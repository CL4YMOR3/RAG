"""
=============================================================================
RAGAS EVALUATION SCRIPT
=============================================================================
Measures RAG pipeline quality with two key metrics:
- Faithfulness: Did the AI hallucinate info not in the documents?
- Answer Relevancy: Did it actually answer the user's question?

Usage:
    python evaluate_ragas.py --team Finance
    python evaluate_ragas.py --team Engineering --eval-file custom_dataset.json
=============================================================================
"""

import asyncio
import argparse
import json
import logging
import sys
from pathlib import Path
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from ragas import evaluate
from ragas.metrics import faithfulness, answer_relevancy
from ragas.llms import LangchainLLMWrapper
from ragas.embeddings import LangchainEmbeddingsWrapper
from datasets import Dataset

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import BaseMessage, AIMessage
from langchain_core.outputs import ChatResult, ChatGeneration
from langchain_huggingface import HuggingFaceEmbeddings

from src.services.query import get_query_service
from src.services.llm import LLMService
from src.core.config import get_settings

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# =============================================================================
# LOCAL LLM WRAPPER FOR RAGAS
# =============================================================================

class LocalLLMForRAGAS(BaseChatModel):
    """
    Wraps our local Qwen LLM to work with RAGAS via LangChain interface.
    """
    
    def _generate(self, messages: List[BaseMessage], stop: Optional[List[str]] = None, run_manager: Any = None, **kwargs) -> ChatResult:
        llm = LLMService.get_llm()
        
        # Convert messages to prompt
        prompt = ""
        for msg in messages:
            role = msg.type if hasattr(msg, 'type') else "user"
            if role == "human":
                role = "user"
            elif role == "ai":
                role = "assistant"
            prompt += f"<|im_start|>{role}\n{msg.content}<|im_end|>\n"
        prompt += "<|im_start|>assistant\n"
        
        # Generate response
        response = llm.complete(prompt)
        
        return ChatResult(
            generations=[ChatGeneration(message=AIMessage(content=response.text))]
        )
    
    @property
    def _llm_type(self) -> str:
        return "local-qwen"
    
    @property
    def _identifying_params(self) -> Dict[str, Any]:
        return {"model": "Qwen2.5-3B-Instruct"}


# =============================================================================
# EVALUATION DATASET
# =============================================================================

SAMPLE_EVAL_DATASET = [
    # Technical/Engineering questions
    {
        "question": "What are the coding standards mentioned in the documents?",
        "ground_truth": "The documents describe coding standards and best practices."
    },
    {
        "question": "What is the deployment process?",
        "ground_truth": "The deployment process involves specific steps and procedures."
    },
    {
        "question": "What technologies or frameworks are used in the project?",
        "ground_truth": "The project uses various technologies and frameworks."
    },
    {
        "question": "What are the testing requirements?",
        "ground_truth": "Testing requirements include unit tests and integration tests."
    },
    {
        "question": "How is version control managed?",
        "ground_truth": "Version control is managed through a defined process."
    },
    {
        "question": "What are the API specifications?",
        "ground_truth": "API specifications define endpoints and data formats."
    },
    {
        "question": "What security practices are documented?",
        "ground_truth": "Security practices include authentication and data protection."
    },
    {
        "question": "What is the architecture overview?",
        "ground_truth": "The architecture consists of various components and layers."
    },
    {
        "question": "What are the performance requirements?",
        "ground_truth": "Performance requirements specify response times and throughput."
    },
    {
        "question": "How is error handling implemented?",
        "ground_truth": "Error handling follows specific patterns and practices."
    }
]


@dataclass
class EvalResult:
    """Container for evaluation results."""
    question: str
    answer: str
    contexts: List[str]
    ground_truth: str
    faithfulness_score: Optional[float] = None
    relevancy_score: Optional[float] = None


# =============================================================================
# MAIN EVALUATOR
# =============================================================================

