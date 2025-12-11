# RAGAS Evaluation Workflow

This workflow describes how to run the RAGAS evaluation framework on the HO RAG backend.

## Prerequisites
Ensure all dependencies are installed:
```bash
pip install -r requirements.txt
```

## Running Evaluation
Run the evaluation script from the `backend` directory:

```bash
cd backend
python evaluate_ragas.py --team Finance
```

### Options
- `--team`: partial collection name to evaluate (default: "Finance")
- `--output`: Save results to a JSON file (e.g., `--output results.json`)
- `--report`: Save text report to a file (default: "ragas_report.txt")
- `--eval-file`: Use a custom dataset JSON file (default: uses internal sample or "eval_dataset.json")

### Example with Custom Dataset
```bash
python evaluate_ragas.py --team Engineering --eval-file eval_dataset.json --output engineer_results.json
```

## Metrics Calculated
1. **Faithfulness**: Accuracy of the answer based *only* on the context.
2. **Answer Relevancy**: Relevance of the generated answer to the query.
3. **Context Precision**: Signal-to-noise ratio of retrieved context.
4. **Context Recall**: Whether all relevant information was retrieved.
5. **Answer Correctness**: Overall correctness vs ground truth.
