import os
import argparse
from pathlib import Path
import datetime
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document
from langchain_community.embeddings import SentenceTransformerEmbeddings
from io import BytesIO
from PyPDF2 import PdfReader
import magic
from unstructured.partition.auto import partition
import docx

# ---------- CONFIG ---------- #
EMBED_MODEL = "all-MiniLM-L6-v2"
INDEX_DIR = "indexes"
CHUNK_SIZE = 800
CHUNK_OVERLAP = 100
# ---------------------------- #

def load_document(file_source: object, source_filename: str) -> Document:
    """Loads a document from a file-like object and returns a Document object."""
    file_extension = Path(source_filename).suffix.lower()
    metadata = {
        "source": source_filename,
        "ingestion_datetime": datetime.datetime.utcnow().isoformat()
    }
    text = ""

    # Use unstructured to partition the document from the file-like object
    try:
        # Read the file stream into a BytesIO object to make it seekable for `unstructured`
        file_content = file_source.read()
        # Use libmagic to determine the content type
        mime_type = magic.from_buffer(file_content, mime=True)
        
        elements = partition(file=BytesIO(file_content), file_filename=source_filename, content_type=mime_type)
        text = "\n\n".join([str(el) for el in elements])
        return Document(page_content=text, metadata=metadata)
    except Exception as e:
        raise ValueError(f"Failed to load or parse {source_filename}: {e}") from e

def chunk_text(text):
    """DEPRECATED: Split text into overlapping chunks without metadata."""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP
    )
    chunks = splitter.split_text(text)
    return [Document(page_content=c) for c in chunks]

def chunk_documents(documents):
    """Split documents into overlapping chunks."""
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP)
    return text_splitter.split_documents(documents)

def build_embeddings(chunks, index_path):
    """Create embeddings and store in FAISS index."""
    embeddings_model = SentenceTransformerEmbeddings(model_name=EMBED_MODEL)
    # Save FAISS index
    db = FAISS.from_documents(chunks, embeddings_model)
    db.save_local(index_path)
    print(f"✅ Index saved at {index_path}")

def ingest(file_source: str | object, team: str, source_filename: str):
    """
    Main ingestion function.
    Processes a file from a path or a file-like object, chunks it, and builds an embedding index.
    """
    # Load the document based on its file type
    doc = load_document(file_source, source_filename)
    chunked_docs = chunk_documents([doc])

    Path(INDEX_DIR).mkdir(exist_ok=True)
    index_path = os.path.join(INDEX_DIR, f"{team.lower()}_index")

    build_embeddings(chunked_docs, index_path)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ingest documents for RAG system")
    parser.add_argument("file_path", help="Path to the document (PDF or text)")
    parser.add_argument("--team", required=True, help="Team or category name")
    args = parser.parse_args()
    
    ingest(args.file_path, args.team, Path(args.file_path).name)
