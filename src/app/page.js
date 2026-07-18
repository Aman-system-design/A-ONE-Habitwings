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
  // Core States
  const [profile, setProfile] = useState(null);
  const [logs, setLogs] = useState([]);
  const [theme, setTheme] = useState("light");
  const [screen, setScreen] = useState("onboarding"); // onboarding | dashboard
  const [toast, setToast] = useState(null);

  // Conversational Onboarding States
  const [onboardStep, setOnboardStep] = useState(0); // 0: Name/Age, 1: Habit, 2: Goal, 3: Triggers, 4: Interests, 5: Vibe
  const [formName, setFormName] = useState("");
  const [formAge, setFormAge] = useState("");
  const [formHabit, setFormHabit] = useState(HABIT_OPTIONS[0]);
  const [formCustomHabit, setFormCustomHabit] = useState("");
  const [formGoal, setFormGoal] = useState("");
  const [formTriggers, setFormTriggers] = useState([]);
  const [formInterests, setFormInterests] = useState([]);
  const [formVibe, setFormVibe] = useState("Direct");

  // Logging
  const [logOutcome, setLogOutcome] = useState("swap");
  const [logIntensity, setLogIntensity] = useState(5);
  const [logTrigger, setLogTrigger] = useState("");
  const [logNote, setLogNote] = useState("");

  // Dashboard AI metrics
  const [dailyMission, setDailyMission] = useState("");
  const [insights, setInsights] = useState("");
  const [missionLoading, setMissionLoading] = useState(false);

  // SOS States
  const [showSos, setShowSos] = useState(false);
  const [sosStep, setSosStep] = useState("halt"); // halt | breathing | redirect | voice
  const [sosResponse, setSosResponse] = useState("");
  const [haltAnswers, setHaltAnswers] = useState({ hungry: false, angry: false, lonely: false, tired: false });
  const [breathPhase, setBreathPhase] = useState("ready");
  const [breathCount, setBreathCount] = useState(0);
  const [urgeTimer, setUrgeTimer] = useState(600);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Chat
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const chatEndRef = useRef(null);
  const breathIntervalRef = useRef(null);
  const urgeIntervalRef = useRef(null);

  const { transcript, listening, startListening, stopListening } = useSpeechRecognition();

  // Load from LocalStorage
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

  // Save to LocalStorage
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

  // Load daily mission
  useEffect(() => {
    if (screen === "dashboard" && profile && !dailyMission) {
      fetchMission();
    }
  }, [screen, profile]);

  // Toast helper
  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 3000); }

  // ─── Conversational Wizard Next Handler ───
  function handleNextStep(e) {
    e?.preventDefault();
    if (onboardStep === 0) {
      if (!formName.trim() || !formAge.trim()) {
        showToast("Tell us your name and age first!");
        return;
      }
      setOnboardStep(1);
    } else if (onboardStep === 1) {
      const habit = formHabit === "Custom..." ? formCustomHabit : formHabit;
      if (!habit.trim()) {
        showToast("Please specify the habit you want to break!");
        return;
      }
      setOnboardStep(2);
    } else if (onboardStep === 2) {
      if (!formGoal.trim()) {
        showToast("What is your replacement goal?");
        return;
      }
      setOnboardStep(3);
    } else if (onboardStep === 3) {
      if (formTriggers.length === 0) {
        showToast("Select at least 1 trigger!");
        return;
      }
      setOnboardStep(4);
    } else if (onboardStep === 4) {
      if (formInterests.length === 0) {
        showToast("Select at least 1 redirect interest!");
        return;
      }
      setOnboardStep(5);
    } else if (onboardStep === 5) {
      // Complete Onboarding
      const habit = formHabit === "Custom..." ? formCustomHabit : formHabit;
      const p = {
        name: formName,
        age: formAge,
        habit,
        goal: formGoal,
        triggers: formTriggers,
        interests: formInterests,
        vibe: formVibe
      };
      setProfile(p);
      setScreen("dashboard");
      setLogTrigger(formTriggers[0] || TRIGGER_OPTIONS[0]);
      setChatMessages([{ role: "system", text: `Hi ${formName}! I'm your AI Coach. Tap 'Panic Intervene' if you feel the urge to scroll.` }]);
      showToast("Profile set up! Let's win 🚀");
    }
  }

  // Toggle Chip list
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
      ? `Hey ${profile.name}! Stop scrolling immediately. Close the app and focus. You committed to ${profile.goal}. Cravings fade in 10 minutes. Let's do a HALT check. Select what you feel.`
      : `Hi ${profile.name}. I see the urge to do "${profile.habit}" is here. Let's ride it out together. First, let's check your HALT status.`;

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

  // HALT complete ➔ AI Redirect
  async function handleHaltDone() {
    const active = Object.entries(haltAnswers).filter(([,v]) => v).map(([k]) => k);
    let promptMsg = `I am experiencing an urge to do ${profile?.habit}. `;
    if (active.length > 0) {
      promptMsg += `My HALT status is: I feel ${active.join(", ")}. `;
    }
    promptMsg += "Acknowledge this craving, command me to stop, and give me a specific 2-minute redirect activity based on my interests.";

    setSosStep("redirect");
    setSosResponse("Analyzing craving trigger...");

    const data = await callCoach(promptMsg, profile, logs, "sos");
    setSosResponse(data.reply);
    speak(data.reply);
  }

  // Voice Input response
  async function handleVoiceInput(text) {
    setIsSpeaking(true);
    setSosResponse("Analyzing response...");
    const data = await callCoach(
      `I answered: "${text}". Hold me accountable to my goal: "${profile?.goal}". Give me a direct 2-sentence response.`,
      profile, logs, "sos"
    );
    setSosResponse(data.reply);
    speak(data.reply, () => setIsSpeaking(false));
  }

  // Box Breathing
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
      speak("Excellent. Your nervous system is centered.");
      setSosStep("voice");
    }, 32000);
  }

  // Save Log
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
    showToast(logOutcome === "swap" ? "Swap logged! 🔄" : logOutcome === "resist" ? "Resisted successfully! 💪" : "Logged. Focus on the next loop.");
  }

  function handleSosOutcome(outcome) {
    const entry = {
      id: Date.now().toString(),
      outcome,
      intensity: 8,
      trigger: "Urgent Cravings",
      note: "SOS Intervention session triggered.",
      timestamp: new Date().toISOString()
    };
    setLogs(prev => [entry, ...prev]);
    exitSOS();
    showToast(outcome === "swap" ? "Swapped successfully! 🎯" : outcome === "resist" ? "Craving surfed! 💪" : "Logged. Re-align and restart.");
  }

  // Fetch AI content
  async function fetchMission() {
    setMissionLoading(true);
    const data = await callCoach("Generate today's daily mission based on my profile.", profile, logs, "mission");
    setDailyMission(data.reply || "Take a 5-minute offline walk to clear your focus.");
    setMissionLoading(false);
  }

  async function fetchInsights() {
    if (logs.length === 0) {
      setInsights("Log a few craving loops to generate AI analysis!");
      return;
    }
    setInsights("Scanning trigger patterns...");
    const data = await callCoach("Analyze my logs and give me trigger patterns.", profile, logs, "insights");
    setInsights(data.reply);
  }

  // Chat
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

  // Metrics
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

  return (
    <>
      {toast && <div className="toast" role="alert"><span>✦</span> {escapeHtml(toast)}</div>}

      <div className="decor-circle decor-1" aria-hidden="true" />
      <div className="decor-circle decor-2" aria-hidden="true" />

      {/* 🆘 EMERGENCY INTERVENTION OVERLAY DIALOG */}
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
                <p className="text-muted">Cravings trigger easily when your system is vulnerable. Check what applies:</p>
                <div className="halt-grid">
                  {[["hungry","🍽️ Hungry"],["angry","😤 Angry / Stressed"],["lonely","😔 Lonely (Bored)"],["tired","😴 Tired / Sleepy"]].map(([key, label]) => (
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
              <button className="btn btn-secondary btn-sm" onClick={() => { setProfile(null); setScreen("onboarding"); setOnboardStep(0); }}>⚙️ Reset Profile</button>
            )}
          </div>
        </header>

        <main style={{ minHeight: "calc(100vh - 120px)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          
          {/* ═══ CONVERSATIONAL ONBOARDING WIZARD ═══ */}
          {screen === "onboarding" && (
            <section className="screen-card fadeInUp" style={{ margin: "20px auto" }}>
              {/* Progress Bar */}
              <div style={{ width: "100%", height: "6px", background: "var(--border-color)", borderRadius: "var(--radius-full)", marginBottom: "28px", overflow: "hidden" }}>
                <div style={{ width: `${((onboardStep + 1) / 6) * 100}%`, height: "100%", background: "rgb(var(--color-primary))", transition: "width 0.3s ease" }} />
              </div>

              <form onSubmit={handleNextStep}>
                {onboardStep === 0 && (
                  <div className="fadeInUp">
                    <h2 style={{ fontSize: 24, marginBottom: 8 }}>Welcome to Habitwings. Let&apos;s start with the basics:</h2>
                    <p className="text-muted" style={{ marginBottom: 20 }}>How should the AI Coach address you?</p>
                    
                    <div className="form-group">
                      <label htmlFor="name-input">Your First Name</label>
                      <input id="name-input" type="text" placeholder="e.g. Aman" value={formName} onChange={(e) => setFormName(e.target.value)} required />
                    </div>

                    <div className="form-group">
                      <label htmlFor="age-input">Your Age</label>
                      <input id="age-input" type="text" placeholder="e.g. 21" value={formAge} onChange={(e) => setFormAge(e.target.value)} required />
                    </div>
                  </div>
                )}

                {onboardStep === 1 && (
                  <div className="fadeInUp">
                    <h2 style={{ fontSize: 24, marginBottom: 8 }}>Hi {formName}! Let&apos;s get real.</h2>
                    <p className="text-muted" style={{ marginBottom: 20 }}>What is the main loop or bad habit we are fighting today?</p>
                    
                    <div className="form-group">
                      <label htmlFor="habit-select-wizard">Select Target Habit</label>
                      <select id="habit-select-wizard" value={formHabit} onChange={(e) => setFormHabit(e.target.value)} required>
                        {HABIT_OPTIONS.map((h) => <option key={h} value={h}>{h}</option>)}
                      </select>
                      {formHabit === "Custom..." && (
                        <input type="text" placeholder="e.g. Scrolling Instagram reels, Procrastination"
                          value={formCustomHabit} onChange={(e) => setFormCustomHabit(e.target.value)} required style={{ marginTop: 8 }} />
                      )}
                    </div>
                  </div>
                )}

                {onboardStep === 2 && (
                  <div className="fadeInUp">
                    <h2 style={{ fontSize: 24, marginBottom: 8 }}>Got it. And when the urge hits...</h2>
                    <p className="text-muted" style={{ marginBottom: 20 }}>What should you be doing instead? (This is your study/focus goal)</p>
                    
                    <div className="form-group">
                      <label htmlFor="goal-input-wizard">Your Replacement Goal</label>
                      <input id="goal-input-wizard" type="text" placeholder="e.g. Studying for CAT Exam, Coding my project"
                        value={formGoal} onChange={(e) => setFormGoal(e.target.value)} required />
                    </div>
                  </div>
                )}

                {onboardStep === 3 && (
                  <div className="fadeInUp">
                    <h2 style={{ fontSize: 24, marginBottom: 8 }}>Identify the triggers.</h2>
                    <p className="text-muted" style={{ marginBottom: 20 }}>What usually makes you slip? (Pick all that apply)</p>
                    
                    <div className="form-group">
                      <div className="chip-container">
                        {TRIGGER_OPTIONS.map((t) => (
                          <button key={t} type="button" className={`chip-label ${formTriggers.includes(t) ? "selected" : ""}`}
                            onClick={() => toggleChip(t, formTriggers, setFormTriggers)}>{t}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {onboardStep === 4 && (
                  <div className="fadeInUp">
                    <h2 style={{ fontSize: 24, marginBottom: 8 }}>Let&apos;s talk redirects.</h2>
                    <p className="text-muted" style={{ marginBottom: 20 }}>To redirect your dopamine cravings, what do you enjoy? (Pick 2+)</p>
                    
                    <div className="form-group">
                      <div className="chip-container">
                        {INTEREST_OPTIONS.map((i) => (
                          <button key={i} type="button" className={`chip-label interest ${formInterests.includes(i) ? "selected" : ""}`}
                            onClick={() => toggleChip(i, formInterests, setFormInterests)}>{i}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {onboardStep === 5 && (
                  <div className="fadeInUp">
                    <h2 style={{ fontSize: 24, marginBottom: 8 }}>One last thing, {formName}.</h2>
                    <p className="text-muted" style={{ marginBottom: 20 }}>What personality style should the AI coach use?</p>
                    
                    <div className="form-group">
                      <label htmlFor="vibe-select-wizard">Coach Vibe Mode</label>
                      <select id="vibe-select-wizard" value={formVibe} onChange={(e) => setFormVibe(e.target.value)}>
                        <option value="Direct">Strict & Direct (Tough Love - Authority Mode)</option>
                        <option value="Supportive">Warm & Supportive (Gentle Coaching)</option>
                        <option value="Analytical">Analytical & Scientific (CBT Brain Facts)</option>
                      </select>
                    </div>
                  </div>
                )}

                <button type="submit" className="btn btn-primary w-full" style={{ padding: 14, marginTop: "12px" }}>
                  {onboardStep === 5 ? "🦋 Launch Micro Dashboard" : "Next Step ➔"}
                </button>
              </form>
            </section>
          )}

          {/* ═══ MICRO DASHBOARD SCREEN (SCREEN FITTING & FOCUSED) ═══ */}
          {screen === "dashboard" && profile && (
            <div className="flex-col fadeInUp" style={{ justifyContent: "flex-start", width: "100%" }}>
              
              {/* Header Banner & SOS Panic */}
              <div className="dashboard-header-panel">
                <div>
                  <span className="badge">Welcome back, {profile.name}!</span>
                  <h2>{profile.habit} ➔ {profile.goal}</h2>
                </div>
                <button className="btn btn-danger pulse-btn" onClick={enterSOS}>
                  🚨 Panic Intervene
                </button>
              </div>

              {/* AI Mission */}
              <div className="card mission-card" style={{ padding: "14px 20px" }}>
                <div className="mission-header">
                  <span>⚡</span>
                  <div>
                    <h4>Today&apos;s AI Mission</h4>
                    <p className="mission-text">{missionLoading ? "Syncing..." : (dailyMission || "Refreshing mission...")}</p>
                  </div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={fetchMission} disabled={missionLoading}>🔄</button>
              </div>

              {/* Layout Content fitting screen */}
              <div className="grid-2">
                
                {/* Left: AI Coach Chat (Primary workspace) */}
                <div className="card chat-card" style={{ height: "360px" }}>
                  <h3 className="card-title">💬 Talk to AI Coach</h3>
                  <div className="chat-messages">
                    {chatMessages.map((msg, i) => (
                      <div key={i} className={`message ${msg.role === "user" ? "user-msg" : msg.role === "system" ? "system-msg" : "coach-msg"}`}>
                        {msg.text}
                      </div>
                    ))}
                    {chatLoading && <div className="message coach-msg">Thinking...</div>}
                    <div ref={chatEndRef} />
                  </div>
                  <form className="chat-input-form" onSubmit={handleChat}>
                    <input type="text" placeholder="Type a message..." value={chatInput} onChange={(e) => setChatInput(e.target.value)} />
                    <button type="submit" className="btn btn-primary btn-icon" disabled={chatLoading}>➤</button>
                  </form>
                </div>

                {/* Right: Stats & Logs */}
                <div className="flex-col">
                  {/* Stats Row */}
                  <div className="stats-grid" style={{ gap: "10px" }}>
                    <div className="stat-card" style={{ padding: "10px" }}>
                      <div className="stat-icon-bg primary" style={{ width: "30px", height: "30px", fontSize: "14px" }}>🔥</div>
                      <div className="stat-info">
                        <span className="stat-value" style={{ fontSize: "14px" }}>{streak}d</span>
                        <span className="stat-label">Streak</span>
                      </div>
                    </div>
                    <div className="stat-card" style={{ padding: "10px" }}>
                      <div className="stat-icon-bg success" style={{ width: "30px", height: "30px", fontSize: "14px" }}>🔄</div>
                      <div className="stat-info">
                        <span className="stat-value" style={{ fontSize: "14px" }}>{swaps}</span>
                        <span className="stat-label">Swaps</span>
                      </div>
                    </div>
                    <div className="stat-card" style={{ padding: "10px" }}>
                      <div className="stat-icon-bg danger" style={{ width: "30px", height: "30px", fontSize: "14px" }}>📈</div>
                      <div className="stat-info">
                        <span className="stat-value" style={{ fontSize: "14px" }}>{successRate}%</span>
                        <span className="stat-label">Index</span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Logger Form */}
                  <div className="card" style={{ padding: "14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <h4 style={{ fontSize: "13px" }}>Log Current Loop</h4>
                      <select id="trigger-log-select" style={{ width: "100px", padding: "4px", fontSize: "11px", border: "1px solid var(--border-color)" }}
                        value={logTrigger} onChange={(e) => setLogTrigger(e.target.value)}>
                        {(profile.triggers.length > 0 ? profile.triggers : TRIGGER_OPTIONS).map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>

                    <div className="choice-container" style={{ gap: "6px" }}>
                      <button className="btn btn-secondary btn-sm w-full" style={{ fontSize: "12px", padding: "8px" }} onClick={() => handleLogSubmit("swap")}>🔄 Swapped</button>
                      <button className="btn btn-secondary btn-sm w-full" style={{ fontSize: "12px", padding: "8px" }} onClick={() => handleLogSubmit("resist")}>💪 Resisted</button>
                      <button className="btn btn-danger btn-sm w-full" style={{ fontSize: "12px", padding: "8px" }} onClick={() => handleLogSubmit("slip")}>😔 Slipped</button>
                    </div>
                  </div>

                  {/* Log list */}
                  <div className="card" style={{ padding: "14px", flexGrow: 1 }}>
                    <h4 style={{ fontSize: "13px", marginBottom: "8px" }}>Activity History</h4>
                    <div className="timeline-container" style={{ maxHeight: "130px" }}>
                      {logs.length === 0 && <p className="text-muted" style={{ fontSize: "11px", textAlign: "center" }}>No logs recorded yet.</p>}
                      {logs.slice(0, 3).map((log) => (
                        <div key={log.id} className="timeline-item">
                          <div className={`timeline-marker ${log.outcome}`} style={{ width: "24px", height: "24px", fontSize: "11px" }}>
                            {log.outcome === "swap" ? "🔄" : log.outcome === "resist" ? "💪" : "😔"}
                          </div>
                          <div className="timeline-content" style={{ padding: "6px 10px" }}>
                            <div className="timeline-header-row" style={{ marginBottom: "0" }}>
                              <span className="timeline-title" style={{ fontSize: "11px" }}>{log.outcome === "swap" ? "Swapped" : log.outcome === "resist" ? "Resisted" : "Slipped"}</span>
                              <span className="timeline-time" style={{ fontSize: "9px" }}>{new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            </div>
                          </div>
                        </div>
                      ))}
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
