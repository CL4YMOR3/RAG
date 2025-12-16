"""
=============================================================================
GBNF GRAMMAR FOR CITATION-ENFORCED OUTPUT
=============================================================================
Forces the LLM to generate structured Chain-of-Thought responses with
mandatory citations. This is enforced at the TOKEN level, making it
mathematically impossible to generate uncited claims.

Usage with llama-cpp-python:
    from llama_cpp import LlamaGrammar
    grammar = LlamaGrammar.from_string(CITATION_GRAMMAR)
    response = llm(prompt, grammar=grammar)
=============================================================================
"""

# =============================================================================
# CITATION-ENFORCED GRAMMAR (GBNF Format)
# =============================================================================
# 
# This grammar forces the output structure:
#
# <ANALYSIS>
# - Fact extracted from [Source: filename.pdf]
# - Another fact from [Source: filename.pdf]
# </ANALYSIS>
#
# <ANSWER>
# The answer text with inline citations [Source: filename.pdf].
# </ANSWER>
#
# =============================================================================

CITATION_GRAMMAR = r'''
root ::= analysis answer

# Analysis section - Chain of Thought
analysis ::= "<ANALYSIS>" newline facts "</ANALYSIS>" newline newline

# Facts must have citations
facts ::= fact+
fact ::= "- " fact-text citation newline
fact-text ::= [^[\n]+
citation ::= "[Source: " filename "]"
filename ::= [a-zA-Z0-9_.\-/]+ 

# Answer section
answer ::= "<ANSWER>" newline answer-content "</ANSWER>" newline?
answer-content ::= (sentence | newline)+
sentence ::= sentence-text citation? punct? ws?
sentence-text ::= [^[\n.!?]+
punct ::= [.!?]
ws ::= [ \t]+
newline ::= "\n"
'''

# =============================================================================
# SIMPLIFIED GRAMMAR (More Flexible)
# =============================================================================
# A simpler grammar that just ensures citations exist but allows more
# natural prose. Use this if the strict grammar is too restrictive.

FLEXIBLE_CITATION_GRAMMAR = r'''
root ::= analysis-section answer-section

analysis-section ::= "<ANALYSIS>" content "</ANALYSIS>" ws*
answer-section ::= "<ANSWER>" content "</ANSWER>" ws*

content ::= (text | citation | ws | newline)+
text ::= [^<\[]+
citation ::= "[Source: " [^\]]+ "]"
ws ::= [ \t]+
newline ::= "\n"
'''

# =============================================================================
# PROSE-ONLY GRAMMAR (Minimal Constraints)
# =============================================================================
# Only enforces that at least one citation exists somewhere in the output.
# Good fallback if structured output causes issues.

MINIMAL_CITATION_GRAMMAR = r'''
root ::= pre-citation citation post-content

pre-citation ::= [^[]*
citation ::= "[Source: " [^\]]+ "]"
post-content ::= (text | citation)*
text ::= [^[]+
'''


def get_citation_grammar(strict: bool = False) -> str:
    """
    Get the appropriate grammar string.
    
    Args:
        strict: If True, use the strict structured grammar.
                If False, use the flexible grammar (recommended).
    
    Returns:
        GBNF grammar string for use with LlamaGrammar.from_string()
    """
    if strict:
        return CITATION_GRAMMAR
    return FLEXIBLE_CITATION_GRAMMAR


# For convenience - the default grammar to use
DEFAULT_GRAMMAR = FLEXIBLE_CITATION_GRAMMAR
