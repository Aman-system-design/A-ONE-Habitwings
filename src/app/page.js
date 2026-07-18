"use client";
import { useState, useEffect, useRef, useCallback } from "react";

// ─── Utility: HTML Escaper ───
function escapeHtml(str) {
  if (typeof str !== "string") return String(str);
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}

function formatTimer(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
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

// Smart replacement goal suggestions keyed by habit
const GOAL_SUGGESTIONS = {
  "Excessive Screen Time / Doom Scrolling": [
    "📚 Read for 20 mins", "🏃 Go for a walk", "✍️ Write in my journal", "🎯 Work on my project", "🧘 Meditate 10 mins"
  ],
  "Vaping / Smoking": [
    "🏃 Do 10 pushups", "🌬️ Box breathing exercise", "💧 Drink water & walk", "🎵 Listen to music", "📞 Call a friend"
  ],
  "Procrastination": [
    "⏱️ Do a 25-min Pomodoro", "📋 Complete one task first", "🎯 Study for my exam", "💻 Code for 30 mins", "📖 Read 1 chapter"
  ],
  "Junk Food / Overeating": [
    "🍎 Eat a fruit instead", "💧 Drink a glass of water", "🚶 Take a short walk", "🧘 Do breathing exercises", "📖 Read for 10 mins"
  ],
  "Impulsive Shopping": [
    "📝 Add to wishlist, wait 48h", "💰 Track my savings goal", "🎯 Work on a skill instead", "🏃 Exercise to reset mood", "📞 Talk to a friend"
  ],
  "Social Media Addiction": [
    "📚 Study for 30 mins", "🎨 Do something creative", "🏃 Go outside for 15 mins", "🎯 Work on my side project", "🧘 Meditate & breathe"
  ],
  "Custom...": [
    "📚 Study or learn something", "🏃 Exercise or go for a walk", "🎯 Work on my main goal", "🧘 Meditate or breathe", "🎨 Do something creative"
  ]
};

// ─── Speech Synthesis Utility ───
function speak(text, onEnd) {
  if (typeof window === "undefined" || !window.speechSynthesis) { onEnd?.(); return; }
  window.speechSynthesis.cancel();
  
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.05; u.pitch = 1.0; u.volume = 1.0;
  
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v => v.lang.startsWith("en") && v.name.toLowerCase().includes("female")) 
    || voices.find(v => v.lang.startsWith("en")) 
    || (voices.length > 0 ? voices[0] : null);
    
  if (preferred) u.voice = preferred;
  u.onend = () => onEnd?.();
  u.onerror = () => onEnd?.();
  window.speechSynthesis.speak(u);
}

// ─── Speech Recognition Utility ───
function useSpeechRecognition() {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  const startListening = useCallback((onResultCallback) => {
    if (typeof window === "undefined") return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("Speech recognition not supported in this browser. Try Chrome or Edge."); return; }
    
    const r = new SpeechRecognition();
    r.continuous = false; r.interimResults = false; r.lang = "en-US";
    
    r.onresult = (e) => { 
      const text = e.results[0][0].transcript;
      setListening(false); 
      onResultCallback?.(text); 
    };
    r.onerror = () => setListening(false);
    r.onend = () => setListening(false);
    
    recognitionRef.current = r;
    setListening(true); 
    try { r.start(); } catch {}
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop(); setListening(false);
  }, []);

  return { listening, startListening, stopListening };
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
    return { reply: "I hear you. Take a deep breath — this craving will pass. Let's redirect that energy into your goals.", engine: "offline" };
  }
}

