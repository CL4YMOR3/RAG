"""
Debug script to verify what the database is actually returning.
This helps diagnose if the retrieval (the "Eyes") is working correctly.
"""
import asyncio
from src.services.query import QueryService

async def debug_retrieval():
    print("\n🔍 --- DIAGNOSTIC MODE ---")
    qs = QueryService()
    
    # This query MUST be something you know is in your documents
    # Replace this string with a real question from your PDF
    test_query = "What are the critical items?" 
    team = "engineering"
    
    print(f"🎯 Searching for: '{test_query}'")
    
    # Run the search manually
    results = qs._hybrid_service._hybrid_search(test_query, team)
    
    if not results:
        print("❌ CRITICAL: No results found.")
        return

    print(f"✅ Found {len(results)} chunks.")
    print("\n--- WHAT THE DATABASE FOUND ---")
    for i, res in enumerate(results[:3]):  # Show top 3
        score = res.get('score', 0)
        text = res.get('text', 'N/A')
        file = res.get('file_name', 'Unknown')
        page = res.get('page', '')
        
        print(f"\n[{i+1}] Score: {score:.4f} | File: {file} | Page: {page}")
        print(f"    CONTENT: {text[:400]}...")

if __name__ == "__main__":
    asyncio.run(debug_retrieval())
