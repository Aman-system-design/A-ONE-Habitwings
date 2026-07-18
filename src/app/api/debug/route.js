import { NextResponse } from 'next/server';

export async function GET() {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim();
  
  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: 'No GEMINI_API_KEY found' });
  }

  const endpointModels = `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`;
  
  try {
    const res = await fetch(endpointModels);
    const data = await res.json();
    return NextResponse.json({
      hasGeminiKey: true,
      models: data.models?.map(m => m.name) || data
    });
  } catch (err) {
    return NextResponse.json({ error: err.message });
  }
}
