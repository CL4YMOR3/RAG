"""
=============================================================================
NEXUS PROMPT GUARDRAILS
=============================================================================
Security layer for protecting against:
- Prompt injection attacks
- Jailbreaking attempts
- Harmful content generation
- System prompt extraction attempts
- Role confusion attacks
"""

import re
import logging
from typing import Tuple, Optional, List
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class GuardrailResult:
    """Result of guardrail check."""
    is_safe: bool
    reason: Optional[str] = None
    sanitized_input: Optional[str] = None


class PromptGuardrails:
    """
    Comprehensive guardrails for NEXUS LLM interactions.
    """
    
    # ==========================================================================
    # BLOCKED PATTERNS - Prompt Injection & Jailbreaking
    # ==========================================================================
    
    INJECTION_PATTERNS = [
        # System prompt extraction
        r"ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?)",
        r"disregard\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?)",
        r"forget\s+(all\s+)?(previous|prior)\s+(instructions?|context)",
        r"what\s+(is|are)\s+your\s+(system\s+)?prompts?",
        r"show\s+me\s+your\s+(system\s+)?prompts?",
        r"reveal\s+your\s+(system\s+)?prompts?",
        r"print\s+your\s+(system\s+)?prompts?",
        r"output\s+your\s+(initial|system)\s+instructions?",
        
        # Role hijacking
        r"you\s+are\s+now\s+(?!nexus)",  # "you are now X" (except NEXUS)
        r"pretend\s+(to\s+be|you\s+are)",
        r"act\s+as\s+(?!a\s+helpful)",  # "act as X" (except helpful assistant)
        r"roleplay\s+as",
        r"simulate\s+(being|a)",
        r"from\s+now\s+on\s+you\s+(are|will)",
        
        # Instruction override
        r"new\s+instructions?:",
        r"updated\s+instructions?:",
        r"override\s+(your\s+)?instructions?",
        r"replace\s+(your\s+)?instructions?",
        r"<\s*system\s*>",
        r"\[\s*system\s*\]",
        r"###\s*system",
        
        # Developer/admin impersonation
        r"developer\s+mode",
        r"admin\s+mode",
        r"maintenance\s+mode",
        r"debug\s+mode\s+enabled",
        r"sudo\s+mode",
        r"god\s+mode",
        
        # Code execution attempts
        r"execute\s+(this\s+)?(code|script|command)",
        r"run\s+(this\s+)?(code|script|command)",
        r"eval\s*\(",
        r"exec\s*\(",
    ]
    
    # Harmful content patterns
    HARMFUL_PATTERNS = [
        r"how\s+to\s+(make|create|build)\s+(a\s+)?(bomb|explosive|weapon)",
        r"how\s+to\s+(hack|crack|break\s+into)",
        r"how\s+to\s+(kill|murder|harm)\s+(someone|a\s+person)",
        r"generate\s+(illegal|harmful|malicious)",
    ]
    
    # ==========================================================================
    # INPUT GUARDRAILS
    # ==========================================================================
    
    @classmethod
    def check_input(cls, user_input: str) -> GuardrailResult:
        """
        Check user input for prompt injection and harmful content.
        
        Returns:
            GuardrailResult with safety status and reason if blocked.
        """
        if not user_input or not user_input.strip():
            return GuardrailResult(is_safe=True, sanitized_input="")
        
        input_lower = user_input.lower()
        
        # Check for injection patterns
        for pattern in cls.INJECTION_PATTERNS:
            if re.search(pattern, input_lower, re.IGNORECASE):
                logger.warning(f"🛡️ Blocked injection attempt: {pattern}")
                return GuardrailResult(
                    is_safe=False,
                    reason="I can't process requests that attempt to modify my instructions or behavior."
                )
        
        # Check for harmful content
        for pattern in cls.HARMFUL_PATTERNS:
            if re.search(pattern, input_lower, re.IGNORECASE):
                logger.warning(f"🛡️ Blocked harmful content: {pattern}")
                return GuardrailResult(
                    is_safe=False,
                    reason="I can't help with requests that could cause harm."
                )
        
        # Check for excessive special characters (possible encoding attack)
        special_char_ratio = sum(1 for c in user_input if not c.isalnum() and c not in ' .,?!-\'\"') / max(len(user_input), 1)
        if special_char_ratio > 0.5:
            logger.warning("🛡️ Blocked: Excessive special characters")
            return GuardrailResult(
                is_safe=False,
                reason="Your message contains unusual formatting. Please rephrase your question."
            )
        
        # Check for extremely long input (potential DoS)
        if len(user_input) > 10000:
            logger.warning("🛡️ Blocked: Input too long")
            return GuardrailResult(
                is_safe=False,
                reason="Your message is too long. Please keep questions under 10,000 characters."
            )
        
        # Sanitize input - remove potential control characters
        sanitized = cls._sanitize_input(user_input)
        
        return GuardrailResult(is_safe=True, sanitized_input=sanitized)
    
    @classmethod
    def _sanitize_input(cls, text: str) -> str:
        """Remove potentially dangerous characters while preserving meaning."""
        # Remove null bytes and control characters (except newlines/tabs)
        sanitized = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)
        
        # Normalize whitespace
        sanitized = re.sub(r'\s+', ' ', sanitized).strip()
        
        return sanitized
    
    # ==========================================================================
    # OUTPUT GUARDRAILS
    # ==========================================================================
    
    @classmethod
    def check_output(cls, llm_output: str) -> GuardrailResult:
        """
        Check LLM output for harmful content or data leakage.
        
        Returns:
            GuardrailResult with safety status.
        """
        if not llm_output:
            return GuardrailResult(is_safe=True, sanitized_input="")
        
        output_lower = llm_output.lower()
        
        # Check if model is revealing system prompt
        system_leak_patterns = [
            r"my\s+system\s+prompt\s+(is|says)",
            r"my\s+instructions\s+(are|say)",
            r"i\s+was\s+programmed\s+to",
            r"my\s+initial\s+prompt",
            r"here\s+(is|are)\s+my\s+instructions?",
        ]
        
        for pattern in system_leak_patterns:
            if re.search(pattern, output_lower):
                logger.warning(f"🛡️ Blocked output: System prompt leak attempt")
                return GuardrailResult(
                    is_safe=False,
                    reason="I'm designed to keep my internal instructions private."
                )
        
        return GuardrailResult(is_safe=True, sanitized_input=llm_output)
    
    # ==========================================================================
    # IDENTITY GUARDRAILS
    # ==========================================================================
    
    IDENTITY_FACTS = {
        "name": "NEXUS",
        "creator": "Affan Shazer",
        "type": "knowledge assistant",
        "purpose": "helping answer questions from documents",
    }
    
    @classmethod
    def get_identity_response(cls, query: str) -> Optional[str]:
        """
        Return a consistent identity response if query is about the AI.
        Returns None if query is not about identity.
        """
        query_lower = query.lower()
        
        identity_patterns = {
            r"(what('s| is)|who('s| is))\s+your\s+name": 
                f"I'm **{cls.IDENTITY_FACTS['name']}**, a knowledge assistant created by {cls.IDENTITY_FACTS['creator']}!",
            
            r"who\s+(created|made|built|developed)\s+(you|nexus)":
                f"I was created by **{cls.IDENTITY_FACTS['creator']}**! I'm here to help you find answers in your documents.",
            
            r"(what|who)\s+(are|is)\s+(you|nexus)":
                f"I'm **{cls.IDENTITY_FACTS['name']}**, a {cls.IDENTITY_FACTS['type']} created by {cls.IDENTITY_FACTS['creator']}. I specialize in {cls.IDENTITY_FACTS['purpose']}.",
            
            r"are\s+you\s+(an?\s+)?(ai|artificial|robot|bot|gpt|chatgpt|claude)":
                f"I'm {cls.IDENTITY_FACTS['name']}, a knowledge assistant built by {cls.IDENTITY_FACTS['creator']}. I'm designed to help you find information in your documents!",
        }
        
        for pattern, response in identity_patterns.items():
            if re.search(pattern, query_lower):
                return response
        
        return None


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

def validate_input(user_input: str) -> Tuple[bool, str, Optional[str]]:
    """
    Validate user input and return (is_safe, sanitized_input_or_error, error_message).
    
    Usage:
        is_safe, result, error = validate_input(user_query)
        if not is_safe:
            return error_response(error)
        # Continue with sanitized input in 'result'
    """
    check = PromptGuardrails.check_input(user_input)
    if check.is_safe:
        return True, check.sanitized_input or user_input, None
    else:
        return False, "", check.reason


def validate_output(llm_output: str) -> Tuple[bool, str, Optional[str]]:
    """
    Validate LLM output before sending to user.
    """
    check = PromptGuardrails.check_output(llm_output)
    if check.is_safe:
        return True, llm_output, None
    else:
        return False, "", check.reason
