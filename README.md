# 🦋 A-ONE Habitwings — AI Voice Coach for Breaking Bad Habits

> **GenAI-powered habit-breaking companion** that uses voice coaching, personalized dopamine redirects, urge surfing science, and HALT checks to help users overcome harmful habits like excessive screen time, vaping, procrastination, and addictions.

**Live Demo**: [Deployed on Vercel](https://a-habitwings.vercel.app/)  
**Vertical**: Breaking Bad Habits & Addiction

---

## 🎯 Problem Statement

Build a GenAI-powered solution that helps users reduce or overcome harmful habits such as excessive screen time or addictions. The solution must leverage Generative AI as a core component to deliver intelligent nudges, personalized tracking, adaptive coaching, and support mechanisms that encourage sustained behavior change.

---

## 🧠 Approach & Logic

### The Core Insight
Most habit apps fail because they're **passive trackers**. When a user is doom-scrolling Instagram at 11 PM, they won't voluntarily open a boring tracker app. 

**A-ONE Habitwings solves this by being MORE engaging than the bad habit itself.** Instead of fighting dopamine, we **redirect it** — using AI to generate personalized micro-activities based on what the user actually enjoys (brainstorming, film trivia, music challenges, game design, etc.).

### Science-Backed Framework
Our approach is built on peer-reviewed behavioral psychology:

1. **Habit Loop Deconstruction** (Charles Duhigg) — Map the Cue → Craving → Routine → Reward loop during onboarding, then generate a personalized replacement routine
2. **Urge Surfing** (Alan Marlatt) — Cravings peak in 10-15 minutes and fade. Our SOS mode includes a real-time countdown timer
3. **HALT Check** (Recovery Programs) — Hungry, Angry, Lonely, Tired states amplify urges. The SOS mode checks for these FIRST before intervening
4. **Affect Labeling** (Matthew Lieberman, UCLA) — Simply naming a feeling out loud reduces amygdala activation. Our **voice coach** leverages this — speaking about urges literally weakens them neurologically
5. **Implementation Intentions** (Peter Gollwitzer) — Pre-built If-Then plans that fire automatically during trigger moments
6. **Cognitive Reappraisal** — AI reframes urges using the user's own data: *"Last 4 times you scrolled past 11 PM, you felt worse afterward"*

### GenAI as Core Component
Generative AI (Google Gemini 2.5 Flash) powers **5 distinct features**, not just a chatbot:

| Feature | How GenAI Powers It |
|---|---|
| **🆘 SOS Craving Intervention** | AI generates personalized, interest-based micro-activities to redirect dopamine in real-time |
| **⚡ Daily AI Mission** | AI analyzes log patterns and generates specific, actionable If-Then plans for each day |
| **🎤 Voice Coach** | AI generates coaching responses that are spoken aloud via Web Speech API — combining affect labeling with cognitive reappraisal |
| **🧠 Pattern Intelligence** | AI detects vulnerability windows, trigger correlations, and strategy effectiveness from log data |
| **💬 Contextual Chat** | AI coach references the user's entire history, interests, and patterns — not generic advice |

---

## 🏗️ How the Solution Works

### Architecture
```
Next.js App Router on Vercel
├── /src/app/page.js          → Single-page React app (Client)
├── /src/app/layout.js        → Root layout with metadata
├── /src/app/globals.css      → Premium design system
├── /src/app/api/coach/route.js → Serverless AI endpoint (Server)
└── /test.js                  → Automated test suite
```

### Security Architecture
- **GEMINI_API_KEY** is stored exclusively in Vercel environment variables — never exposed to the client
- All AI calls go through the serverless `/api/coach` route — zero client-side API key exposure
- **HTML escaping** (`escapeHtml()`) wraps all user-generated content before rendering
- Input validation on all API endpoints

### User Flow
1. **Onboarding (30 seconds)**: User picks their bad habit, triggers, personal interests, and coach vibe
2. **Daily Dashboard**: Morning mission, quick-tap check-ins (Swapped / Resisted / Slipped), progress tracking
3. **🆘 SOS Mode (killer feature)**: When craving hits → HALT check → AI generates interest-based redirect → Guided breathing → Voice coach
4. **Voice Interaction**: Tap mic → speak → AI responds with voice (Web Speech API — zero cost)
5. **Pattern Analysis**: AI detects when and why the user is most vulnerable

### Offline Resilience
If the Gemini API is unreachable, the app **never shows an error**. A built-in heuristic NLP engine provides CBT-based responses matching the user's selected coach vibe, ensuring the app always works.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (React 19), App Router |
| Styling | Custom CSS design system with glassmorphism, dark/light themes |
| AI Engine | Google Gemini 2.5 Flash via serverless API routes |
| Voice Input | Web Speech API — `SpeechRecognition` (built-in, free) |
| Voice Output | Web Speech API — `SpeechSynthesis` (built-in, free) |
| Hosting | Vercel (serverless) |
| Data | Client-side localStorage (privacy-first — no server storage) |
| Testing | Node.js native `assert` module (zero dependencies) |

---

## ⚙️ Assumptions

1. Users have a modern browser (Chrome, Edge, or Safari) for Web Speech API support
2. The Gemini API key is configured as `GEMINI_API_KEY` in Vercel environment variables
3. The app works fully offline without an API key — the heuristic engine provides fallback responses
4. All user data is stored locally in the browser — no server-side user data storage
5. The voice coach is most effective on desktop/laptop due to microphone access

---

## 🧪 Testing

Run the automated test suite:
```bash
npm test
```

The test suite validates:
- **Security**: HTML escaping prevents XSS injection across all input types
- **Offline AI**: NLP keyword matching correctly routes to urge, slip, HALT, success, and generic responses
- **Statistics**: Swap/resist/slip counting, success rate percentages, and streak tracking
- **API Validation**: Request body validation for the coach endpoint

---

## 🚀 Local Development

```bash
# Install dependencies
npm install

# Create .env.local with your Gemini key (optional — works offline without it)
echo "GEMINI_API_KEY=your_key_here" > .env.local

# Start development server
npm run dev

# Run tests
npm test
```

---

## 📄 License

MIT
