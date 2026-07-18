/* ==========================================================================
   A-ONE HABITWINGS — AUTOMATED TESTING SUITE
   ========================================================================== */

const assert = require('assert');

console.log("🦋 Starting A-ONE Habitwings Test Suite...\n");

// ─── Mock Functions from app logic ───

// 1. HTML Escaper (XSS Prevention) — mirrors app's escapeHtml
function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
}

// 2. Offline NLP Fallback Engine — mirrors route.js offlineFallback
function offlineFallback(userMessage, profile) {
  const msg = userMessage.toLowerCase();
  const interests = (profile?.interests || []).join(', ') || 'general activities';

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

// 3. Streak Calculator — mirrors page.js streak logic
function calculateStreak(logs) {
  if (!logs || logs.length === 0) return 0;
  let s = 0;
  const slipDays = new Set(logs.filter(l => l.outcome === 'slip').map(l => l.timestamp.split('T')[0]));
  const resistDays = new Set(logs.filter(l => l.outcome !== 'slip').map(l => l.timestamp.split('T')[0]));
  let d = new Date();
  for (let i = 0; i < 365; i++) {
    const ds = d.toISOString().split('T')[0];
    if (slipDays.has(ds)) break;
    if (resistDays.has(ds)) { s++; d.setDate(d.getDate() - 1); }
    else if (s === 0 && i < 2) { d.setDate(d.getDate() - 1); continue; }
    else break;
  }
  return s;
}

// 4. Stats Calculator — mirrors page.js stats
function calculateStats(logs) {
  const total = logs.length;
  if (total === 0) return { total: 0, swaps: 0, resists: 0, slips: 0, successRate: 100 };
  const swaps = logs.filter(l => l.outcome === 'swap').length;
  const resists = logs.filter(l => l.outcome === 'resist').length;
  const slips = logs.filter(l => l.outcome === 'slip').length;
  const successRate = Math.round(((swaps + resists) / total) * 100);
  return { total, swaps, resists, slips, successRate };
}

// 5. API Request Validator — validates coach endpoint request body
function validateCoachRequest(body) {
  const errors = [];
  if (!body.message || typeof body.message !== 'string') errors.push('Message is required and must be a string');
  if (body.mode && !['general', 'sos', 'mission', 'insights'].includes(body.mode)) errors.push('Invalid mode');
  return { valid: errors.length === 0, errors };
}

// ─── Test Framework ───
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

// ═══════════════════════════════════════════
// TEST SUITE 1: Security — HTML Sanitization
// ═══════════════════════════════════════════
console.log("\n─── Security Tests ───");

runTest("escapeHtml prevents XSS injection by escaping all dangerous characters", () => {
  const dirty = '<script>alert("xss")</script> & "test" \'quoted\'';
  const clean = escapeHtml(dirty);
  assert.ok(!clean.includes('<script>'), 'Script tags should be escaped');
  assert.ok(clean.includes('&lt;script&gt;'), 'Should contain escaped tags');
  assert.ok(clean.includes('&amp;'), 'Ampersand should be escaped');
  assert.ok(clean.includes('&quot;'), 'Quotes should be escaped');
  assert.ok(clean.includes('&#039;'), 'Single quotes should be escaped');
});

runTest("escapeHtml passes non-string types through unchanged (type safety)", () => {
  assert.strictEqual(escapeHtml(12345), 12345);
  assert.strictEqual(escapeHtml(null), null);
  assert.strictEqual(escapeHtml(undefined), undefined);
  assert.strictEqual(escapeHtml(true), true);
});

runTest("escapeHtml handles empty string without error", () => {
  assert.strictEqual(escapeHtml(''), '');
});

// ═══════════════════════════════════════════
// TEST SUITE 2: Offline AI — NLP Matching
// ═══════════════════════════════════════════
console.log("\n─── Offline AI Engine Tests ───");

const mockProfile = { interests: ['Brainstorming Ideas', 'Film Trivia'], habit: 'Screen Time', triggers: ['Boredom'] };

runTest("Offline engine detects urge/craving keywords and responds with redirect", () => {
  const reply = offlineFallback("I have a strong urge to scroll my phone", mockProfile);
  assert.ok(reply.includes('urge is real'), 'Should acknowledge the urge');
  assert.ok(reply.includes('10 minutes'), 'Should mention urge duration');
  assert.ok(reply.includes('Brainstorming Ideas'), 'Should reference user interests');
});

runTest("Offline engine detects slip/relapse keywords with compassionate response", () => {
  const reply = offlineFallback("I slipped and scrolled for 2 hours", mockProfile);
  assert.ok(reply.includes('data, not defeat'), 'Should reframe the slip compassionately');
  assert.ok(reply.includes('self-compassion'), 'Should reference self-compassion research');
});

runTest("Offline engine detects HALT states (hungry, lonely, tired, stressed)", () => {
  const replies = [
    offlineFallback("I'm so bored right now", mockProfile),
    offlineFallback("feeling stressed about work", mockProfile),
    offlineFallback("I'm lonely and just want distraction", mockProfile),
  ];
  replies.forEach(r => {
    assert.ok(r.includes('HALT'), 'Should trigger HALT check advice');
  });
});

runTest("Offline engine celebrates success with neuroscience backing", () => {
  const reply = offlineFallback("I'm proud I resisted today!", mockProfile);
  assert.ok(reply.includes('prefrontal cortex'), 'Should reference brain science');
  assert.ok(reply.includes('rewiring'), 'Should mention neural rewiring');
});

runTest("Offline engine returns generic guidance for unrecognized inputs", () => {
  const reply = offlineFallback("hey what's up", mockProfile);
  assert.ok(reply.includes('urges are waves'), 'Should include urge surfing concept');
});

// ═══════════════════════════════════════════
// TEST SUITE 3: Statistics & Streak Tracking
// ═══════════════════════════════════════════
console.log("\n─── Statistics & Tracking Tests ───");

runTest("calculateStats accurately computes swap/resist/slip counts and success rate", () => {
  const logs = [
    { outcome: 'swap', timestamp: '2026-07-18T10:00:00' },
    { outcome: 'resist', timestamp: '2026-07-18T11:00:00' },
    { outcome: 'slip', timestamp: '2026-07-18T12:00:00' },
    { outcome: 'swap', timestamp: '2026-07-18T13:00:00' },
    { outcome: 'swap', timestamp: '2026-07-18T14:00:00' },
  ];
  const stats = calculateStats(logs);
  assert.strictEqual(stats.total, 5);
  assert.strictEqual(stats.swaps, 3);
  assert.strictEqual(stats.resists, 1);
  assert.strictEqual(stats.slips, 1);
  assert.strictEqual(stats.successRate, 80); // (3+1)/5 = 80%
});

runTest("calculateStats returns 100% success rate for empty logs (no failures)", () => {
  const stats = calculateStats([]);
  assert.strictEqual(stats.successRate, 100);
  assert.strictEqual(stats.total, 0);
});

runTest("calculateStreak tracks consecutive clean days correctly", () => {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const dayBefore = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0];

  const logs = [
    { outcome: 'swap', timestamp: `${today}T10:00:00` },
    { outcome: 'resist', timestamp: `${yesterday}T12:00:00` },
    { outcome: 'swap', timestamp: `${dayBefore}T09:00:00` },
  ];
  assert.strictEqual(calculateStreak(logs), 3);
});

