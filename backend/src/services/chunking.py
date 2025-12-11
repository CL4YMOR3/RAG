from llama_index.core.node_parser import (
    SentenceWindowNodeParser,
    SemanticSplitterNodeParser
)
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
from llama_index.core import Settings

# Ensure the global embedding model is set, though usually handled in main config
# We might need it here for Semantic Splitting
embed_model = HuggingFaceEmbedding(model_name="BAAI/bge-small-en-v1.5")


class ChunkingService:
    @staticmethod
    def get_sentence_window_parser(window_size: int = 3):
        return SentenceWindowNodeParser.from_defaults(
            window_size=window_size,
            window_metadata_key="window",
            original_text_metadata_key="original_text",
        )

    @staticmethod
    def get_semantic_parser(buffer_size: int = 1, breakpoint_percentile_threshold: int = 95):
        return SemanticSplitterNodeParser(
            buffer_size=buffer_size,
            breakpoint_percentile_threshold=breakpoint_percentile_threshold,
            embed_model=embed_model
        )

def get_chunker(strategy: str = "window"):
    if strategy == "semantic":
        return ChunkingService.get_semantic_parser()
    else:
        return ChunkingService.get_sentence_window_parser()
