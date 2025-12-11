import logging
from typing import Any, Optional
from llama_cpp import Llama 

# LlamaIndex Core Imports
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
# IMPORT BOTH CALLBACKS
from llama_index.core.llms.callbacks import llm_completion_callback, llm_chat_callback

from src.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

class LocalQwenGPU(CustomLLM):
    """
    Custom wrapper to bridge LlamaIndex 0.14+ with llama-cpp-python 0.2.90 (GPU).
    """
    context_window: int = settings.CONTEXT_WINDOW
    num_output: int = 1024
    model_name: str = "Qwen2.5-3B-Instruct"
    _model: Any = None

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        
        # Check model path
        model_path = settings.LLM_MODEL_PATH
        import os
        if not os.path.isabs(model_path):
            model_path = os.path.abspath(model_path)

        logger.info(f"🔌 Initializing Direct GPU Engine from: {model_path}")
        
        # Initialize the GPU Model directly
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
    def complete(self, prompt: str, **kwargs: Any) -> CompletionResponse:
        response = self._model(
            prompt, 
            max_tokens=self.num_output, 
            temperature=0.1,
            stop=["<|im_end|>", "<|endoftext|>"]
        )
        text = response["choices"][0]["text"]
        return CompletionResponse(text=text)

    @llm_completion_callback()
    def stream_complete(self, prompt: str, **kwargs: Any) -> CompletionResponseGen:
        response_iter = self._model(
            prompt, 
            max_tokens=self.num_output, 
            stream=True, 
            temperature=0.1,
            stop=["<|im_end|>", "<|endoftext|>"]
        )
        for response in response_iter:
            text = response["choices"][0]["text"]
            yield CompletionResponse(text=text, delta=text)

    # --- CHANGED: Uses @llm_chat_callback() ---
    @llm_chat_callback()
    def chat(self, messages: list[ChatMessage], **kwargs: Any) -> ChatResponse:
        prompt = self._messages_to_prompt(messages)
        completion_response = self.complete(prompt, **kwargs)
        
        return ChatResponse(
            message=ChatMessage(
                role=MessageRole.ASSISTANT,
                content=completion_response.text
            )
        )
    
    # --- CHANGED: Uses @llm_chat_callback() ---
    @llm_chat_callback()
    def stream_chat(self, messages: list[ChatMessage], **kwargs: Any) -> ChatResponseGen:
        prompt = self._messages_to_prompt(messages)
        completion_gen = self.stream_complete(prompt, **kwargs)
        
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
            prompt += f"<|im_start|>{role}\n{content}<|im_end|>\n"
        prompt += "<|im_start|>assistant\n"
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