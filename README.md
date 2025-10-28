# Team-Based RAG System for Internal Knowledge

This project implements a Retrieval-Augmented Generation (RAG) system designed to answer questions based on internal company documents. It organizes knowledge by "teams" or categories, allowing for separate, focused knowledge bases.

## Features

*   **Multi-Format Document Ingestion**: Supports a wide range of document types including PDF, DOCX, PPTX, TXT, HTML, and more, powered by `unstructured`.
*   **Team-Based Indexing**: Creates and manages separate vector indexes for different teams (e.g., 'HR', 'Engineering'), ensuring queries are only run against relevant knowledge.
*   **Efficient Vector Search**: Uses FAISS for fast and efficient similarity searches.
*   **LLM-Powered Answers**: Leverages Mistral AI models to generate natural language answers based on retrieved document chunks.
*   **Conversational Short-Term Memory**: Remembers the last few interactions within a session to provide context-aware answers to follow-up questions. This creates a more natural, conversational experience.
*   **RESTful API**: A comprehensive FastAPI backend that exposes document ingestion, querying, and session management, making it easy to integrate with other services or a frontend application.
*   **Source Provenance**: Each answer includes a list of source document chunks, including the original filename and ingestion timestamp, for full traceability.

## Project Structure

```
.
├── indexes/              # Stores the generated FAISS indexes for each team
├── src/                  # Source code
│   ├── ingest.py         # Script to ingest and index documents
│   └── query.py          # Script to query the knowledge base
├── .env                  # Environment variables (API keys)
└── README.md             # This file
```

## Setup & Installation

1.  **Create a Virtual Environment**

    It's recommended to use a virtual environment to manage dependencies.

    ```bash
    python -m venv venv
    # On Windows
    venv\Scripts\activate
    # On macOS/Linux
    source venv/bin/activate
    ```

2.  **Install Dependencies**

    Create a `requirements.txt` file with the following content:

    ```
    fastapi>=0.95
    uvicorn[standard]>=0.22
    langchain-core>=0.1.0
    langchain-community>=0.0.1
    langchain-text-splitters>=0.0.1
    openai>=1.0
    pdfplumber>=0.8
    pytesseract>=0.3
    python-multipart>=0.0.6
    pydantic>=1.10
    chromadb>=0.3
    # pinecone-client>=1.0 # Keeping this commented out as it's not used in ingest.py
    faiss-cpu>=1.7
    sentence-transformers>=2.2
    transformers>=4.30
    unstructured[local-inference]>=0.12.0
    python-magic-bin>=0.4.27 # For libmagic on Windows
    mistralai>=0.1.2
    ```

    Then, install the packages:

    ```bash
    pip install -r requirements.txt
    ```

3.  **Set Up Environment Variables**

    Create a `.env` file in the root of the project and add your Mistral API key:

    ```
    MISTRAL_API_KEY="your_mistral_api_key_here"
    ```

## Usage

This project can be used via the command line for simple tasks or via its REST API for more advanced integration.

### 1. Ingesting Documents (Command Line)

To add a document to a team's knowledge base, run the `ingest.py` script.

```bash
# Example: Ingest a PDF for the 'hr' team
python src/ingest.py "path/to/your/document.pdf" --team "hr"
```

### 2. Querying the Knowledge Base (Command Line)

To ask a question, run the `query.py` script, specifying the relevant team.

```bash
# Example: Ask a question to the 'hr' team's knowledge base
python src/query.py "What is the company's vacation policy?" --team "hr"
```
uvicorn src.api:app --reload --host 0.0.0.0 --port 8000
