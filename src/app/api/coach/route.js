import { NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// Offline heuristic fallback when Gemini is unreachable
function offlineFallback(userMessage, profile) {
  const msg = userMessage.toLowerCase();
  const interests = (profile?.interests || []).join(', ') || 'general activities';
  const habit = profile?.habit || 'your habit';

  if (msg.includes('urge') || msg.includes('crav') || msg.includes('want to') || msg.includes('tempt') || msg.includes('feel like')) {
    return `I hear you — that urge is real, but it peaks in about 10 minutes and then fades. Let's redirect that energy! Since you enjoy ${interests}, try this: spend the next 2 minutes brainstorming something creative related to your interests. Set a micro-timer. The urge will pass before you know it. You've got this!`;
  }
  if (msg.includes('slip') || msg.includes('fail') || msg.includes('broke') || msg.includes('relapse') || msg.includes('gave in')) {
    return `A slip is data, not defeat. Research shows that people who treat setbacks with self-compassion recover faster than those who beat themselves up. What triggered it? Understanding the trigger is more valuable than the guilt. Let's adjust your If-Then plan for next time.`;
  }
  if (msg.includes('bored') || msg.includes('lonely') || msg.includes('tired') || msg.includes('stress') || msg.includes('hungry') || msg.includes('angry')) {
    return `HALT check detected! You might be feeling Hungry, Angry, Lonely, or Tired — these amplify urges dramatically. Address the root feeling first: drink water, eat something small, text a friend, or take a 5-minute rest. Once you handle the HALT state, the craving often shrinks on its own.`;
  }
  if (msg.includes('good') || msg.includes('resist') || msg.includes('proud') || msg.includes('streak') || msg.includes('made it')) {
    return `YES! That's your prefrontal cortex getting stronger with every single resist. Each time you ride out an urge, the neural pathway for self-control literally gets reinforced. You're rewiring your brain right now. Keep that momentum!`;
  }
  return `Tell me more about what you're feeling right now. The more specific you are, the better I can help redirect your energy into something you actually enjoy. Remember: urges are waves — they peak and they pass. You don't have to fight them, just ride them out.`;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { message, profile, logs, mode } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const habit = escapeHtml(profile?.habit || 'harmful habit');
    const goal = escapeHtml(profile?.goal || 'reduce or quit');
    const vibe = profile?.vibe || 'Supportive';
    const interests = (profile?.interests || []).map(i => escapeHtml(i)).join(', ') || 'general activities';
    const triggers = (profile?.triggers || []).map(t => escapeHtml(t)).join(', ') || 'various triggers';
    const recentLogs = (logs || []).slice(0, 5);

    let systemPrompt = '';

    if (mode === 'sos') {
      systemPrompt = `You are the voice coach of A-ONE Habitwings, an urgent craving intervention assistant.
The user is experiencing a craving RIGHT NOW for their bad habit: "${habit}".
Their goal: ${goal}. Their known triggers: ${triggers}.
Their personal interests/hobbies: ${interests}.

YOUR CRITICAL MISSION:
1. Acknowledge their urge with empathy — don't dismiss it.
2. Remind them urges peak in 10-15 minutes and WILL pass (cite the neuroscience — prefrontal cortex vs reward system).
3. Give them a SPECIFIC, FUN, personalized micro-activity based on their interests that will occupy them for 2-5 minutes. Make it engaging and dopamine-producing — it must compete with the bad habit for attention.
4. Be ${vibe} in tone. Keep it SHORT — max 3-4 sentences since this will be spoken aloud.

Examples of interest-based redirects:
- If they like brainstorming: "Quick challenge: 3 business ideas for a space restaurant in 30 seconds. GO!"
- If they like films: "Pop quiz: name 3 movies where the villain actually wins. Timer starts now."
- If they like music: "Hum your favorite chorus right now. What memory does it bring back?"
- If they like gaming: "Design a boss fight in 2 sentences. What's the mechanic?"

Recent activity logs: ${JSON.stringify(recentLogs)}`;
    } else if (mode === 'mission') {
      systemPrompt = `You are the daily mission generator for A-ONE Habitwings.
The user's bad habit: "${habit}". Goal: ${goal}. Triggers: ${triggers}. Interests: ${interests}.
Recent logs: ${JSON.stringify(recentLogs)}

Generate a SPECIFIC, ACTIONABLE daily mission for today. It must:
1. Be based on their actual log patterns (when they slip, what triggers them).
2. Include a concrete If-Then plan: "IF [specific trigger situation], THEN [specific action]."
3. Include one interest-based replacement activity.
4. Be 2-3 sentences max. Be direct and specific, not vague.`;
    } else if (mode === 'insights') {
      systemPrompt = `You are the pattern analyst for A-ONE Habitwings.
User's bad habit: "${habit}". Goal: ${goal}. Triggers: ${triggers}. Interests: ${interests}.
Full activity logs: ${JSON.stringify(recentLogs)}

Analyze their logs and provide:
1. Their #1 vulnerability pattern (time of day, trigger type, situation).
2. What's working (which replacement activities or strategies show success).
3. One specific adjustment to their strategy.
4. A HALT check reminder if relevant.
Keep it concise — 4-5 bullet points max. Use data from their logs, not generic advice.`;
    } else {
      systemPrompt = `You are the AI voice coach for A-ONE Habitwings.
The user's bad habit: "${habit}". Goal: ${goal}. Known triggers: ${triggers}. Interests: ${interests}.
Coach vibe: ${vibe}. Recent logs: ${JSON.stringify(recentLogs)}

You are NOT a chatbot. You are an active recovery coach who:
- References the user's actual history and patterns
- Suggests personalized, interest-based activities to redirect urges
- Uses affect labeling (help them NAME their feelings to reduce urge intensity)
- Keeps responses SHORT (2-4 sentences) since they may be spoken aloud
- Uses science-backed techniques: urge surfing, cognitive reappraisal, HALT checks, if-then plans`;
    }

    // Try Gemini API
    if (!GEMINI_API_KEY) {
      return NextResponse.json({
        reply: offlineFallback(message, profile),
        engine: 'offline'
      });
    }

    try {
      const apiResponse = await fetch(GEMINI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: systemPrompt + '\n\n---\nUser says: ' + message }] }
          ]
        })
      });

      if (!apiResponse.ok) {
        throw new Error(`Gemini API returned ${apiResponse.status}`);
      }

      const data = await apiResponse.json();
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!reply) throw new Error('Empty API response');

      return NextResponse.json({ reply, engine: 'gemini' });
    } catch (apiError) {
      console.error('Gemini API error, falling back to offline:', apiError.message);
      return NextResponse.json({
        reply: offlineFallback(message, profile),
        engine: 'offline'
      });
    }
  } catch (error) {
    console.error('Coach route error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
