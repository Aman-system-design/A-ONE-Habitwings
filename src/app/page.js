"use client";
import { useState, useEffect, useRef, useCallback } from "react";

// ─── Utility: HTML Escaper ───
function escapeHtml(str) {
  if (typeof str !== "string") return String(str);
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}

const INTEREST_OPTIONS = [
  "Brainstorming Ideas", "Film & TV Trivia", "Music & Singing", "Gaming Strategy",
  "Sketching & Doodling", "Puzzles & Riddles", "Science Facts"
];
const TRIGGER_OPTIONS = ["Boredom", "Stress", "Loneliness", "Fatigue", "Anxiety", "Social Pressure", "FOMO"];
const HABIT_OPTIONS = [
  "Excessive Screen Time / Doom Scrolling", "Vaping / Smoking", "Procrastination", 
  "Junk Food / Overeating", "Impulsive Shopping", "Social Media Addiction", "Custom..."
];

// ─── Speech Utilities ───
function speak(text, onEnd) {
  if (typeof window === "undefined" || !window.speechSynthesis) { onEnd?.(); return; }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.05; u.pitch = 1.0; u.volume = 1;
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
    return { reply: "I hear you. Take a deep breath — this craving will pass. Let's redirect that energy into something you enjoy right now.", engine: "offline" };
  }
}

