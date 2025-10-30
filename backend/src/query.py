import os
from dotenv import load_dotenv
from langchain_community.vectorstores import FAISS
from sentence_transformers import SentenceTransformer
from langchain_mistralai.chat_models import ChatMistralAI
from langchain_huggingface import HuggingFaceEmbeddings
import numpy as np

# ---------- CONFIG ---------- #
load_dotenv()
MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY")
EMBED_MODEL = "all-MiniLM-L6-v2"
INDEX_DIR = "indexes"
TOP_K = 4
MODEL = "mistral-small-latest"   # you can switch later to mistral-medium or mistral-large
MEMORY_WINDOW_SIZE = 3 # Number of past exchanges to remember
# ---------------------------- #

client = ChatMistralAI(model=MODEL, mistral_api_key=MISTRAL_API_KEY)
embedder = SentenceTransformer(EMBED_MODEL)

# In-memory store for conversational history
# Format: { "session_id": [ {"user": "...", "assistant": "..."} ] }
memory_store = {}

def load_index(team):
    """Load the FAISS index for the given team."""
    path = os.path.join(INDEX_DIR, f"{team.lower()}_index")
    if not os.path.exists(path):
        raise FileNotFoundError(f"No index found for team '{team}'.")
    embeddings = HuggingFaceEmbeddings(model_name=EMBED_MODEL)
    db = FAISS.load_local(path, embeddings=embeddings, allow_dangerous_deserialization=True)
    return db

def retrieve_relevant_chunks(query, team):
    """Retrieve the top relevant chunks for a query with provenance."""
    db = load_index(team)
    query_emb = embedder.encode([query])
    D, I = db.index.search(np.array(query_emb).astype('float32'), TOP_K)

    retrieved_chunks = []
    for idx in I[0]:
        doc = db.docstore._dict[db.index_to_docstore_id[idx]]
        chunk_info = {
            "chunk_text": doc.page_content,
            "source_doc": doc.metadata.get("source", "unknown"),
            "ingestion_datetime": doc.metadata.get("ingestion_datetime", "unknown"),
            "chunk_id": idx
        }
        retrieved_chunks.append(chunk_info)

    # Concatenate chunks for prompt
    context_text = "\n\n".join([c["chunk_text"] for c in retrieved_chunks])
    return context_text, retrieved_chunks


def generate_answer(query, context, history=""):
    """Use Mistral to generate an augmented response."""
    
    history_prompt_part = ""
    if history:
        history_prompt_part = f"""
Here is the recent conversation history:
{history}
"""

    prompt = f"""
You are an AI assistant helping the user with internal company knowledge.
Use the provided context and conversation history to answer the user's question.
If the user is asking a follow-up question, use the history to understand the context.
Answer concisely.

{history_prompt_part}

Context from relevant documents:
{context}

Question: {query}
Answer:
    """

    response = client.invoke(
        [{"role": "user", "content": prompt}]
    )

    # Fix: access .content attribute of AssistantMessage
    return response.content.strip()

def rag_query(query, team, session_id=None):
    """Full RAG pipeline with provenance."""
    context_text, provenance = retrieve_relevant_chunks(query, team)

    history_text = ""
    if session_id and session_id in memory_store:
        # Get the last few exchanges
        recent_history = memory_store[session_id][-MEMORY_WINDOW_SIZE:]
        history_text = "\n".join([f"User: {h['user']}\nAssistant: {h['assistant']}" for h in recent_history])

    answer = generate_answer(query, context_text, history=history_text)

    # Store the new exchange in memory
    if session_id:
        if session_id not in memory_store:
            memory_store[session_id] = []
        memory_store[session_id].append({"user": query, "assistant": answer})

    return {
        "answer": answer,
        "provenance": provenance
    }

def rag_query_stream(query, team, session_id=None):
    """
    Full RAG pipeline with streaming response.
    Yields answer chunks and then a final dictionary with provenance.
    """
    context_text, provenance = retrieve_relevant_chunks(query, team)

    history_text = ""
    if session_id and session_id in memory_store:
        recent_history = memory_store[session_id][-MEMORY_WINDOW_SIZE:]
        history_text = "\n".join([f"User: {h['user']}\nAssistant: {h['assistant']}" for h in recent_history])

    # Use a generator for the answer stream
    answer_stream = generate_answer_stream(query, context_text, history=history_text)

    # We need to accumulate the full answer to store it in memory
    full_answer = ""
    for chunk in answer_stream:
        full_answer += chunk
        yield chunk

    # Store the complete exchange in memory
    if session_id:
        if session_id not in memory_store:
            memory_store[session_id] = []
        memory_store[session_id].append({"user": query, "assistant": full_answer})

    # After the answer stream is finished, yield the provenance data
    yield {"provenance": provenance}

def clear_session_memory(session_id: str):
    """Removes a session's history from the in-memory store."""
    if session_id in memory_store:
        del memory_store[session_id]

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Query the RAG system")
    parser.add_argument("query", help="Your question")
    parser.add_argument("--team", required=True, help="Team/category name")
    args = parser.parse_args()

    response = rag_query(args.query, args.team)
    print("\n🧠 RAG Response:\n")
    print(response)

def generate_answer_stream(query, context, history=""):
    """Use Mistral to generate an augmented response as a stream."""
    
    history_prompt_part = ""
    if history:
        history_prompt_part = f"""
Here is the recent conversation history:
{history}
"""

    prompt = f"""
You are an AI assistant helping the user with internal company knowledge.
Use the provided context and conversation history to answer the user's question.
If the user is asking a follow-up question, use the history to understand the context.
Answer concisely.

{history_prompt_part}

Context from relevant documents:
{context}

Question: {query}
Answer:
    """

    for chunk in client.stream([{"role": "user", "content": prompt}]):
        yield chunk.content
