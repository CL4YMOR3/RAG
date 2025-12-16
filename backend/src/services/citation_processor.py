"""
=============================================================================
CITATION POST-PROCESSOR
=============================================================================
Automatically adds missing citations to LLM responses.

The 3B model often gives correct answers but forgets to cite every sentence.
This post-processor ensures every sentence has a [Source: filename] citation.

Usage:
    processor = CitationPostProcessor()
    enhanced_answer = processor.ensure_citations(answer, provenance_docs)
=============================================================================
"""

import re
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)


class CitationPostProcessor:
    """
    Post-processes LLM answers to ensure every sentence has a citation.
    """
    
    # Pattern to detect existing citations
    CITATION_PATTERN = re.compile(r'\[Source:\s*[^\]]+\]')
    
    # Pattern to split into sentences (handles common abbreviations)
    SENTENCE_PATTERN = re.compile(r'(?<=[.!?])\s+(?=[A-Z])')
    
    def __init__(self):
        pass
    
    def has_citation(self, text: str) -> bool:
        """Check if text contains a citation."""
        return bool(self.CITATION_PATTERN.search(text))
    
    def get_primary_source(self, provenance: List[Dict[str, Any]]) -> str:
        """Get the most relevant source from provenance list."""
        if not provenance:
            return "documents"
        
        # Get the first (highest ranked) source
        first_doc = provenance[0]
        filename = first_doc.get("file_name", first_doc.get("source", "documents"))
        
        # Clean up the filename
        if "/" in filename:
            filename = filename.split("/")[-1]
        if "\\" in filename:
            filename = filename.split("\\")[-1]
            
        return filename
    
    def ensure_citations(self, answer: str, provenance: List[Dict[str, Any]]) -> str:
        """
        Ensure every sentence in the answer has a citation.
        
        Args:
            answer: The LLM-generated answer
            provenance: List of source documents with metadata
            
        Returns:
            Answer with citations added to uncited sentences
        """
        if not answer or not answer.strip():
            return answer
        
        primary_source = self.get_primary_source(provenance)
        citation = f"[Source: {primary_source}]"
        
        # Split into sentences
        sentences = self.SENTENCE_PATTERN.split(answer)
        
        enhanced_sentences = []
        citations_added = 0
        
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
                
            # Skip if it's just a citation
            if sentence.startswith("[Source:") and sentence.endswith("]"):
                enhanced_sentences.append(sentence)
                continue
            
            # Check if sentence already has a citation
            if self.has_citation(sentence):
                enhanced_sentences.append(sentence)
            else:
                # Add citation before the period (or at end if no period)
                if sentence.endswith(('.', '!', '?')):
                    punct = sentence[-1]
                    sentence_without_punct = sentence[:-1].rstrip()
                    enhanced_sentence = f"{sentence_without_punct} {citation}{punct}"
                else:
                    enhanced_sentence = f"{sentence} {citation}"
                    
                enhanced_sentences.append(enhanced_sentence)
                citations_added += 1
        
        if citations_added > 0:
            logger.info(f"📎 Added {citations_added} missing citation(s)")
        
        return " ".join(enhanced_sentences)


# Singleton instance
_processor = None

def get_citation_processor() -> CitationPostProcessor:
    """Get singleton citation processor instance."""
    global _processor
    if _processor is None:
        _processor = CitationPostProcessor()
    return _processor


def ensure_citations(answer: str, provenance: List[Dict[str, Any]]) -> str:
    """Convenience function to ensure citations in an answer."""
    return get_citation_processor().ensure_citations(answer, provenance)
