from fastapi import FastAPI, UploadFile, Form, Query, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from pathlib import Path
from src.services.ingestion import IngestionService
from src.services.query import QueryService
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import json
import logging
import re

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="HO RAG System")

# --- Supported File Extensions ---
SUPPORTED_EXTENSIONS = {
    ".pdf": "PDF",
    ".docx": "Microsoft Word",
    ".doc": "Microsoft Word (Legacy)",
    ".txt": "Plain Text",
    ".md": "Markdown",
    ".csv": "CSV",
    ".xlsx": "Microsoft Excel",
    ".xls": "Microsoft Excel (Legacy)",
    ".pptx": "Microsoft PowerPoint",
    ".ppt": "Microsoft PowerPoint (Legacy)",
    ".html": "HTML",
    ".htm": "HTML",
    ".epub": "EPUB",
    ".rtf": "Rich Text Format",
    ".json": "JSON",
}

# --- Error Response Helper ---
def create_error_response(status_code: int, error_type: str, message: str, details: str = None, suggestion: str = None):
    """Creates a standardized error response."""
    content = {
        "status": "error",
        "error_type": error_type,
        "message": message,
    }
    if details:
        content["details"] = details
    if suggestion:
        content["suggestion"] = suggestion
    return JSONResponse(status_code=status_code, content=content)

# --- Error Classification ---
def classify_and_respond_to_error(e: Exception, context: str = "operation"):
    """
    Classifies an exception and returns a user-friendly error response.
    """
    error_str = str(e).lower()
    original_error = str(e)

    # 1. Missing Dependency Errors
    dependency_match = re.search(r"no module named ['\"]?(\w+)['\"]?", error_str)
    if dependency_match or "is required" in error_str:
        missing_lib = dependency_match.group(1) if dependency_match else "a required library"
        return create_error_response(
            status_code=503,
            error_type="MISSING_DEPENDENCY",
            message=f"The server is missing a required library to process this file.",
            details=original_error,
            suggestion=f"Please ask your administrator to install the missing library (e.g., `pip install {missing_lib}`) and restart the server."
        )

    # 2. Unsupported File Type
    if "unsupported file type" in error_str or "no reader available" in error_str:
        return create_error_response(
            status_code=415,
            error_type="UNSUPPORTED_FILE_TYPE",
            message="This file type is not supported for ingestion.",
            details=original_error,
            suggestion=f"Supported types: {', '.join(SUPPORTED_EXTENSIONS.values())}."
        )

    # 3. Database Connection Errors (Qdrant)
    if "connection refused" in error_str or "qdrant" in error_str and ("connect" in error_str or "refused" in error_str):
        return create_error_response(
            status_code=503,
            error_type="DATABASE_CONNECTION_ERROR",
            message="Could not connect to the vector database (Qdrant).",
            details=original_error,
            suggestion="Ensure that the Qdrant server is running (e.g., `docker run -p 6333:6333 qdrant/qdrant`)."
        )
    
    # 4. Empty or Corrupt File
    if "empty" in error_str or "no text" in error_str or "could not parse" in error_str:
        return create_error_response(
            status_code=400,
            error_type="INVALID_FILE_CONTENT",
            message="The uploaded file appears to be empty or could not be parsed.",
            details=original_error,
            suggestion="Please check if the file contains readable content and try again."
        )

    # 5. File Too Large (if applicable)
    if "too large" in error_str or "memory" in error_str:
        return create_error_response(
            status_code=413,
            error_type="FILE_TOO_LARGE",
            message="The uploaded file is too large to process.",
            details=original_error,
            suggestion="Try splitting the document into smaller parts."
        )

    # 6. Collection/Team Not Found
    if "collection" in error_str and "not found" in error_str:
        return create_error_response(
            status_code=404,
            error_type="COLLECTION_NOT_FOUND",
            message=f"The knowledge base (team) was not found.",
            details=original_error,
            suggestion="Please ingest a document into this team first to create its knowledge base."
        )

    # Default: Generic Server Error
    return create_error_response(
        status_code=500,
        error_type="INTERNAL_SERVER_ERROR",
        message=f"An unexpected error occurred during {context}.",
        details=original_error,
        suggestion="Please check the server logs for more details or contact support."
    )


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://192.168.1.175:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Base directories
DATA_DIR = Path("data")
INDEX_DIR = Path("indexes")

