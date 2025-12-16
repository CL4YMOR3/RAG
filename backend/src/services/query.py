"""
=============================================================================
HYBRID QUERY SERVICE
=============================================================================
Features:
- Conversational Memory: Redis-backed session management
- Step A: Query Contextualization (standalone question from history)
- Step B: HyDE - Hypothetical Document Embeddings
- Step C: Hybrid Search (0.7 dense + 0.3 sparse weighted fusion)
- Step D: FlashRank Reranking (CPU-optimized)
- Step E: Citation-enforced Generation with Qwen 2.5 (GPU Acceleration)
- Context Truncation: 2500 tokens max before LLM
=============================================================================
"""

import logging
import json
from typing import Dict, List, Optional, Any, AsyncGenerator
from dataclasses import dataclass

# Embeddings (CPU)
from langchain_huggingface import HuggingFaceEmbeddings
from fastembed import SparseTextEmbedding

# Reranking (CPU)
from flashrank import Ranker, RerankRequest

# Qdrant
from qdrant_client import QdrantClient
from qdrant_client.models import (
    SparseVector,
    Prefetch,
    FusionQuery
)

# Core Imports
from llama_index.core.llms import ChatMessage, MessageRole
from llama_index.embeddings.huggingface import HuggingFaceEmbedding

# INTERNAL IMPORTS
from src.core.config import get_settings
from src.services.llm import LLMService  # <--- NEW GPU BRIDGE
from src.services.ingestion import get_ingestion_service
from src.services.router import SemanticRouter
from src.services.guardrails import PromptGuardrails, validate_input
from src.db.redis_cache import get_session_store

logger = logging.getLogger(__name__)

# =============================================================================
# CONFIGURATION
# =============================================================================

@dataclass
class HybridQueryConfig:
    """Configuration for hybrid query pipeline."""
    # Dense Embeddings
    dense_model: str = "BAAI/bge-small-en-v1.5"
    
    # Sparse Embeddings - Using Qdrant's optimized model
    sparse_model: str = "Qdrant/bm42-all-minilm-l6-v2-attentions"
    
    # Hybrid Search Weights
    dense_weight: float = 0.7
    sparse_weight: float = 0.3
    
    # Retrieval Settings
    top_k_children: int = 10  # Retrieve this many child chunks
    top_k_rerank: int = 3     # Keep this many after reranking
    
    # Context Limit (tokens)
    max_context_tokens: int = 2500
    
    # Device
    device: str = "cpu"


# =============================================================================
# PROMPTS
# =============================================================================

CONTEXTUALIZATION_PROMPT = """Given the following conversation history and a follow-up question, 
rephrase the follow-up question to be a standalone question that captures all necessary context.

Conversation History:
{history}

Follow-up Question: {question}

Standalone Question:"""

HYDE_PROMPT = """You are an expert at writing detailed answers. Given the question below, 
write a hypothetical passage that would directly answer this question. 
This passage will be used to search a knowledge base, so be specific and detailed.

Question: {question}

Hypothetical Answer:"""

CITATION_SYSTEM_PROMPT = """You are NEXUS, a precise document assistant. Answer questions using ONLY the Context below.

CRITICAL RULES:
1. Answer the question directly in your first sentence.
2. Use ONLY information that appears in the Context. Never add outside knowledge.
3. When possible, QUOTE exact text from the documents.
4. Cite every claim: [Source: filename]
5. If you cannot find the answer in the Context, say: "This information is not in the provided documents."

FORBIDDEN:
- Do NOT infer, assume, or expand beyond what the documents say.
- Do NOT add helpful context from your training data.

Context:
{context}"""


# =============================================================================
# HYBRID QUERY SERVICE
# =============================================================================

