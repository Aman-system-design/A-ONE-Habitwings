import { NextResponse } from 'next/server';

export async function GET() {
  const geminiKey = process.env.GEMINI_API_KEY;
  const envKeys = Object.keys(process.env).filter(k => !k.startsWith('npm_'));
  
  return NextResponse.json({
    timestamp: '2026-07-18T09:42:00Z',
    gitCommit: '80dae32 (fix: force fresh Vercel build to pick up GEMINI_API_KEY env var)',
    hasGeminiKey: !!geminiKey,
    geminiKeyLength: geminiKey ? geminiKey.length : 0,
    availableEnvKeys: envKeys
  });
}
