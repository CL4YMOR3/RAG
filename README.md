# NEXUS RAG - Enterprise Hybrid RAG System

A Retrieval-Augmented Generation system with **Hybrid Search**, **HyDE**, **Reranking**, **Semantic Routing**, and **Inline Citations**.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Hybrid Search** | Dense (BGE-Small) + Sparse (BM42) vectors for semantic + keyword matching |
| **HyDE** | Hypothetical Document Embeddings for improved retrieval |
| **Parent-Child Indexing** | Search on small chunks, retrieve full context |
| **FlashRank Reranking** | CPU-optimized reranking for precision |
| **Semantic Router** | Cosine similarity-based chat vs RAG classification |
| **Inline Citations** | `[Source: file.pdf]` format in responses |
| **Conversational Memory** | Redis-backed session persistence |
| **Multi-Format Support** | PDF, DOCX, PPTX, XLSX, TXT, HTML, EPUB, RTF, CSV, JSON |
| **VRAM Protection** | Embeddings on CPU, only LLM on GPU |
| **RAGAS Evaluation** | Built-in Faithfulness & Answer Relevancy metrics |
| **Prompt Guardrails** | Protection against prompt injection, jailbreaking & harmful content |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js 16)                        │
│                    - Chat interface                             │
│                    - File upload via + button                   │
│                    - Team selection                             │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP API
┌────────────────────────────▼────────────────────────────────────┐
│                      FastAPI Backend                            │
├─────────────────────────────────────────────────────────────────┤
│  ENDPOINTS                                                      │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────────────┐ │
│  │ /ingest/   │  │ /query/    │  │ /teams/                    │ │
│  │ POST       │  │ POST       │  │ GET/DELETE                 │ │
│  └─────┬──────┘  └─────┬──────┘  └────────────────────────────┘ │
│        │               │                                        │
├────────▼───────────────▼────────────────────────────────────────┤
│  SERVICES                                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  SemanticRouter (router.py)                               │  │
│  │  → Routes "hi/hello" to chat, everything else to RAG      │  │
│  └─────────────────────────────┬─────────────────────────────┘  │
│                                │                                │
│  ┌─────────────────────────────▼─────────────────────────────┐  │
│  │  HybridQueryService (query.py)                            │  │
│  │  1. Contextualize → 2. HyDE → 3. Hybrid Search →          │  │
│  │  4. Fetch Parents → 5. Rerank → 6. Generate w/ Citations  │  │
│  └─────────────────────────────┬─────────────────────────────┘  │
│                                │                                │
│  ┌───────────────┐  ┌──────────▼────────┐  ┌─────────────────┐  │
│  │ Ingestion     │  │ LocalQwenGPU      │  │ FlashRank       │  │
│  │ Service       │  │ (llm.py)          │  │ Reranker        │  │
│  │ (ingestion.py)│  │ Qwen 2.5 3B/GPU   │  │ (CPU)           │  │
│  └───────┬───────┘  └───────────────────┘  └─────────────────┘  │
│          │                                                      │
├──────────▼──────────────────────────────────────────────────────┤
│  DATA LAYER                                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Qdrant Vector DB                                       │    │
│  │  - Dense vectors (BGE-Small, 384 dims)                  │    │
│  │  - Sparse vectors (BM42/SPLADE)                         │    │
│  │  - Named vector search + RRF fusion                     │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ┌────────────────────────┐  ┌─────────────────────────────┐    │
│  │  Redis                 │  │  PostgreSQL (Neon)          │    │
│  │  - Session memory      │  │  - Parent document storage  │    │
│  │  - Parent doc cache    │  │  - Crash-proof backup       │    │
│  └────────────────────────┘  └─────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
NEXUS RAG/
├── backend/
│   ├── src/
│   │   ├── api.py                    # FastAPI endpoints
│   │   ├── services/
│   │   │   ├── query.py              # Main RAG pipeline
│   │   │   ├── ingestion.py          # Document ingestion
│   │   │   ├── llm.py                # Qwen LLM wrapper
│   │   │   ├── router.py             # Semantic classifier
│   │   │   ├── guardrails.py         # Security guardrails
│   │   │   └── chunking.py           # Text chunking
│   │   ├── core/
│   │   │   └── config.py             # Settings & prompts
│   │   └── db/
│   │       ├── vector_store.py       # Qdrant connection
│   │       ├── postgres.py           # PostgreSQL storage
│   │       └── redis_cache.py        # Redis caching
│   ├── evaluate_ragas.py             # RAGAS evaluation script
│   ├── debug_search.py               # Retrieval diagnostic
│   ├── SLM/                          # Local LLM model files
│   └── docker-compose.yml            # Qdrant + Redis containers
│
└── frontend-new/                     # Next.js 16 UI
    ├── src/app/page.tsx              # Main chat interface
    ├── src/hooks/useChatStream.ts    # Streaming hook
    └── src/lib/api/                  # API client
