/* ==========================================================================
   HABITSMATE - AUTOMATED TESTING SUITE
   ========================================================================== */

const assert = require('assert');

console.log("🚀 Starting HabitsMate Test Suite...\n");

// --- Mock Functions / Implementations from app.js to test in isolation ---

// 1. HTML Escaper (XSS Prevention)
function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
}

// 2. Offline NLP Rules Matcher for Offline Mode
function runOfflineNLPCoaching(msg, vibe, habit) {
  const cleanMsg = msg.toLowerCase();
  
  const hasSlip = cleanMsg.includes('slip') || cleanMsg.includes('relapse') || cleanMsg.includes('broke') || cleanMsg.includes('failed') || cleanMsg.includes('smoked') || cleanMsg.includes('vaped') || cleanMsg.includes('scrolled') || cleanMsg.includes('ate');
  const hasUrge = cleanMsg.includes('crave') || cleanMsg.includes('urge') || cleanMsg.includes('want') || cleanMsg.includes('need') || cleanMsg.includes('tempt');
  const hasSuccess = cleanMsg.includes('resist') || cleanMsg.includes('streak') || cleanMsg.includes('success') || cleanMsg.includes('proud') || cleanMsg.includes('won') || cleanMsg.includes('good');
  const hasNegativeMood = cleanMsg.includes('bored') || cleanMsg.includes('tired') || cleanMsg.includes('stress') || cleanMsg.includes('anxious') || cleanMsg.includes('sad') || cleanMsg.includes('angry');

  const responses = {
    Compassionate: {
      slip: "It is completely okay. A slip is just a single data point in a long journey",
      urge: "I hear how strong the urge is right now",
      success: "That is incredible! Resisting that craving takes genuine strength",
      mood: "I hear you. When we feel overwhelmed, our brain automatically reaches",
      generic: "Thank you for sharing that. Breaking habits takes time"
    },
    Direct: {
      slip: "You slipped. Acknowledge it, but do not dwell on excuses",
      urge: "The urge is just a feeling, not an command",
      success: "Good. You did what you committed to. That is discipline",
      mood: "Feelings are temporary, but the consequences of breaking",
      generic: "Stay focused on your daily target."
    },
    Analytical: {
      slip: "Understood. Analyzing slip: This represents a lapse in the cognitive",
      urge: "Urges usually escalate and peak within 10 to 15 minutes",
      success: "Data logged: Urge successfully resisted. This strengthens",
      mood: "Affetive triggers such as fatigue or anxiety alter cognitive",
      generic: "Analyzing state. To help build your CBT model"
    }
  };

  const bank = responses[vibe] || responses.Compassionate;

  if (hasSlip) return bank.slip;
  if (hasUrge) return bank.urge;
  if (hasSuccess) return bank.success;
  if (hasNegativeMood) return bank.mood;
  return bank.generic;
}

// 3. CBT Offline Diagnostics Report (Insights generator logic)
function getCbtInsights(logs) {
  if (!logs || logs.length === 0) {
    return { status: "empty", report: "No logs recorded yet" };
  }

  const total = logs.length;
  const slips = logs.filter(l => l.outcome === 'slip');
  const resists = logs.filter(l => l.outcome === 'resist');

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
  return {
    total,
    slips: slips.length,
    resists: resists.length,
    slipRate,
    topTrigger
  };
}

// 4. Streak Calculation Logic
function calculateStreak(logs) {
  if (!logs || logs.length === 0) return 0;
  
  let streak = 0;
  const sortedLogs = [...logs].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  
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

  let checkDate = new Date();
  while (true) {
    const dateStr = checkDate.toISOString().split('T')[0];
    if (daysWithSlips.has(dateStr)) {
      break; 
    }
    if (daysWithResists.has(dateStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      // Check if we can skip the current day if there is no activity today yet
      if (streak === 0) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yestStr = yesterday.toISOString().split('T')[0];
        if (daysWithResists.has(yestStr)) {
          checkDate.setDate(checkDate.getDate() - 1);
          continue;
        }
      }
      break;
    }
  }

  return streak;
}

// --- Test Cases ---

let passedTests = 0;
let failedTests = 0;

function runTest(description, fn) {
  try {
    fn();
    console.log(` ✅ PASS: ${description}`);
    passedTests++;
  } catch (error) {
    console.error(` ❌ FAIL: ${description}`);
    console.error(`    Reason: ${error.message}`);
    failedTests++;
  }
}

