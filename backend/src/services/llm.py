import logging
from typing import Any, Optional
from llama_cpp import Llama, LlamaGrammar

from llama_index.core.llms import (
    CustomLLM,
    CompletionResponse,
    CompletionResponseGen,
    ChatResponse,
    ChatResponseGen,
    LLMMetadata,
    ChatMessage,
    MessageRole
)
from llama_index.core.llms.callbacks import llm_completion_callback, llm_chat_callback

from src.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Stop tokens for Qwen ChatML format
IM_END = "\u003c|im_end|\u003e"
END_OF_TEXT = "\u003c|endoftext|\u003e"
IM_START = "\u003c|im_start|\u003e"
STOP_TOKENS = [IM_END, END_OF_TEXT]


class LocalQwenGPU(CustomLLM):
    """
    Custom wrapper to bridge LlamaIndex 0.14+ with llama-cpp-python 0.2.90 (GPU).
    Supports GBNF grammar-constrained decoding for structured outputs.
    """
    context_window: int = settings.CONTEXT_WINDOW
    num_output: int = 1024
    model_name: str = "Qwen2.5-3B-Instruct"
    _model: Any = None

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        
        model_path = settings.LLM_MODEL_PATH
        import os
        if not os.path.isabs(model_path):
            model_path = os.path.abspath(model_path)

        logger.info(f"Initializing Direct GPU Engine from: {model_path}")
        
        self._model = Llama(
            model_path=model_path,
            n_gpu_layers=-1,        
            n_ctx=self.context_window,
            verbose=False           
        )

    @property
    def metadata(self) -> LLMMetadata:
        return LLMMetadata(
            context_window=self.context_window,
            num_output=self.num_output,
            model_name=self.model_name,
            is_chat_model=True,
        )

    @llm_completion_callback()
    def complete(self, prompt: str, grammar: Optional[LlamaGrammar] = None, **kwargs: Any) -> CompletionResponse:
        """
        Complete a prompt with optional GBNF grammar constraints.
        
        Args:
            prompt: The input prompt
            grammar: Optional LlamaGrammar for constrained decoding
        """
        llm_kwargs = {
            "max_tokens": self.num_output,
            "temperature": 0.1,
            "stop": STOP_TOKENS,
        }
        if grammar is not None:
            llm_kwargs["grammar"] = grammar
            
        response = self._model(prompt, **llm_kwargs)
        text = response["choices"][0]["text"]
        return CompletionResponse(text=text)

    @llm_completion_callback()
    def stream_complete(self, prompt: str, grammar: Optional[LlamaGrammar] = None, **kwargs: Any) -> CompletionResponseGen:
        """
        Stream completion with optional GBNF grammar constraints.
        """
        llm_kwargs = {
            "max_tokens": self.num_output,
            "stream": True,
            "temperature": 0.1,
            "stop": STOP_TOKENS,
        }
        if grammar is not None:
            llm_kwargs["grammar"] = grammar
            
        response_iter = self._model(prompt, **llm_kwargs)
        for response in response_iter:
            text = response["choices"][0]["text"]
            yield CompletionResponse(text=text, delta=text)

    @llm_chat_callback()
    def chat(self, messages: list[ChatMessage], grammar: Optional[LlamaGrammar] = None, **kwargs: Any) -> ChatResponse:
        prompt = self._messages_to_prompt(messages)
        completion_response = self.complete(prompt, grammar=grammar, **kwargs)
        
        return ChatResponse(
            message=ChatMessage(
                role=MessageRole.ASSISTANT,
                content=completion_response.text
            )
        )
    
    @llm_chat_callback()
    def stream_chat(self, messages: list[ChatMessage], grammar: Optional[LlamaGrammar] = None, **kwargs: Any) -> ChatResponseGen:
        prompt = self._messages_to_prompt(messages)
        completion_gen = self.stream_complete(prompt, grammar=grammar, **kwargs)
        
        for completion in completion_gen:
            yield ChatResponse(
                message=ChatMessage(
                    role=MessageRole.ASSISTANT,
                    content=completion.text
                ),
                delta=completion.delta
            )

    def _messages_to_prompt(self, messages: list[ChatMessage]) -> str:
        prompt = ""
        for msg in messages:
            role = msg.role.value
            content = msg.content
            prompt += f"{IM_START}{role}\n{content}{IM_END}\n"
        prompt += f"{IM_START}assistant\n"
        return prompt


# --- Singleton Factory ---
_llm_instance = None

class LLMService:
    @staticmethod
    def get_llm():
        global _llm_instance
        if _llm_instance is None:
            _llm_instance = LocalQwenGPU()
        return _llm_instance