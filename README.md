# HO RAG - Enterprise Hybrid RAG System

A Retrieval-Augmented Generation system with **Hybrid Search**, **HyDE**, **Reranking**, and **Inline Citations**.

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Hybrid Search** | Dense (MiniLM) + Sparse (BM42) vectors for semantic + keyword matching |
| **HyDE** | Hypothetical Document Embeddings for improved retrieval |
| **Parent-Child Indexing** | Search on small chunks, retrieve full context |
| **FlashRank Reranking** | CPU-optimized reranking for precision |
| **Inline Citations** | `[Source: file.pdf, Pg X]` format in responses |
| **Conversational Memory** | Redis-backed session persistence |
| **Multi-Format Support** | PDF, DOCX, PPTX, XLSX, TXT, HTML, EPUB, RTF |
| **VRAM Protection** | Embeddings on CPU, only LLM on GPU |
| **Crash-Proof** | PostgreSQL (Neon) + Redis for persistent storage |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                        │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP
┌────────────────────────────▼────────────────────────────────────┐
│                      FastAPI Backend                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   /ingest/   │  │   /query/    │  │  /teams/ Management  │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────────────┘  │
│         │                 │                                     │
│  ┌──────▼───────┐  ┌──────▼───────────────────────────────┐    │
│  │  Ingestion   │  │            Query Pipeline            │    │
│  │   Service    │  │  Router → HyDE → Search → Rerank →   │    │
│  │              │  │  Generate w/ Citations               │    │
│  └──────┬───────┘  └──────────────────┬───────────────────┘    │
│         │                              │                        │
│  ┌──────▼──────────────────────────────▼───────────────────┐   │
│  │                    Qdrant (Vector DB)                   │   │
│  │              Dense + Sparse Named Vectors               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Qwen 2.5 3B (llama-cpp, GPU)               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────┐  ┌────────────────────────────┐   │
│  │     Redis (Cache)       │  │  PostgreSQL/Neon           │   │
│  │  - Session Memory       │  │  - Parent Document Storage │   │
│  │  - Parent Doc Cache     │  │  - Crash-proof backup      │   │
│  └─────────────────────────┘  └────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
HO RAG/
├── backend/
│   ├── src/
│   │   ├── api.py              # FastAPI endpoints
│   │   ├── services/
│   │   │   ├── ingestion.py    # Hybrid ingestion pipeline
│   │   │   ├── query.py        # HyDE + Hybrid search + Citations
│   │   │   ├── llm.py          # Qwen LLM service (Singleton factory)
│   │   │   ├── router.py       # Semantic router (chat vs RAG)
│   │   │   └── chunking.py     # Text chunking strategies
│   │   ├── core/
│   │   │   └── config.py       # Settings & prompts
│   │   └── db/
│   │       ├── vector_store.py # Qdrant connection
│   │       ├── postgres.py     # PostgreSQL/Neon parent storage
│   │       └── redis_cache.py  # Redis caching & sessions
│   ├── SLM/                    # Local LLM model files
│   ├── .env.example            # Environment template
│   ├── requirements.txt
│   └── docker-compose.yml      # Qdrant + Redis containers
│
└── frontend/                   # React UI
```

---

## 🚀 Quick Start

### 1. Configure Environment
```bash
cd backend
cp .env.example .env
# Edit .env with your Neon PostgreSQL connection string
```

### 2. Start Services (Qdrant + Redis)
```bash
docker-compose up -d
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Start Backend
```bash
uvicorn src.api:app --reload --host 0.0.0.0 --port 8000
```

### 5. Start Frontend
```bash
cd frontend
npm install
npm start
```
### 5. Create folder for models
mkdir -p backend/SLM

# Download Qwen 2.5 3B (GGUF Quantized)
huggingface-cli download Qwen/Qwen2.5-3B-Instruct-GGUF qwen2.5-3b-instruct-q4_k_m.gguf --local-dir backend/SLM --local-dir-use-symlinks False
---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/ingest/` | Upload and index documents |
| `POST` | `/query/` | Query with RAG (non-streaming) |
| `POST` | `/query/stream` | Query with streaming response |
| `GET` | `/teams/` | List all teams/collections |
| `GET` | `/teams/{team}/documents` | List documents in team |
| `DELETE` | `/teams/{team}` | Delete team collection |
| `DELETE` | `/session/{session_id}` | Clear chat memory |

---

## ⚙️ Configuration

Create a `.env` file in the `backend/` directory (see `.env.example`):

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | (required) | PostgreSQL/Neon connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL |
| `REDIS_SESSION_TTL` | `86400` | Session expiry (24 hours) |
| `REDIS_CACHE_TTL` | `604800` | Cache expiry (7 days) |
| `QDRANT_HOST` | `localhost` | Qdrant server host |
| `QDRANT_PORT` | `6333` | Qdrant server port |
| `LLM_MODEL_PATH` | `SLM/Qwen2.5-3B-Instruct/...` | Path to GGUF model |
| `CONTEXT_WINDOW` | `4096` | LLM context size (4096 for 4GB VRAM) |
| `N_GPU_LAYERS` | `-1` | GPU layers (-1 = all) |

---

## 🧪 How It Works

### Ingestion Pipeline
1. **Load Document** → Extract text from PDF/DOCX/etc
2. **Parent-Child Chunking** → 2000 char parents, 400 char children
3. **Generate Embeddings** → Dense (MiniLM) + Sparse (SPLADE)
4. **Index to Qdrant** → Named vectors for hybrid search

### Query Pipeline
1. **Route** → Chat vs RAG classification
2. **Contextualize** → Rewrite query with history (Redis)
3. **HyDE** → Generate hypothetical answer
4. **Hybrid Search** → RRF fusion of dense + sparse
5. **Fetch Parents** → Redis cache → PostgreSQL fallback
6. **Rerank** → FlashRank top 3
7. **Generate** → Qwen with citation enforcement

---

## 🤖 LLM Service Architecture

The `LocalQwenGPU` class provides a custom LlamaIndex `CustomLLM` implementation:

| Component | Description |
|-----------|-------------|
| **Singleton Factory** | `LLMService.get_llm()` ensures single model instance |
| **ChatML Format** | Proper `<\|im_start\|>` / `<\|im_end\|>` prompt formatting |
| **Dual Callbacks** | `@llm_completion_callback()` for complete, `@llm_chat_callback()` for chat |
| **GPU Acceleration** | Full GPU offload via `llama-cpp-python` (`n_gpu_layers=-1`) |
| **Streaming Support** | Both `stream_complete()` and `stream_chat()` methods |

```python
from src.services.llm import LLMService

# Get singleton LLM instance
llm = LLMService.get_llm()

# Use for completions or chat
response = llm.complete("Your prompt here")
```

---