# Ensure base directories exist
DATA_DIR.mkdir(exist_ok=True)
INDEX_DIR.mkdir(exist_ok=True)

ingestion_service = IngestionService()
query_service = QueryService()

@app.post("/ingest/")
async def ingest_file(
    file: UploadFile, 
    team: str = Form(...),
    chunking_strategy: str = Form("window", description="Strategy: 'window' or 'semantic'")
):
    """
    Upload a document and ingest it into the Qdrant vector database.
    Now supports scalable ingestion and different chunking strategies.
    """
    # Validate file extension before processing
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in SUPPORTED_EXTENSIONS:
        return create_error_response(
            status_code=415,
            error_type="UNSUPPORTED_FILE_TYPE",
            message=f"The file type '{file_ext}' is not supported.",
            suggestion=f"Supported file types: {', '.join(SUPPORTED_EXTENSIONS.keys())}"
        )

    try:
        result = await ingestion_service.ingest_file(
            file_stream=file,
            filename=file.filename,
            team=team,
            chunking_strategy=chunking_strategy
        )
        return {"status": "success", "message": f"Successfully ingested {file.filename}", "details": result}
    except Exception as e:
        logger.error(f"Ingestion error: {e}")
        import traceback
        traceback.print_exc()
        return classify_and_respond_to_error(e, context="file ingestion")


@app.post("/query/")
async def query_team(query: str = Form(...), team: str = Form(...), session_id: str = Form(None)):
    """Query a specific team index and return answer + provenance."""
    try:
        # Generate a temporary session ID if not provided (stateless fallback)
        if not session_id:
            session_id = "temp_session"
            
        result = await query_service.query(query, team, session_id)

        # Convert any numpy types to native Python equivalents (just in case)
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
        logger.error(f"Query error: {e}")
        return classify_and_respond_to_error(e, context="querying the knowledge base")

@app.post("/query/stream")
async def query_team_stream(query: str = Form(...), team: str = Form(...), session_id: str = Form(None)):
    """Query a team index and stream the answer token by token."""
    try:
        if not session_id:
            session_id = "temp_session"

        async def stream_generator():
            async for chunk in query_service.stream_query(query, team, session_id):
                yield chunk

        return StreamingResponse(stream_generator(), media_type="text/event-stream")

    except Exception as e:
        logger.error(f"Stream query error: {e}")
        return classify_and_respond_to_error(e, context="streaming query")

@app.delete("/session/{session_id}")
async def delete_session(session_id: str):
    """Clear the conversational memory for a given session_id."""
    try:
        await query_service.clear_session(session_id)
        return {"status": "success", "message": f"Memory for session {session_id} cleared."}
    except Exception as e:
        return classify_and_respond_to_error(e, context="clearing session memory")


# =============================================================================
# TEAM MANAGEMENT ENDPOINTS
# =============================================================================

@app.get("/teams/")
def list_teams():
    """
    List all available teams (Qdrant collections).
    Returns a list of team names that have been created via document ingestion.
    """
    try:
        from qdrant_client import QdrantClient
        from src.core.config import get_settings
        
        settings = get_settings()
        client = QdrantClient(
            host=settings.QDRANT_HOST,
            port=settings.QDRANT_PORT,
            url=settings.QDRANT_URL,
            api_key=settings.QDRANT_API_KEY
        )
        
        collections = client.get_collections().collections
        teams = [col.name for col in collections]
        
        return {
            "status": "success",
            "teams": teams,
            "count": len(teams)
        }
    except Exception as e:
        logger.error(f"Error listing teams: {e}")
        return classify_and_respond_to_error(e, context="listing teams")