class RAGASEvaluator:
    """
    Evaluates RAG pipeline using RAGAS metrics:
    - Faithfulness: Detects hallucinations (info not in context)
    - Answer Relevancy: Measures if answer addresses the question
    """
    
    def __init__(self, team: str):
        self.team = team
        self.query_service = get_query_service()
        self.settings = get_settings()
        
        # Setup RAGAS LLM and embeddings
        self.llm = LangchainLLMWrapper(LocalLLMForRAGAS())
        self.embeddings = LangchainEmbeddingsWrapper(
            HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
        )
        
        logger.info(f"📊 RAGAS Evaluator initialized for team: {team}")
    
    async def run_query(self, question: str) -> Dict[str, Any]:
        """Run a query through the RAG pipeline."""
        session_id = f"eval_{hash(question)}"
        result = await self.query_service.query(question, self.team, session_id)
        return result
    
    async def evaluate_dataset(self, eval_data: List[Dict[str, str]]) -> Dict[str, Any]:
        """
        Evaluate a dataset of questions through the RAG pipeline.
        
        Args:
            eval_data: List of {"question": str, "ground_truth": str}
        
        Returns:
            Dictionary with metrics and detailed results
        """
        logger.info(f"🔍 Evaluating {len(eval_data)} questions...")
        
        questions = []
        answers = []
        contexts = []
        ground_truths = []
        
        for i, item in enumerate(eval_data):
            question = item["question"]
            ground_truth = item.get("ground_truth", "")
            
            logger.info(f"  [{i+1}/{len(eval_data)}] Processing: {question[:50]}...")
            
            try:
                result = await self.run_query(question)
                answer = result.get("answer", "")
                provenance = result.get("provenance", [])
                
                # Extract context texts from provenance
                context_texts = [p.get("text", "") for p in provenance if p.get("text")]
                if not context_texts:
                    context_texts = ["No context retrieved."]
                
                questions.append(question)
                answers.append(answer)
                contexts.append(context_texts)
                ground_truths.append(ground_truth)
                
                logger.info(f"    ✓ Answer length: {len(answer)} chars, Contexts: {len(context_texts)}")
                
            except Exception as e:
                logger.error(f"    ✗ Error: {e}")
                questions.append(question)
                answers.append(f"Error: {e}")
                contexts.append(["Error retrieving context."])
                ground_truths.append(ground_truth)
        
        # Create RAGAS dataset
        dataset = Dataset.from_dict({
            "user_input": questions,
            "response": answers,
            "retrieved_contexts": contexts,
            "reference": ground_truths
        })
        
        logger.info("📈 Computing RAGAS metrics (Faithfulness & Answer Relevancy)...")
        
        # Run RAGAS evaluation
        try:
            logger.info("🔄 Starting RAGAS evaluate()...")
            results = evaluate(
                dataset=dataset,
                metrics=[faithfulness, answer_relevancy],
                llm=self.llm,
                embeddings=self.embeddings,
            )
            logger.info(f"✅ RAGAS evaluate() returned: {type(results)}")
            logger.info(f"   Results object: {results}")
            
            # Extract scores - RAGAS 0.4.1 returns EvaluationResult object
            # Convert to pandas dataframe and get mean scores
            try:
                df = results.to_pandas()
                logger.info(f"📊 Pandas DataFrame columns: {list(df.columns)}")
                logger.info(f"   DataFrame shape: {df.shape}")
                faithfulness_score = df["faithfulness"].mean() if "faithfulness" in df.columns else 0.0
                relevancy_score = df["answer_relevancy"].mean() if "answer_relevancy" in df.columns else 0.0
                logger.info(f"   Faithfulness mean: {faithfulness_score}, Relevancy mean: {relevancy_score}")
            except Exception as extract_err:
                logger.warning(f"Could not extract from pandas: {extract_err}")
                import traceback
                traceback.print_exc()
                # Fallback: try direct attribute access
                faithfulness_score = getattr(results, 'faithfulness', 0.0)
                relevancy_score = getattr(results, 'answer_relevancy', 0.0)
            
            return {
                "metrics": {
                    "faithfulness": float(faithfulness_score) if faithfulness_score is not None else None,
                    "answer_relevancy": float(relevancy_score) if relevancy_score is not None else None,
                },
                "num_questions": len(questions),
                "team": self.team,
                "details": [
                    {
                        "question": q,
                        "answer": a[:200] + "..." if len(a) > 200 else a,
                        "num_contexts": len(c),
                        "ground_truth": gt
                    }
                    for q, a, c, gt in zip(questions, answers, contexts, ground_truths)
                ]
            }
            
        except Exception as e:
            logger.error(f"RAGAS evaluation failed: {e}")
            import traceback
            traceback.print_exc()
            return {
                "error": str(e),
                "metrics": {"faithfulness": None, "answer_relevancy": None},
                "num_questions": len(questions),
                "team": self.team
            }