export default function Home() {
  // States
  const [profile, setProfile] = useState(null);
  const [logs, setLogs] = useState([]);
  const [theme, setTheme] = useState("light");
  const [screen, setScreen] = useState("onboarding"); // onboarding | dashboard
  const [toast, setToast] = useState(null);
  
  // Onboarding setup states (EMPTY, NO hardcoded values — each user is unique)
  const [formHabit, setFormHabit] = useState(HABIT_OPTIONS[0]);
  const [formCustomHabit, setFormCustomHabit] = useState("");
  const [formGoal, setFormGoal] = useState("");
  const [formTriggers, setFormTriggers] = useState([]);
  const [formInterests, setFormInterests] = useState([]);
  const [formVibe, setFormVibe] = useState("Direct");

  // Dashboard Logging states
  const [logOutcome, setLogOutcome] = useState("swap");
  const [logIntensity, setLogIntensity] = useState(5);
  const [logTrigger, setLogTrigger] = useState("");
  const [logNote, setLogNote] = useState("");

  // Daily Mission / Insights states
  const [dailyMission, setDailyMission] = useState("");
  const [insights, setInsights] = useState("");
  const [missionLoading, setMissionLoading] = useState(false);

  // SOS Interventions States
  const [showSos, setShowSos] = useState(false);
  const [sosStep, setSosStep] = useState("halt"); // halt | breathing | redirect | voice
  const [sosResponse, setSosResponse] = useState("");
  const [haltAnswers, setHaltAnswers] = useState({ hungry: false, angry: false, lonely: false, tired: false });
  const [breathPhase, setBreathPhase] = useState("ready");
  const [breathCount, setBreathCount] = useState(0);
  const [urgeTimer, setUrgeTimer] = useState(600); // 10 minutes
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Chat
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const chatEndRef = useRef(null);
  const breathIntervalRef = useRef(null);
  const urgeIntervalRef = useRef(null);

  const { transcript, listening, startListening, stopListening } = useSpeechRecognition();

  // Load from localStorage
  useEffect(() => {
    const p = localStorage.getItem("habitwings_profile");
    const l = localStorage.getItem("habitwings_logs");
    const t = localStorage.getItem("habitwings_theme");
    if (p) {
      try {
        const parsed = JSON.parse(p);
        setProfile(parsed);
        setScreen("dashboard");
      } catch {}
    }
    if (l) { try { setLogs(JSON.parse(l)); } catch {} }
    if (t) setTheme(t);
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (profile) {
      localStorage.setItem("habitwings_profile", JSON.stringify(profile));
    } else {
      localStorage.removeItem("habitwings_profile");
    }
  }, [profile]);

  useEffect(() => { localStorage.setItem("habitwings_logs", JSON.stringify(logs)); }, [logs]);
  
  useEffect(() => {
    localStorage.setItem("habitwings_theme", theme);
    document.body.className = theme === "dark" ? "dark" : "";
  }, [theme]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  useEffect(() => {
    if (transcript && showSos) handleVoiceInput(transcript);
  }, [transcript]);

  // Load initial daily mission
  useEffect(() => {
    if (screen === "dashboard" && profile && !dailyMission) {
      fetchMission();
    }
  }, [screen, profile]);

  // Toast
  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 3000); }

  // ─── Setup Onboarding Profile ───
  function handleSetup(e) {
    e.preventDefault();
    const habit = formHabit === "Custom..." ? formCustomHabit : formHabit;
    if (!habit.trim() || !formGoal.trim()) {
      showToast("Please specify your habit and goal!");
      return;
    }
    if (formInterests.length === 0) {
      showToast("Pick at least 1 interest to redirect your urges!");
      return;
    }

    const p = {
      habit,
      goal: formGoal,
      triggers: formTriggers,
      interests: formInterests,
      vibe: formVibe
    };
    
    setProfile(p);
    setScreen("dashboard");
    setLogTrigger(formTriggers[0] || TRIGGER_OPTIONS[0]);
    setChatMessages([{ role: "system", text: `AI Coach initialized in ${formVibe} mode. I will guide you to swap "${habit}" for healthy routines.` }]);
    showToast("Profile set up successfully! 🚀");
  }

  // Toggle Chip
  function toggleChip(value, list, setter) {
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  // ─── Trigger SOS Overlay ───
  async function enterSOS() {
    setShowSos(true);
    setSosStep("halt");
    setSosResponse("");
    setBreathPhase("ready");
    setBreathCount(0);
    setUrgeTimer(600);

    const voicePitch = profile?.vibe === "Direct"
      ? `Attention! Stop scrolling and close the app. You committed to: ${profile.goal}. Cravings are temporary surges. Let's run a quick HALT check. Are you hungry, angry, lonely, or tired?`
      : `I see you are experiencing an urge to engage in "${profile?.habit || "your habit"}". Urges peak in 10 minutes. First, let's do a HALT check.`;
      
    speak(voicePitch);

    if (urgeIntervalRef.current) clearInterval(urgeIntervalRef.current);
    urgeIntervalRef.current = setInterval(() => {
      setUrgeTimer((prev) => {
        if (prev <= 1) { clearInterval(urgeIntervalRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  }

  function exitSOS() {
    setShowSos(false);
    clearInterval(urgeIntervalRef.current);
    clearInterval(breathIntervalRef.current);
    window.speechSynthesis?.cancel();
  }

  // ─── HALT complete ➔ AI Redirect ───
  async function handleHaltDone() {
    const active = Object.entries(haltAnswers).filter(([,v]) => v).map(([k]) => k);
    let promptMsg = `I am experiencing an urge right now. `;
    if (active.length > 0) {
      promptMsg += `My HALT check indicates I am feeling: ${active.join(", ")}. `;
    }
    promptMsg += "Acknowledge the urge, tell me to stop, and give me a specific, engaging 2-minute redirect activity based on my interests.";

    setSosStep("redirect");
    setSosResponse("Analyzing loop trigger...");

    const data = await callCoach(promptMsg, profile, logs, "sos");
    setSosResponse(data.reply);
    speak(data.reply);
  }

  // ─── Voice Input SOS Response ───
  async function handleVoiceInput(text) {
    setIsSpeaking(true);
    setSosResponse("Analyzing...");
    const data = await callCoach(
      `I answered: "${text}". Keep me accountable to my goal: "${profile?.goal}". Give me a brief, direct response.`,
      profile, logs, "sos"
    );
    setSosResponse(data.reply);
    speak(data.reply, () => setIsSpeaking(false));
  }

  // ─── Box Breathing ───
  function startBreathing() {
    setSosStep("breathing");
    let phase = 0;
    let tick = 4;
    const phases = ["inhale", "hold", "exhale", "holdEmpty"];
    setBreathPhase(phases[0]);
    setBreathCount(4);
    speak("Breathe in.");

    if (breathIntervalRef.current) clearInterval(breathIntervalRef.current);
    breathIntervalRef.current = setInterval(() => {
      tick--;
      if (tick < 0) {
        phase = (phase + 1) % 4;
        tick = 3;
        setBreathPhase(phases[phase]);
        if (phase === 0) speak("Breathe in.");
        if (phase === 1) speak("Hold.");
        if (phase === 2) speak("Breathe out.");
        if (phase === 3) speak("Hold.");
      }
      setBreathCount(tick + 1);
    }, 1000);

    setTimeout(() => {
      clearInterval(breathIntervalRef.current);
      setBreathPhase("ready");
      speak("Excellent. Your focus is recentered.");
      setSosStep("voice");
    }, 32000);
  }

  // ─── Log Entry ───
  function handleLog(e) {
    e?.preventDefault();
    const entry = {
      id: Date.now().toString(),
      outcome: logOutcome,
      intensity: logIntensity,
      trigger: logTrigger || (profile?.triggers[0] || "Boredom"),
      note: logNote,
      timestamp: new Date().toISOString()
    };
    setLogs(prev => [entry, ...prev]);
    setLogNote("");
    showToast(logOutcome === "swap" ? "Awesome! Swap logged! 🔄" : logOutcome === "resist" ? "Resisted successfully! 💪" : "Logged. Let's restart next loop.");
  }

  // SOS log submit
  function handleSosOutcome(outcome) {
    const entry = {
      id: Date.now().toString(),
      outcome,
      intensity: 8,
      trigger: "Urgent Cravings",
      note: "Intervention session triggered.",
      timestamp: new Date().toISOString()
    };
    setLogs(prev => [entry, ...prev]);
    exitSOS();
    showToast(outcome === "swap" ? "Awesome swap! 🎯" : outcome === "resist" ? "Craving surfed! 💪" : "Logged. Reset and restart.");
  }

  // ─── Fetch Mission ───
  async function fetchMission() {
    setMissionLoading(true);
    const data = await callCoach("Generate today's focus mission based on my triggers.", profile, logs, "mission");
    setDailyMission(data.reply || "Take a 5-minute break to stretch and focus before starting your session.");
    setMissionLoading(false);
  }

  // ─── Fetch Insights ───
  async function fetchInsights() {
    if (logs.length === 0) {
      setInsights("Log a few cravings to generate pattern trends!");
      return;
    }
    setInsights("Analyzing triggers...");
    const data = await callCoach("Analyze my logs and give me trigger patterns.", profile, logs, "insights");
    setInsights(data.reply);
  }

  // ─── Chat ───
  async function handleChat(e) {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    setChatMessages(prev => [...prev, { role: "user", text: userMsg }]);
    setChatLoading(true);
    const data = await callCoach(userMsg, profile, logs, "general");
    setChatMessages(prev => [...prev, { role: "coach", text: data.reply }]);
    setChatLoading(false);
    speak(data.reply);
  }

  // Stats
  const total = logs.length;
  const swaps = logs.filter(l => l.outcome === "swap").length;
  const resists = logs.filter(l => l.outcome === "resist").length;
  const successRate = total > 0 ? Math.round(((swaps + resists) / total) * 100) : 100;
  
  const streak = (() => {
    let s = 0;
    const slipDays = new Set(logs.filter(l => l.outcome === "slip").map(l => l.timestamp.split("T")[0]));
    const activeDays = new Set(logs.filter(l => l.outcome !== "slip").map(l => l.timestamp.split("T")[0]));
    let d = new Date();
    for (let i = 0; i < 30; i++) {
      const ds = d.toISOString().split("T")[0];
      if (slipDays.has(ds)) break;
      if (activeDays.has(ds)) { s++; d.setDate(d.getDate() - 1); }
      else if (s === 0 && i < 2) { d.setDate(d.getDate() - 1); continue; }
      else break;
    }
    return s;
  })();

  function formatTimer(s) {
    return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,"0")}`;
  }

  return (
    <>
      {toast && <div className="toast" role="alert"><span>✦</span> {escapeHtml(toast)}</div>}

      <div className="decor-circle decor-1" aria-hidden="true" />
      <div className="decor-circle decor-2" aria-hidden="true" />

      {/* 🆘 EMERGENCY SOS OVERLAY DIALOG */}
      {showSos && (
        <div className="sos-overlay">
          <div className="sos-panel">
            <div className="sos-header">
              <h2>🚨 AI Emergency Intervention</h2>
              <div className="sos-timer">Urge Surfer: <strong>{formatTimer(urgeTimer)}</strong></div>
              <button className="btn btn-secondary btn-sm" onClick={exitSOS}>✕ Close</button>
            </div>

            {sosStep === "halt" && (
              <div className="sos-content fadeInUp">
                <h3>Vulnerability Check (HALT)</h3>
                <p className="text-muted">Cravings latch on when your body is in one of these states. Check what applies:</p>
                <div className="halt-grid">
                  {[["hungry","🍽️ Hungry (Low Blood Sugar)"],["angry","😤 Angry / Stressed"],["lonely","😔 Lonely (Bored)"],["tired","😴 Tired / Sleepy"]].map(([key, label]) => (
                    <button key={key} className={`halt-btn ${haltAnswers[key] ? "active" : ""}`}
                      onClick={() => setHaltAnswers(prev => ({...prev, [key]: !prev[key]}))}>
                      {label}
                    </button>
                  ))}
                </div>
                <div className="sos-actions">
                  <button className="btn btn-primary w-full" onClick={handleHaltDone}>Get Focus Redirect ➔</button>
                  <button className="btn btn-secondary" onClick={startBreathing}>Do Box Breathing</button>
                </div>
              </div>
            )}

            {sosStep === "breathing" && (
              <div className="sos-content fadeInUp" style={{ textAlign: "center" }}>
                <h3>Box Breathing (4-4-4-4)</h3>
                <p className="text-muted">Inhale and hold to balance your nervous system.</p>
                <div className="breathing-circle-container">
                  <div className={`breathing-circle ${breathPhase}`} />
                  <div className="breath-label">
                    {breathPhase === "inhale" && "Inhale"}
                    {breathPhase === "hold" && "Hold"}
                    {breathPhase === "exhale" && "Exhale"}
                    {breathPhase === "holdEmpty" && "Hold"}
                    {breathPhase === "ready" && "Ready"}
                  </div>
                </div>
                <div className="breath-counter">{breathCount}s</div>
              </div>
            )}

            {sosStep === "redirect" && (
              <div className="sos-content fadeInUp">
                <h3>🎯 Focus Redirect Activity</h3>
                <div className="voice-response">{sosResponse}</div>
                <div className="sos-actions">
                  <button className={`btn btn-primary w-full ${listening ? "listening" : ""}`}
                    onClick={listening ? stopListening : startListening}>
                    {listening ? "🔴 Listening..." : "🎤 Respond (Voice Chat)"}
                  </button>
                  <button className="btn btn-secondary" onClick={startBreathing}>Try Breathing Instead</button>
                </div>
              </div>
            )}

            {sosStep === "voice" && (
              <div className="sos-content fadeInUp">
                <h3>🎤 Voice Coaching Session</h3>
                <div className="voice-panel">
                  <button className={`mic-btn ${listening ? "listening" : ""}`} onClick={listening ? stopListening : startListening}>
                    {listening ? "🔴" : "🎙️"}
                  </button>
                  {listening && <p className="mic-status">Listening...</p>}
                </div>
                {sosResponse && <div className="voice-response">{sosResponse}</div>}
                {isSpeaking && <p className="speaking-indicator">🔊 Coach is speaking...</p>}
              </div>
            )}

            {/* Resolve/Close */}
            <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--border-color)" }}>
              <p style={{ fontWeight: 700, marginBottom: 8, fontSize: 13 }}>Were you able to override the urge?</p>
              <div className="choice-container">
                <button className="btn btn-secondary btn-sm" onClick={() => handleSosOutcome("swap")}>🔄 Yes, Swapped to study</button>
                <button className="btn btn-secondary btn-sm" onClick={() => handleSosOutcome("resist")}>💪 Yes, surfed the urge</button>
                <button className="btn btn-danger btn-sm" onClick={() => handleSosOutcome("slip")}>😔 Slipped (I gave in)</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="app-container">
        {/* Header */}
        <header className="app-header">
          <div className="logo">
            <div className="logo-icon-bg">🦋</div>
            <div className="logo-text-group">
              <span className="logo-sub">A-ONE</span>
              <h1 className="logo-main">Habitwings</h1>
            </div>
          </div>
          <div className="header-actions">
            <button className="btn-icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} title="Toggle Theme" aria-label="Toggle light and dark theme">
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
            {profile && (
              <button className="btn btn-secondary btn-sm" onClick={() => { setProfile(null); setScreen("onboarding"); }}>⚙️ Reset Profile</button>
            )}
          </div>
        </header>

        <main>
          {/* ═══ ONBOARDING PROFILE SETUP SCREEN (NO PREFILLS) ═══ */}
          {screen === "onboarding" && (
            <section className="screen-card fadeInUp">
              <div className="screen-header" style={{ marginBottom: 20 }}>
                <h2>Create Your Recovery Profile</h2>
                <p className="text-muted">Enter your unique goals to get personalized AI warnings and swaps.</p>
              </div>

              <form onSubmit={handleSetup}>
                <div className="form-group">
                  <label htmlFor="habit-select">What habit are you fighting?</label>
                  <select id="habit-select" value={formHabit} onChange={(e) => setFormHabit(e.target.value)} required>
                    {HABIT_OPTIONS.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                  {formHabit === "Custom..." && (
                    <input type="text" placeholder="e.g. Scrolling Instagram, Vaping, Biting Nails"
                      value={formCustomHabit} onChange={(e) => setFormCustomHabit(e.target.value)} required style={{ marginTop: 8 }} />
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="goal-input">Your daily target / study goal</label>
                  <input id="goal-input" type="text" placeholder="e.g. Study for CAT Exam 3 hours, Max 30m phone use"
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
                  <label>What do you ENJOY? (AI redirects cravings into these)</label>
                  <div className="chip-container">
                    {INTEREST_OPTIONS.map((i) => (
                      <button key={i} type="button" className={`chip-label interest ${formInterests.includes(i) ? "selected" : ""}`}
                        onClick={() => toggleChip(i, formInterests, setFormInterests)}>{i}</button>
                    ))}
                  </div>
                  {formInterests.length === 0 && <p className="help-text">⚡ Pick at least 1 interest to activate redirects!</p>}
                </div>

                <div className="form-group">
                  <label htmlFor="vibe-select">AI Coach Vibe</label>
                  <select id="vibe-select" value={formVibe} onChange={(e) => setFormVibe(e.target.value)}>
                    <option value="Direct">Strict & Direct (Tough Love)</option>
                    <option value="Supportive">Warm & Supportive (Gentle Guide)</option>
                    <option value="Analytical">Analytical & Scientific (CBT Brain Facts)</option>
                  </select>
                </div>

                <button type="submit" className="btn btn-primary w-full" style={{ padding: 14 }}>🦋 Launch Dashboard</button>
              </form>
            </section>
          )}

          {/* ═══ UNIFIED DASHBOARD SCREEN (ALL FEATURES ACCESSIBLE) ═══ */}
          {screen === "dashboard" && profile && (
            <div className="flex-col">
              {/* Header Banner & SOS Intervene */}
              <div className="dashboard-header-panel">
                <div>
                  <div className="badge">Active Loop Goal</div>
                  <h2>Break: &ldquo;{profile.habit}&rdquo; ➔ Goal: &ldquo;{profile.goal}&rdquo;</h2>
                  <p className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>Vibe Mode: {profile.vibe} Coach</p>
                </div>
                <button className="btn btn-danger pulse-btn" onClick={enterSOS}>
                  🚨 Panic Intervene
                </button>
              </div>

              {/* AI Mission Banner */}
              <div className="card mission-card">
                <div className="mission-header">
                  <span>⚡</span>
                  <div>
                    <h4>Today&apos;s AI Mission</h4>
                    <p className="mission-text">{missionLoading ? "Syncing..." : (dailyMission || "Loading daily plan...")}</p>
                  </div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={fetchMission} disabled={missionLoading}>🔄 Refresh</button>
              </div>

              {/* Stats Metrics */}
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon-bg primary">🔥</div>
                  <div className="stat-info">
                    <span className="stat-value">{streak} days</span>
                    <span className="stat-label">Consecutive Streak</span>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon-bg success">🔄</div>
                  <div className="stat-info">
                    <span className="stat-value">{swaps} swaps</span>
                    <span className="stat-label">Urges Swapped</span>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon-bg danger">📈</div>
                  <div className="stat-info">
                    <span className="stat-value">{successRate}%</span>
                    <span className="stat-label">Success Index</span>
                  </div>
                </div>
              </div>

              {/* Multi-Column Main Workspace */}
              <div className="grid-2">
                
                {/* Left Side: Logger and History List */}
                <div className="flex-col">
                  {/* Craving Log Form */}
                  <div className="card">
                    <h3 className="card-title">📝 Log a Craving Loop</h3>
                    <form onSubmit={handleLog}>
                      <div className="form-group">
                        <label>Loop Outcome</label>
                        <div className="choice-container">
                          {[["swap","🔄 Swapped Routine","swap"],["resist","💪 Surfed Caving","resist"],["slip","😔 Slipped Loop","slip"]].map(([val, label, cls]) => (
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
                        <label htmlFor="log-trigger">Trigger Category</label>
                        <select id="log-trigger" value={logTrigger} onChange={(e) => setLogTrigger(e.target.value)}>
                          {(profile.triggers.length > 0 ? profile.triggers : TRIGGER_OPTIONS).map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label htmlFor="note-area">Reflection Notes (Optional)</label>
                        <textarea id="note-area" rows="2" placeholder="What situation triggered the craving? How did you respond?"
                          value={logNote} onChange={(e) => setLogNote(e.target.value)} />
                      </div>

                      <button type="submit" className="btn btn-primary w-full">Save Logging</button>
                    </form>
                  </div>

                  {/* History Timeline list */}
                  <div className="card">
                    <h3 className="card-title">📋 Activity History Logs</h3>
                    <div className="timeline-container">
                      {logs.length === 0 && <p className="text-muted" style={{ fontSize: 13, textAlign: "center", padding: "10px 0" }}>No logs recorded yet. Start tracking above!</p>}
                      {logs.slice(0, 8).map((log) => (
                        <div key={log.id} className="timeline-item">
                          <div className={`timeline-marker ${log.outcome}`}>
                            {log.outcome === "swap" ? "🔄" : log.outcome === "resist" ? "💪" : "😔"}
                          </div>
                          <div className="timeline-content">
                            <div className="timeline-header-row">
                              <span className="timeline-title">{log.outcome === "swap" ? "Swapped Loop" : log.outcome === "resist" ? "Surfed Caving" : "Slipped"}</span>
                              <span className="timeline-time">{new Date(log.timestamp).toLocaleDateString()} {new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            </div>
                            {log.note && <p className="timeline-body">&ldquo;{escapeHtml(log.note)}&rdquo;</p>}
                            <div style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center" }}>
                              <span className="tag-indicator" style={{ fontSize: 9 }}>{escapeHtml(log.trigger)}</span>
                              <span style={{ fontSize: 10, fontWeight: 700 }}>Intensity: {log.intensity}/10</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Side: Chat with AI Coach & Pattern Insights */}
                <div className="flex-col">
                  {/* Chat Card */}
                  <div className="card chat-card">
                    <h3 className="card-title">💬 AI Coach Chat</h3>
                    <div className="chat-messages">
                      {chatMessages.map((msg, i) => (
                        <div key={i} className={`message ${msg.role === "user" ? "user-msg" : msg.role === "system" ? "system-msg" : "coach-msg"}`}>
                          {msg.text}
                        </div>
                      ))}
                      {chatLoading && <div className="message coach-msg">Syncing message...</div>}
                      <div ref={chatEndRef} />
                    </div>
                    <form className="chat-input-form" onSubmit={handleChat}>
                      <input type="text" placeholder="Ask for advice or study support..." value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)} aria-label="Message input" />
                      <button type="submit" className="btn btn-primary btn-icon" disabled={chatLoading}>➤</button>
                    </form>
                  </div>

                  {/* AI Insights Card */}
                  <div className="card">
                    <div className="card-header-flex">
                      <h3 className="card-title">🧠 AI Trigger Patterns</h3>
                      <button className="btn btn-secondary btn-sm" onClick={fetchInsights}>Analyze Cravings</button>
                    </div>
                    <div className="insights-body">
                      {insights || "Log some cravings and click Analyze to scan trigger patterns."}
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