export default function Home() {
  // Core States
  const [profile, setProfile] = useState(null);
  const [logs, setLogs] = useState([]);
  const [theme, setTheme] = useState("light");
  const [screen, setScreen] = useState("onboarding"); 
  const [dashboardTab, setDashboardTab] = useState("home"); // home | sos | chat
  const [toast, setToast] = useState(null);

  // Onboarding Wizard
  const [onboardStep, setOnboardStep] = useState(0); 
  const [formName, setFormName] = useState("");
  const [formAge, setFormAge] = useState("");
  const [formHabit, setFormHabit] = useState(""); // Not prefilled
  const [formCustomHabit, setFormCustomHabit] = useState("");
  const [formGoal, setFormGoal] = useState("");
  const [formTriggers, setFormTriggers] = useState([]);
  const [formInterests, setFormInterests] = useState([]);
  const [formVibe, setFormVibe] = useState("Direct");

  // Talk Me! (Voice) Tab States
  const [sosStep, setSosStep] = useState("voice"); // Start directly in voice mode
  const [sosResponse, setSosResponse] = useState("");
  const [haltAnswers, setHaltAnswers] = useState({ hungry: false, angry: false, lonely: false, tired: false });
  const [breathPhase, setBreathPhase] = useState("ready");
  const [breathCount, setBreathCount] = useState(0);
  const [urgeTimer, setUrgeTimer] = useState(600);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isContinuousVoice, setIsContinuousVoice] = useState(false); 
  const [voiceMessages, setVoiceMessages] = useState([]);
  const [showHaltModal, setShowHaltModal] = useState(false);
  const [showBreathingModal, setShowBreathingModal] = useState(false);

  // Chat Tab States
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const chatEndRef = useRef(null);
  const breathIntervalRef = useRef(null);
  const urgeIntervalRef = useRef(null);

  const { listening, startListening, stopListening } = useSpeechRecognition();

  // Warm up voices
  useEffect(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

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

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages, voiceMessages]);

  // Prepopulate Chat Tab welcome message if empty
  useEffect(() => {
    if (profile && chatMessages.length === 0) {
      setChatMessages([{ 
        role: "coach", 
        text: `Hi ${profile.name}! I'm your AI Coach. How are you holding up today? Whenever you need an immediate talking companion, tap 'Talk Me!' at the top right.` 
      }]);
    }
  }, [profile, chatMessages]);

  // Voice handler timer
  useEffect(() => {
    if (dashboardTab === "sos" && screen === "dashboard") {
      startSosSession();
    } else {
      stopSosSession();
    }
    return () => stopSosSession();
  }, [dashboardTab, screen]);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 3000); }

  // ─── Onboarding Wizard ───
  function handleNextStep(e) {
    e?.preventDefault();
    if (onboardStep === 0) {
      if (!formName.trim() || !formAge.trim()) { showToast("Tell us your name and age first!"); return; }
      setOnboardStep(1);
    } else if (onboardStep === 1) {
      const habit = formHabit === "Custom..." ? formCustomHabit : formHabit;
      if (!habit.trim()) { showToast("Please specify the habit you want to break!"); return; }
      setOnboardStep(2);
    } else if (onboardStep === 2) {
      if (!formGoal.trim()) { showToast("What is your replacement goal?"); return; }
      setOnboardStep(3);
    } else if (onboardStep === 3) {
      if (formTriggers.length === 0) { showToast("Select at least 1 trigger!"); return; }
      setOnboardStep(4);
    } else if (onboardStep === 4) {
      if (formInterests.length === 0) { showToast("Select at least 1 redirect interest!"); return; }
      setOnboardStep(5);
    } else if (onboardStep === 5) {
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
      setDashboardTab("home");
      setChatMessages([{ role: "system", text: `Hi ${formName}! Tap 'Talk Me!' at the top to converse with your AI coach.` }]);
      showToast("Profile set up! Let's win 🚀");
    }
  }

  // Toggle Chip list
  function toggleChip(value, list, setter) {
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  // ─── Voice Session Controls ───
  function startSosSession() {
    setSosStep("voice"); // Start directly in voice mode
    setSosResponse("");
    setBreathPhase("ready");
    setBreathCount(0);
    setUrgeTimer(600);
    setIsContinuousVoice(false);

    const greeting = profile?.vibe === "Direct"
      ? `Hey ${profile.name}! I'm here. Stop scrolling and let's stay focused on your goal: "${profile.goal}". How are you feeling right now?`
      : `Hi ${profile.name}, I'm here. I see the urge for "${profile.habit}" is here. Let's surf it together. What's going on?`;

    setSosResponse(greeting);
    setVoiceMessages([{ role: "coach", text: greeting }]);
    speak(greeting);

    if (urgeIntervalRef.current) clearInterval(urgeIntervalRef.current);
    urgeIntervalRef.current = setInterval(() => {
      setUrgeTimer((prev) => {
        if (prev <= 1) { clearInterval(urgeIntervalRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  }

  function stopSosSession() {
    clearInterval(urgeIntervalRef.current);
    clearInterval(breathIntervalRef.current);
    setIsContinuousVoice(false);
    stopListening();
    window.speechSynthesis?.cancel();
  }

  // Unified callback for Speech Recognition results
  const handleVoiceInput = useCallback(async (text) => {
    if (!text.trim()) {
      if (isContinuousVoice) {
        startListening(handleVoiceInput);
      }
      return;
    }
    
    // Add user speech to transcript
    setVoiceMessages(prev => [...prev, { role: "user", text }]);
    setIsSpeaking(true);
    setSosResponse("Thinking...");
    
    const data = await callCoach(
      `The user said: "${text}". Hold them accountable to their goal "${profile?.goal}" and help them avoid "${profile?.habit}". Reply directly with 2-3 sentences.`,
      profile, logs, "sos"
    );
    
    setSosResponse(data.reply);
    setVoiceMessages(prev => [...prev, { role: "coach", text: data.reply }]);
    
    speak(data.reply, () => {
      setIsSpeaking(false);
      if (isContinuousVoice) {
        startListening(handleVoiceInput);
      }
    });
  }, [profile, logs, isContinuousVoice, startListening]);

  // Tap-to-speak microphone toggle
  function handleMicClick() {
    if (listening) {
      stopListening();
    } else {
      window.speechSynthesis?.cancel();
      startListening(handleVoiceInput);
    }
  }

  // Toggle Continuous Advanced Voice Mode
  function toggleContinuousVoice() {
    if (isContinuousVoice) {
      setIsContinuousVoice(false);
      stopListening();
      window.speechSynthesis?.cancel();
    } else {
      setIsContinuousVoice(true);
      speak("Continuous voice mode active. Speak when ready.", () => {
        startListening(handleVoiceInput);
      });
    }
  }

  // Submit HALT Vulnerability State to Coach
  async function submitHaltCheck() {
    const active = Object.entries(haltAnswers).filter(([,v]) => v).map(([k]) => k);
    const userText = `HALT check: I am feeling ${active.join(", ") || "fine, just craving"}.`;
    
    setVoiceMessages(prev => [...prev, { role: "user", text: userText }]);
    setShowHaltModal(false);
    setIsSpeaking(true);
    setSosResponse("Analyzing craving trigger...");

    const promptMsg = `I am experiencing an urge to do ${profile?.habit}. My HALT status is: I feel ${active.join(", ")}. Acknowledge this with CBT, and give me a specific 2-sentence redirect challenge.`;
    const data = await callCoach(promptMsg, profile, logs, "sos");
    
    setSosResponse(data.reply);
    setVoiceMessages(prev => [...prev, { role: "coach", text: data.reply }]);
    
    speak(data.reply, () => {
      setIsSpeaking(false);
      if (isContinuousVoice) {
        startListening(handleVoiceInput);
      }
    });
  }

  // Simple quick log
  function logSessionOutcome(outcome) {
    const entry = {
      id: Date.now().toString(),
      outcome,
      intensity: 7,
      trigger: "Self-Reported",
      note: `Resolved check. Outcome: ${outcome}`,
      timestamp: new Date().toISOString()
    };
    setLogs(prev => [entry, ...prev]);
    setDashboardTab("home");
    showToast(outcome === "swap" ? "Redirect logged! 🔄" : outcome === "resist" ? "Resisted! 💪" : "Slipped. Let's restart.");
  }

  // Box Breathing Guide
  function startBreathing() {
    setShowBreathingModal(true);
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
      setVoiceMessages(prev => [...prev, { role: "system", text: "Box Breathing session completed. Nervous system centered." }]);
      setShowBreathingModal(false);
    }, 32000);
  }

  function stopBreathing() {
    clearInterval(breathIntervalRef.current);
    setBreathPhase("ready");
    setShowBreathingModal(false);
    window.speechSynthesis?.cancel();
  }

  // Chat Tab Submit
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

  // Streak Math
  const total = logs.length;
  const resists = logs.filter(l => l.outcome === "resist").length;
  const swaps = logs.filter(l => l.outcome === "swap").length;
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

          <div className="header-actions" style={{ alignItems: "center" }}>
            {/* 🧭 INLINE HEADER NAVIGATION (TOP RIGHT) */}
            {screen === "dashboard" && (
              <nav className="inline-nav" aria-label="Main Navigation">
                <button className={`nav-link ${dashboardTab === "home" ? "active" : ""}`} onClick={() => setDashboardTab("home")}>🏠 Home</button>
                <button className={`nav-link ${dashboardTab === "sos" ? "active" : ""}`} onClick={() => setDashboardTab("sos")}>🎙️ Talk Me!</button>
                <button className={`nav-link ${dashboardTab === "chat" ? "active" : ""}`} onClick={() => setDashboardTab("chat")}>💬 Chat</button>
              </nav>
            )}
            
            <button className="btn-icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} title="Toggle Theme" aria-label="Toggle light and dark theme">
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
            {profile && (
              <button className="btn btn-secondary btn-sm" onClick={() => { setProfile(null); setScreen("onboarding"); setOnboardStep(0); }}>⚙️ Reset</button>
            )}
          </div>
        </header>

        {/* Main Content Area */}
        <main style={{ minHeight: "calc(100vh - 120px)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          
          {/* ═══ CONVERSATIONAL ONBOARDING WIZARD ═══ */}
          {screen === "onboarding" && (
            <section className="screen-card fadeInUp" style={{ margin: "20px auto" }}>
              <div style={{ width: "100%", height: "6px", background: "var(--border-color)", borderRadius: "var(--radius-full)", marginBottom: "28px", overflow: "hidden" }}>
                <div style={{ width: `${((onboardStep + 1) / 6) * 100}%`, height: "100%", background: "rgb(var(--color-primary))", transition: "width 0.3s ease" }} />
              </div>

              <form onSubmit={handleNextStep}>
                {onboardStep === 0 && (
                  <div className="fadeInUp">
                    <h2 style={{ fontSize: 22, marginBottom: 8 }}>Welcome to Habitwings. Let&apos;s start with the basics:</h2>
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
                    <h2 style={{ fontSize: 22, marginBottom: 8 }}>Hi {formName}! Let&apos;s get real.</h2>
                    <p className="text-muted" style={{ marginBottom: 20 }}>What is the main bad habit we are breaking?</p>
                    <div className="form-group">
                      <label htmlFor="habit-select-wizard">Select Target Habit</label>
                      <select id="habit-select-wizard" value={formHabit} onChange={(e) => setFormHabit(e.target.value)} required>
                        <option value="" disabled hidden>-- Select target habit --</option>
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
                    <h2 style={{ fontSize: 22, marginBottom: 8 }}>And when the urge hits...</h2>
                    <p className="text-muted" style={{ marginBottom: 20 }}>Pick what you'll do instead — or type your own:</p>
                    <div className="form-group">
                      <div className="chip-container" style={{ marginBottom: 14 }}>
                        {(GOAL_SUGGESTIONS[formHabit] || GOAL_SUGGESTIONS["Custom..."] ).map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            className={`chip-label ${formGoal === suggestion ? "selected" : ""}`}
                            onClick={() => setFormGoal(formGoal === suggestion ? "" : suggestion)}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                      <label htmlFor="goal-input-wizard" style={{ fontSize: 13, color: "var(--text-muted)" }}>Or type a custom goal:</label>
                      <input
                        id="goal-input-wizard"
                        type="text"
                        placeholder="e.g. Study for CAT Exam, Build my app..."
                        value={formGoal.startsWith("📚") || formGoal.startsWith("🏃") || formGoal.startsWith("✍️") || formGoal.startsWith("🎯") || formGoal.startsWith("🧘") || formGoal.startsWith("🌬️") || formGoal.startsWith("💧") || formGoal.startsWith("🎵") || formGoal.startsWith("📞") || formGoal.startsWith("⏱️") || formGoal.startsWith("📋") || formGoal.startsWith("💻") || formGoal.startsWith("📖") || formGoal.startsWith("🍎") || formGoal.startsWith("🚶") || formGoal.startsWith("📝") || formGoal.startsWith("💰") || formGoal.startsWith("🎨") || formGoal.startsWith("📚") ? "" : formGoal}
                        onChange={(e) => setFormGoal(e.target.value)}
                        style={{ marginTop: 6 }}
                      />
                      {formGoal && (
                        <p style={{ marginTop: 8, fontSize: 13, color: "rgb(var(--color-primary))" }}>
                          ✓ Your goal: <strong>{formGoal}</strong>
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {onboardStep === 3 && (
                  <div className="fadeInUp">
                    <h2 style={{ fontSize: 22, marginBottom: 8 }}>Identify the triggers.</h2>
                    <p className="text-muted" style={{ marginBottom: 20 }}>What triggers your urges? (Select all that apply)</p>
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
                    <h2 style={{ fontSize: 22, marginBottom: 8 }}>Let&apos;s talk redirects.</h2>
                    <p className="text-muted" style={{ marginBottom: 20 }}>To redirect dopamine cravings, what do you enjoy? (Pick 2+)</p>
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
                    <h2 style={{ fontSize: 22, marginBottom: 8 }}>Lastly, {formName}.</h2>
                    <p className="text-muted" style={{ marginBottom: 20 }}>Choose the personality style of the AI Coach:</p>
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
                  {onboardStep === 5 ? "Launch Habitwings 🦋" : "Next Step ➔"}
                </button>
              </form>
            </section>
          )}

          {/* ═══ TAB 1: 🏠 MINIMAL HOME VIEW ═══ */}
          {screen === "dashboard" && dashboardTab === "home" && profile && (
            <div className="flex-col fadeInUp" style={{ justifyContent: "center", alignItems: "center", width: "100%", maxWidth: "600px", margin: "0 auto", textAlign: "center", gap: "28px" }}>
              <div>
                <span className="badge" style={{ marginBottom: "8px" }}>Focus Protocol Active</span>
                <h2 style={{ fontSize: "28px" }}>Hi, {profile.name}! Let&apos;s stay focused today.</h2>
                <p className="text-muted" style={{ fontSize: "14px", marginTop: "4px" }}>
                  Goal: <strong>{profile.goal}</strong> | Breaking: <strong>{profile.habit}</strong>
                </p>
              </div>

              {/* Two Direct Quick Entry Points */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", width: "100%" }}>
                <button 
                  className="card" 
                  onClick={() => setDashboardTab("sos")} 
                  style={{ 
                    padding: "24px 16px", 
                    cursor: "pointer", 
                    textAlign: "center", 
                    display: "flex", 
                    flexDirection: "column", 
                    alignItems: "center", 
                    gap: "10px",
                    background: "linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(20, 184, 166, 0.05) 100%)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "var(--radius-lg)"
                  }}
                >
                  <span style={{ fontSize: "36px" }}>🎙️</span>
                  <h3 style={{ fontSize: "15px" }}>Talk Me!</h3>
                  <p className="text-muted" style={{ fontSize: "11px" }}>Converse with the Voice Agent to surf cravings hands-free</p>
                </button>
                
                <button 
                  className="card" 
                  onClick={() => setDashboardTab("chat")} 
                  style={{ 
                    padding: "24px 16px", 
                    cursor: "pointer", 
                    textAlign: "center", 
                    display: "flex", 
                    flexDirection: "column", 
                    alignItems: "center", 
                    gap: "10px",
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "var(--radius-lg)"
                  }}
                >
                  <span style={{ fontSize: "36px" }}>💬</span>
                  <h3 style={{ fontSize: "15px" }}>Chat Coach</h3>
                  <p className="text-muted" style={{ fontSize: "11px" }}>Discuss triggers, streaks, and adjustment plans via text</p>
                </button>
              </div>

              {/* Micro stats banner */}
              <div style={{ display: "flex", gap: "24px", justifyContent: "center" }}>
                <div>
                  <span style={{ fontSize: "20px", fontWeight: "800" }}>{streak}d</span>
                  <p className="text-muted" style={{ fontSize: "11px" }}>Focus Streak</p>
                </div>
                <div style={{ width: "1px", background: "var(--border-color)" }} />
                <div>
                  <span style={{ fontSize: "20px", fontWeight: "800" }}>{successRate}%</span>
                  <p className="text-muted" style={{ fontSize: "11px" }}>Success Index</p>
                </div>
              </div>

              {/* Clean, minimal log view */}
              <div className="card" style={{ width: "100%", padding: "14px", textAlign: "left" }}>
                <h4 style={{ fontSize: "12px", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>Recent Urges Surfed</h4>
                {logs.length === 0 && <p className="text-muted" style={{ fontSize: "12px" }}>No logs recorded yet. Press Talk Me! if an urge hits.</p>}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {logs.slice(0, 2).map((l) => (
                    <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", borderBottom: "1px solid var(--border-color)", paddingBottom: "6px" }}>
                      <span>{l.outcome === "swap" ? "🔄 Redirected Dopamine" : l.outcome === "resist" ? "💪 Resisted Habit" : "😔 Slipped Up"}</span>
                      <span className="text-muted" style={{ fontSize: "10px" }}>{new Date(l.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══ TAB 2: 🎙️ TALK ME! (VOICE INTERVENTION) ═══ */}
          {screen === "dashboard" && dashboardTab === "sos" && profile && (
            <div className="flex-col fadeInUp" style={{ justifyContent: "center", width: "100%", maxWidth: "520px", margin: "0 auto" }}>
              <div className="card" style={{ padding: "24px", position: "relative" }}>
                <div className="sos-header" style={{ marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h2 style={{ fontSize: "18px", display: "flex", alignItems: "center", gap: "8px" }}>🎙️ Talk Me! AI Voice Coach</h2>
                  <div className="sos-timer" style={{ fontSize: "12px", fontWeight: "700", padding: "4px 8px", background: "rgba(244,63,94,0.08)", color: "rgb(var(--color-danger))", borderRadius: "var(--radius-sm)" }}>
                    Urge Surfer: <strong>{formatTimer(urgeTimer)}</strong>
                  </div>
                </div>

                {/* Glowing AI visualizer mic button */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", margin: "16px 0", gap: "10px" }}>
                  <div 
                    style={{
                      width: "110px",
                      height: "110px",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: listening ? "rgba(244, 63, 94, 0.12)" : isSpeaking ? "rgba(168, 85, 247, 0.12)" : "rgba(99, 102, 241, 0.08)",
                      boxShadow: listening ? "0 0 20px rgba(244, 63, 94, 0.25)" : isSpeaking ? "0 0 20px rgba(168, 85, 247, 0.25)" : "0 0 10px rgba(99, 102, 241, 0.05)",
                      transition: "all 0.3s ease",
                      cursor: "pointer"
                    }}
                    onClick={handleMicClick}
                  >
                    <button 
                      className={`mic-btn ${listening ? "listening" : ""}`}
                      style={{
                        width: "74px",
                        height: "74px",
                        borderRadius: "50%",
                        border: "none",
                        background: listening ? "rgb(var(--color-danger))" : isSpeaking ? "rgb(var(--color-purple))" : "rgb(var(--color-primary))",
                        color: "white",
                        fontSize: "26px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                        animation: listening ? "micPulse 1.5s infinite ease-in-out" : "none"
                      }}
                      aria-label={listening ? "Stop recording" : "Start recording"}
                    >
                      {listening ? "🎙️" : isSpeaking ? "🔊" : "🎤"}
                    </button>
                  </div>
                  <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-secondary)" }}>
                    {listening ? "🟢 Listening... Speak now!" : isSpeaking ? "🔊 AI Coach speaking..." : "Tap mic to speak"}
                  </div>
                </div>

                {/* Voice Session conversation bubbles */}
                <div 
                  className="voice-transcript-box"
                  style={{
                    height: "190px",
                    overflowY: "auto",
                    border: "1px solid var(--border-color)",
                    borderRadius: "var(--radius-md)",
                    padding: "12px",
                    background: "rgba(255,255,255,0.45)",
                    marginBottom: "14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px"
                  }}
                >
                  {voiceMessages.map((msg, i) => (
                    <div 
                      key={i} 
                      style={{
                        display: "flex",
                        justifyContent: msg.role === "user" ? "flex-end" : msg.role === "system" ? "center" : "flex-start",
                        width: "100%"
                      }}
                    >
                      <div 
                        style={{
                          maxWidth: "85%",
                          padding: msg.role === "system" ? "4px 8px" : "8px 12px",
                          borderRadius: "var(--radius-md)",
                          fontSize: "12.5px",
                          lineHeight: "1.35",
                          fontWeight: msg.role === "system" ? "500" : "600",
                          backgroundColor: msg.role === "user" 
                            ? "rgb(var(--color-primary))" 
                            : msg.role === "system"
                              ? "transparent"
                              : "var(--bg-surface-solid)",
                          color: msg.role === "user" 
                            ? "white" 
                            : msg.role === "system"
                              ? "var(--text-muted)"
                              : "var(--text-primary)",
                          border: msg.role === "coach" ? "1px solid var(--border-color)" : "none",
                          boxShadow: msg.role === "system" ? "none" : "var(--shadow-sm)",
                          textAlign: msg.role === "system" ? "center" : "left"
                        }}
                      >
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>

                {/* Interactive tools row */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "12px" }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowHaltModal(true)}>
                    📋 Vulnerability Check
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={startBreathing}>
                    🧘 Box Breathing
                  </button>
                </div>

                {/* Hands-free mode control */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "var(--border-color)", borderRadius: "var(--radius-md)", marginBottom: "14px" }}>
                  <label htmlFor="handsfree-toggle" style={{ fontSize: "11.5px", fontWeight: "700", cursor: "pointer" }}>
                    🎙️ Hands-Free Conversational Loop
                  </label>
                  <input 
                    id="handsfree-toggle"
                    type="checkbox" 
                    checked={isContinuousVoice} 
                    onChange={toggleContinuousVoice}
                    style={{ width: "15px", height: "15px", cursor: "pointer" }}
                  />
                </div>

                {/* Resolve/Close */}
                <div style={{ paddingTop: 10, borderTop: "1px solid var(--border-color)" }}>
                  <p style={{ fontWeight: 700, marginBottom: 8, fontSize: 11, textAlign: "center" }}>Did you override the loop?</p>
                  <div className="choice-container" style={{ gap: "6px" }}>
                    <button className="btn btn-secondary btn-sm w-full" onClick={() => logSessionOutcome("swap")}>🔄 Swapped</button>
                    <button className="btn btn-secondary btn-sm w-full" onClick={() => logSessionOutcome("resist")}>💪 Resisted</button>
                    <button className="btn btn-danger btn-sm w-full" onClick={() => logSessionOutcome("slip")}>😔 Slipped</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ TAB 3: 💬 AI COACH CHAT ═══ */}
          {screen === "dashboard" && dashboardTab === "chat" && profile && (
            <div className="flex-col fadeInUp" style={{ justifyContent: "flex-start", width: "100%", maxWidth: "600px", margin: "0 auto" }}>
              <div className="card chat-card" style={{ height: "460px" }}>
                <h3 className="card-title">💬 AI Coach Chat</h3>
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
            </div>
          )}

        </main>
      </div>

      {/* ─── OVERLAY MODAL: BOX BREATHING ─── */}
      {showBreathingModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card screen-card" style={{ maxWidth: "380px", width: "90%", textAlign: "center", position: "relative", padding: "24px" }}>
            <button onClick={stopBreathing} style={{ position: "absolute", top: "14px", right: "14px", background: "none", border: "none", fontSize: "16px", cursor: "pointer", color: "var(--text-muted)" }}>✕</button>
            <h3 style={{ fontSize: "18px", marginBottom: "6px" }}>🧘 Box Breathing</h3>
            <p className="text-muted" style={{ fontSize: "11px", marginBottom: "16px" }}>Centered breathing to calm your nervous system</p>
            
            <div className="breathing-circle-container" style={{ width: "140px", height: "140px", margin: "16px auto" }}>
              <div className={`breathing-circle ${breathPhase}`} style={{ width: "70px", height: "70px" }} />
              <div className="breath-label" style={{ fontSize: "13px", fontWeight: "800", zIndex: 1 }}>
                {breathPhase === "inhale" && "Inhale 💨"}
                {breathPhase === "hold" && "Hold 🛡️"}
                {breathPhase === "exhale" && "Exhale 🌬️"}
                {breathPhase === "holdEmpty" && "Hold Empty 🛡️"}
                {breathPhase === "ready" && "Ready"}
              </div>
            </div>
            <div className="breath-counter" style={{ fontSize: "22px", fontWeight: "850", color: "rgb(var(--color-primary))", marginBottom: "16px" }}>
              {breathCount}s
            </div>
            <button className="btn btn-secondary w-full btn-sm" onClick={stopBreathing}>
              Cancel Breathing
            </button>
          </div>
        </div>
      )}

      {/* ─── OVERLAY MODAL: HALT CHECK ─── */}
      {showHaltModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card screen-card" style={{ maxWidth: "380px", width: "90%", position: "relative", padding: "24px" }}>
            <button onClick={() => setShowHaltModal(false)} style={{ position: "absolute", top: "14px", right: "14px", background: "none", border: "none", fontSize: "16px", cursor: "pointer", color: "var(--text-muted)" }}>✕</button>
            <h3 style={{ fontSize: "18px", marginBottom: "6px" }}>📋 Self-Report HALT State</h3>
            <p className="text-muted" style={{ fontSize: "11.5px", marginBottom: "14px" }}>Select what you are currently feeling to update your coach:</p>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", margin: "14px 0" }}>
              {[
                ["hungry", "🍽️ Hungry"],
                ["angry", "😤 Angry"],
                ["lonely", "😔 Lonely"],
                ["tired", "😴 Tired"]
              ].map(([key, label]) => (
                <button 
                  key={key} 
                  type="button"
                  style={{ 
                    padding: "12px", 
                    fontSize: "13px", 
                    borderRadius: "var(--radius-md)", 
                    border: "1px solid var(--border-color)", 
                    background: haltAnswers[key] ? "rgba(99, 102, 241, 0.08)" : "var(--bg-surface-solid)",
                    color: haltAnswers[key] ? "rgb(var(--color-primary))" : "var(--text-primary)",
                    borderColor: haltAnswers[key] ? "rgb(var(--color-primary))" : "var(--border-color)",
                    cursor: "pointer",
                    fontWeight: haltAnswers[key] ? "700" : "500",
                    transition: "var(--transition)"
                  }}
                  onClick={() => setHaltAnswers(prev => ({ ...prev, [key]: !prev[key] }))}
                >
                  {label}
                </button>
              ))}
            </div>
            
            <div style={{ display: "flex", gap: "8px", marginTop: "14px" }}>
              <button className="btn btn-secondary btn-sm w-full" onClick={() => setShowHaltModal(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm w-full" onClick={submitHaltCheck}>Apply State</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