// 1. HTML Sanitization Tests
runTest("escapeHtml escapes HTML tags and special characters to prevent XSS injection", () => {
  const dirty = '<div class="test">alert("xss")</div> & "hello"';
  const clean = escapeHtml(dirty);
  assert.strictEqual(clean, '&lt;div class=&quot;test&quot;&gt;alert(&quot;xss&quot;)&lt;/div&gt; &amp; &quot;hello&quot;');
});

runTest("escapeHtml passes non-string types through unchanged", () => {
  assert.strictEqual(escapeHtml(98765), 98765);
  assert.strictEqual(escapeHtml(null), null);
});

// 2. Offline NLP Rules Engine Vibe Tests
runTest("Offline NLP engine responds in correct Vibe (Compassionate) for a slip", () => {
  const reply = runOfflineNLPCoaching("I had a slip and scrolled for 2 hours", "Compassionate", "Excessive Screen Time");
  assert.ok(reply.includes("It is completely okay"));
});

runTest("Offline NLP engine responds in correct Vibe (Direct) for a slip", () => {
  const reply = runOfflineNLPCoaching("I had a slip today", "Direct", "Vaping/Smoking");
  assert.ok(reply.includes("You slipped. Acknowledge it"));
});

runTest("Offline NLP engine responds in correct Vibe (Analytical) for a craving urge", () => {
  const reply = runOfflineNLPCoaching("I have a huge urge to check my phone", "Analytical", "Excessive Screen Time");
  assert.ok(reply.includes("Urges usually escalate and peak"));
});

// 3. CBT Diagnostic Calculator Tests
runTest("getCbtInsights accurately calculates slip rates and top vulnerability triggers", () => {
  const mockLogs = [
    { outcome: 'slip', trigger: 'Stress', timestamp: '2026-07-18T10:00' },
    { outcome: 'slip', trigger: 'Stress', timestamp: '2026-07-18T11:00' },
    { outcome: 'resist', trigger: 'Boredom', timestamp: '2026-07-18T12:00' },
    { outcome: 'slip', trigger: 'Boredom', timestamp: '2026-07-18T13:00' },
    { outcome: 'resist', trigger: 'Fatigue', timestamp: '2026-07-18T14:00' }
  ];

  const analysis = getCbtInsights(mockLogs);
  assert.strictEqual(analysis.total, 5);
  assert.strictEqual(analysis.slips, 3);
  assert.strictEqual(analysis.resists, 2);
  assert.strictEqual(analysis.slipRate, 60); // 3 out of 5 is 60%
  assert.strictEqual(analysis.topTrigger, 'Stress'); // Stress occurred twice as slip, Boredom once
});

// 4. Streak Calculation Tests
runTest("calculateStreak tracks consecutive days of resists and breaks on slips", () => {
  const today = new Date().toISOString().split('T')[0];
  
  const yesterdayObj = new Date();
  yesterdayObj.setDate(yesterdayObj.getDate() - 1);
  const yesterday = yesterdayObj.toISOString().split('T')[0];

  const dayBeforeObj = new Date();
  dayBeforeObj.setDate(dayBeforeObj.getDate() - 2);
  const dayBefore = dayBeforeObj.toISOString().split('T')[0];

  const mockLogs = [
    { outcome: 'resist', timestamp: `${today}T10:00:00` },
    { outcome: 'resist', timestamp: `${yesterday}T12:00:00` },
    { outcome: 'resist', timestamp: `${dayBefore}T09:00:00` }
  ];

  const streak = calculateStreak(mockLogs);
  assert.strictEqual(streak, 3); // Three days in a row of resist
});

runTest("calculateStreak returns 0 if there was a slip today", () => {
  const today = new Date().toISOString().split('T')[0];
  
  const yesterdayObj = new Date();
  yesterdayObj.setDate(yesterdayObj.getDate() - 1);
  const yesterday = yesterdayObj.toISOString().split('T')[0];

  const mockLogs = [
    { outcome: 'slip', timestamp: `${today}T15:00:00` },
    { outcome: 'resist', timestamp: `${yesterday}T12:00:00` }
  ];

  const streak = calculateStreak(mockLogs);
  assert.strictEqual(streak, 0); // Slip today breaks the streak
});

// --- Final Results ---
console.log("\n====================================");
console.log(`🏁 Test execution complete.`);
console.log(`   Passed: ${passedTests}`);
console.log(`   Failed: ${failedTests}`);
console.log("====================================\n");

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