runTest("calculateStreak breaks on slip day and returns 0", () => {
  const today = new Date().toISOString().split('T')[0];
  const logs = [
    { outcome: 'slip', timestamp: `${today}T15:00:00` },
    { outcome: 'resist', timestamp: `${new Date(Date.now() - 86400000).toISOString().split('T')[0]}T12:00:00` },
  ];
  assert.strictEqual(calculateStreak(logs), 0);
});

// ═══════════════════════════════════════════
// TEST SUITE 4: API Request Validation
// ═══════════════════════════════════════════
console.log("\n─── API Validation Tests ───");

runTest("validateCoachRequest rejects missing message", () => {
  const result = validateCoachRequest({ mode: 'general' });
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors[0].includes('Message'));
});

runTest("validateCoachRequest rejects invalid mode", () => {
  const result = validateCoachRequest({ message: 'hello', mode: 'invalid_mode' });
  assert.strictEqual(result.valid, false);
});

runTest("validateCoachRequest accepts valid request", () => {
  const result = validateCoachRequest({ message: 'I need help', mode: 'sos' });
  assert.strictEqual(result.valid, true);
});

// ═══ RESULTS ═══
console.log("\n====================================");
console.log(`🏁 Test execution complete.`);
console.log(`   Passed: ${passedTests}`);
console.log(`   Failed: ${failedTests}`);
console.log("====================================\n");

if (failedTests > 0) process.exit(1);
else process.exit(0);
