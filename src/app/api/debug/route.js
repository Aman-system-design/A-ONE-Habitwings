import { NextResponse } from 'next/server';

export async function GET() {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim();
  
  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: 'No GEMINI_API_KEY found' });
  }

  // List of models to try
  const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-3.5-flash', 'gemini-flash-latest'];
  const results = {};

  const bodyPayload = {
    contents: [
      { role: 'user', parts: [{ text: 'Hello, respond with exactly "OK"' }] }
    ]
  };

  for (const model of models) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload)
      });
      const resText = await res.text();
      results[model] = {
        status: res.status,
        ok: res.ok,
        body: resText.slice(0, 300) // keep it short
      };
    } catch (err) {
      results[model] = { error: err.message };
    }
  }

  return NextResponse.json({
    hasGeminiKey: true,
    results
  });
}