def generate_report(results: Dict[str, Any]) -> str:
    """Generate a human-readable evaluation report."""
    lines = [
        "=" * 60,
        "RAGAS EVALUATION REPORT",
        "=" * 60,
        "",
        f"Team: {results.get('team', 'Unknown')}",
        f"Questions Evaluated: {results.get('num_questions', 0)}",
        "",
        "-" * 60,
        "METRICS",
        "-" * 60,
    ]
    
    metrics = results.get("metrics", {})
    
    faithfulness_score = metrics.get("faithfulness")
    relevancy_score = metrics.get("answer_relevancy")
    
    if faithfulness_score is not None:
        lines.append(f"Faithfulness:       {faithfulness_score:.3f}")
        lines.append("  → Measures if answers only contain info from documents")
        lines.append("  → Higher = less hallucination")
    else:
        lines.append("Faithfulness:       N/A (evaluation failed)")
    
    lines.append("")
    
    if relevancy_score is not None:
        lines.append(f"Answer Relevancy:   {relevancy_score:.3f}")
        lines.append("  → Measures if answers address the user's question")
        lines.append("  → Higher = more relevant answers")
    else:
        lines.append("Answer Relevancy:   N/A (evaluation failed)")
    
    if results.get("error"):
        lines.extend(["", f"Error: {results['error']}"])
    
    lines.extend(["", "=" * 60])
    
    return "\n".join(lines)


async def main():
    parser = argparse.ArgumentParser(description="RAGAS Evaluation for HO RAG")
    parser.add_argument("--team", type=str, default="engineering", help="Team collection to evaluate")
    parser.add_argument("--eval-file", type=str, help="Custom evaluation dataset JSON file")
    parser.add_argument("--output", type=str, help="Save results to JSON file")
    parser.add_argument("--report", type=str, default="ragas_report.txt", help="Save text report")
    
    args = parser.parse_args()
    
    # Load evaluation dataset
    if args.eval_file:
        eval_path = Path(args.eval_file)
        if eval_path.exists():
            with open(eval_path, "r", encoding="utf-8") as f:
                eval_data = json.load(f)
            logger.info(f"📂 Loaded {len(eval_data)} questions from {args.eval_file}")
        else:
            logger.error(f"Evaluation file not found: {args.eval_file}")
            sys.exit(1)
    else:
        eval_data = SAMPLE_EVAL_DATASET
        logger.info(f"📂 Using sample dataset with {len(eval_data)} questions")
    
    # Run evaluation
    evaluator = RAGASEvaluator(team=args.team)
    results = await evaluator.evaluate_dataset(eval_data)
    
    # Generate and print report
    report = generate_report(results)
    print("\n" + report)
    
    # Save report
    if args.report:
        with open(args.report, "w", encoding="utf-8") as f:
            f.write(report)
        logger.info(f"📄 Report saved to: {args.report}")
    
    # Save JSON results
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2)
        logger.info(f"💾 Results saved to: {args.output}")


if __name__ == "__main__":
    asyncio.run(main())
