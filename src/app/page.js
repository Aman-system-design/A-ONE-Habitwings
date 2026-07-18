"use client";
import { useState, useEffect, useRef, useCallback } from "react";

// ─── Utility: HTML Escaper ───
function escapeHtml(str) {
  if (typeof str !== "string") return String(str);
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}

// ─── Default State ───
const DEFAULT_PROFILE = null;
const INTEREST_OPTIONS = [
  "Brainstorming Ideas","Film & TV Trivia","Music & Singing","Gaming Strategy",
  "Sketching & Doodling","Cooking Hacks","Sports Trivia","Puzzles & Riddles",
  "Writing Stories","Science Facts","Memes & Comedy","Fitness Challenges"
];
const TRIGGER_OPTIONS = ["Boredom","Stress","Loneliness","Fatigue","Anxiety","Social Pressure","Automatic Routine","FOMO"];
const HABIT_OPTIONS = [
  "Excessive Screen Time / Doom Scrolling","Vaping / Smoking","Procrastination","Junk Food / Overeating",
  "Impulsive Shopping","Nail Biting","Social Media Addiction","Gaming Addiction"
];

// ─── Speech Utilities ───
function speak(text, onEnd) {
  if (typeof window === "undefined" || !window.speechSynthesis) { onEnd?.(); return; }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.0; u.pitch = 1.0; u.volume = 1;
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v => v.lang.startsWith("en") && v.name.toLowerCase().includes("female")) 
    || voices.find(v => v.lang.startsWith("en")) || voices[0];
  if (preferred) u.voice = preferred;
  u.onend = () => onEnd?.();
  window.speechSynthesis.speak(u);
}

function useSpeechRecognition() {
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  const startListening = useCallback(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("Speech recognition not supported in this browser. Try Chrome or Edge."); return; }
    const r = new SpeechRecognition();
    r.continuous = false; r.interimResults = false; r.lang = "en-US";
    r.onresult = (e) => { setTranscript(e.results[0][0].transcript); setListening(false); };
    r.onerror = () => setListening(false);
    r.onend = () => setListening(false);
    recognitionRef.current = r;
    setTranscript(""); setListening(true); r.start();
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop(); setListening(false);
  }, []);

  return { transcript, listening, startListening, stopListening, setTranscript };
}

// ─── API Helper ───
async function callCoach(message, profile, logs, mode = "general") {
  try {
    const res = await fetch("/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, profile, logs, mode }),
    });
    const data = await res.json();
    return data;
  } catch {
    return { reply: "I'm having trouble connecting. Take a deep breath — urges pass in 10 minutes. You've got this.", engine: "offline" };
  }
}

