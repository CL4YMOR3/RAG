import os
import uuid
import tempfile
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

# Document Loading
from llama_index.core import SimpleDirectoryReader

# Embeddings (CPU-optimized)
from langchain_huggingface import HuggingFaceEmbeddings
from fastembed import SparseTextEmbedding

# Text Splitting with Parent-Child Strategy
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document

# Database & Cache
from src.db.postgres import get_parent_store, ParentDocumentStore
from src.db.redis_cache import get_parent_cache, ParentDocumentCache

# Qdrant
from qdrant_client import QdrantClient
from qdrant_client.models import (
    VectorParams, 
    SparseVectorParams,
    Distance,
    PointStruct,
    SparseVector,
    NamedVector,
    NamedSparseVector
)

from src.core.config import get_settings

logger = logging.getLogger(__name__)

# =============================================================================
# CONFIGURATION
# =============================================================================

@dataclass
class HybridConfig:
    """Configuration for hybrid ingestion pipeline."""
    # Dense Embeddings (Semantic Search)
    dense_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    dense_dimension: int = 384
    
    # Sparse Embeddings (Keyword Search) - Using Qdrant's optimized pruned SPLADE
    sparse_model: str = "Qdrant/bm42-all-minilm-l6-v2-attentions"  # Lighter than full SPLADE
    
    # Parent-Child Chunking
    parent_chunk_size: int = 2000
    parent_chunk_overlap: int = 200
    child_chunk_size: int = 400
    child_chunk_overlap: int = 50
    
    # Device - CPU for embeddings to protect VRAM
    device: str = "cpu"


# =============================================================================
# HYBRID INGESTION SERVICE
# =============================================================================

