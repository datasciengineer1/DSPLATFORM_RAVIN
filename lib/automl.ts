export type AutoOut = { task:string; recommendedModel:string; reasons:string[]; options:string[] };

function guessTask(nlq:string): string {
  const q = nlq.toLowerCase();
  const forecastingHints = /(forecast|next|time series|trend|future|sarima|arima|prophet|seasonal)/;
  const classificationHints = /(classif|churn|probability of|predict whether|yes|no|segment|categor|fraud)/;
  const regressionHints = /(how much|continuous|amount|price|sales|revenue|numeric|estimate)/;
  const clusteringHints = /(cluster|group|kmeans|segment customers without labels)/;

  if (forecastingHints.test(q)) return "forecasting";
  if (classificationHints.test(q)) return "classification";
  if (clusteringHints.test(q)) return "clustering";
  if (regressionHints.test(q)) return "regression";
  // default
  return "regression";
}

export function autoSelect(nlq:string): AutoOut {
  const task = guessTask(nlq);
  const reasons = [`Detected task from NLQ phrasing: "${task}".`];

  if (task==="forecasting") {
    return {
      task,
      recommendedModel: /seasonal|weekly|monthly/.test(nlq.toLowerCase()) ? "SARIMA" : "Prophet",
      reasons: reasons.concat([
        "Time references or seasonality hints → forecasting.",
        "Prophet handles holiday/seasonality well; SARIMA if strong seasonal AR structure is likely."
      ]),
      options: ["Moving Average","ARIMA","SARIMA","Prophet"]
    };
  }
  if (task==="classification") {
    return {
      task,
      recommendedModel: "XGBoost Classifier",
      reasons: reasons.concat(["Binary/label phrases found.", "XGBoost is a strong baseline for tabular classification."]),
      options: ["Logistic Regression","Random Forest Classifier","XGBoost Classifier","CatBoost Classifier"]
    };
  }
  if (task==="clustering") {
    return {
      task,
      recommendedModel: "KMeans",
      reasons: reasons.concat(["Unsupervised grouping requested."]),
      options: ["KMeans","DBSCAN","HDBSCAN"]
    };
  }
  // regression
  return {
    task,
    recommendedModel: "XGBoost Regressor",
    reasons: reasons.concat(["Asking for continuous values.", "XGBoost is a robust default for tabular regression."]),
    options: ["Linear Regression","Ridge","Lasso","Random Forest Regressor","XGBoost Regressor","CatBoost Regressor"]
  };
}
