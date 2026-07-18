/**
 * HabitsMate - Core Application Engine
 */

// HTML Escaping Utility for XSS Prevention
function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
}

// Client State
let state = {
  profile: null, // { apiKey, habit, customHabit, goal, vibe, triggers: [] }
  logs: [],      // Array of { id, outcome ('resist'|'slip'), intensity (1-10), trigger, timestamp, note }
  theme: 'light',
  breathingTimer: null,
  chatHistory: [] // { role: 'user'|'model', text: string }
};

// DOM References
const setupScreen = document.getElementById('setup-screen');
const mainAppScreen = document.getElementById('main-app-screen');
const setupForm = document.getElementById('setup-form');
const apiKeyInput = document.getElementById('api-key-input');
const toggleKeyVisibilityBtn = document.getElementById('toggle-key-visibility');
const habitSelect = document.getElementById('habit-select');
const customHabitGroup = document.getElementById('custom-habit-group');
const customHabitInput = document.getElementById('custom-habit-input');
const habitGoal = document.getElementById('habit-goal');
const coachVibe = document.getElementById('coach-vibe');
const resetProfileBtn = document.getElementById('reset-profile-btn');

// Dashboard DOM References
const bannerHabitName = document.getElementById('banner-habit-name');
const bannerHabitGoal = document.getElementById('banner-habit-goal');
const statStreak = document.getElementById('stat-streak');
const statResists = document.getElementById('stat-resists');
const statRate = document.getElementById('stat-rate');

// Craving Logger DOM References
const logForm = document.getElementById('log-form');
const logIntensity = document.getElementById('log-intensity');
const intensityVal = document.getElementById('intensity-val');
const logTrigger = document.getElementById('log-trigger');
const logTimestamp = document.getElementById('log-timestamp');
const logNote = document.getElementById('log-note');

// Panic Button DOM References
const panicBtn = document.getElementById('panic-btn');
const panicHelperWidget = document.getElementById('panic-helper-widget');
const closePanicBtn = document.getElementById('close-panic-btn');
const panicExerciseContainer = document.getElementById('panic-exercise-container');
const panicExerciseTitle = document.getElementById('panic-exercise-title');
const panicExerciseBody = document.getElementById('panic-exercise-body');
const breathingWidget = document.getElementById('breathing-widget');
const breathingCircle = document.getElementById('breathing-circle');
const breathingInstruction = document.getElementById('breathing-instruction');
const breathingTimerLabel = document.getElementById('breathing-timer');

// Chat Panel DOM References
const chatMessagesBox = document.getElementById('chat-messages-box');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const coachVibeDisplay = document.getElementById('coach-vibe-display');
const engineBadgeDisplay = document.getElementById('engine-badge-display');
const generateInsightsBtn = document.getElementById('generate-insights-btn');
const insightsContent = document.getElementById('insights-content');

// Timeline History DOM References
const timelineList = document.getElementById('timeline-list');
const clearLogsBtn = document.getElementById('clear-logs-btn');

// Theme Toggle
const themeToggle = document.getElementById('theme-toggle');

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  loadLocalState();
  initEventListeners();
  applyTheme();
  setupUI();
  updateChallengeCard();
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
});

// Load state from LocalStorage
function loadLocalState() {
  const storedProfile = localStorage.getItem('habitsmate_profile');
  const storedLogs = localStorage.getItem('habitsmate_logs');
  const storedTheme = localStorage.getItem('habitsmate_theme');

  if (storedProfile) {
    try {
      state.profile = JSON.parse(storedProfile);
    } catch (e) {
      state.profile = null;
    }
  }
  if (storedLogs) {
    try {
      state.logs = JSON.parse(storedLogs);
    } catch (e) {
      state.logs = [];
    }
  }
  if (storedTheme) {
    state.theme = storedTheme;
  }
}

// Save state to LocalStorage
function saveLocalState() {
  if (state.profile) {
    localStorage.setItem('habitsmate_profile', JSON.stringify(state.profile));
  } else {
    localStorage.removeItem('habitsmate_profile');
  }
  localStorage.setItem('habitsmate_logs', JSON.stringify(state.logs));
  localStorage.setItem('habitsmate_theme', state.theme);
}

