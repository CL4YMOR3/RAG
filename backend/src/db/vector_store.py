import logging
from llama_index.core import StorageContext
from llama_index.vector_stores.qdrant import QdrantVectorStore
from qdrant_client import QdrantClient, AsyncQdrantClient
from src.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

def get_vector_store(collection_name: str) -> QdrantVectorStore:
    """
    Creates or retrieves a QdrantVectorStore instance for the given collection (team).
    """
    logger.info(f"Connecting to Qdrant at {settings.QDRANT_HOST}:{settings.QDRANT_PORT}")
    
    client = QdrantClient(
        host=settings.QDRANT_HOST, 
        port=settings.QDRANT_PORT,
        url=settings.QDRANT_URL,
        api_key=settings.QDRANT_API_KEY
    )
    
    aclient = AsyncQdrantClient(
        host=settings.QDRANT_HOST, 
        port=settings.QDRANT_PORT,
        url=settings.QDRANT_URL,
        api_key=settings.QDRANT_API_KEY
    )
    
    vector_store = QdrantVectorStore(
        client=client, 
        aclient=aclient,
        collection_name=collection_name
    )
    
    return vector_store

def get_storage_context(vector_store: QdrantVectorStore) -> StorageContext:
    return StorageContext.from_defaults(vector_store=vector_store)
