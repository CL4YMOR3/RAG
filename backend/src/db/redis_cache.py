"""
Redis Cache Module for HO RAG Backend
======================================
Provides:
- Parent document caching (write-through cache)
- Session memory storage (replaces in-memory SessionMemoryStore)
- TTL-based expiration for automatic cleanup
"""

import json
import logging
from typing import Optional, Dict, List, Any

import redis.asyncio as redis
from langchain_core.documents import Document

from src.core.config import get_settings

logger = logging.getLogger(__name__)


# =============================================================================
# REDIS CONNECTION
# =============================================================================

class RedisConnection:
    """Manages Redis connection pool."""
    
    _instance: Optional["RedisConnection"] = None
    _pool: Optional[redis.ConnectionPool] = None
    _client: Optional[redis.Redis] = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    async def get_client(self) -> redis.Redis:
        """Get or create Redis client."""
        if self._client is None:
            settings = get_settings()
            
            logger.info(f"🔌 Connecting to Redis at {settings.REDIS_URL}...")
            
            self._pool = redis.ConnectionPool.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                max_connections=10
            )
            self._client = redis.Redis(connection_pool=self._pool)
            
            # Test connection
            await self._client.ping()
            logger.info("✅ Redis connection established!")
        
        return self._client
    
    async def close(self):
        """Close Redis connection."""
        if self._client:
            await self._client.close()
            self._client = None
        if self._pool:
            await self._pool.disconnect()
            self._pool = None


# =============================================================================
# PARENT DOCUMENT CACHE
# =============================================================================

class ParentDocumentCache:
    """
    Redis cache for parent documents.
    Implements write-through caching strategy.
    """
    
    PREFIX = "parent_doc:"
    
    def __init__(self):
        self.redis_conn = RedisConnection()
        self.settings = get_settings()
    
    async def get(self, parent_id: str) -> Optional[Document]:
        """
        Get a parent document from cache.
        
        Args:
            parent_id: Unique identifier
            
        Returns:
            Document object or None if not in cache
        """
        client = await self.redis_conn.get_client()
        key = f"{self.PREFIX}{parent_id}"
        
        data = await client.get(key)
        if data:
            parsed = json.loads(data)
            return Document(
                page_content=parsed["content"],
                metadata=parsed["metadata"]
            )
        
        return None
    
    async def set(self, parent_id: str, document: Document):
        """
        Cache a parent document.
        
        Args:
            parent_id: Unique identifier
            document: LangChain Document object
        """
        client = await self.redis_conn.get_client()
        key = f"{self.PREFIX}{parent_id}"
        
        data = json.dumps({
            "content": document.page_content,
            "metadata": document.metadata
        })
        
        await client.setex(key, self.settings.REDIS_CACHE_TTL, data)
    
    async def set_batch(self, documents: List[tuple]):
        """
        Cache multiple parent documents.
        
        Args:
            documents: List of (parent_id, Document) tuples
        """
        client = await self.redis_conn.get_client()
        
        pipe = client.pipeline()
        for parent_id, document in documents:
            key = f"{self.PREFIX}{parent_id}"
            data = json.dumps({
                "content": document.page_content,
                "metadata": document.metadata
            })
            pipe.setex(key, self.settings.REDIS_CACHE_TTL, data)
        
        await pipe.execute()
        logger.info(f"📦 Cached {len(documents)} parent documents in Redis")
    
    async def delete(self, parent_id: str):
        """Delete a parent document from cache."""
        client = await self.redis_conn.get_client()
        key = f"{self.PREFIX}{parent_id}"
        await client.delete(key)
    
    async def delete_pattern(self, pattern: str):
        """Delete all keys matching a pattern."""
        client = await self.redis_conn.get_client()
        
        cursor = 0
        while True:
            cursor, keys = await client.scan(cursor, match=f"{self.PREFIX}{pattern}")
            if keys:
                await client.delete(*keys)
            if cursor == 0:
                break


# =============================================================================
# SESSION MEMORY STORE (REDIS)
# =============================================================================

class RedisSessionStore:
    """
    Redis-backed session storage for chat history.
    Replaces the in-memory SessionMemoryStore.
    """
    
    PREFIX = "session:"
    
    def __init__(self):
        self.redis_conn = RedisConnection()
        self.settings = get_settings()
    
    async def get_history(self, session_id: str) -> List[Dict[str, str]]:
        """Get chat history for a session."""
        client = await self.redis_conn.get_client()
        key = f"{self.PREFIX}{session_id}"
        
        data = await client.get(key)
        if data:
            return json.loads(data)
        return []
    
    async def add_message(self, session_id: str, role: str, content: str):
        """Add a message to session history."""
        client = await self.redis_conn.get_client()
        key = f"{self.PREFIX}{session_id}"
        
        # Get existing history
        history = await self.get_history(session_id)
        
        # Add new message
        history.append({"role": role, "content": content})
        
        # Keep only last 20 messages
        if len(history) > 20:
            history = history[-20:]
        
        # Save with TTL
        await client.setex(key, self.settings.REDIS_SESSION_TTL, json.dumps(history))
    
    async def clear_session(self, session_id: str):
        """Clear a session's history."""
        client = await self.redis_conn.get_client()
        key = f"{self.PREFIX}{session_id}"
        await client.delete(key)
    
    async def format_history(self, session_id: str) -> str:
        """Format history as string for prompts."""
        history = await self.get_history(session_id)
        
        if not history:
            return "No previous conversation."
        
        formatted = []
        for msg in history[-6:]:  # Last 6 messages for context
            role = "User" if msg["role"] == "user" else "Assistant"
            formatted.append(f"{role}: {msg['content']}")
        
        return "\n".join(formatted)
    
    # Sync wrappers for backwards compatibility
    def get_history_sync(self, session_id: str) -> List[Dict[str, str]]:
        """Synchronous wrapper - returns empty list, async method preferred."""
        import asyncio
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # Can't use asyncio.run in running loop
                return []
            return loop.run_until_complete(self.get_history(session_id))
        except RuntimeError:
            return []
    
    def format_history_sync(self, session_id: str) -> str:
        """Synchronous wrapper for format_history."""
        import asyncio
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                return "No previous conversation."
            return loop.run_until_complete(self.format_history(session_id))
        except RuntimeError:
            return "No previous conversation."


# =============================================================================
# SINGLETON ACCESSORS
# =============================================================================

_parent_cache: Optional[ParentDocumentCache] = None
_session_store: Optional[RedisSessionStore] = None


def get_parent_cache() -> ParentDocumentCache:
    """Get or create singleton parent document cache."""
    global _parent_cache
    if _parent_cache is None:
        _parent_cache = ParentDocumentCache()
    return _parent_cache


def get_session_store() -> RedisSessionStore:
    """Get or create singleton session store."""
    global _session_store
    if _session_store is None:
        _session_store = RedisSessionStore()
    return _session_store