```

---

## 🔧 Backend Components Explained

### 1. SemanticRouter (`router.py`)

**Purpose**: Classify queries as "chat" (general conversation) or "rag" (document retrieval).

| Method | Description |
|--------|-------------|
| `route(query)` | Returns `"chat"` or `"rag"` based on cosine similarity |
| `_cosine_similarity()` | Compares query embedding to pre-computed route examples |

**How it works**:
1. Pre-computes embeddings for chat phrases ("hi", "hello", "how are you?")
2. For each query, computes embedding and finds max similarity to chat examples
3. If similarity > 0.75 threshold → route to chat (no document retrieval)
4. Otherwise → route to RAG pipeline

---

### 2. HybridQueryService (`query.py`)

**Purpose**: The main RAG pipeline orchestrator. Handles the complete query→answer flow.

#### Configuration (`HybridQueryConfig`)
```python
dense_model = "BAAI/bge-small-en-v1.5"   # Semantic embeddings
sparse_model = "Qdrant/bm42-all-minilm-l6-v2-attentions"  # Keyword matching
top_k_children = 10    # Chunks to retrieve
top_k_rerank = 3       # Chunks after reranking
max_context_tokens = 2500
```

#### Pipeline Steps

| Step | Method | Description |
|------|--------|-------------|
| **1. Router** | `router.route()` | Chat vs RAG classification |
| **2. Contextualize** | `_contextualize_query()` | Rewrite query with conversation history |
| **3. HyDE** | `_generate_hyde()` | Generate hypothetical answer for better retrieval |
| **4. Hybrid Search** | `_hybrid_search()` | Dense + Sparse RRF fusion in Qdrant |
| **5. Fetch Parents** | `_fetch_parent_documents()` | Get full context from parent chunks |
| **6. Rerank** | `_rerank_documents()` | FlashRank scores top 3 |
| **7. Format Context** | `_format_context()` | Build `[Source: file]` formatted context |
| **8. Generate** | `_generate_answer()` | Qwen generates cited response |

#### System Prompt
```
CRITICAL RULES:
1. Answer the question directly in your first sentence.
2. Use ONLY information that appears in the Context. Never add outside knowledge.
3. When possible, QUOTE exact text from the documents.
4. Cite every claim: [Source: filename]
5. If you cannot find the answer in the Context, say: "This information is not in the provided documents."

FORBIDDEN:
- Do NOT infer, assume, or expand beyond what the documents say.
- Do NOT add helpful context from your training data.
```

---

### 3. HybridIngestionService (`ingestion.py`)

**Purpose**: Process documents into searchable chunks with dual embeddings.

#### Configuration (`HybridConfig`)
```python
dense_model = "BAAI/bge-small-en-v1.5"
dense_dimension = 384
sparse_model = "Qdrant/bm42-all-minilm-l6-v2-attentions"
parent_chunk_size = 2000     # Full context chunks
child_chunk_size = 400       # Search chunks
```

#### Pipeline Steps

| Step | Method | Description |
|------|--------|-------------|
| **1. Load** | `SimpleDirectoryReader` | Extract text from PDF/DOCX/etc |
| **2. Chunk** | `_create_parent_child_chunks()` | 2000 char parents → 400 char children |
| **3. Embed** | `_generate_embeddings()` | Dense (BGE) + Sparse (BM42) vectors |
| **4. Index** | `_index_to_qdrant()` | Upload to Qdrant with named vectors |
| **5. Store Parents** | PostgreSQL + Redis | Store parent docs for later retrieval |

---

### 4. LocalQwenGPU (`llm.py`)

**Purpose**: Custom LlamaIndex wrapper for Qwen 2.5 3B running on GPU.

| Component | Description |
|-----------|-------------|
| **Backend** | `llama-cpp-python` with CUDA acceleration |
| **Model** | Qwen 2.5 3B Instruct (Q4_K_M quantized) |
| **Context** | 4096 tokens (configurable) |
| **Singleton** | `LLMService.get_llm()` ensures single instance |

#### Prompt Format (ChatML)
```
<|im_start|>system
{system_prompt}
<|im_end|>
<|im_start|>user
{query}
<|im_end|>
<|im_start|>assistant
```

---

### 5. PromptGuardrails (`guardrails.py`)

**Purpose**: Security layer to protect against malicious inputs and ensure safe outputs.

| Protection | Description |
|------------|-------------|
| **Prompt Injection** | Blocks "ignore previous instructions", system prompt extraction, role hijacking |
| **Jailbreaking** | Detects "developer mode", "admin mode", instruction override attempts |
| **Harmful Content** | Filters requests for dangerous/illegal information |
| **Output Filtering** | Prevents LLM from revealing system prompts |
| **Identity Consistency** | Returns consistent responses when asked about the AI |

#### Key Methods
```python
PromptGuardrails.check_input(query)   # Returns GuardrailResult (is_safe, reason)
PromptGuardrails.check_output(answer) # Validates LLM response before sending
PromptGuardrails.get_identity_response(query)  # Handles "who are you?" queries
```

---

### 6. API Endpoints (`api.py`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/ingest/` | Upload and index documents |
| `POST` | `/query/` | Query with RAG (non-streaming) |
| `POST` | `/query/stream` | Query with streaming response |
| `GET` | `/teams/` | List all teams/collections |
| `GET` | `/teams/{team}/documents` | List documents in team |
| `DELETE` | `/teams/{team}` | Delete team collection |
| `DELETE` | `/teams/{team}/documents/{filename}` | Delete specific document |
| `DELETE` | `/session/{session_id}` | Clear chat memory |