// Event Listeners Registration
function initEventListeners() {
  // Theme toggle
  themeToggle.addEventListener('click', () => {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    applyTheme();
    saveLocalState();
  });

  // Toggle API Key visibility
  toggleKeyVisibilityBtn.addEventListener('click', () => {
    const isPassword = apiKeyInput.type === 'password';
    apiKeyInput.type = isPassword ? 'text' : 'password';
    const icon = toggleKeyVisibilityBtn.querySelector('i');
    if (icon) {
      icon.setAttribute('data-lucide', isPassword ? 'eye-off' : 'eye');
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  });

  // Custom habit dropdown trigger
  habitSelect.addEventListener('change', () => {
    if (habitSelect.value === 'Custom') {
      customHabitGroup.classList.remove('hidden');
      customHabitInput.setAttribute('required', 'true');
    } else {
      customHabitGroup.classList.add('hidden');
      customHabitInput.removeAttribute('required');
    }
  });

  // Onboarding Form Submit
  setupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const triggers = [];
    document.querySelectorAll('.trigger-chips-container input[type="checkbox"]:checked').forEach(cb => {
      triggers.push(cb.value);
    });

    state.profile = {
      apiKey: apiKeyInput.value.trim(),
      habit: habitSelect.value,
      customHabit: habitSelect.value === 'Custom' ? customHabitInput.value.trim() : '',
      goal: habitGoal.value.trim(),
      vibe: coachVibe.value,
      triggers: triggers
    };

    saveLocalState();
    setupUI();
    showToast('Profile configured successfully!');
  });

  // Reset/Settings Button click
  resetProfileBtn.addEventListener('click', () => {
    // Populate form fields with existing state
    if (state.profile) {
      apiKeyInput.value = state.profile.apiKey || '';
      habitSelect.value = state.profile.customHabit ? 'Custom' : state.profile.habit;
      if (state.profile.customHabit) {
        customHabitGroup.classList.remove('hidden');
        customHabitInput.value = state.profile.customHabit;
        customHabitInput.setAttribute('required', 'true');
      } else {
        customHabitGroup.classList.add('hidden');
        customHabitInput.value = '';
      }
      habitGoal.value = state.profile.goal || '';
      coachVibe.value = state.profile.vibe || 'Compassionate';
      
      // Checkboxes
      document.querySelectorAll('.trigger-chips-container input[type="checkbox"]').forEach(cb => {
        cb.checked = state.profile.triggers.includes(cb.value);
      });
    }

    state.profile = null;
    saveLocalState();
    setupUI();
  });

  // Intensity slider update
  logIntensity.addEventListener('input', () => {
    intensityVal.textContent = logIntensity.value;
  });

  // Log Form Submit
  logForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const outcome = document.querySelector('input[name="log-outcome"]:checked').value;
    const intensity = parseInt(logIntensity.value, 10);
    const trigger = logTrigger.value;
    const timestampStr = logTimestamp.value;
    const note = logNote.value.trim();

    const newLog = {
      id: Date.now().toString(),
      outcome,
      intensity,
      trigger,
      timestamp: timestampStr,
      note
    };

    state.logs.unshift(newLog); // prepend to show latest first
    saveLocalState();
    
    // Reset log input except timestamp
    logNote.value = '';
    logIntensity.value = '5';
    intensityVal.textContent = '5';
    document.getElementById('outcome-resist').checked = true;

    updateDashboardStats();
    renderTimelineLogs();
    renderCravingChart();
    runCbtInsights();
    showToast('Log entry recorded!');
  });

  // Panic Button Click
  panicBtn.addEventListener('click', () => {
    panicHelperWidget.classList.remove('hidden');
    panicExerciseContainer.classList.add('hidden');
    stopBreathingWidget();
    panicHelperWidget.scrollIntoView({ behavior: 'smooth' });
  });

  closePanicBtn.addEventListener('click', () => {
    panicHelperWidget.classList.add('hidden');
    stopBreathingWidget();
  });

  // Panic Mood Buttons
  document.querySelectorAll('.panic-mood-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const selectedTrigger = e.currentTarget.getAttribute('data-trigger');
      triggerPanicExercise(selectedTrigger);
    });
  });

  // Chat message submit
  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;

    appendChatMessage('user', text);
    chatInput.value = '';
    chatInput.focus();

    // Disable input while coach replies
    const submitBtn = chatForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      appendChatMessage('coach', 'Thinking...', true); // temp thinking message
      const response = await fetchCoachResponse(text);
      removeTempMessage();
      appendChatMessage('coach', response);
    } catch (err) {
      removeTempMessage();
      appendChatMessage('coach', "I apologize, but I encountered an error processing that. Let's practice a grounding technique in the meantime.");
    } finally {
      submitBtn.disabled = false;
    }
  });

  // Refresh analysis
  generateInsightsBtn.addEventListener('click', () => {
    runCbtInsights();
    showToast('Recovery diagnostics refreshed.');
  });

  // Clear Logs
  clearLogsBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear your entire log history? This cannot be undone.')) {
      state.logs = [];
      saveLocalState();
      updateDashboardStats();
      renderTimelineLogs();
      renderCravingChart();
      runCbtInsights();
      showToast('Log history cleared.');
    }
  });
}

