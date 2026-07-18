import { NextResponse } from 'next/server';

export async function GET() {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim();
  
  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: 'No GEMINI_API_KEY found' });
  }

  const endpoint25 = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  const endpoint15 = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  const bodyPayload = {
    contents: [
      { role: 'user', parts: [{ text: 'Hello, respond with exactly "OK"' }] }
    ]
  };

  const results = {};

  // Test 2.5 Flash
  try {
    const res = await fetch(endpoint25, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload)
    });
    results.gemini25 = {
      status: res.status,
      ok: res.ok,
      body: await res.text()
    };
  } catch (err) {
    results.gemini25 = { error: err.message };
  }

  // Test 1.5 Flash
  try {
    const res = await fetch(endpoint15, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload)
    });
    results.gemini15 = {
      status: res.status,
      ok: res.ok,
      body: await res.text()
    };
  } catch (err) {
    results.gemini15 = { error: err.message };
  }

  return NextResponse.json({
    hasGeminiKey: true,
    geminiKeyLength: GEMINI_API_KEY.length,
    results
  });
}
