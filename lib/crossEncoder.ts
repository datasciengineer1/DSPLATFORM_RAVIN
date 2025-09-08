export function explainCrossEncoder(): string {
  return [
    "We combine three signals:",
    "1) Dense cosine — semantic similarity from embeddings (language-agnostic).",
    "2) Sparse/BM25-like — keyword/phrase overlap for lexical alignment.",
    "3) Cross-encoder re-rank — reads query and candidate together to score relevance in context.",
    "The final list is sorted by a weighted combination you selected on the NLQ page."
  ].join(" ");
}