// Apply Stylesheet Theme
function applyTheme() {
  const sunIcon = themeToggle.querySelector('.sun-icon');
  const moonIcon = themeToggle.querySelector('.moon-icon');

  if (state.theme === 'dark') {
    document.body.classList.add('dark');
    sunIcon.classList.remove('hidden');
    moonIcon.classList.add('hidden');
  } else {
    document.body.classList.remove('dark');
    sunIcon.classList.add('hidden');
    moonIcon.classList.remove('hidden');
  }
}

// UI Visibility Management based on State
function setupUI() {
  if (state.profile) {
    setupScreen.classList.add('hidden');
    mainAppScreen.classList.remove('hidden');
    resetProfileBtn.classList.remove('hidden');

    // Populate active banner info
    const habitName = state.profile.customHabit || state.profile.habit;
    bannerHabitName.textContent = escapeHtml(habitName);
    bannerHabitGoal.textContent = escapeHtml(state.profile.goal);

    // Populate coach display parameters
    coachVibeDisplay.textContent = `Vibe: ${escapeHtml(state.profile.vibe)}`;
    
    if (state.profile.apiKey) {
      engineBadgeDisplay.textContent = 'Gemini GenAI Engine';
      engineBadgeDisplay.classList.add('online');
    } else {
      engineBadgeDisplay.textContent = 'Offline Engine';
      engineBadgeDisplay.classList.remove('online');
    }

    // Set default log timestamp to current local time
    const now = new Date();
    // Offset local timezone to get string matching YYYY-MM-DDThh:mm
    const tzoffset = now.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(now.getTime() - tzoffset)).toISOString().slice(0, 16);
    logTimestamp.value = localISOTime;

    // Refresh display
    updateDashboardStats();
    renderTimelineLogs();
    renderCravingChart();
    runCbtInsights();
  } else {
    setupScreen.classList.remove('hidden');
    mainAppScreen.classList.add('hidden');
    resetProfileBtn.classList.add('hidden');
  }
}

// Toast Notifications helper
function showToast(message) {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-message');
  toastMsg.textContent = message;
  toast.classList.remove('hidden');
  
  // Slide out after 3 seconds
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}

