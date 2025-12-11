"""
PostgreSQL Database Module for Parent Document Storage (Neon)
=============================================================
Provides persistent storage for parent documents with async support.
Uses SQLAlchemy async with asyncpg driver for Neon PostgreSQL.
"""

import os
import json
import logging
from typing import Optional, Dict, Any, List
from contextlib import asynccontextmanager

from sqlalchemy import String, Text, DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from langchain_core.documents import Document

from src.core.config import get_settings

logger = logging.getLogger(__name__)


# =============================================================================
# DATABASE MODELS
# =============================================================================

class Base(DeclarativeBase):
    pass


class ParentDocumentModel(Base):
    """SQLAlchemy model for parent documents."""
    __tablename__ = "parent_documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    metadata_json: Mapped[str] = mapped_column(Text, nullable=False)  # JSON serialized
    team: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())


# =============================================================================
# DATABASE CONNECTION
# =============================================================================

class PostgresConnection:
    """Manages PostgreSQL connection pool and sessions."""
    
    _instance: Optional["PostgresConnection"] = None
    _engine = None
    _session_factory = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    async def initialize(self):
        """Initialize the database connection and create tables."""
        if self._engine is not None:
            return
            
        settings = get_settings()
        database_url = settings.DATABASE_URL
        
        if not database_url:
            raise ValueError("DATABASE_URL is not set in environment variables")
        
        # Convert to async URL format
        if database_url.startswith("postgresql://"):
            database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
        
        logger.info(f"🔌 Connecting to PostgreSQL (Neon)...")
        
        self._engine = create_async_engine(
            database_url,
            pool_size=5,
            max_overflow=10,
            pool_pre_ping=True,
            echo=False
        )
        
        self._session_factory = async_sessionmaker(
            self._engine,
            class_=AsyncSession,
            expire_on_commit=False
        )
        
        # Create tables
        async with self._engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        
        logger.info("✅ PostgreSQL connection established and tables created!")
    
    @asynccontextmanager
    async def session(self):
        """Get an async database session."""
        if self._session_factory is None:
            await self.initialize()
        
        async with self._session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise


# =============================================================================
# PARENT DOCUMENT STORE
# =============================================================================

class ParentDocumentStore:
    """
    Persistent store for parent documents using PostgreSQL.
    Replaces langchain's InMemoryStore for production use.
    """
    
    def __init__(self):
        self.db = PostgresConnection()
        self._initialized = False
    
    async def _ensure_initialized(self):
        """Ensure database is initialized."""
        if not self._initialized:
            await self.db.initialize()
            self._initialized = True
    
    async def store(self, parent_id: str, document: Document, team: str):
        """
        Store a parent document in the database.
        
        Args:
            parent_id: Unique identifier for the parent document
            document: LangChain Document object
            team: Team/collection name
        """
        await self._ensure_initialized()
        
        async with self.db.session() as session:
            # Check if exists, update if so
            from sqlalchemy import select
            stmt = select(ParentDocumentModel).where(ParentDocumentModel.id == parent_id)
            result = await session.execute(stmt)
            existing = result.scalar_one_or_none()
            
            metadata_json = json.dumps(document.metadata)
            
            if existing:
                existing.content = document.page_content
                existing.metadata_json = metadata_json
                existing.team = team
            else:
                new_doc = ParentDocumentModel(
                    id=parent_id,
                    content=document.page_content,
                    metadata_json=metadata_json,
                    team=team
                )
                session.add(new_doc)
        
        logger.debug(f"📝 Stored parent document: {parent_id}")
    
    async def store_batch(self, documents: List[tuple], team: str):
        """
        Store multiple parent documents in a single transaction.
        
        Args:
            documents: List of (parent_id, Document) tuples
            team: Team/collection name
        """
        await self._ensure_initialized()
        
        async with self.db.session() as session:
            for parent_id, document in documents:
                metadata_json = json.dumps(document.metadata)
                new_doc = ParentDocumentModel(
                    id=parent_id,
                    content=document.page_content,
                    metadata_json=metadata_json,
                    team=team
                )
                session.add(new_doc)
        
        logger.info(f"📝 Stored {len(documents)} parent documents to PostgreSQL")
    
    async def get(self, parent_id: str) -> Optional[Document]:
        """
        Retrieve a parent document by ID.
        
        Args:
            parent_id: The unique identifier
            
        Returns:
            Document object or None if not found
        """
        await self._ensure_initialized()
        
        async with self.db.session() as session:
            from sqlalchemy import select
            stmt = select(ParentDocumentModel).where(ParentDocumentModel.id == parent_id)
            result = await session.execute(stmt)
            row = result.scalar_one_or_none()
            
            if row:
                metadata = json.loads(row.metadata_json)
                return Document(page_content=row.content, metadata=metadata)
            
            return None
    
    async def delete_by_team(self, team: str) -> int:
        """
        Delete all parent documents for a team.
        
        Args:
            team: Team/collection name
            
        Returns:
            Number of documents deleted
        """
        await self._ensure_initialized()
        
        async with self.db.session() as session:
            from sqlalchemy import delete
            stmt = delete(ParentDocumentModel).where(ParentDocumentModel.team == team)
            result = await session.execute(stmt)
            deleted_count = result.rowcount
            
        logger.info(f"🗑️ Deleted {deleted_count} parent documents for team: {team}")
        return deleted_count
    
    async def delete_by_filename(self, team: str, filename: str) -> int:
        """
        Delete parent documents for a specific file.
        
        Args:
            team: Team/collection name
            filename: Source filename to delete
            
        Returns:
            Number of documents deleted
        """
        await self._ensure_initialized()
        
        async with self.db.session() as session:
            from sqlalchemy import select, delete
            
            # Get all documents for this team and filter by filename in metadata
            stmt = select(ParentDocumentModel).where(ParentDocumentModel.team == team)
            result = await session.execute(stmt)
            docs = result.scalars().all()
            
            deleted_ids = []
            for doc in docs:
                metadata = json.loads(doc.metadata_json)
                if metadata.get("file_name") == filename or metadata.get("source") == filename:
                    deleted_ids.append(doc.id)
            
            if deleted_ids:
                stmt = delete(ParentDocumentModel).where(ParentDocumentModel.id.in_(deleted_ids))
                await session.execute(stmt)
        
        logger.info(f"🗑️ Deleted {len(deleted_ids)} parent documents for file: {filename}")
        return len(deleted_ids)


# =============================================================================
# SINGLETON ACCESSOR
# =============================================================================

_parent_store: Optional[ParentDocumentStore] = None


def get_parent_store() -> ParentDocumentStore:
    """Get or create the singleton parent document store."""
    global _parent_store
    if _parent_store is None:
        _parent_store = ParentDocumentStore()
    return _parent_store
