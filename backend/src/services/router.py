import logging
import numpy as np
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

class SemanticRouter:
    """
    A simple semantic router that uses embedding similarity to route queries.
    Accepts any embedder with an `embed_query(text)` method (LangChain-style).
    """
    def __init__(self, embed_model: Any):
        """
        Args:
            embed_model: Any embedder with embed_query(text) method
        """
        self.embed_model = embed_model
        if not hasattr(embed_model, 'embed_query'):
            raise ValueError("Embedding model must have an 'embed_query' method")
            
        # Define routes with example queries
        self.routes = {
            "chat": [
                "hi", "hello", "hey", "greetings", "good morning", "good afternoon", "good evening",
                "how are you?", "who are you?", "what can you do?", "help", "nice to meet you"
            ],
        }
        
        # Pre-compute embeddings for route examples
        self.route_embeddings = self._compute_route_embeddings()
        
        # Threshold for similarity (tuning required)
        self.threshold = 0.75

    def _compute_route_embeddings(self) -> Dict[str, List[List[float]]]:
        """Compute embeddings for all route examples."""
        route_embeddings = {}
        for route, examples in self.routes.items():
            try:
                # Use LangChain-style embed_query for each example
                embeddings = [self.embed_model.embed_query(ex) for ex in examples]
                route_embeddings[route] = embeddings
                logger.info(f"Computed {len(embeddings)} embeddings for route '{route}'")
            except Exception as e:
                logger.error(f"Failed to compute embeddings for route '{route}': {e}")
                route_embeddings[route] = []
        return route_embeddings

    def _cosine_similarity(self, v1: List[float], v2: List[float]) -> float:
        """Compute cosine similarity between two vectors."""
        dot_product = np.dot(v1, v2)
        norm_v1 = np.linalg.norm(v1)
        norm_v2 = np.linalg.norm(v2)
        if norm_v1 == 0 or norm_v2 == 0:
            return 0.0
        return dot_product / (norm_v1 * norm_v2)

    async def route(self, query: str) -> str:
        """
        Route the query to 'chat' or 'rag' based on semantic similarity.
        """
        # Use LangChain-style embed_query (synchronous)
        query_embedding = self.embed_model.embed_query(query)

        max_similarity = -1.0

        # Check against "chat" examples
        chat_embeddings = self.route_embeddings.get("chat", [])
        
        for embed in chat_embeddings:
            sim = self._cosine_similarity(query_embedding, embed)
            if sim > max_similarity:
                max_similarity = sim
        
        logger.info(f"Router: Query='{query}' | Max Chat Similarity={max_similarity:.4f}")

        if max_similarity >= self.threshold:
            return "chat"
        
        return "rag"

