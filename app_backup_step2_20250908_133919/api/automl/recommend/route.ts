import { NextResponse } from 'next/server';
export async function GET(){
  return NextResponse.json({
    models: [
      { name: "LogisticRegression", why: "Fast, interpretable baseline for binary targets." },
      { name: "RandomForest",       why: "Strong tabular baseline, handles nonlinearity." },
      { name: "XGBoost",            why: "State-of-the-art on many tabular tasks." },
      { name: "MLP (Deep)",         why: "Simple deep learner for tabular; captures interactions." },
      { name: "TabNet (Deep)",      why: "Attention-based deep learning for tabular data." }
    ]
  });
}
