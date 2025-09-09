export const runtime = 'nodejs';
export async function POST(req: Request) {
  const { question } = await req.json();
  const q = String(question || "").toLowerCase();
  const isForecast = /forecast|next\s+\d+|future|predict/i.test(q);
  const isClassify = /classif|churn|fraud|spam|yes\/no|binary/i.test(q);
  const taskType = isClassify ? "classification" : "regression";
  const suggestedTarget =
    /revenue|sale|sales/.test(q) ? "Sales" :
    /churn/.test(q) ? "Churn" :
    "Target";
  const recommendedModels = taskType==="classification"
    ? ["LogisticRegression","RandomForest","XGBoost","LightGBM","NeuralNet"]
    : ["LinearRegression","RandomForestRegressor","XGBoostRegressor","LSTM"];
  return Response.json({ taskType, suggestedTarget, recommendedModels });
}