class HybridIngestionService:
    """
    Enterprise-grade hybrid ingestion service with:
    - Dense + Sparse vector indexing
    - Parent-Child document hierarchy
    - Multi-format document support
    """
    
    def __init__(self, config: Optional[HybridConfig] = None):
        self.config = config or HybridConfig()
        self.settings = get_settings()
        
        logger.info("🚀 Initializing Hybrid Ingestion Service...")
        
        # Initialize Dense Embeddings (Semantic - CPU)
        logger.info(f"Loading Dense Embeddings: {self.config.dense_model} (device={self.config.device})")
        self.dense_embedder = HuggingFaceEmbeddings(
            model_name=self.config.dense_model,
            model_kwargs={"device": self.config.device},
            encode_kwargs={"normalize_embeddings": True}
        )
        
        # Initialize Sparse Embeddings (Keyword - CPU)
        logger.info(f"Loading Sparse Embeddings: {self.config.sparse_model}")
        self.sparse_embedder = SparseTextEmbedding(
            model_name=self.config.sparse_model,
            # FastEmbed uses CPU by default
        )
        
        # Text Splitters for Parent-Child
        self.parent_splitter = RecursiveCharacterTextSplitter(
            chunk_size=self.config.parent_chunk_size,
            chunk_overlap=self.config.parent_chunk_overlap,
            separators=["\n\n", "\n", ". ", " ", ""]
        )
        
        self.child_splitter = RecursiveCharacterTextSplitter(
            chunk_size=self.config.child_chunk_size,
            chunk_overlap=self.config.child_chunk_overlap,
            separators=["\n\n", "\n", ". ", " ", ""]
        )
        
        # Parent Document Storage (PostgreSQL + Redis cache)
        self.parent_store = get_parent_store()
        self.parent_cache = get_parent_cache()
        
        # Qdrant Client
        self.qdrant_client = QdrantClient(
            host=self.settings.QDRANT_HOST,
            port=self.settings.QDRANT_PORT,
            url=self.settings.QDRANT_URL,
            api_key=self.settings.QDRANT_API_KEY
        )
        
        logger.info("✅ Hybrid Ingestion Service initialized successfully!")

    def _ensure_collection_exists(self, collection_name: str):
        """
        Create Qdrant collection with both dense and sparse vector configurations.
        Uses named vectors for hybrid search.
        """
        collections = [c.name for c in self.qdrant_client.get_collections().collections]
        
        if collection_name not in collections:
            logger.info(f"📦 Creating new hybrid collection: {collection_name}")
            
            self.qdrant_client.create_collection(
                collection_name=collection_name,
                vectors_config={
                    "dense": VectorParams(
                        size=self.config.dense_dimension,
                        distance=Distance.COSINE
                    )
                },
                sparse_vectors_config={
                    "sparse": SparseVectorParams()
                }
            )
            logger.info(f"✅ Collection '{collection_name}' created with hybrid vectors!")
        else:
            logger.info(f"📁 Collection '{collection_name}' already exists")

    def _extract_metadata(self, doc: Any, filename: str) -> Dict[str, Any]:
        """Extract rich metadata from document."""
        metadata = {
            "source": filename,
            "file_name": filename,
        }
        
        # Extract page number if available (from PDF)
        if hasattr(doc, 'metadata'):
            if 'page_label' in doc.metadata:
                metadata["page"] = doc.metadata['page_label']
            elif 'page' in doc.metadata:
                metadata["page"] = doc.metadata['page']
            
            # Copy other useful metadata
            for key in ['creation_date', 'author', 'title']:
                if key in doc.metadata:
                    metadata[key] = doc.metadata[key]
        
        return metadata

    def _create_parent_child_chunks(
        self, 
        documents: List[Any], 
        filename: str,
        team: str
    ) -> tuple[List[Document], Dict[str, Document]]:
        """
        Create parent-child document hierarchy.
        
        Returns:
            - children: List of child chunks for indexing
            - parents: Dict mapping parent_id to parent document
        """
        parents = {}
        children = []
        
        for doc in documents:
            # Extract text content
            text = doc.get_content() if hasattr(doc, 'get_content') else str(doc)
            base_metadata = self._extract_metadata(doc, filename)
            base_metadata["team"] = team
            
            # Create parent chunks
            parent_texts = self.parent_splitter.split_text(text)
            
            for parent_idx, parent_text in enumerate(parent_texts):
                parent_id = str(uuid.uuid4())
                
                parent_metadata = {
                    **base_metadata,
                    "parent_id": parent_id,
                    "chunk_type": "parent",
                    "parent_index": parent_idx
                }
                
                parent_doc = Document(
                    page_content=parent_text,
                    metadata=parent_metadata
                )
                parents[parent_id] = parent_doc
                
                # Create child chunks from this parent
                child_texts = self.child_splitter.split_text(parent_text)
                
                for child_idx, child_text in enumerate(child_texts):
                    child_metadata = {
                        **base_metadata,
                        "parent_id": parent_id,
                        "chunk_type": "child",
                        "child_index": child_idx,
                        "parent_index": parent_idx
                    }
                    
                    child_doc = Document(
                        page_content=child_text,
                        metadata=child_metadata
                    )
                    children.append(child_doc)
        
        logger.info(f"📄 Created {len(parents)} parents, {len(children)} children")
        return children, parents

    def _generate_embeddings(self, texts: List[str]) -> tuple[List[List[float]], List[SparseVector]]:
        """
        Generate both dense and sparse embeddings for texts.
        
        Returns:
            - dense_vectors: List of dense embedding vectors
            - sparse_vectors: List of SparseVector objects
        """
        logger.info(f"🔢 Generating embeddings for {len(texts)} chunks...")
        
        # Dense embeddings (batched)
        dense_vectors = self.dense_embedder.embed_documents(texts)
        
        # Sparse embeddings (returns generator)
        sparse_embeddings = list(self.sparse_embedder.embed(texts))
        sparse_vectors = [
            SparseVector(
                indices=emb.indices.tolist(),
                values=emb.values.tolist()
            )
            for emb in sparse_embeddings
        ]
        
        logger.info("✅ Embeddings generated successfully!")
        return dense_vectors, sparse_vectors

    def _index_to_qdrant(
        self,
        collection_name: str,
        children: List[Document],
        dense_vectors: List[List[float]],
        sparse_vectors: List[SparseVector]
    ):
        """Index child chunks with hybrid vectors into Qdrant."""
        points = []
        
        for idx, (child, dense_vec, sparse_vec) in enumerate(
            zip(children, dense_vectors, sparse_vectors)
        ):
            point = PointStruct(
                id=str(uuid.uuid4()),
                vector={
                    "dense": dense_vec,
                    "sparse": sparse_vec
                },
                payload={
                    "text": child.page_content,
                    **child.metadata
                }
            )
            points.append(point)
        
        # Batch upsert
        batch_size = 100
        for i in range(0, len(points), batch_size):
            batch = points[i:i + batch_size]
            self.qdrant_client.upsert(
                collection_name=collection_name,
                points=batch
            )
            logger.info(f"📤 Indexed batch {i//batch_size + 1}/{(len(points)-1)//batch_size + 1}")
        
        logger.info(f"✅ Indexed {len(points)} chunks to collection '{collection_name}'")

    async def ingest_file(
        self, 
        file_stream, 
        filename: str, 
        team: str, 
        chunking_strategy: str = "hybrid"  # Kept for API compatibility
    ) -> Dict[str, Any]:
        """
        Main ingestion method - processes file and indexes with hybrid vectors.
        
        Args:
            file_stream: File upload stream
            filename: Original filename
            team: Team/collection name
            chunking_strategy: Ignored - always uses hybrid strategy
            
        Returns:
            Dict with ingestion results
        """
        logger.info(f"📥 Starting hybrid ingestion: {filename} → Team: {team}")
        
        # Ensure collection exists with hybrid config
        self._ensure_collection_exists(team)
        
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_file_path = os.path.join(temp_dir, filename)
            
            # Write uploaded content
            content = await file_stream.read()
            with open(temp_file_path, "wb") as f:
                f.write(content)
            
            # Load documents using LlamaIndex (supports many formats)
            reader = SimpleDirectoryReader(input_files=[temp_file_path])
            documents = reader.load_data()
            
            logger.info(f"📖 Loaded {len(documents)} document(s) from {filename}")
        
        # Create parent-child hierarchy
        children, parents = self._create_parent_child_chunks(documents, filename, team)
        
        if not children:
            raise ValueError(f"No content extracted from {filename}")
        
        # Store parents in PostgreSQL and cache in Redis
        parent_items = list(parents.items())
        await self.parent_store.store_batch(parent_items, team)
        await self.parent_cache.set_batch(parent_items)
        
        # Generate hybrid embeddings
        child_texts = [c.page_content for c in children]
        dense_vectors, sparse_vectors = self._generate_embeddings(child_texts)
        
        # Index to Qdrant
        self._index_to_qdrant(team, children, dense_vectors, sparse_vectors)
        
        result = {
            "status": "success",
            "filename": filename,
            "team": team,
            "parent_chunks": len(parents),
            "child_chunks": len(children),
            "indexing_mode": "hybrid (dense + sparse)"
        }
        
        logger.info(f"🎉 Ingestion complete: {result}")
        return result

    async def get_parent_document(self, parent_id: str) -> Optional[Document]:
        """Retrieve a parent document by ID (cache-first, fallback to PostgreSQL)."""
        # Try cache first
        cached = await self.parent_cache.get(parent_id)
        if cached:
            return cached
        
        # Fallback to PostgreSQL
        doc = await self.parent_store.get(parent_id)
        if doc:
            # Populate cache for next time
            await self.parent_cache.set(parent_id, doc)
        
        return doc


# =============================================================================
# SINGLETON INSTANCE (for use in API)
# =============================================================================

# Global service instance
_ingestion_service: Optional[HybridIngestionService] = None

def get_ingestion_service() -> HybridIngestionService:
    """Get or create the singleton ingestion service."""
    global _ingestion_service
    if _ingestion_service is None:
        _ingestion_service = HybridIngestionService()
    return _ingestion_service


# =============================================================================
# BACKWARDS COMPATIBILITY WRAPPER
# =============================================================================

class IngestionService:
    """
    Backwards-compatible wrapper for the API.
    Delegates to HybridIngestionService.
    """
    
    def __init__(self):
        self._hybrid_service = get_ingestion_service()
    
    async def ingest_file(
        self, 
        file_stream, 
        filename: str, 
        team: str, 
        chunking_strategy: str = "hybrid"
    ) -> Dict[str, Any]:
        """Ingest file using hybrid pipeline."""
        return await self._hybrid_service.ingest_file(
            file_stream, 
            filename, 
            team, 
            chunking_strategy
        )
    
    async def get_parent_document(self, parent_id: str) -> Optional[Document]:
        """Get parent document for context expansion."""
        return await self._hybrid_service.get_parent_document(parent_id)
