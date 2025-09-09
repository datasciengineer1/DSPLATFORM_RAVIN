import ollama from "ollama";

type Body = {
  question?: string;
  datasetId?: string | null;
  context?: string;
  mode?: "fast" | "default";
  questionLang?: string; // e.g., "es-ES"
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;

  const mode = body.mode || "fast";
  const model =
    mode === "fast"
      ? process.env.OLLAMA_FAST_MODEL || "llama3.1:8b-instruct-q5_1"
      : process.env.OLLAMA_MODEL || "llama3.1:8b-instruct-q8_0";

  const question = (body.question || "").trim();
  const datasetId = body.datasetId || "";
  const context = (body.context || "").trim();
  const hintLang = (body.questionLang || "").trim();

  const system = [
    "You are an analytics copilot that produces business-friendly explanations.",
    "Always respond in the same language as the user's question.",
    hintLang ? `If language detection is ambiguous, respond in ${hintLang}.` : "",
    "Use the following structure with clear labels:",
    "- What was asked",
    "- What I did (logic)",
    "- Key drivers/patterns (3–5 bullets)",
    "- Confidence & caveats (1–3 bullets)",
    "- Next best actions (2–4 bullets)"
  ].filter(Boolean).join("\n");

  const user = [
    question ? `Q: ${question}` : "",
    datasetId ? `Dataset: ${datasetId}` : "",
    context ? `Context:\n${context}` : ""
  ].filter(Boolean).join("\n\n");

  const resp = await ollama.chat({
    model,
    stream: false,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    options: { temperature: 0.1, top_p: 0.9, num_predict: mode === "fast" ? 256 : 512 },
  });

  const answer = resp?.message?.content || "";
  return Response.json({ answer, provider: "ollama", model });
}