// ─── Main App ───
export default function Home() {
  // State
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [logs, setLogs] = useState([]);
  const [theme, setTheme] = useState("dark");
  const [screen, setScreen] = useState("onboarding"); // onboarding | dashboard | sos
  const [toast, setToast] = useState(null);
  const [dailyMission, setDailyMission] = useState("");
  const [insights, setInsights] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [sosStep, setSosStep] = useState("halt"); // halt | breathing | activity | voice
  const [sosResponse, setSosResponse] = useState("");
  const [breathPhase, setBreathPhase] = useState("ready"); // ready | inhale | hold | exhale | holdEmpty
  const [breathCount, setBreathCount] = useState(0);
  const [urgeTimer, setUrgeTimer] = useState(600); // 10 min in seconds
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [missionLoading, setMissionLoading] = useState(false);

  // Onboarding form state
  const [formHabit, setFormHabit] = useState(HABIT_OPTIONS[0]);
  const [formCustomHabit, setFormCustomHabit] = useState("");
  const [formGoal, setFormGoal] = useState("");
  const [formTriggers, setFormTriggers] = useState(["Boredom"]);
  const [formInterests, setFormInterests] = useState([]);
  const [formVibe, setFormVibe] = useState("Supportive");

  // Log form state
  const [logOutcome, setLogOutcome] = useState("swap");
  const [logIntensity, setLogIntensity] = useState(5);
  const [logTrigger, setLogTrigger] = useState("Boredom");
  const [logNote, setLogNote] = useState("");

  // Refs
  const chatEndRef = useRef(null);
  const breathIntervalRef = useRef(null);
  const urgeIntervalRef = useRef(null);

  // Speech recognition
  const { transcript, listening, startListening, stopListening, setTranscript } = useSpeechRecognition();

  // ─── Load/Save from localStorage ───
  useEffect(() => {
    const p = localStorage.getItem("habitwings_profile");
    const l = localStorage.getItem("habitwings_logs");
    const t = localStorage.getItem("habitwings_theme");
    if (p) { try { setProfile(JSON.parse(p)); setScreen("dashboard"); } catch {} }
    if (l) { try { setLogs(JSON.parse(l)); } catch {} }
    if (t) setTheme(t);
  }, []);

  useEffect(() => {
    if (profile) localStorage.setItem("habitwings_profile", JSON.stringify(profile));
    else localStorage.removeItem("habitwings_profile");
  }, [profile]);

  useEffect(() => { localStorage.setItem("habitwings_logs", JSON.stringify(logs)); }, [logs]);
  useEffect(() => {
    localStorage.setItem("habitwings_theme", theme);
    document.body.className = theme === "dark" ? "dark" : "";
  }, [theme]);

  // ─── Scroll chat to bottom ───
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  // ─── Load daily mission on dashboard mount ───
  useEffect(() => {
    if (screen === "dashboard" && profile && !dailyMission) fetchMission();
  }, [screen, profile]);

  // ─── Handle voice transcript in SOS ───
  useEffect(() => {
    if (transcript && screen === "sos") handleVoiceInput(transcript);
  }, [transcript]);

  // ─── Urge timer countdown ───
  useEffect(() => {
    if (screen === "sos") {
      setUrgeTimer(600);
      urgeIntervalRef.current = setInterval(() => {
        setUrgeTimer((prev) => { if (prev <= 1) { clearInterval(urgeIntervalRef.current); return 0; } return prev - 1; });
      }, 1000);
      return () => clearInterval(urgeIntervalRef.current);
    }
  }, [screen]);

  // ─── Toast ───
  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 3000); }

  // ─── Onboarding Submit ───
  function handleSetup(e) {
    e.preventDefault();
    if (formInterests.length === 0) { showToast("Pick at least 1 interest for personalized redirects!"); return; }
    const habit = formHabit === "Custom" ? formCustomHabit : formHabit;
    if (!habit || !formGoal) { showToast("Please fill in your habit and goal."); return; }
    const p = { habit, goal: formGoal, triggers: formTriggers, interests: formInterests, vibe: formVibe };
    setProfile(p);
    setScreen("dashboard");
    setChatMessages([{ role: "system", text: `Welcome to A-ONE Habitwings! I'm your AI coach. I know your interests (${formInterests.join(", ")}) and I'll use them to redirect your urges into something fun. Talk to me anytime!` }]);
    showToast("Profile created! Let's break some habits 🔥");
  }

  // ─── Toggle Chip ───
  function toggleChip(value, list, setter) {
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  // ─── Fetch Daily Mission ───
  async function fetchMission() {
    setMissionLoading(true);
    const data = await callCoach("Generate today's mission based on my logs and patterns.", profile, logs, "mission");
    setDailyMission(data.reply || "Start your day by putting your phone in another room for 30 minutes.");
    setMissionLoading(false);
  }

  // ─── Log Entry ───
  function handleLog(e) {
    e.preventDefault();
    const entry = {
      id: Date.now().toString(),
      outcome: logOutcome,
      intensity: logIntensity,
      trigger: logTrigger,
      note: logNote,
      timestamp: new Date().toISOString(),
    };
    setLogs((prev) => [entry, ...prev]);
    setLogNote(""); setLogIntensity(5);
    showToast(logOutcome === "swap" ? "Amazing! Swap logged! 🎯" : logOutcome === "resist" ? "Strong resist! 💪" : "Logged. No judgment — let's learn from it.");
  }

  // ─── Stats ───
  const totalLogs = logs.length;
  const swaps = logs.filter((l) => l.outcome === "swap").length;
  const resists = logs.filter((l) => l.outcome === "resist").length;
  const slips = logs.filter((l) => l.outcome === "slip").length;
  const successRate = totalLogs > 0 ? Math.round(((swaps + resists) / totalLogs) * 100) : 100;

  // Streak (consecutive days without a slip, counting back from today)
  const streak = (() => {
    let s = 0;
    const slipDays = new Set(logs.filter(l => l.outcome === "slip").map(l => l.timestamp.split("T")[0]));
    const resistDays = new Set(logs.filter(l => l.outcome !== "slip").map(l => l.timestamp.split("T")[0]));
    let d = new Date();
    for (let i = 0; i < 365; i++) {
      const ds = d.toISOString().split("T")[0];
      if (slipDays.has(ds)) break;
      if (resistDays.has(ds)) s++;
      else if (s === 0 && i < 2) { d.setDate(d.getDate() - 1); continue; }
      else break;
      d.setDate(d.getDate() - 1);
    }
    return s;
  })();

  // ─── Chat ───
  async function handleChat(e) {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", text: userMsg }]);
    setChatLoading(true);
    const data = await callCoach(userMsg, profile, logs, "general");
    setChatMessages((prev) => [...prev, { role: "coach", text: data.reply, engine: data.engine }]);
    setChatLoading(false);
    // Speak the response
    speak(data.reply);
  }

  // ─── SOS Mode ───
  function enterSOS() {
    setScreen("sos");
    setSosStep("halt");
    setSosResponse("");
    setBreathPhase("ready");
    setBreathCount(0);
  }

  function exitSOS() {
    setScreen("dashboard");
    clearInterval(breathIntervalRef.current);
    clearInterval(urgeIntervalRef.current);
    window.speechSynthesis?.cancel();
  }

  // HALT check answers
  const [haltAnswers, setHaltAnswers] = useState({ hungry: false, angry: false, lonely: false, tired: false });

  async function handleHaltDone() {
    const active = Object.entries(haltAnswers).filter(([,v]) => v).map(([k]) => k);
    let haltMsg = "";
    if (active.length > 0) {
      haltMsg = `HALT check: I'm feeling ${active.join(", ")}. `;
      speak(`I see you're feeling ${active.join(" and ")}. These states amplify urges. Let's address them first, then redirect your energy.`);
    }
    setSosStep("activity");
    // Get AI-powered activity redirect
    const data = await callCoach(
      `${haltMsg}I'm having a craving right now. Give me a personalized micro-activity based on my interests to redirect my attention for the next few minutes.`,
      profile, logs, "sos"
    );
    setSosResponse(data.reply);
    speak(data.reply);
  }

  // ─── Breathing Exercise ───
  function startBreathing() {
    setSosStep("breathing");
    let phase = 0; // 0=inhale,1=hold,2=exhale,3=holdEmpty
    let tick = 4;
    const phases = ["inhale", "hold", "exhale", "holdEmpty"];
    const labels = ["Breathe In...", "Hold...", "Breathe Out...", "Hold Empty..."];

    setBreathPhase(phases[0]);
    setBreathCount(4);
    speak("Let's do box breathing. Breathe in for 4 seconds.");

    breathIntervalRef.current = setInterval(() => {
      tick--;
      if (tick < 0) { phase = (phase + 1) % 4; tick = 3; setBreathPhase(phases[phase]); }
      setBreathCount(tick + 1);
    }, 1000);

    // Stop after 4 full cycles (64 seconds)
    setTimeout(() => {
      clearInterval(breathIntervalRef.current);
      setBreathPhase("ready");
      speak("Great job. Your nervous system is calming down. How do you feel now?");
      setSosStep("voice");
    }, 64000);
  }

  // ─── Voice Input in SOS ───
  async function handleVoiceInput(text) {
    setIsSpeaking(true);
    const data = await callCoach(text, profile, logs, "sos");
    setSosResponse(data.reply);
    speak(data.reply, () => setIsSpeaking(false));
  }

  // ─── Format Time ───
  function formatTimer(s) { return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,"0")}`; }
  function formatDate(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    } catch { return iso; }
  }

  // ─── Fetch Insights ───
  async function fetchInsights() {
    if (logs.length === 0) { setInsights("Log some activities first to get AI-powered insights!"); return; }
    setInsights("Analyzing your patterns...");
    const data = await callCoach("Analyze my logs and give me pattern insights, what's working, and one adjustment.", profile, logs, "insights");
    setInsights(data.reply);
  }

  // ─── RENDER ───
  return (
    <>
      {/* Toast */}
      {toast && <div className="toast" role="alert" aria-live="polite"><span>✦</span> {escapeHtml(toast)}</div>}

      {/* Decorative Backgrounds */}
      <div className="decor-circle decor-1" aria-hidden="true" />
      <div className="decor-circle decor-2" aria-hidden="true" />

      {/* SOS OVERLAY */}
      {screen === "sos" && (
        <div className="sos-overlay">
          <div className="sos-panel">
            <div className="sos-header">
              <h2>🆘 Craving Intervention</h2>
              <div className="sos-timer">Urge fades in: <strong>{formatTimer(urgeTimer)}</strong></div>
              <button className="btn btn-secondary btn-sm" onClick={exitSOS}>✕ Close</button>
            </div>

            {sosStep === "halt" && (
              <div className="sos-content fadeInUp">
                <h3>Quick HALT Check</h3>
                <p className="text-muted">These states amplify urges. Check what applies:</p>
                <div className="halt-grid">
                  {[["hungry","🍽️ Hungry"],["angry","😤 Angry/Frustrated"],["lonely","😔 Lonely"],["tired","😴 Tired"]].map(([key, label]) => (
                    <button key={key} className={`halt-btn ${haltAnswers[key] ? "active" : ""}`}
                      onClick={() => setHaltAnswers(prev => ({...prev, [key]: !prev[key]}))}>
                      {label}
                    </button>
                  ))}
                </div>
                <div className="sos-actions">
                  <button className="btn btn-primary" onClick={handleHaltDone}>Get My Redirect Activity →</button>
                  <button className="btn btn-secondary" onClick={startBreathing}>Start Breathing Exercise</button>
                </div>
              </div>
            )}

            {sosStep === "breathing" && (
              <div className="sos-content fadeInUp" style={{ textAlign: "center" }}>
                <h3>Box Breathing (4-4-4-4)</h3>
                <p className="text-muted">Slow your nervous system. Follow the circle.</p>
                <div className="breathing-circle-container">
                  <div className={`breathing-circle ${breathPhase}`} />
                  <div className="breath-label">
                    {breathPhase === "inhale" && "Breathe In"}
                    {breathPhase === "hold" && "Hold"}
                    {breathPhase === "exhale" && "Breathe Out"}
                    {breathPhase === "holdEmpty" && "Hold Empty"}
                    {breathPhase === "ready" && "Ready"}
                  </div>
                </div>
                <div className="breath-counter">{breathCount}s</div>
              </div>
            )}

            {sosStep === "activity" && (
              <div className="sos-content fadeInUp">
                <h3>🎯 Your Personalized Redirect</h3>
                <div className="voice-response">{sosResponse || "Generating your activity..."}</div>
                <div className="sos-actions">
                  <button className="btn btn-primary mic-btn-inline" onClick={listening ? stopListening : startListening}>
                    {listening ? "🔴 Listening..." : "🎤 Talk Back"}
                  </button>
                  <button className="btn btn-secondary" onClick={startBreathing}>Try Breathing Instead</button>
                  <button className="btn btn-secondary" onClick={() => setSosStep("voice")}>Voice Chat Mode</button>
                </div>
              </div>
            )}

            {sosStep === "voice" && (
              <div className="sos-content fadeInUp">
                <h3>🎤 Voice Coach</h3>
                <p className="text-muted">Tap the mic and tell me how you feel. I'll respond with my voice.</p>
                <div className="voice-panel">
                  <button className={`mic-btn ${listening ? "listening" : ""}`} onClick={listening ? stopListening : startListening}
                    aria-label={listening ? "Stop recording" : "Start recording"}>
                    {listening ? "🔴" : "🎙️"}
                  </button>
                  {listening && <p className="mic-status">Listening...</p>}
                  {transcript && <p className="transcript-text">You said: &ldquo;{escapeHtml(transcript)}&rdquo;</p>}
                </div>
                {sosResponse && <div className="voice-response">{sosResponse}</div>}
                {isSpeaking && <p className="speaking-indicator">🔊 Coach is speaking...</p>}
              </div>
            )}

            {/* Urge Wave Visual */}
            <div className="urge-wave-container">
              <svg viewBox="0 0 1200 60" className="urge-wave" preserveAspectRatio="none" role="img" aria-label="Urge wave animation">
                <path d="M0,30 Q150,0 300,30 T600,30 T900,30 T1200,30 V60 H0 Z" fill="currentColor" opacity="0.15" />
                <path d="M0,35 Q150,10 300,35 T600,35 T900,35 T1200,35 V60 H0 Z" fill="currentColor" opacity="0.08" />
              </svg>
            </div>
          </div>
        </div>
      )}

      <div className="app-container">
        {/* Header */}
        <header className="app-header">
          <div className="logo">
            <div className="logo-icon-bg">🦋</div>
            <div>
              <h1 className="logo-text">A-ONE <span className="accent-text">Habitwings</span></h1>
              <p className="tagline">AI voice coach for breaking bad habits</p>
            </div>
          </div>
          <div className="header-actions">
            <button className="btn-icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} title="Toggle theme" aria-label="Toggle dark and light theme">
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
            {profile && <button className="btn btn-secondary btn-sm" onClick={() => { setProfile(null); setScreen("onboarding"); }}>⚙️ Setup</button>}
          </div>
        </header>

        <main>
          {/* ═══ ONBOARDING ═══ */}
          {screen === "onboarding" && (
            <section className="screen-card fadeInUp">
              <div className="screen-header">
                <h2>Let&apos;s Build Your Recovery Profile</h2>
                <p className="text-muted">Takes 30 seconds. All data stays in your browser.</p>
              </div>
              <form onSubmit={handleSetup}>
                <div className="form-group">
                  <label htmlFor="habit-select">What habit are you fighting?</label>
                  <select id="habit-select" value={formHabit} onChange={(e) => setFormHabit(e.target.value)} required>
                    {HABIT_OPTIONS.map((h) => <option key={h} value={h}>{h}</option>)}
                    <option value="Custom">Custom...</option>
                  </select>
                  {formHabit === "Custom" && (
                    <input type="text" placeholder="e.g. Nail Biting" value={formCustomHabit}
                      onChange={(e) => setFormCustomHabit(e.target.value)} required style={{ marginTop: 8 }} />
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="goal-input">Your daily target / goal</label>
                  <input id="goal-input" type="text" placeholder="e.g. Max 1 hour screen time, Zero vaping, Study 3 hours daily"
                    value={formGoal} onChange={(e) => setFormGoal(e.target.value)} required />
                </div>

                <div className="form-group">
                  <label>What triggers your urges? (pick all that apply)</label>
                  <div className="chip-container">
                    {TRIGGER_OPTIONS.map((t) => (
                      <button key={t} type="button" className={`chip-label ${formTriggers.includes(t) ? "selected" : ""}`}
                        onClick={() => toggleChip(t, formTriggers, setFormTriggers)}>{t}</button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label>What do you ENJOY? (we&apos;ll use these to redirect your urges into something fun)</label>
                  <div className="chip-container">
                    {INTEREST_OPTIONS.map((i) => (
                      <button key={i} type="button" className={`chip-label interest ${formInterests.includes(i) ? "selected" : ""}`}
                        onClick={() => toggleChip(i, formInterests, setFormInterests)}>{i}</button>
                    ))}
                  </div>
                  {formInterests.length === 0 && <p className="help-text">⚡ Pick at least 1 — this powers your personalized redirects!</p>}
                </div>

                <div className="form-group">
                  <label htmlFor="vibe-select">Coach personality</label>
                  <select id="vibe-select" value={formVibe} onChange={(e) => setFormVibe(e.target.value)}>
                    <option value="Supportive">Supportive & Warm (gentle guide)</option>
                    <option value="Direct">Direct & Strict (tough love)</option>
                    <option value="Analytical">Analytical & Scientific (data nerd)</option>
                    <option value="Hype">Hype & Energetic (cheerleader)</option>
                  </select>
                </div>

                <button type="submit" className="btn btn-primary w-full">🦋 Launch Habitwings</button>
              </form>
            </section>
          )}

          {/* ═══ DASHBOARD ═══ */}
          {screen === "dashboard" && profile && (
            <>
              {/* Banner + SOS */}
              <div className="dashboard-header-panel">
                <div className="banner-info">
                  <div className="badge">{escapeHtml(profile.habit)}</div>
                  <h2>Your Recovery Dashboard</h2>
                  <p className="text-muted">Target: {escapeHtml(profile.goal)}</p>
                </div>
                <button className="btn btn-danger pulse-btn" onClick={enterSOS}>
                  🆘 Having a Craving!
                </button>
              </div>

              {/* Daily Mission */}
              <div className="card mission-card">
                <div className="mission-header">
                  <span>⚡</span>
                  <div>
                    <h4>Today&apos;s AI Mission</h4>
                    <p className="mission-text">{missionLoading ? "Generating your mission..." : (dailyMission || "Loading...")}</p>
                  </div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={fetchMission} disabled={missionLoading}>🔄 New Mission</button>
              </div>

              {/* Stats */}
              <div className="stats-grid">
                <div className="stat-card"><div className="stat-icon-bg primary">🔥</div><div className="stat-info"><span className="stat-value">{streak} days</span><span className="stat-label">Current Streak</span></div></div>
                <div className="stat-card"><div className="stat-icon-bg success">🎯</div><div className="stat-info"><span className="stat-value">{swaps} swaps</span><span className="stat-label">Habit Swaps</span></div></div>
                <div className="stat-card"><div className="stat-icon-bg danger">📊</div><div className="stat-info"><span className="stat-value">{successRate}%</span><span className="stat-label">Success Rate</span></div></div>
              </div>

              {/* Two Column: Log + Coach */}
              <div className="grid-2">
                {/* Left: Log + Timeline */}
                <div className="flex-col">
                  {/* Log Form */}
                  <div className="card">
                    <h3 className="card-title">📝 Log a Craving</h3>
                    <form onSubmit={handleLog}>
                      <div className="form-group">
                        <label>What happened?</label>
                        <div className="choice-container">
                          {[["swap","🔄 Swapped to Good Habit","swap"],["resist","💪 Resisted","resist"],["slip","😔 Slipped","slip"]].map(([val, label, cls]) => (
                            <button key={val} type="button" className={`choice-label ${cls} ${logOutcome === val ? "selected" : ""}`}
                              onClick={() => setLogOutcome(val)}>{label}</button>
                          ))}
                        </div>
                      </div>
                      <div className="form-group">
                        <label htmlFor="intensity-slider">Craving Intensity: <strong>{logIntensity}</strong>/10</label>
                        <input id="intensity-slider" type="range" min="1" max="10" value={logIntensity} onChange={(e) => setLogIntensity(Number(e.target.value))} />
                      </div>
                      <div className="form-group">
                        <label htmlFor="log-trigger-select">Trigger</label>
                        <select id="log-trigger-select" value={logTrigger} onChange={(e) => setLogTrigger(e.target.value)}>
                          {TRIGGER_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label htmlFor="log-note-input">Quick note (optional)</label>
                        <textarea id="log-note-input" rows="2" placeholder="What happened? What were you feeling?"
                          value={logNote} onChange={(e) => setLogNote(e.target.value)} />
                      </div>
                      <button type="submit" className="btn btn-primary w-full">Save Log</button>
                    </form>
                  </div>

                  {/* Timeline */}
                  <div className="card">
                    <div className="card-header-flex">
                      <h3 className="card-title">📋 Activity Timeline</h3>
                      {logs.length > 0 && <button className="btn btn-danger btn-sm" onClick={() => { if(confirm("Clear all logs?")) { setLogs([]); showToast("Logs cleared."); } }}>Clear</button>}
                    </div>
                    <div className="timeline-container">
                      {logs.length === 0 && <p className="text-muted text-center">No logs yet. Start tracking above!</p>}
                      {logs.slice(0, 10).map((log) => (
                        <div key={log.id} className="timeline-item">
                          <div className={`timeline-marker ${log.outcome}`}>
                            {log.outcome === "swap" ? "🔄" : log.outcome === "resist" ? "💪" : "😔"}
                          </div>
                          <div className="timeline-content">
                            <div className="timeline-header-row">
                              <span className="timeline-title">{log.outcome === "swap" ? "Swapped" : log.outcome === "resist" ? "Resisted" : "Slipped"}</span>
                              <span className="timeline-time">{formatDate(log.timestamp)}</span>
                            </div>
                            {log.note && <p className="timeline-body">{escapeHtml(log.note)}</p>}
                            <div className="timeline-footer">
                              <span className={`tag-indicator ${log.trigger.toLowerCase().replace(/\s/g,"")}`}>{escapeHtml(log.trigger)}</span>
                              <span className="intensity-badge">Intensity: {log.intensity}/10</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right: AI Coach + Insights */}
                <div className="flex-col">
                  {/* Voice Quick Access */}
                  <div className="card voice-quick-card">
                    <h3 className="card-title">🎤 Voice Coach — Talk to me</h3>
                    <p className="text-muted">Tap the mic and tell me how you feel. I&apos;ll listen and respond with my voice.</p>
                    <div className="voice-panel">
                      <button className={`mic-btn ${listening ? "listening" : ""}`}
                        onClick={listening ? stopListening : startListening}
                        aria-label={listening ? "Stop recording" : "Start recording"}>
                        {listening ? "🔴" : "🎙️"}
                      </button>
                      {listening && <p className="mic-status">Listening...</p>}
                    </div>
                    {transcript && !listening && (
                      <div className="voice-transcript">
                        <p>You said: &ldquo;{escapeHtml(transcript)}&rdquo;</p>
                      </div>
                    )}
                    {sosResponse && <div className="voice-response">{sosResponse}</div>}
                  </div>

                  {/* Text Chat */}
                  <div className="card chat-card">
                    <h3 className="card-title">💬 AI Coach Chat</h3>
                    <div className="chat-messages" id="chat-messages-box">
                      {chatMessages.map((msg, i) => (
                        <div key={i} className={`message ${msg.role === "user" ? "user-msg" : msg.role === "system" ? "system-msg" : "coach-msg"}`}>
                          {msg.text}
                        </div>
                      ))}
                      {chatLoading && <div className="message coach-msg">Thinking...</div>}
                      <div ref={chatEndRef} />
                    </div>
                    <form className="chat-input-form" onSubmit={handleChat}>
                      <input type="text" placeholder="Type or use voice above..." value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)} aria-label="Chat message input" />
                      <button type="submit" className="btn btn-primary btn-icon" disabled={chatLoading} aria-label="Send message">➤</button>
                    </form>
                  </div>

                  {/* AI Insights */}
                  <div className="card">
                    <div className="card-header-flex">
                      <h3 className="card-title">🧠 AI Pattern Insights</h3>
                      <button className="btn btn-secondary btn-sm" onClick={fetchInsights}>Analyze</button>
                    </div>
                    <div className="insights-body">{insights || "Log some activities, then click Analyze for AI-powered pattern detection."}</div>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}
