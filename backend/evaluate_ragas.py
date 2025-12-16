"""
=============================================================================
RAGAS EVALUATION SCRIPT
=============================================================================
Measures RAG pipeline quality with two key metrics:
- Faithfulness: Did the AI hallucinate info not in the documents?
- Answer Relevancy: Did it actually answer the user's question?

Uses Mistral AI API for stable evaluation (avoids local LLM VRAM issues).

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
import os
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

from langchain_mistralai import ChatMistralAI
from langchain_huggingface import HuggingFaceEmbeddings

from src.services.query import get_query_service

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# =============================================================================
# MISTRAL AI CONFIGURATION
# =============================================================================

# Mistral API Key for RAGAS evaluation
# Your RAG still uses the local SLM; Mistral is only used to *judge* quality
MISTRAL_API_KEY = os.environ.get("MISTRAL_API_KEY", "PmDkL3NvP3gmhBkZGfKvvHr0nZNG6AKx")


# =============================================================================
# EVALUATION DATASET
# =============================================================================

SAMPLE_EVAL_DATASET = [
    # JWTL IT Security Audit specific questions
    {
        "question": "What are the critical items mentioned in the security audit?",
        "ground_truth": "Critical items include establishing critical alerting for mission-critical events and security training for staff."
    },
    {
        "question": "What is the recommendation for critical alerting?",
        "ground_truth": "Define and configure alerts for mission-critical events such as 50+ failed login attempts in 5 minutes, EDR detection on a server, and Firewall HA failure."
    },
    {
        "question": "What is the log retention policy recommendation?",
        "ground_truth": "Log retention should be 90 days local storage on the SIEM and 1 year archived to low-cost cloud storage."
    },
    {
        "question": "What is the status of security training?",
        "ground_truth": "Security training status is None. Staff are untrained on identifying phishing, malware, or safe handling of company data."
    },
    {
        "question": "What are the Windows Server log recommendations?",
        "ground_truth": "Windows Server logs, especially Security logs, should be configured with sufficient maximum size to prevent rapid overwriting before forwarding to SIEM."
    },
    {
        "question": "What is the phishing reporting status?",
        "ground_truth": "Phishing reporting status is None - there is no mechanism for staff to report phishing attempts."
    },
    {
        "question": "What are the escalation matrix recommendations?",
        "ground_truth": "Create an escalation matrix to define who is notified for different severity levels of security events."
    },
    {
        "question": "What mission-critical events should trigger alerts?",
        "ground_truth": "50+ failed login attempts in 5 minutes, EDR detection on a server, and Firewall HA failure should trigger immediate alerts."
    },
    {
        "question": "Why is security training considered critical?",
        "ground_truth": "Staff are untrained on identifying phishing, malware, or safe handling of company data, making them the weakest security link."
    },
    {
        "question": "What is the impact of lacking security training?",
        "ground_truth": "Without security training, staff become the weakest security link as they cannot identify phishing or malware threats."
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
    
    Uses Mistral AI API for evaluation (stable, no VRAM issues).
    Your RAG responses are still generated by your local SLM.
    """
    
    def __init__(self, team: str):
        self.team = team
        self.query_service = get_query_service()
        
        # Setup RAGAS LLM using Mistral AI API
        logger.info("🔗 Connecting to Mistral AI API for evaluation...")
        mistral_llm = ChatMistralAI(
            model="mistral-large-latest",
            api_key=MISTRAL_API_KEY,
            temperature=0.0,  # Deterministic for evaluation
        )
        self.llm = LangchainLLMWrapper(mistral_llm)
        
        # Embeddings (still local - fast and free)
        self.embeddings = LangchainEmbeddingsWrapper(
            HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
        )
        
        logger.info(f"📊 RAGAS Evaluator initialized for team: {team}")
        logger.info("   → Evaluation LLM: Mistral AI (mistral-large-latest)")
        logger.info("   → RAG responses: Your local SLM")
    
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
        
        logger.info("📈 Computing RAGAS metrics using Mistral AI...")
        logger.info("   (This uses API calls - may take 1-2 minutes)")
        
        # Run RAGAS evaluation
        try:
            logger.info("🔄 Starting RAGAS evaluate()...")
            results = evaluate(
                dataset=dataset,
                metrics=[faithfulness, answer_relevancy],
                llm=self.llm,
                embeddings=self.embeddings,
            )
            logger.info(f"✅ RAGAS evaluate() completed!")
            
            # Extract scores
            try:
                df = results.to_pandas()
                logger.info(f"📊 Results DataFrame columns: {list(df.columns)}")
                faithfulness_score = df["faithfulness"].mean() if "faithfulness" in df.columns else 0.0
                relevancy_score = df["answer_relevancy"].mean() if "answer_relevancy" in df.columns else 0.0
                logger.info(f"   Faithfulness: {faithfulness_score:.3f}")
                logger.info(f"   Answer Relevancy: {relevancy_score:.3f}")
            except Exception as extract_err:
                logger.warning(f"Could not extract from pandas: {extract_err}")
                faithfulness_score = getattr(results, 'faithfulness', 0.0)
                relevancy_score = getattr(results, 'answer_relevancy', 0.0)
            
            return {
                "metrics": {
                    "faithfulness": float(faithfulness_score) if faithfulness_score is not None else None,
                    "answer_relevancy": float(relevancy_score) if relevancy_score is not None else None,
                },
                "num_questions": len(questions),
                "team": self.team,
                "evaluator": "Mistral AI (mistral-large-latest)",
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
        f"Evaluator: {results.get('evaluator', 'Local LLM')}",
        f"Questions Evaluated: {results.get('num_questions', 0)}",
        "",
        "-" * 60,
        "METRICS",
        "-" * 60,
    ]
    
    metrics = results.get("metrics", {})
    
    faithfulness_score = metrics.get("faithfulness")
    relevancy_score = metrics.get("answer_relevancy")
    
    if faithfulness_score is not None and not (isinstance(faithfulness_score, float) and faithfulness_score != faithfulness_score):
        lines.append(f"Faithfulness:       {faithfulness_score:.3f}")
        lines.append("  → Measures if answers only contain info from documents")
        lines.append("  → Higher = less hallucination")
    else:
        lines.append("Faithfulness:       N/A (evaluation failed)")
    
    lines.append("")
    
    if relevancy_score is not None and not (isinstance(relevancy_score, float) and relevancy_score != relevancy_score):
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
    parser = argparse.ArgumentParser(description="RAGAS Evaluation for HO RAG (using Mistral AI)")
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
