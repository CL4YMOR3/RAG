# NEXUS RAG - Enterprise Hybrid RAG System

> **Silicon Valley Standard** AI-Powered Knowledge Platform.
> Secure. Multi-Tenant. Scalable. Hybrid RAG.

<div align="center">

![Python](https://img.shields.io/badge/Python-3.11%2B-blue)
![Next.js](https://img.shields.io/badge/Next.js-16%2B-black)
![Qdrant](https://img.shields.io/badge/Vector%20DB-Qdrant-red)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fnexus%2Fnexus-rag)
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/nexus-rag)

</div>

![Nexus Enterprise](Nexus%20Logo.png)

## 🚀 Overview

**NEXUS RAG** is a production-grade **Retrieval-Augmented Generation (RAG)** platform designed for secure enterprise knowledge management. It enables organizations to ingest vast amounts of data and query it using state-of-the-art LLMs, with strict data isolation between teams.

It combines a high-performance **Hybrid Search** pipeline (Dense + Sparse) with robust enterprise security (RBAC, Audit Logging, SSO).

---

## 🛠 Tech Stack

### Frontend (Client)
- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, Server Actions)
- **Language**: TypeScript 5+
- **Styling**: **Tailwind CSS v4**, Custom Glassmorphism System
- **State**: React Hooks, Context API

### Backend (Server)
- **Core**: Python 3.11+, [FastAPI](https://fastapi.tiangolo.com/)
- **Orchestration**: LlamaIndex / LangChain
- **Vector Database**: **Qdrant** (Containerized)
- **Database**: **PostgreSQL** (via Neon Serverless)
- **ORM**: **Prisma** (Multi-tenant Schema)
- **Caching & Rate Limiting**: **Upstash Redis**

### Infrastructure & Security
- **Authentication**: **NextAuth.js v5** (Google OAuth 2.0, JWT Strategy)
- **Deployment**: Docker Compose (Local), Vercel (Frontend), Railway/AWS (Backend)

---

## ✨ Features

### Core RAG Capabilities
| Feature | Description |
|:---|:---|
| **Hybrid Search** | Dense (BGE-Small) + Sparse (BM42) vectors for semantic + keyword matching |
| **HyDE** | Hypothetical Document Embeddings for improved retrieval |
| **Parent-Child Indexing** | Search on small chunks, retrieve full context |
| **FlashRank Reranking** | CPU-optimized reranking for precision |
| **Semantic Router** | Cosine similarity-based chat vs RAG classification |
| **Inline Citations** | `[Source: file.pdf]` format in responses |
| **Multi-Format Support** | PDF, DOCX, PPTX, XLSX, TXT, HTML, EPUB, RTF, CSV, JSON |
| **VRAM Protection** | Embeddings on CPU, only LLM on GPU (Optimized for 4GB VRAM) |
| **RAGAS Evaluation** | Built-in Faithfulness & Answer Relevancy metrics |
| **Prompt Guardrails** | Protection against prompt injection, jailbreaking & harmful content |

### 🛡️ Enterprise Platform Features (New)
| Feature | Description |
|:---|:---|
| **Multi-Tenancy** | Logic-enforced isolation ensures Team A cannot access Team B's data |
| **RBAC System** | **System Admin** (Platform control), **Team Owner** (Manage members), **Member** (Read/Write) |
| **Admin Console** | Dedicated dashboard (`/admin`) for User management, Team creation, and Analytics |
| **Smart Onboarding** | Multi-step wizard with "Magic Auto-Join" based on email domain (`@jwtl.in`) |
| **Audit Logging** | Comprehensive tracking of all critical actions (Signups, Data Access, Settings) |
| **Rate Limiting** | Token-bucket limiting using **Upstash Redis** to prevent abuse (50 req/hour) |
| **API Keys** | Scoped API key management for programmatic access (`sk_...`) |
| **Mobile-First UX** | Fully responsive design with swipeable drawers, `100dvh` viewport fixes, and touch targets |
| **Real-Time Presence** | Live "online users" indicators per team (Heartbeat mechanism) |

---

## 🏗️ Architecture

```mermaid
graph TD
    User[User] -->|HTTPS| Frontend[Next.js 16 Frontend]
    Frontend -->|NextAuth| Auth[Google OAuth 2.0]
    Frontend -->|API Request| Backend[FastAPI Backend]
    
    subgraph "Backend Services"
        Backend -->|Auth Check| API_Secret[Internal API Secret]
        Backend -->|Route| Router{Semantic Router}
        Router -->|Chat| LLM[Qwen 2.5 3B (GPU)]
        Router -->|RAG| HybridParams[Contextualize + HyDE]
        
        HybridParams -->|Search| Qdrant[(Qdrant Vector DB)]
        Qdrant -->|Retrieve| Reranker[FlashRank (CPU)]
        Reranker -->|Context| LLM
    end
    
    subgraph "Data Layer"
        Qdrant <-->|Vectors| Ingestion[Ingestion Service]
        Frontend -->|Session| Redis[(Redis Cache)]
        Backend -->|Metadata| PG[(PostgreSQL)]
    end
```

---

## 📁 Project Structure

```bash
NEXUS RAG/
├── backend/                  # Python FastAPI Backend
│   ├── src/
│   │   ├── api.py           # FastAPI endpoints
│   │   ├── services/
│   │   │   ├── query.py     # Main RAG pipeline
│   │   │   ├── ingestion.py # Document ingestion
│   │   │   ├── llm.py       # Qwen LLM wrapper
│   │   │   ├── auth.py      # [NEW] Auth & User Context
│   │   │   ├── router.py    # Semantic classifier
│   │   │   └── guardrails.py # Security guardrails
│   │   ├── core/
│   │   │   └── config.py    # Settings & prompts
│   │   └── db/
│   │       ├── vector_store.py # Qdrant connection
│   │       ├── postgres.py  # PostgreSQL storage
│   │       └── redis_cache.py # Redis caching
│   ├── evaluate_ragas.py    # RAGAS evaluation script
│   ├── debug_search.py      # Retrieval diagnostic
│   ├── SLM/                 # Local LLM model files
│   └── docker-compose.yml   # Qdrant + Redis containers
│
└── frontend-new/             # Next.js 16 UI
    ├── src/
    │   ├── app/
    │   │   ├── admin/       # [NEW] Admin Dashboard
    │   │   ├── onboarding/  # [NEW] User Onboarding Flow
    │   │   ├── profile/     # [NEW] User Profile
    │   │   └── page.tsx     # Main chat interface
    │   ├── components/      # Reusable UI (Sidebar, UserMenu)
    │   ├── lib/api/         # API client
    │   └── hooks/           # Custom Hooks (useChatStream, usePresence)
    └── tailwind.config.ts   # Design System & Breakpoints
```

---

## 🔧 Backend Components Explained

### 1. SemanticRouter (`router.py`)
**Purpose**: Classify queries as "chat" (general conversation) or "rag" (document retrieval).
*   **Method**: `route(query)` returns "chat" or "rag" based on cosine similarity.
*   **Threshold**: > 0.75 similarity routes to Chat (pre-computed embeddings for "hi", "hello", etc.).

### 2. HybridQueryService (`query.py`)
**Purpose**: The main RAG pipeline orchestrator.
*   **Configuration**:
    *   Dense: `BAAI/bge-small-en-v1.5`
    *   Sparse: `Qdrant/bm42-all-minilm-l6-v2-attentions`
    *   Rerank: Top 3 from `FlashRank`
*   **Pipeline**: Contextualize → HyDE → Hybrid Search → Fetch Parents → Rerank → Generate.
*   **System Prompt Rules**: Answer directly, Quote text, Cite claims `[Source: filename]`, No outside knowledge.

### 3. HybridIngestionService (`ingestion.py`)
**Purpose**: Process documents into searchable chunks (Parent-Child Indexing).
*   **Process**: Load -> Chunk (2000 char parents, 400 char children) -> Embed (Dual) -> Index -> Store Parents in PG/Redis.

### 4. LocalQwenGPU (`llm.py`)
**Purpose**: Custom LlamaIndex wrapper for Qwen 2.5 3B running on GPU.
*   **Stack**: `llama-cpp-python` with CUDA.
*   **Context**: 4096 tokens. Configured as a Singleton.

### 5. PromptGuardrails (`guardrails.py`)
**Purpose**: Security layer.
*   **Protections**: Prompt Injection, Jailbreaking, Harmful Content, Output Filtering.
*   **Identity**: Enforces consistent responses to "who are you?".

### 6. Enterprise API Endpoints (`api.py`)
| Method | Endpoint | Description |
|:---|:---|:---|
| POST | `/ingest/` | Upload and index documents |
| POST | `/query/` | Query with RAG (non-streaming) |
| POST | `/query/stream` | Query with streaming response |
| GET | `/teams/` | List all teams/collections |
| DELETE | `/teams/{team}` | Delete team collection & wipe vectors |
| POST | `/admin/teams` | [NEW] Create Team with Auto-Admin |
| GET | `/admin/users` | [NEW] List/Manage Users |

### 7. RAGAS Evaluation
*   **Metrics**: Faithfulness (0.64), Answer Relevancy (0.80)
*   **Run**: `python evaluate_ragas.py --team engineering`

---

## 🚦 Getting Started

### Prerequisites
*   Node.js 18+ (Running Next.js 16)
*   Python 3.11+
*   Docker & Docker Compose
*   PostgreSQL Database (Local or Neon)

### 1. Environment Setup

Copy the example environment files to get started quickly:

**Frontend**:
```bash
cp frontend-new/.env.example frontend-new/.env.local
```
Edit `.env.local` to add your keys (Google OAuth, etc.).

**Backend**:
```bash
cp backend/.env.example backend/.env
```
Edit `.env` to add your database and LLM paths.

### 2. Installation

```bash
# Frontend
cd frontend-new
npm install
npx prisma generate
npx prisma db push # Sync schema

# Backend
cd backend
pip install -r requirements.txt
```

### 3. Run Locally

1.  **Infrastructure**: `docker-compose up -d` (Starts Qdrant & Redis)
2.  **Backend**: `uvicorn src.api:app --reload --host 0.0.0.0 --port 8000`
3.  **Frontend**: `npm run dev` (Runs on localhost:3000)

### 4. Admin Setup
1.  Sign in with Google.
2.  The **first user** is automatically promoted to **System Admin**.
3.  Navigate to `/admin` to create teams and invite users.
4.  Subsequent users with matching domains (`@jwtl.in`) will **auto-join** their existing teams.

---

## ⚙️ Configuration & Diagnostics

**Diagnostic Tools**:
*   `python debug_search.py`: Inspect retrieved chunks for a query.
*   `evaluate_ragas.py`: Run evaluation benchmarks.

**Data Flow**:
User Query → SemanticRouter → (Chat / RAG) → HyDE → Hybrid Search (Qdrant) → Rerank (FlashRank) → LLM (Qwen) → Stream.

---

## 🤝 Community & Contributing

We welcome contributions! Please check our [Contributing Guidelines](CONTRIBUTING.md) for details on how to get started.

### License
This project is licensed under the [MIT License](LICENSE).

