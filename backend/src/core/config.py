import os
from pydantic_settings import BaseSettings
from functools import lru_cache
from dotenv import load_dotenv

# Load .env file before settings are initialized
load_dotenv()

class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "HO RAG Backend"
    
    # PostgreSQL (Neon) - Parent Document Storage
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    
    # Redis Configuration
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379")
    REDIS_SESSION_TTL: int = int(os.getenv("REDIS_SESSION_TTL", 86400))  # 24 hours
    REDIS_CACHE_TTL: int = int(os.getenv("REDIS_CACHE_TTL", 604800))  # 7 days
    
    # Qdrant Configuration
    QDRANT_HOST: str = os.getenv("QDRANT_HOST", "localhost")
    QDRANT_PORT: int = int(os.getenv("QDRANT_PORT", 6333))
    QDRANT_URL: str | None = os.getenv("QDRANT_URL", None) # Optional: for cloud instances
    QDRANT_API_KEY: str | None = os.getenv("QDRANT_API_KEY", None)

    # Embedding Model
    EMBEDDING_MODEL_NAME: str = "local:BAAI/bge-small-en-v1.5"

    # LLM Configuration
    LLM_MODEL_PATH: str = os.getenv("LLM_MODEL_PATH", r"SLM/Qwen2.5-3B-Instruct/Qwen2.5-3B-Instruct-Q4_K_M.gguf")
    CONTEXT_WINDOW: int = int(os.getenv("CONTEXT_WINDOW", 4096))  # 4096 for 4GB VRAM, 8192 for 8GB+
    MAX_NEW_TOKENS: int = int(os.getenv("MAX_NEW_TOKENS", 2048))
    N_GPU_LAYERS: int = int(os.getenv("N_GPU_LAYERS", -1)) # -1 for all layers
    
    class Config:
        case_sensitive = True
        env_file = ".env"

    # System Prompt
    SYSTEM_PROMPT: str = """You are an intelligent and helpful AI assistant for the "HO RAG" system.
Your goal is to answer user questions ACCURATELY based *only* on the provided context information.

**Guidelines:**
1.  **Strict Context Adherence:** Use ONLY the provided context snippets to answer. Do not use outside knowledge unless it's general language understanding.
2.  **Citations:** When you use information from a specific file, you MUST cite it. (e.g., "According to [filename]...").
3.  **Honesty:** If the answer is not in the context, say "I cannot find the answer in the provided documents." Do not hallucinate.
4.  **Tone:** Be professional, concise, and direct.
5.  **Format:** Use Markdown for clear formatting (bullet points, bold text).
"""

    CHITCHAT_SYSTEM_PROMPT: str = """You are a friendly and helpful AI assistant for the "HO RAG" system.
Your goal is to chat naturally with the user, answer general questions, and be polite.

**Guidelines:**
1.  **Personality:** Be warm, professional, and helpful.
2.  **Scope:** You can answer general questions, acknowledge greetings, and discuss general topics.
3.  **Limitations:** If the user asks specific questions about internal documents, company data, or technical details that require the database, politely prompt them to ask specifically about those topics so the system can retrieve the data (or just do your best if you think it's general knowledge).
4.  **Format:** Use Markdown for clear formatting.
"""

@lru_cache()
def get_settings():
    return Settings()
