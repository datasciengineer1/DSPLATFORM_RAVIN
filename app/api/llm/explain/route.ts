import { NextResponse } from 'next/server'
import { z } from 'zod'
import { chatLLM, buildExplainPrompt } from '@/utils/llm'

export const runtime = 'nodejs'

const Body = z.object({
  prompt: z.string().optional(),
  question: z.string().optional(),
  metrics: z.any().optional(),
  facts: z.any().optional(),
  previewSample: z.array(z.any()).optional(),
  system: z.string().optional(),
  model: z.string().optional(),
  temperature: z.number().optional()
})

export async function POST(req: Request) {
  const body = Body.parse(await req.json())
  const prompt =
    body.prompt ||
    buildExplainPrompt({
      question: body.question,
      metrics: body.metrics,
      facts: body.facts,
      previewSample: body.previewSample
    })

  const text = await chatLLM({
    prompt,
    system: body.system,
    model: body.model,
    temperature: body.temperature
  })

  return NextResponse.json({ text })
}
