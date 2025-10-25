from fastapi import FastAPI, UploadFile, Form, Query
from fastapi.responses import JSONResponse
from pathlib import Path
from .query import rag_query
from .ingest import ingest
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import os

app = FastAPI(title="HO RAG System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Base directories
DATA_DIR = Path("data")
INDEX_DIR = Path("indexes")

# Ensure base directories exist
DATA_DIR.mkdir(exist_ok=True)
Path("indexes").mkdir(exist_ok=True)


@app.post("/ingest/")
async def ingest_file(file: UploadFile, team: str = Form(...)):
    """Upload a document, save it under the team's folder, and ingest it into the FAISS index."""
    # We will now process the file in-memory instead of saving it to disk first.
    try:
        # The `file` object from UploadFile is a file-like object (stream)
        # We pass it directly to the ingest function.
        ingest(file.file, team, file.filename)
        return {"status": "success", "message": f"{file.filename} ingested for team {team}"}
    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})


@app.post("/query/")
def query_team(query: str = Form(...), team: str = Form(...)):
    """Query a specific team index and return answer + provenance."""
    try:
        result = rag_query(query, team)

        # Convert any numpy types to native Python equivalents
        def convert(obj):
            if isinstance(obj, np.generic):
                return obj.item()
            elif isinstance(obj, dict):
                return {k: convert(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [convert(i) for i in obj]
            return obj

        clean_result = convert(result)
        return clean_result

    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})