---

### 7. RAGAS Evaluation (`evaluate_ragas.py`)

**Purpose**: Measure retrieval and generation quality.

| Metric | Description | Current Score |
|--------|-------------|---------------|
| **Faithfulness** | Does answer only use document content? | 0.64 |
| **Answer Relevancy** | Does answer address the question? | 0.37 |

**Run evaluation**:
```bash
python evaluate_ragas.py --team engineering
```

---

## 🚀 Quick Start

### 1. Start Docker Services
```bash
docker-compose up -d  # Starts Qdrant + Redis
```

### 2. Install Dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 3. Start Backend
```bash
python -m uvicorn src.api:app --reload --host 0.0.0.0 --port 8000
```

### 4. Start Frontend
```bash
cd frontend-new
npm install
npm run dev
```

### 5. Upload Documents
Use the **+ button** in the chat interface to upload documents directly.

---

## ⚙️ Configuration

Create a `.env` file in `backend/`:

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | (required) | PostgreSQL/Neon connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL |
| `QDRANT_HOST` | `localhost` | Qdrant server host |
| `QDRANT_PORT` | `6333` | Qdrant server port |
| `LLM_MODEL_PATH` | `SLM/Qwen2.5-3B-Instruct/...` | Path to GGUF model |
| `CONTEXT_WINDOW` | `4096` | LLM context size |
| `N_GPU_LAYERS` | `-1` | GPU layers (-1 = all) |

---

## 📊 Diagnostic Tools

### Debug Retrieval
```bash
python debug_search.py
```
Shows what chunks the database returns for a test query.

### RAGAS Evaluation
```bash
python evaluate_ragas.py --team engineering
```
Measures Faithfulness and Answer Relevancy using Mistral AI as evaluator.

---

## 🔄 Data Flow Summary

```
User Query
    ↓
SemanticRouter → "chat" → Generate chitchat response
    ↓ "rag"
Contextualize with history (Redis)
    ↓
HyDE: Generate hypothetical answer
    ↓
Hybrid Search: Dense + Sparse vectors (Qdrant)
    ↓
Fetch Parent Documents (Redis → PostgreSQL)
    ↓
FlashRank Rerank: Top 3 documents
    ↓
Format Context with [Source: ...] headers
    ↓
Qwen 2.5 3B: Generate cited answer
    ↓
Stream response to frontend
```

---

## 📈 Latest Metrics

| Metric | Score | Target | Status |
|--------|-------|--------|--------|
| Faithfulness | **0.47** | ≥ 0.85 | 🔄 Improving |
| Answer Relevancy | **0.80** | ≥ 0.70 | ✅ Achieved! |

**Improvement Journey**:
| Run | Faithfulness | Answer Relevancy | Notes |
|-----|--------------|------------------|-------|
| Baseline | 0.62 | 0.22 | MiniLM embeddings |
| BGE-Small | 0.64 | 0.37 | Smarter embeddings |
| JWTL Questions | 0.47 | **0.80** | Document-specific eval |

**Optimizations applied**:
- ✅ Upgraded embedding model: MiniLM → BGE-Small
- ✅ Document-specific evaluation questions
- ✅ Faithfulness-focused system prompt with FORBIDDEN section

---

## 📄 License

MIT License
