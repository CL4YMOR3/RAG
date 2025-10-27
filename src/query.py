import os
from dotenv import load_dotenv
from langchain_community.vectorstores import FAISS
from sentence_transformers import SentenceTransformer
from mistralai import Mistral
import numpy as np

# ---------- CONFIG ---------- #
load_dotenv()
MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY")
EMBED_MODEL = "all-MiniLM-L6-v2"
INDEX_DIR = "indexes"
TOP_K = 4
MODEL = "mistral-small-latest"   # you can switch later to mistral-medium or mistral-large
# ---------------------------- #

client = Mistral(api_key=MISTRAL_API_KEY)
embedder = SentenceTransformer(EMBED_MODEL)

def load_index(team):
    """Load the FAISS index for the given team."""
    path = os.path.join(INDEX_DIR, f"{team.lower()}_index")
    if not os.path.exists(path):
        raise FileNotFoundError(f"No index found for team '{team}'.")
    db = FAISS.load_local(path, embeddings=None, allow_dangerous_deserialization=True)
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


def generate_answer(query, context):
    """Use Mistral to generate an augmented response."""
    prompt = f"""
You are an AI assistant helping the user with internal company knowledge.
Use the provided context to answer concisely.

Context:
{context}

Question: {query}
Answer:
    """

    response = client.chat.complete(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}]
    )

    # Fix: access .content attribute of AssistantMessage
    msg = response.choices[0].message
    return msg.content.strip()

def rag_query(query, team):
    """Full RAG pipeline with provenance."""
    context_text, provenance = retrieve_relevant_chunks(query, team)
    answer = generate_answer(query, context_text)
    return {
        "answer": answer,
        "provenance": provenance
    }

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Query the RAG system")
    parser.add_argument("query", help="Your question")
    parser.add_argument("--team", required=True, help="Team/category name")
    args = parser.parse_args()

    response = rag_query(args.query, args.team)
    print("\n🧠 RAG Response:\n")
    print(response)