// Calculate Dashboard Stats
function updateDashboardStats() {
  if (!state.logs || state.logs.length === 0) {
    statStreak.textContent = '0 days';
    statResists.textContent = '0 times';
    statRate.textContent = '100%';
    statRate.parentElement.querySelector('.stat-label').textContent = 'Success Rate';
    return;
  }

  // Cravings Resisted Count
  const resists = state.logs.filter(l => l.outcome === 'resist').length;
  statResists.textContent = `${resists} times`;

  // Success Rate
  const successRate = Math.round((resists / state.logs.length) * 100);
  statRate.textContent = `${successRate}%`;

  // Streak calculation (continuous days resisted without slips)
  let streak = 0;
  
  // Sort logs by time ascending to calculate streaks chronologically
  const sortedLogs = [...state.logs].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  
  // Calculate day difference streak
  const daysWithResists = new Set();
  const daysWithSlips = new Set();

  sortedLogs.forEach(log => {
    const dateStr = log.timestamp.split('T')[0];
    if (log.outcome === 'resist') {
      daysWithResists.add(dateStr);
    } else {
      daysWithSlips.add(dateStr);
    }
  });

  // Calculate consecutive days of resist ending at current date
  let checkDate = new Date();
  while (true) {
    const dateStr = checkDate.toISOString().split('T')[0];
    if (daysWithSlips.has(dateStr)) {
      break; // Slip breaks the streak
    }
    if (daysWithResists.has(dateStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      // If there are logs on prior days, but nothing today yet, keep checking one day back
      // but if we hit a gap of a full day with no activity, we might break or continue.
      // For a simple robust streak, let's say a day without logs doesn't break a streak
      // unless there is a slip. But to be rigorous: if they resisted yesterday, the streak is alive.
      // Let's count consecutive days in daysWithResists.
      if (streak === 0) {
        // Allow streak to be alive if they did it yesterday
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yestStr = yesterday.toISOString().split('T')[0];
        if (daysWithResists.has(yestStr) && !daysWithSlips.has(dateStr)) {
          checkDate.setDate(checkDate.getDate() - 1);
          continue;
        }
      }
      break;
    }
  }

  statStreak.textContent = `${streak} days`;
}

// Generate Challenge dynamically based on target habit
function updateChallengeCard() {
  const challengeText = document.getElementById('challenge-text');
  if (!state.profile) return;

  const habit = (state.profile.customHabit || state.profile.habit).toLowerCase();
  
  const challenges = {
    screen: [
      "Digital Sunset: Keep your phone in another room tonight 30 minutes before sleep.",
      "Gray Mode: Turn your screen grayscale for 3 hours to lower cognitive appeal.",
      "Friction Barrier: Place a physical rubber band around your phone to pause impulse clicks.",
      "App-Free Meal: Have your next meal completely screen-free, focused on sensory eating."
    ],
    vape: [
      "Delay urge: Wait exactly 10 minutes from the moment you feel the next vape craving.",
      "Water substitute: Take 3 slow gulps of cold water when you reach for a smoke/vape.",
      "Safe custody: Place your device in a drawer on another floor for 4 hours.",
      "Deep Breathing: Complete 3 box-breathing cycles next time a craving hits."
    ],
    procrastination: [
      "Micro-Pomodoro: Dedicate exactly 10 minutes to your task with zero distraction.",
      "2-Minute Rule: If a task takes less than 2 minutes, perform it right now.",
      "Single-Tasking: Close all browser tabs except the one active task for 1 hour.",
      "Draft first step: Write down just the single sentence starting point of the project."
    ],
    food: [
      "Mindful Snack: Wait 15 minutes before opening the pantry, drinking a full glass of water.",
      "Healthy swap: Swap your afternoon sweet snack for a handful of nuts or fresh fruit.",
      "Zero-Screen Bite: Eat your lunch with no phone/tv, paying attention to full textures.",
      "Craving Check: Rate your stomach hunger 1-10 before snacking. If under 5, do a stretch."
    ],
    shop: [
      "48-Hour Cart Rule: Put items in the cart but wait 48 hours before clicking buy.",
      "Unsubscribe session: Unsubscribe from 3 promotional marketing newsletters today.",
      "Cash day: Use only cash or restrict digital payment setups for 24 hours.",
      "Need vs Want: Write down the functional reason why you need the item before checkout."
    ]
  };

  let matchingList = challenges.screen;
  if (habit.includes('vape') || habit.includes('smoke') || habit.includes('nicotine')) {
    matchingList = challenges.vape;
  } else if (habit.includes('procrast') || habit.includes('work') || habit.includes('distract')) {
    matchingList = challenges.procrastination;
  } else if (habit.includes('food') || habit.includes('eat') || habit.includes('snack')) {
    matchingList = challenges.food;
  } else if (habit.includes('shop') || habit.includes('spend') || habit.includes('buy')) {
    matchingList = challenges.shop;
  }

  // Seed daily random selection using date as seed
  const dayIndex = new Date().getDate() % matchingList.length;
  challengeText.textContent = matchingList[dayIndex];
}

// Render Timeline Logs
function renderTimelineLogs() {
  if (!state.logs || state.logs.length === 0) {
    timelineList.innerHTML = `<p class="text-muted text-center py-4">No entries in the log history yet. Complete a check-in above.</p>`;
    return;
  }

  let html = '';
  state.logs.forEach(log => {
    const isResist = log.outcome === 'resist';
    const markerClass = isResist ? 'resist' : 'slip';
    const markerIcon = isResist ? 'thumbs-up' : 'thumbs-down';
    const tagClass = getTriggerTagClass(log.trigger);
    
    // Format timestamp nicely
    let formattedDate = 'Just now';
    if (log.timestamp) {
      try {
        const dateObj = new Date(log.timestamp);
        formattedDate = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + 
                        dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      } catch (e) {
        formattedDate = log.timestamp;
      }
    }

    html += `
      <div class="timeline-item" data-id="${log.id}">
        <div class="timeline-marker ${markerClass}">
          <i data-lucide="${markerIcon}"></i>
        </div>
        <div class="timeline-content">
          <div class="timeline-header-row">
            <span class="timeline-title">${isResist ? 'Resisted Urge' : 'Slipped / Acted'}</span>
            <span class="timeline-time">${escapeHtml(formattedDate)}</span>
          </div>
          ${log.note ? `<p class="timeline-body-text">${escapeHtml(log.note)}</p>` : ''}
          <div class="timeline-footer-row">
            <span class="tag-indicator ${tagClass}">${escapeHtml(log.trigger)}</span>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="intensity-badge-inline">Intensity: ${log.intensity}/10</span>
              <button type="button" class="btn-delete-log" onclick="deleteLogEntry('${log.id}')" aria-label="Delete log entry">
                <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  });

  timelineList.innerHTML = html;
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// Global scope helper for deleting log entry
window.deleteLogEntry = function(id) {
  state.logs = state.logs.filter(log => log.id !== id);
  saveLocalState();
  updateDashboardStats();
  renderTimelineLogs();
  renderCravingChart();
  runCbtInsights();
  showToast('Log entry deleted.');
};

// Map trigger values to CSS tag indicator colors
function getTriggerTagClass(trigger) {
  const mapping = {
    'Stress': 'stress',
    'Boredom': 'boredom',
    'Anxiety': 'anxiety',
    'Fatigue': 'fatigue',
    'Social Pressure': 'social',
    'Automatic Routine': 'routine'
  };
  return mapping[trigger] || 'other';
}

// Render dynamic SVG Line Chart of craving intensities
function renderCravingChart() {
  const svg = document.getElementById('craving-chart');
  if (!svg) return;

  // Clear previous SVG content
  svg.innerHTML = '';

  // Get last 7 logs, chronologically sorted (left to right)
  const chartLogs = [...state.logs].slice(0, 7).reverse();

  if (chartLogs.length === 0) {
    svg.setAttribute('aria-label', 'Craving chart: No log data available.');
    const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    textNode.setAttribute('x', '250');
    textNode.setAttribute('y', '100');
    textNode.setAttribute('text-anchor', 'middle');
    textNode.setAttribute('class', 'chart-axis-text');
    textNode.textContent = 'Log cravings above to view progression trends';
    svg.appendChild(textNode);
    return;
  }

  // Dimensions setup
  const width = 500;
  const height = 200;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 30;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Draw Gridlines & Y-axis labels (Intensity 1 to 10)
  for (let i = 1; i <= 10; i++) {
    const y = paddingTop + chartHeight - ((i - 1) / 9) * chartHeight;
    
    // Grid lines for levels 1, 5, 10
    if (i === 1 || i === 5 || i === 10) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', paddingLeft);
      line.setAttribute('y1', y);
      line.setAttribute('x2', width - paddingRight);
      line.setAttribute('y2', y);
      line.setAttribute('class', 'chart-grid');
      svg.appendChild(line);

      // Y-axis label text
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', paddingLeft - 10);
      text.setAttribute('y', y + 3);
      text.setAttribute('text-anchor', 'end');
      text.setAttribute('class', 'chart-axis-text');
      text.textContent = i;
      svg.appendChild(text);
    }
  }

  // Calculate coordinates
  const points = [];
  const count = chartLogs.length;

  chartLogs.forEach((log, idx) => {
    // Distribute X coordinate
    const x = paddingLeft + (count > 1 ? (idx / (count - 1)) * chartWidth : chartWidth / 2);
    // Map intensity 1-10 to Y coordinate (intensity 10 at top, 1 at bottom)
    const y = paddingTop + chartHeight - ((log.intensity - 1) / 9) * chartHeight;
    points.push({ x, y, log });
  });

  // Draw Polyline path
  if (points.length > 1) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    let pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      pathD += ` L ${points[i].x} ${points[i].y}`;
    }
    path.setAttribute('d', pathD);
    path.setAttribute('class', 'chart-line');
    svg.appendChild(path);
  }

  // Draw Points & Tooltips
  points.forEach((pt, idx) => {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', pt.x);
    circle.setAttribute('cy', pt.y);
    circle.setAttribute('class', 'chart-point');
    
    // Color points based on outcome (resist = success green, slip = danger red)
    const isResist = pt.log.outcome === 'resist';
    circle.style.stroke = isResist ? 'var(--success)' : 'var(--danger)';

    // Accessibility support
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = `Log ${idx + 1}: ${isResist ? 'Resisted' : 'Slipped'}, Intensity: ${pt.log.intensity}/10 (${pt.log.trigger})`;
    circle.appendChild(title);

    svg.appendChild(circle);

    // Draw simple X-axis date labels
    const dateText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    dateText.setAttribute('x', pt.x);
    dateText.setAttribute('y', height - 8);
    dateText.setAttribute('text-anchor', 'middle');
    dateText.setAttribute('class', 'chart-axis-text');
    
    let dateLabel = `L${idx + 1}`;
    if (pt.log.timestamp) {
      try {
        const d = new Date(pt.log.timestamp);
        dateLabel = d.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
      } catch (e) {}
    }
    dateText.textContent = dateLabel;
    svg.appendChild(dateText);
  });

  // Set aria description
  const logSummaries = chartLogs.map((l, i) => `#${i+1} (${l.outcome === 'resist' ? 'Resisted' : 'Slipped'}, intensity ${l.intensity})`).join(', ');
  svg.setAttribute('aria-label', `Line chart showing craving intensity over recent logs. Plot points: ${logSummaries}`);
}

// CBT Offline Grounding & Coping Exercises
const copingExercises = {
  Stress: {
    title: "Grounding Box Breathing (4-4-4-4)",
    body: "Reduce physiological fight-or-flight triggers by pacing your nervous system. Inhale slowly for 4 seconds, hold your lungs full for 4, exhale fully for 4, and hold empty for 4. Repeat this loop.",
    showBreathing: true
  },
  Boredom: {
    title: "Disruptive Choice Loop",
    body: "Boredom is a cue looking for instant reward. Force a friction step: Commit to doing an alternate screen-free activity (e.g. stretch, clean a surface, write a paper todo item) for exactly 5 minutes. Tell yourself: 'If I still crave it in 5 minutes, I will evaluate again.' This interrupts the routine loop.",
    showBreathing: false
  },
  Anxiety: {
    title: "5-4-3-2-1 Sensory Grounding",
    body: "Redirect scanning behaviors back to your surroundings. Name out loud: <br>• <b>5</b> things you can see around you,<br>• <b>4</b> physical textures you can feel (e.g., your desk, shirt),<br>• <b>3</b> distinct sounds you can hear,<br>• <b>2</b> scents you can smell,<br>• <b>1</b> taste you can identify. <br>This interrupts anxiety-driven craving signals.",
    showBreathing: false
  },
  Fatigue: {
    title: "The 10-Minute Recharge",
    body: "Low energy triggers immediate-gratification behaviors. Perform an active boost: Hydrate with a full glass of water, stand up to stretch your torso up towards the ceiling, or close your eyes to rest without any device stimulation for 10 minutes. Acknowledge fatigue as a physiological signal, not a cue to engage in your habit.",
    showBreathing: false
  }
};

// Trigger Panic exercise view
function triggerPanicExercise(trigger) {
  const exercise = copingExercises[trigger] || copingExercises.Stress;
  panicExerciseContainer.classList.remove('hidden');
  panicExerciseTitle.textContent = exercise.title;
  panicExerciseBody.innerHTML = exercise.body;

  if (exercise.showBreathing) {
    startBreathingWidget();
  } else {
    stopBreathingWidget();
  }
}

// Start Breathing Widget
function startBreathingWidget() {
  breathingWidget.classList.remove('hidden');
  stopBreathingWidget(); // Clear any existing intervals

  let cycle = 0; // 0=Inhale, 1=Hold, 2=Exhale, 3=Hold
  let count = 4;

  const runTimer = () => {
    breathingTimerLabel.textContent = `${count}s`;
    if (cycle === 0) {
      breathingInstruction.textContent = "Breathe In";
      breathingCircle.classList.add('inhale-state');
      breathingCircle.classList.remove('exhale-state');
    } else if (cycle === 1) {
      breathingInstruction.textContent = "Hold Breath";
    } else if (cycle === 2) {
      breathingInstruction.textContent = "Breathe Out";
      breathingCircle.classList.add('exhale-state');
      breathingCircle.classList.remove('inhale-state');
    } else if (cycle === 3) {
      breathingInstruction.textContent = "Hold Empty";
    }

    count--;
    if (count < 0) {
      count = 4;
      cycle = (cycle + 1) % 4;
    }
  };

  runTimer(); // Run once immediately
  state.breathingTimer = setInterval(runTimer, 1000);
}

// Stop Breathing Widget
function stopBreathingWidget() {
  if (state.breathingTimer) {
    clearInterval(state.breathingTimer);
    state.breathingTimer = null;
  }
  breathingWidget.classList.add('hidden');
  breathingCircle.classList.remove('inhale-state', 'exhale-state');
  breathingTimerLabel.textContent = 'Ready';
}

// Offline Heuristic Insights Engine (Diagnostics Generator)
function runCbtInsights() {
  if (!state.logs || state.logs.length === 0) {
    insightsContent.innerHTML = `<p>No logs recorded yet. Add logs to let the coach perform trigger diagnostics.</p>`;
    return;
  }

  // Count metrics
  const total = state.logs.length;
  const slips = state.logs.filter(l => l.outcome === 'slip');
  const resists = state.logs.filter(l => l.outcome === 'resist');

  // Trigger metrics
  const triggerCounts = {};
  slips.forEach(s => {
    triggerCounts[s.trigger] = (triggerCounts[s.trigger] || 0) + 1;
  });

  let topTrigger = 'None';
  let maxCount = 0;
  for (const t in triggerCounts) {
    if (triggerCounts[t] > maxCount) {
      maxCount = triggerCounts[t];
      topTrigger = t;
    }
  }

  const slipRate = Math.round((slips.length / total) * 100);

  // Generate offline report
  let insightText = '';
  if (slips.length === 0) {
    insightText = `
      <p><b>Analysis</b>: Phenomenal work! You have maintained a <b>100% resistance rate</b> across ${total} cravings.</p>
      <ul>
        <li>Keep updating your trigger logs when urges surface.</li>
        <li>Your mindfulness challenges are building high mental resistance.</li>
      </ul>
    `;
  } else {
    let copingTip = "Build friction into your routines by placing your trigger objects far away.";
    if (topTrigger === 'Stress') {
      copingTip = "Since stress is a major trigger, practice box breathing for 2 minutes *prior* to starting difficult tasks.";
    } else if (topTrigger === 'Boredom') {
      copingTip = "Boredom slips suggest a lack of alternative stimulation. Write down 3 screen-free tasks you can do instantly.";
    } else if (topTrigger === 'Anxiety') {
      copingTip = "Anxiety cues require grounding. Use the 5-4-3-2-1 sensory method to calm mental loops.";
    } else if (topTrigger === 'Fatigue') {
      copingTip = "Fatigue slips indicate willpower exhaustion. Ensure you take structured breaks rather than scrolling/acting on your habit.";
    }

    insightText = `
      <p><b>Diagnostics Report</b>:</p>
      <ul>
        <li><b>Urge Slips</b>: You acted on the urge in <b>${slipRate}%</b> of logs (${slips.length}/${total}).</li>
        <li><b>Vulnerability Peak</b>: Your primary trigger of relapse is <b>${escapeHtml(topTrigger)}</b> (${maxCount} times).</li>
        <li><b>Actionable CBT Plan</b>: ${escapeHtml(copingTip)}</li>
      </ul>
    `;
  }

  insightsContent.innerHTML = insightText;
}

// Chat Messages Rendering Helpers
function appendChatMessage(role, text, isTemp = false) {
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${role === 'user' ? 'user-msg' : 'coach-msg'}`;
  if (isTemp) {
    msgDiv.id = 'temp-coach-message';
  }
  
  // Use escaped HTML to prevent code injection
  const escapedText = escapeHtml(text).replace(/\n/g, '<br>');
  msgDiv.innerHTML = `<p>${escapedText}</p>`;
  
  chatMessagesBox.appendChild(msgDiv);
  chatMessagesBox.scrollTop = chatMessagesBox.scrollHeight;

  // Add to conversational state if not temporary loading text
  if (!isTemp) {
    state.chatHistory.push({ role, text });
    // Keep chat history clean to preserve space (last 15 messages)
    if (state.chatHistory.length > 15) {
      state.chatHistory.shift();
    }
  }
}

function removeTempMessage() {
  const tempMsg = document.getElementById('temp-coach-message');
  if (tempMsg) {
    tempMsg.remove();
  }
}

// Fetch responses via Gemini API or fall back to Offline Heuristic Rules Engine
async function fetchCoachResponse(userMessage) {
  const apiKey = state.profile?.apiKey;
  const habit = state.profile?.customHabit || state.profile?.habit || "harmful habit";
  const goal = state.profile?.goal || "reduction";
  const vibe = state.profile?.vibe || "Compassionate";

  // System Prompt template defining the coach's personality and instructions
  const systemPrompt = `You are HabitsMate Coach, a certified Cognitive Behavioral Therapy (CBT) recovery assistant.
Your goal is to help the user break their harmful habit: "${habit}" (Goal: ${goal}).
Your coaching vibe is: "${vibe}".
- If Compassionate: Be warm, empathetic, validating, and supportive.
- If Direct: Be firm, focused on discipline, accountability, and direct truths.
- If Analytical: Focus on science, psychology statistics, behavioral loop analysis, and CBT logs.

User's logs context: ${JSON.stringify(state.logs.slice(0, 5))}

Keep answers concise (max 3 short paragraphs). Offer a grounding technique, a friction step, or redirection if they report high cravings.`;

  // Check if API key is configured
  if (!apiKey) {
    // Run offline heuristic response
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(runOfflineNLPCoaching(userMessage, vibe, habit));
      }, 600);
    });
  }

  // API Request to Gemini
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  
  // Format conversational context
  const apiContents = [];
  
  // 1. Add context instruction as first user message (Gemini API does not support separate developerInstruction in client-side query easily without specific fields, so we prepend it safely)
  apiContents.push({
    role: 'user',
    parts: [{ text: `${systemPrompt}\n\nUnderstood. I will coaching you now.` }]
  });
  apiContents.push({
    role: 'model',
    parts: [{ text: "Hello! Let's work together to build healthier patterns. I am ready." }]
  });

  // 2. Add conversational history
  state.chatHistory.forEach(msg => {
    apiContents.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    });
  });

  // 3. Add latest message
  apiContents.push({
    role: 'user',
    parts: [{ text: userMessage }]
  });

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: apiContents
      })
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();
    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (replyText) {
      return replyText;
    } else {
      throw new Error('Malformed API response');
    }
  } catch (err) {
    console.error("Gemini API connection error:", err);
    // Fallback to offline engine
    return runOfflineNLPCoaching(userMessage, vibe, habit) + " \n\n[Note: Running in Offline Mode due to API connection issue]";
  }
}

// Local NLP Rules Matcher for Offline Mode
function runOfflineNLPCoaching(msg, vibe, habit) {
  const cleanMsg = msg.toLowerCase();
  
  // Keyword category detectors
  const hasSlip = cleanMsg.includes('slip') || cleanMsg.includes('relapse') || cleanMsg.includes('broke') || cleanMsg.includes('failed') || cleanMsg.includes('smoked') || cleanMsg.includes('vaped') || cleanMsg.includes('scrolled') || cleanMsg.includes('ate');
  const hasUrge = cleanMsg.includes('crave') || cleanMsg.includes('urge') || cleanMsg.includes('want') || cleanMsg.includes('need') || cleanMsg.includes('tempt');
  const hasSuccess = cleanMsg.includes('resist') || cleanMsg.includes('streak') || cleanMsg.includes('success') || cleanMsg.includes('proud') || cleanMsg.includes('won') || cleanMsg.includes('good');
  const hasNegativeMood = cleanMsg.includes('bored') || cleanMsg.includes('tired') || cleanMsg.includes('stress') || cleanMsg.includes('anxious') || cleanMsg.includes('sad') || cleanMsg.includes('angry');

  // Vibe responses bank
  const responses = {
    Compassionate: {
      slip: `It is completely okay. A slip is just a single data point in a long journey—it does not erase your progress. Take a deep, gentle breath. What matters now is how you comfort yourself and step back into alignment. Let's do a quick breathing stretch.`,
      urge: `I hear how strong the urge is right now, and it is completely natural. Urges are like waves: they peak and then they break. You don't have to fight it—just sit with it for 5 minutes without acting. I am right here with you.`,
      success: `That is incredible! Resisting that craving takes genuine strength. Celebrate this win—it strengthens your brain's new neural path. Keep up this momentum!`,
      mood: `I hear you. When we feel overwhelmed, our brain automatically reaches for the habit for comfort. Let's address the root feeling. Try taking a sip of water and relaxing your shoulders.`,
      generic: `Thank you for sharing that. Breaking habits takes time and patience. Tell me more about what is triggering your thoughts, or ask about a grounding technique.`
    },
    Direct: {
      slip: `You slipped. Acknowledge it, but do not dwell on excuses. Identify the exact trigger that tripped you up so we can build a barrier against it next time. Reset your focus immediately. What is your immediate next action?`,
      urge: `The urge is just a feeling, not an command. It cannot force you to act unless you let it. Put your devices or triggers away, stand up, and move to another room. You are in control of your hands and actions.`,
      success: `Good. You did what you committed to. That is discipline in action. Write down what worked so you can repeat it next time. Keep pushing.`,
      mood: `Feelings are temporary, but the consequences of breaking your commitment are long term. Do not use stress or tiredness as a hall pass. Acknowledge the emotion and carry on with your goal.`,
      generic: `Stay focused on your daily target. Habits are broken through consistent daily decisions. What is your immediate plan to avoid your cues right now?`
    },
    Analytical: {
      slip: `Understood. Analyzing slip: This represents a lapse in the cognitive feedback loop. Let's catalog the environmental cues and your affective state prior to this action. By understanding the cue (e.g. stress) and the routine, we can reprogram the reward mechanism.`,
      urge: `Urges usually escalate and peak within 10 to 15 minutes before declining. This is known as 'urge surfing'. Let's monitor the intensity level. Try using the Box Breathing grounding widget on the left to measure if the urge intensity drops.`,
      success: `Data logged: Urge successfully resisted. This strengthens the inhibitory control networks in your prefrontal cortex. Each resistance makes the next decision statistically easier.`,
      mood: `Affetive triggers such as fatigue or anxiety alter cognitive evaluation, making immediate rewards appear more valuable than long-term goals. Disconnect from the stimuli and run a sensory grounding exercise to re-stabilize cognitive processing.`,
      generic: `Analyzing state. To help build your CBT model, describe what trigger cues (stress, boredom, location, time) are currently active in your environment.`
    }
  };

  const bank = responses[vibe] || responses.Compassionate;

  if (hasSlip) return bank.slip;
  if (hasUrge) return bank.urge;
  if (hasSuccess) return bank.success;
  if (hasNegativeMood) return bank.mood;
  return bank.generic;
}
