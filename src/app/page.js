"use client";
import { useState, useEffect, useRef, useCallback } from "react";

// ─── Utility: HTML Escaper ───
function escapeHtml(str) {
  if (typeof str !== "string") return String(str);
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}

// ─── Default Interests for redirects ───
const INTEREST_OPTIONS = [
  "Brainstorming Ideas", "Film & TV Trivia", "Music & Singing", "Gaming Strategy",
  "Sketching & Doodling", "Puzzles & Riddles", "Science Facts"
];

// ─── Speech Utilities ───
function speak(text, onEnd) {
  if (typeof window === "undefined" || !window.speechSynthesis) { onEnd?.(); return; }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.05; u.pitch = 1.0; u.volume = 1;
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v => v.lang.startsWith("en") && v.name.toLowerCase().includes("google")) 
    || voices.find(v => v.lang.startsWith("en") && v.name.toLowerCase().includes("female"))
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
    return { reply: "I hear you. Take a deep breath — this craving will pass. Let's close the tab and start studying right now.", engine: "offline" };
  }
}

export default function Home() {
  // States
  const [theme, setTheme] = useState("light");
  const [screen, setScreen] = useState("crisis"); // crisis | dashboard | sos
  const [toast, setToast] = useState(null);
  
  // Crisis Form States (Pre-filled for the exact user scenario)
  const [scrollingWhat, setScrollingWhat] = useState("Instagram");
  const [studyWhat, setStudyWhat] = useState("Studying for CAT Exam");
  const [vibe, setVibe] = useState("Direct"); // Default to Direct ("Tough Love")

  // Log state
  const [logs, setLogs] = useState([]);
  const [logOutcome, setLogOutcome] = useState("swap");
  const [logNote, setLogNote] = useState("");

  // SOS Interventions States
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

  // Load / Save
  useEffect(() => {
    const l = localStorage.getItem("habitwings_logs");
    const t = localStorage.getItem("habitwings_theme");
    const sw = localStorage.getItem("habitwings_scrolling");
    const st = localStorage.getItem("habitwings_study");
    if (l) { try { setLogs(JSON.parse(l)); } catch {} }
    if (t) setTheme(t);
    if (sw) setScrollingWhat(sw);
    if (st) setStudyWhat(st);
  }, []);

  useEffect(() => {
    localStorage.setItem("habitwings_scrolling", scrollingWhat);
    localStorage.setItem("habitwings_study", studyWhat);
  }, [scrollingWhat, studyWhat]);

  useEffect(() => { localStorage.setItem("habitwings_logs", JSON.stringify(logs)); }, [logs]);
  
  useEffect(() => {
    localStorage.setItem("habitwings_theme", theme);
    document.body.className = theme === "dark" ? "dark" : "";
  }, [theme]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  useEffect(() => {
    if (transcript && screen === "sos") handleVoiceInput(transcript);
  }, [transcript]);

  // Toast
  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 3000); }

  // ─── Trigger Crisis SOS ───
  async function triggerIntervention(e) {
    e?.preventDefault();
    if (!scrollingWhat.trim() || !studyWhat.trim()) {
      showToast("Tell us what you're doing vs what you should do!");
      return;
    }
    
    setScreen("sos");
    setSosStep("halt");
    setSosResponse("");
    setBreathPhase("ready");
    setBreathCount(0);
    setUrgeTimer(600);

    // Initial alert speech based on the selected vibe
    const voicePitch = vibe === "Direct" 
      ? `Attention! Stop scrolling ${scrollingWhat} immediately. You committed to ${studyWhat}. Every second you scroll is pulling you away from your goal. Let's do a quick redirect. First, are you hungry, angry, lonely, or tired? Check what applies.`
      : `I see you're caught in a loop scrolling ${scrollingWhat} instead of ${studyWhat}. Cravings are just wave signals. Let's sit with this urge together. First, let's check your HALT status.`;

    speak(voicePitch);

    // Start Urge surfing timer countdown
    if (urgeIntervalRef.current) clearInterval(urgeIntervalRef.current);
    urgeIntervalRef.current = setInterval(() => {
      setUrgeTimer((prev) => {
        if (prev <= 1) { clearInterval(urgeIntervalRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  }

  // ─── HALT check complete ➔ Get AI Redirect ───
  async function handleHaltDone() {
    const active = Object.entries(haltAnswers).filter(([,v]) => v).map(([k]) => k);
    let promptMsg = `I am currently scrolling ${scrollingWhat} instead of ${studyWhat}. `;
    if (active.length > 0) {
      promptMsg += `I checked the HALT state: I am feeling ${active.join(", ")}. `;
    }
    promptMsg += "Provide an immediate strict audio voice warning to get me off my phone and study, followed by a quick 2-minute interest challenge to restart my brain focus.";

    setSosStep("redirect");
    setSosResponse("Analyzing the loop...");

    const data = await callCoach(promptMsg, { habit: scrollingWhat, goal: studyWhat, vibe, interests: INTEREST_OPTIONS }, logs, "sos");
    setSosResponse(data.reply);
    speak(data.reply);
  }

  // ─── Voice Input Response ───
  async function handleVoiceInput(text) {
    setIsSpeaking(true);
    setSosResponse("Thinking...");
    const data = await callCoach(
      `I answered: "${text}". Give me a short response in your ${vibe} tone holding me accountable to study ${studyWhat} and stop ${scrollingWhat}.`,
      { habit: scrollingWhat, goal: studyWhat, vibe }, logs, "sos"
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
    speak("Let's do box breathing. Inhale for 4 seconds.");

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
      speak("Excellent. Your nervous system is balanced. Let's close the tab and start studying.");
      setSosStep("voice");
    }, 32000); // 2 full cycles
  }

  // ─── Save Log ───
  function handleLogSubmit(outcome) {
    const entry = {
      id: Date.now().toString(),
      outcome,
      scrolling: scrollingWhat,
      study: studyWhat,
      note: logNote,
      timestamp: new Date().toISOString()
    };
    setLogs(prev => [entry, ...prev]);
    setLogNote("");
    showToast(outcome === "swap" ? "Awesome! Swap logged!" : outcome === "resist" ? "Resisted successfully!" : "Logged. No guilt, let's do better next loop.");
    setScreen("dashboard");
    clearInterval(urgeIntervalRef.current);
    clearInterval(breathIntervalRef.current);
    window.speechSynthesis?.cancel();
  }

  // ─── Dashboard Stats ───
  const total = logs.length;
  const swaps = logs.filter(l => l.outcome === "swap").length;
  const resists = logs.filter(l => l.outcome === "resist").length;
  const slips = logs.filter(l => l.outcome === "slip").length;
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

  // ─── Chat ───
  async function handleChat(e) {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", text: userMsg }]);
    setChatLoading(true);
    const data = await callCoach(userMsg, { habit: scrollingWhat, goal: studyWhat, vibe }, logs, "general");
    setChatMessages((prev) => [...prev, { role: "coach", text: data.reply }]);
    setChatLoading(false);
    speak(data.reply);
  }

  function formatTimer(s) {
    return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,"0")}`;
  }

  return (
    <>
      {toast && <div className="toast" role="alert"><span>✦</span> {escapeHtml(toast)}</div>}

      <div className="decor-circle decor-1" aria-hidden="true" />
      <div className="decor-circle decor-2" aria-hidden="true" />

      {/* 🆘 SOS INTERVENTION SCREEN */}
      {screen === "sos" && (
        <div className="sos-overlay">
          <div className="sos-panel">
            <div className="sos-header">
              <h2>🚨 AI Intervention Active</h2>
              <div className="sos-timer">Urge Surfer Timer: <strong>{formatTimer(urgeTimer)}</strong></div>
            </div>

            {sosStep === "halt" && (
              <div className="sos-content fadeInUp">
                <h3>Mindful Check: Are you in a HALT state?</h3>
                <p className="text-muted">Cravings trigger easily when your system is vulnerable. Select what you feel:</p>
                <div className="halt-grid">
                  {[["hungry","🍽️ Hungry (Low Blood Sugar)"],["angry","😤 Angry / Stressed"],["lonely","😔 Lonely (Bored)"],["tired","😴 Tired (Sleepy)"]].map(([key, label]) => (
                    <button key={key} className={`halt-btn ${haltAnswers[key] ? "active" : ""}`}
                      onClick={() => setHaltAnswers(prev => ({...prev, [key]: !prev[key]}))}>
                      {label}
                    </button>
                  ))}
                </div>
                <div className="sos-actions">
                  <button className="btn btn-primary w-full" onClick={handleHaltDone}>Interrupt The Loop ➔</button>
                  <button className="btn btn-secondary" onClick={startBreathing}>Calm My Nerves</button>
                </div>
              </div>
            )}

            {sosStep === "breathing" && (
              <div className="sos-content fadeInUp" style={{ textAlign: "center" }}>
                <h3>Box Breathing (Calming Center)</h3>
                <p className="text-muted">Direct focus to your breath. Follow the circle.</p>
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
                <h3>⚡ Focus Redirect Command</h3>
                <div className="voice-response">{sosResponse}</div>
                
                <div className="sos-actions">
                  <button className={`btn btn-primary w-full ${listening ? "listening" : ""}`} 
                    onClick={listening ? stopListening : startListening}>
                    {listening ? "🔴 Listening to your voice..." : "🎤 Respond to Coach (Voice)"}
                  </button>
                  <button className="btn btn-secondary" onClick={startBreathing}>Do Box Breathing</button>
                  <button className="btn btn-secondary" onClick={() => setSosStep("voice")}>Speech Mode</button>
                </div>
              </div>
            )}

            {sosStep === "voice" && (
              <div className="sos-content fadeInUp">
                <h3>🎤 Speak to Coach</h3>
                <div className="voice-panel">
                  <button className={`mic-btn ${listening ? "listening" : ""}`} onClick={listening ? stopListening : startListening}>
                    {listening ? "🔴" : "🎙️"}
                  </button>
                  {listening && <p className="mic-status">Listening...</p>}
                </div>
                {sosResponse && <div className="voice-response">{sosResponse}</div>}
                {isSpeaking && <p className="speaking-indicator">🔊 AI Coach is speaking...</p>}
              </div>
            )}

            {/* Post-intervention outcomes */}
            <div style={{ marginTop: 24, paddingTop: 16, borderTop: "2px solid var(--border-color)" }}>
              <p style={{ fontWeight: 700, marginBottom: 8, fontSize: 13 }}>What is your plan now?</p>
              <div className="choice-container">
                <button className="btn btn-secondary btn-sm" onClick={() => handleLogSubmit("swap")}>🔄 I will swap and study</button>
                <button className="btn btn-secondary btn-sm" onClick={() => handleLogSubmit("resist")}>💪 Urge surfed successfully</button>
                <button className="btn btn-danger btn-sm" onClick={() => handleLogSubmit("slip")}>😔 Slipped (I scrolled)</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="app-container">
        <header className="app-header">
          <div className="logo">
            <div className="logo-icon-bg">🦋</div>
            <div className="logo-text-group">
              <span className="logo-sub">A-ONE</span>
              <h1 className="logo-main">Habitwings</h1>
            </div>
          </div>
          <div className="header-actions">
            <button className="btn-icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
            {screen === "dashboard" && (
              <button className="btn btn-secondary btn-sm" onClick={() => setScreen("crisis")}>🚨 Panic Panel</button>
            )}
            {screen === "crisis" && logs.length > 0 && (
              <button className="btn btn-secondary btn-sm" onClick={() => setScreen("dashboard")}>📈 Stats Dashboard</button>
            )}
          </div>
        </header>

        <main>
          {/* ═══ CRISIS INTERVENTION LANDING PANEL ═══ */}
          {screen === "crisis" && (
            <section className="screen-card fadeInUp">
              <div className="screen-header" style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 28, fontWeight: 800 }}>Stuck in a loop? Get an AI intervention.</h2>
                <p className="text-muted">One tap to stop scrolling, align your focus, and start your study session.</p>
              </div>

              <form onSubmit={triggerIntervention}>
                <div className="form-group">
                  <label htmlFor="scroll-input">What are you scrolling/doing right now?</label>
                  <input id="scroll-input" type="text" value={scrollingWhat} onChange={(e) => setScrollingWhat(e.target.value)} required />
                </div>

                <div className="form-group">
                  <label htmlFor="study-input">What should you be doing instead?</label>
                  <input id="study-input" type="text" value={studyWhat} onChange={(e) => setStudyWhat(e.target.value)} required />
                </div>

                <div className="form-group">
                  <label>Quick presets (tap to load)</label>
                  <div className="chip-container">
                    {[
                      ["Instagram", "Studying for CAT Exam"],
                      ["Instagram", "Solving Quant Problems"],
                      ["YouTube Shorts", "Coding Next.js Project"],
                      ["Reddit", "Completing Homework Assignment"],
                      ["Twitter / X", "Reading Book Chapters"]
                    ].map(([sw, st], idx) => (
                      <button key={idx} type="button" className="chip-label" onClick={() => { setScrollingWhat(sw); setStudyWhat(st); }}>
                        📱 {sw} ➔ 📚 {st.split(" ")[0]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="vibe-select">Coach Vibe (Authority Level)</label>
                  <select id="vibe-select" value={vibe} onChange={(e) => setVibe(e.target.value)}>
                    <option value="Direct">Strict & Direct (Tough Love - Authority Mode)</option>
                    <option value="Supportive">Warm & Supportive (Gentle Coaching)</option>
                    <option value="Analytical">Analytical & Scientific (CBT Brain Facts)</option>
                  </select>
                </div>

                <button type="submit" className="btn btn-danger w-full pulse-btn" style={{ fontSize: 16, padding: 16 }}>
                  🚨 INTERVENE NOW (Force Stop)
                </button>
              </form>
            </section>
          )}

          {/* ═══ STATS DASHBOARD SCREEN ═══ */}
          {screen === "dashboard" && (
            <div className="flex-col">
              <div className="dashboard-header-panel">
                <div>
                  <div className="badge">Active Loop</div>
                  <h2 style={{ fontSize: 20 }}>{scrollingWhat} ➔ {studyWhat}</h2>
                  <p className="text-muted">Vibe: {vibe} Coach</p>
                </div>
                <button className="btn btn-danger" onClick={triggerIntervention}>🚨 Quick Intervene</button>
              </div>

              {/* Stats Cards */}
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
                    <span className="stat-label">Success Rate</span>
                  </div>
                </div>
              </div>

              {/* Two Column Grid */}
              <div className="grid-2">
                {/* Left Column: Logging & History */}
                <div className="flex-col">
                  <div className="card">
                    <h3 className="card-title">📝 Note / Log Input</h3>
                    <div className="form-group">
                      <label htmlFor="log-note">What made you slip or swap this time?</label>
                      <textarea id="log-note" rows="3" placeholder="e.g. Felt bored at 3 PM, so I started scrolling. Resisted after AI coach check."
                        value={logNote} onChange={(e) => setLogNote(e.target.value)} />
                    </div>
                    <div className="choice-container">
                      <button className="btn btn-primary" onClick={() => handleLogSubmit("swap")}>🔄 Swapped</button>
                      <button className="btn btn-secondary" onClick={() => handleLogSubmit("resist")}>💪 Resisted</button>
                      <button className="btn btn-danger" onClick={() => handleLogSubmit("slip")}>😔 Slipped</button>
                    </div>
                  </div>

                  {/* History Logs list */}
                  <div className="card">
                    <h3 className="card-title">📋 Activity History</h3>
                    <div className="timeline-container">
                      {logs.slice(0, 10).map((log) => (
                        <div key={log.id} className="timeline-item">
                          <div className={`timeline-marker ${log.outcome}`}>
                            {log.outcome === "swap" ? "🔄" : log.outcome === "resist" ? "💪" : "😔"}
                          </div>
                          <div className="timeline-content">
                            <div className="timeline-header-row">
                              <span className="timeline-title">{log.outcome === "swap" ? "Swapped" : log.outcome === "resist" ? "Resisted" : "Slipped"}</span>
                              <span className="timeline-time">{new Date(log.timestamp).toLocaleTimeString()}</span>
                            </div>
                            <p className="timeline-body">{log.note || "No note recorded."}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Column: AI Coach Chat */}
                <div className="flex-col">
                  <div className="card chat-card">
                    <h3 className="card-title">💬 Conversation with Coach</h3>
                    <div className="chat-messages">
                      <div className="message system-msg">You are talking to the AI coach in {vibe} mode. Ask for support or study advice.</div>
                      {chatMessages.map((msg, i) => (
                        <div key={i} className={`message ${msg.role === "user" ? "user-msg" : "coach-msg"}`}>
                          {msg.text}
                        </div>
                      ))}
                      {chatLoading && <div className="message coach-msg">Thinking...</div>}
                      <div ref={chatEndRef} />
                    </div>
                    <form className="chat-input-form" onSubmit={handleChat}>
                      <input type="text" placeholder="Type a message..." value={chatInput} onChange={(e) => setChatInput(e.target.value)} />
                      <button type="submit" className="btn btn-primary btn-icon">➤</button>
                    </form>
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