class HybridQueryService:
    """
    Enterprise-grade query service with:
    - Conversational memory
    - HyDE (Hypothetical Document Embeddings)
    - Hybrid search (dense + sparse)
    - FlashRank reranking
    - Citation-enforced generation
    """
    
    def __init__(self, config: Optional[HybridQueryConfig] = None):
        self.config = config or HybridQueryConfig()
        self.settings = get_settings()
        
        logger.info("🚀 Initializing Hybrid Query Service...")
        
        # LLM (GPU) - Using the Custom Bridge
        self.llm = LLMService.get_llm()
        
        # Dense Embeddings (CPU)
        logger.info(f"Loading Dense Embeddings: {self.config.dense_model}")
        self.dense_embedder = HuggingFaceEmbeddings(
            model_name=self.config.dense_model,
            model_kwargs={"device": self.config.device},
            encode_kwargs={"normalize_embeddings": True}
        )
        
        # Sparse Embeddings (CPU)
        logger.info(f"Loading Sparse Embeddings: {self.config.sparse_model}")
        self.sparse_embedder = SparseTextEmbedding(
            model_name=self.config.sparse_model
        )
        
        # FlashRank Reranker (CPU)
        logger.info("Loading FlashRank Reranker...")
        self.reranker = Ranker(model_name="ms-marco-MiniLM-L-12-v2")
        
        # Qdrant Client
        self.qdrant_client = QdrantClient(
            host=self.settings.QDRANT_HOST,
            port=self.settings.QDRANT_PORT,
            url=self.settings.QDRANT_URL,
            api_key=self.settings.QDRANT_API_KEY
        )
        
        # Session Memory (Redis-backed)
        self.memory_store = get_session_store()
        
        # Ingestion service (for parent document retrieval)
        self.ingestion_service = get_ingestion_service()
        
        # Semantic Router (Reuse Dense Embedder to save RAM)
        # We reuse the existing LangChain dense_embedder which has the required 'embed_query' method
        logger.info("Initializing Semantic Router...")
        self.router = SemanticRouter(embed_model=self.dense_embedder)
        
        logger.info("✅ Hybrid Query Service initialized!")

    # =========================================================================
    # STEP A: CONTEXTUALIZATION
    # =========================================================================
    
    async def _contextualize_query(self, query: str, session_id: str) -> str:
        """
        Rewrite query with conversation history to create standalone question.
        """
        history = await self.memory_store.format_history(session_id)
        
        if history == "No previous conversation.":
            return query
        
        prompt = CONTEXTUALIZATION_PROMPT.format(
            history=history,
            question=query
        )
        
        messages = [
            ChatMessage(role=MessageRole.SYSTEM, content="You are a helpful assistant that rewrites questions."),
            ChatMessage(role=MessageRole.USER, content=prompt)
        ]
        
        response = self.llm.chat(messages)
        standalone_question = str(response.message.content).strip()
        
        logger.info(f"📝 Contextualized: '{query}' → '{standalone_question}'")
        return standalone_question

    # =========================================================================
    # STEP B: HyDE (Hypothetical Document Embeddings)
    # =========================================================================
    
    def _generate_hyde(self, question: str) -> str:
        """
        Generate a hypothetical answer to improve retrieval.
        """
        prompt = HYDE_PROMPT.format(question=question)
        
        messages = [
            ChatMessage(role=MessageRole.SYSTEM, content="You are an expert knowledge assistant."),
            ChatMessage(role=MessageRole.USER, content=prompt)
        ]
        
        response = self.llm.chat(messages)
        hyde_answer = str(response.message.content).strip()
        
        logger.info(f"🔮 HyDE generated: {hyde_answer[:100]}...")
        return hyde_answer

    # =========================================================================
    # STEP C: HYBRID SEARCH
    # =========================================================================
    
    def _hybrid_search(self, query_text: str, collection_name: str) -> List[Dict[str, Any]]:
        """
        Perform hybrid search combining dense and sparse vectors.
        """
        # Generate embeddings for the query
        dense_vector = self.dense_embedder.embed_query(query_text)
        
        sparse_embedding = list(self.sparse_embedder.embed([query_text]))[0]
        sparse_vector = SparseVector(
            indices=sparse_embedding.indices.tolist(),
            values=sparse_embedding.values.tolist()
        )
        
        # Hybrid search using Qdrant's prefetch + RRF fusion
        results = self.qdrant_client.query_points(
            collection_name=collection_name,
            prefetch=[
                Prefetch(
                    query=dense_vector,
                    using="dense",
                    limit=self.config.top_k_children * 2
                ),
                Prefetch(
                    query=sparse_vector,
                    using="sparse",
                    limit=self.config.top_k_children * 2
                )
            ],
            query=FusionQuery(fusion="rrf"),  # Reciprocal Rank Fusion
            limit=self.config.top_k_children,
            with_payload=True
        )
        
        # Extract results
        search_results = []
        for point in results.points:
            search_results.append({
                "id": point.id,
                "score": point.score,
                "text": point.payload.get("text", ""),
                "source": point.payload.get("source", "Unknown"),
                "file_name": point.payload.get("file_name", "Unknown"),
                "page": point.payload.get("page", ""),
                "parent_id": point.payload.get("parent_id"),
                "metadata": point.payload
            })
        
        logger.info(f"🔍 Hybrid search returned {len(search_results)} results")
        return search_results

    # =========================================================================
    # FETCH PARENT DOCUMENTS
    # =========================================================================
    
    async def _fetch_parent_documents(self, child_results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Retrieve parent documents for the child chunks.
        """
        parent_docs = []
        seen_parent_ids = set()
        
        for child in child_results:
            parent_id = child.get("parent_id")
            
            if parent_id and parent_id not in seen_parent_ids:
                seen_parent_ids.add(parent_id)
                
                # Try to get parent from Redis cache / PostgreSQL
                parent_doc = await self.ingestion_service.get_parent_document(parent_id)
                
                if parent_doc:
                    parent_docs.append({
                        "text": parent_doc.page_content,
                        "source": parent_doc.metadata.get("source", child.get("source", "Unknown")),
                        "file_name": parent_doc.metadata.get("file_name", child.get("file_name", "Unknown")),
                        "page": parent_doc.metadata.get("page", child.get("page", "")),
                        "score": child.get("score", 0),
                        "metadata": parent_doc.metadata
                    })
                else:
                    # Fallback to child text if parent not found
                    parent_docs.append({
                        "text": child.get("text", ""),
                        "source": child.get("source", "Unknown"),
                        "file_name": child.get("file_name", "Unknown"),
                        "page": child.get("page", ""),
                        "score": child.get("score", 0),
                        "metadata": child.get("metadata", {})
                    })
        
        logger.info(f"📄 Fetched {len(parent_docs)} parent documents")
        return parent_docs

    # =========================================================================
    # STEP D: RERANK
    # =========================================================================
    
    def _rerank_documents(self, query: str, documents: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Rerank documents using FlashRank for better relevance.
        """
        if not documents:
            return []
        
        # Prepare for FlashRank
        passages = [
            {"id": i, "text": doc["text"], "meta": doc}
            for i, doc in enumerate(documents)
        ]
        
        rerank_request = RerankRequest(
            query=query,
            passages=passages
        )
        
        reranked = self.reranker.rerank(rerank_request)
        
        # Extract top-k reranked
        top_docs = []
        for result in reranked[:self.config.top_k_rerank]:
            doc = result["meta"]
            doc["rerank_score"] = result["score"]
            top_docs.append(doc)
        
        logger.info(f"🏆 Reranked to top {len(top_docs)} documents")
        return top_docs

    # =========================================================================
    # CONTEXT FORMATTING WITH TRUNCATION
    # =========================================================================
    
    def _format_context(self, documents: List[Dict[str, Any]]) -> str:
        """
        Format documents into context string with source info.
        Truncates to max_context_tokens.
        """
        context_parts = []
        
        for i, doc in enumerate(documents):
            source = doc.get("source", doc.get("file_name", "Unknown"))
            page = doc.get("page", "")
            text = doc.get("text", "")
            
            if page:
                header = f"[Source: {source}, Page {page}]"
            else:
                header = f"[Source: {source}]"
            
            context_parts.append(f"{header}\n{text}")
        
        full_context = "\n\n---\n\n".join(context_parts)
        
        # Simple token estimation (4 chars ≈ 1 token)
        max_chars = self.config.max_context_tokens * 4
        
        if len(full_context) > max_chars:
            full_context = full_context[:max_chars] + "\n\n[Context truncated due to length...]"
            logger.info(f"✂️ Context truncated to ~{self.config.max_context_tokens} tokens")
        
        return full_context

    # =========================================================================
    # STEP E: GENERATION WITH CITATIONS
    # =========================================================================
    
    def _generate_answer(self, question: str, context: str) -> str:
        """
        Generate answer using Qwen with citation enforcement.
        """
        system_prompt = CITATION_SYSTEM_PROMPT.format(context=context)
        
        messages = [
            ChatMessage(role=MessageRole.SYSTEM, content=system_prompt),
            ChatMessage(role=MessageRole.USER, content=question)
        ]
        
        response = self.llm.chat(messages)
        answer = str(response.message.content).strip()
        
        return answer
    
    async def _generate_answer_stream(self, question: str, context: str) -> AsyncGenerator[str, None]:
        """
        Stream answer generation using Qwen.
        """
        system_prompt = CITATION_SYSTEM_PROMPT.format(context=context)
        
        messages = [
            ChatMessage(role=MessageRole.SYSTEM, content=system_prompt),
            ChatMessage(role=MessageRole.USER, content=question)
        ]
        
        response = self.llm.stream_chat(messages)
        
        for token in response:
            yield token.delta

    # =========================================================================
    # CHITCHAT (Non-RAG) HANDLING
    # =========================================================================
    
    async def _generate_chitchat_response(self, query: str, session_id: str) -> str:
        """Generate response for general chat (non-RAG queries)."""
        history = await self.memory_store.format_history(session_id)
        
        system_prompt = self.settings.CHITCHAT_SYSTEM_PROMPT
        
        messages = [
            ChatMessage(role=MessageRole.SYSTEM, content=system_prompt),
        ]
        
        # Add history context if available
        if history != "No previous conversation.":
            messages.append(ChatMessage(
                role=MessageRole.USER, 
                content=f"Previous conversation:\n{history}\n\nCurrent message: {query}"
            ))
        else:
            messages.append(ChatMessage(role=MessageRole.USER, content=query))
        
        response = self.llm.chat(messages)
        return str(response.message.content).strip()
    
    async def _generate_chitchat_stream(self, query: str, session_id: str):
        """Stream response for general chat (non-RAG queries)."""
        history = await self.memory_store.format_history(session_id)
        
        system_prompt = self.settings.CHITCHAT_SYSTEM_PROMPT
        
        messages = [
            ChatMessage(role=MessageRole.SYSTEM, content=system_prompt),
        ]
        
        # Add history context if available
        if history != "No previous conversation.":
            messages.append(ChatMessage(
                role=MessageRole.USER, 
                content=f"Previous conversation:\n{history}\n\nCurrent message: {query}"
            ))
        else:
            messages.append(ChatMessage(role=MessageRole.USER, content=query))
        
        response = self.llm.stream_chat(messages)
        for token in response:
            yield token.delta              
    
    # =========================================================================
    # MAIN QUERY METHOD
    # =========================================================================
    
    async def query(self, query: str, team: str, session_id: str) -> Dict[str, Any]:
        """
        Main query endpoint - routes to chat or RAG pipeline.
        """
        logger.info(f"🎯 Query: '{query}' | Team: {team} | Session: {session_id}")
        
        route = await self.router.route(query)
        logger.info(f"📍 Route: {route}")
        
        if route == "chat":
            answer = await self._generate_chitchat_response(query, session_id)
            await self.memory_store.add_message(session_id, "user", query)
            await self.memory_store.add_message(session_id, "assistant", answer)
            return {"answer": answer, "provenance": []}
        
        # RAG Mode
        standalone_question = await self._contextualize_query(query, session_id)
        hyde_answer = self._generate_hyde(standalone_question)
        child_results = self._hybrid_search(hyde_answer, team)
        parent_docs = await self._fetch_parent_documents(child_results)
        reranked_docs = self._rerank_documents(standalone_question, parent_docs)
        context = self._format_context(reranked_docs)
        answer = self._generate_answer(standalone_question, context)
        
        await self.memory_store.add_message(session_id, "user", query)
        await self.memory_store.add_message(session_id, "assistant", answer)
        
        provenance = [
            {
                "file_name": doc.get("file_name", doc.get("source", "Unknown")),
                "text": doc.get("text", "")[:500] + "..." if len(doc.get("text", "")) > 500 else doc.get("text", ""),
                "page": str(doc.get("page", "")),
                "score": float(doc.get("rerank_score", doc.get("score", 0)))
            }
            for doc in reranked_docs
        ]
        
        return {
            "answer": answer,
            "provenance": provenance
        }
    
    async def stream_query(self, query: str, team: str, session_id: str) -> AsyncGenerator[str, None]:
        """
        Streaming query endpoint - yields tokens and provenance.
        """
        logger.info(f"🎯 Stream Query: '{query}' | Team: {team} | Session: {session_id}")
        
        # =================================================================
        # GUARDRAILS - Input Validation
        # =================================================================
        is_safe, sanitized_query, error_reason = validate_input(query)
        if not is_safe:
            logger.warning(f"🛡️ Guardrails blocked: {error_reason}")
            yield error_reason
            yield f"\n\n__PROVENANCE_START__\n{json.dumps({'provenance': []})}\n__PROVENANCE_END__"
            return
        
        # Check for identity questions (consistent responses)
        identity_response = PromptGuardrails.get_identity_response(sanitized_query)
        if identity_response:
            yield identity_response
            await self.memory_store.add_message(session_id, "user", query)
            await self.memory_store.add_message(session_id, "assistant", identity_response)
            yield f"\n\n__PROVENANCE_START__\n{json.dumps({'provenance': []})}\n__PROVENANCE_END__"
            return
        
        # Use sanitized query from here
        query = sanitized_query
        
        route = await self.router.route(query)
        logger.info(f"📍 Route: {route}")
        
        if route == "chat":
            full_response = ""
            async for token in self._generate_chitchat_stream(query, session_id):
                full_response += token
                yield token
            await self.memory_store.add_message(session_id, "user", query)
            await self.memory_store.add_message(session_id, "assistant", full_response)
            yield f"\n\n__PROVENANCE_START__\n{json.dumps({'provenance': []})}\n__PROVENANCE_END__"
            return
        
        # RAG Mode
        standalone_question = await self._contextualize_query(query, session_id)
        hyde_answer = self._generate_hyde(standalone_question)
        child_results = self._hybrid_search(hyde_answer, team)
        parent_docs = await self._fetch_parent_documents(child_results)
        reranked_docs = self._rerank_documents(standalone_question, parent_docs)
        context = self._format_context(reranked_docs)
        
        full_response = ""
        async for token in self._generate_answer_stream(standalone_question, context):
            full_response += token
            yield token
        
        await self.memory_store.add_message(session_id, "user", query)
        await self.memory_store.add_message(session_id, "assistant", full_response)
        
        provenance = [
            {
                "file_name": doc.get("file_name", doc.get("source", "Unknown")),
                "text": doc.get("text", "")[:500] + "..." if len(doc.get("text", "")) > 500 else doc.get("text", ""),
                "page": str(doc.get("page", "")),
                "score": float(doc.get("rerank_score", doc.get("score", 0)))
            }
            for doc in reranked_docs
        ]
        
        yield f"\n\n__PROVENANCE_START__\n{json.dumps({'provenance': provenance})}\n__PROVENANCE_END__"
    
    async def clear_session(self, session_id: str):
        """Clear session history."""
        await self.memory_store.clear_session(session_id)
        logger.info(f"🗑️ Cleared session: {session_id}")


# =============================================================================
# SINGLETON & BACKWARDS COMPATIBILITY
# =============================================================================

_query_service: Optional[HybridQueryService] = None

def get_query_service() -> HybridQueryService:
    """Get or create singleton query service."""
    global _query_service
    if _query_service is None:
        _query_service = HybridQueryService()
    return _query_service


class QueryService:
    """
    Backwards-compatible wrapper for the API.
    """
    
    def __init__(self):
        self._hybrid_service = get_query_service()
    
    async def query(self, query: str, team: str, session_id: str) -> Dict[str, Any]:
        return await self._hybrid_service.query(query, team, session_id)
    
    async def stream_query(self, query: str, team: str, session_id: str) -> AsyncGenerator[str, None]:
        async for token in self._hybrid_service.stream_query(query, team, session_id):
            yield token
    
    async def clear_session(self, session_id: str):
        await self._hybrid_service.clear_session(session_id)