@app.get("/teams/{team}/documents")
def list_team_documents(team: str):
    """
    List all documents that have been ingested into a specific team's knowledge base.
    Returns unique filenames and document counts.
    """
    try:
        from qdrant_client import QdrantClient
        from src.core.config import get_settings
        
        settings = get_settings()
        client = QdrantClient(
            host=settings.QDRANT_HOST,
            port=settings.QDRANT_PORT,
            url=settings.QDRANT_URL,
            api_key=settings.QDRANT_API_KEY
        )
        
        # Check if collection exists
        collections = [col.name for col in client.get_collections().collections]
        if team not in collections:
            return create_error_response(
                status_code=404,
                error_type="TEAM_NOT_FOUND",
                message=f"Team '{team}' does not exist.",
                suggestion="Please ingest a document to create this team's knowledge base."
            )
        
        # Get collection info
        collection_info = client.get_collection(collection_name=team)
        total_points = collection_info.points_count
        
        # Scroll through all points to get unique filenames
        # Note: For very large collections, this should be paginated
        documents = {}
        offset = None
        
        while True:
            results, next_offset = client.scroll(
                collection_name=team,
                limit=100,
                offset=offset,
                with_payload=True,
                with_vectors=False
            )
            
            for point in results:
                filename = point.payload.get("file_name", "Unknown")
                if filename in documents:
                    documents[filename]["chunks"] += 1
                else:
                    documents[filename] = {
                        "filename": filename,
                        "chunks": 1,
                        "team": point.payload.get("team", team)
                    }
            
            if next_offset is None:
                break
            offset = next_offset
        
        return {
            "status": "success",
            "team": team,
            "total_chunks": total_points,
            "documents": list(documents.values()),
            "document_count": len(documents)
        }
    except Exception as e:
        logger.error(f"Error listing documents for team {team}: {e}")
        return classify_and_respond_to_error(e, context="listing team documents")


@app.delete("/teams/{team}/documents/{filename}")
def delete_document(team: str, filename: str):
    """
    Delete a specific document (all its chunks) from a team's knowledge base.
    """
    try:
        from qdrant_client import QdrantClient
        from qdrant_client.models import Filter, FieldCondition, MatchValue
        from src.core.config import get_settings
        
        settings = get_settings()
        client = QdrantClient(
            host=settings.QDRANT_HOST,
            port=settings.QDRANT_PORT,
            url=settings.QDRANT_URL,
            api_key=settings.QDRANT_API_KEY
        )
        
        # Check if collection exists
        collections = [col.name for col in client.get_collections().collections]
        if team not in collections:
            return create_error_response(
                status_code=404,
                error_type="TEAM_NOT_FOUND",
                message=f"Team '{team}' does not exist.",
                suggestion="Please check the team name and try again."
            )
        
        # Delete points matching the filename
        result = client.delete(
            collection_name=team,
            points_selector=Filter(
                must=[
                    FieldCondition(
                        key="file_name",
                        match=MatchValue(value=filename)
                    )
                ]
            )
        )
        
        logger.info(f"Deleted document '{filename}' from team '{team}'")
        return {
            "status": "success",
            "message": f"Successfully deleted '{filename}' from team '{team}'.",
            "team": team,
            "filename": filename
        }
    except Exception as e:
        logger.error(f"Error deleting document {filename} from team {team}: {e}")
        return classify_and_respond_to_error(e, context="deleting document")


@app.delete("/teams/{team}")
def delete_team(team: str):
    """
    Delete an entire team's knowledge base (Qdrant collection).
    WARNING: This permanently deletes all documents in the team.
    """
    try:
        from qdrant_client import QdrantClient
        from src.core.config import get_settings
        
        settings = get_settings()
        client = QdrantClient(
            host=settings.QDRANT_HOST,
            port=settings.QDRANT_PORT,
            url=settings.QDRANT_URL,
            api_key=settings.QDRANT_API_KEY
        )
        
        # Check if collection exists
        collections = [col.name for col in client.get_collections().collections]
        if team not in collections:
            return create_error_response(
                status_code=404,
                error_type="TEAM_NOT_FOUND",
                message=f"Team '{team}' does not exist.",
                suggestion="Please check the team name and try again."
            )
        
        # Delete the collection
        client.delete_collection(collection_name=team)
        
        logger.info(f"Deleted team/collection '{team}'")
        return {
            "status": "success",
            "message": f"Successfully deleted team '{team}' and all its documents.",
            "team": team
        }
    except Exception as e:
        logger.error(f"Error deleting team {team}: {e}")
        return classify_and_respond_to_error(e, context="deleting team")

