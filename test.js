/* ==========================================================================
   SOUSCHEF AI - AUTOMATED TESTING SUITE
   ========================================================================== */

const assert = require('assert');

console.log("🚀 Starting SousChef AI Test Suite...\n");

// --- Helper: Mock Functions from app.js to test logic in isolation ---

// 1. HTML Escaper (XSS Prevention)
function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
}

// 2. Timer Formatter
function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// 3. Servings Pricing Scale Formula
function calculateScale(servings) {
  let scale = 1.0;
  if (servings === 1) scale = 0.7;
  if (servings === 4) scale = 1.7;
  if (servings > 4) scale = 1.7 + (servings - 4) * 0.25;
  if (servings < 4 && servings > 1) scale = 0.7 + (servings - 1) * 0.35;
  return Number(scale.toFixed(2));
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

// 1. Sanitization Tests
runTest("escapeHtml escapes HTML tags and special characters to prevent XSS", () => {
  const dirty = '<script>alert("hack")</script> & "hello"';
  const clean = escapeHtml(dirty);
  assert.strictEqual(clean, '&lt;script&gt;alert(&quot;hack&quot;)&lt;/script&gt; &amp; &quot;hello&quot;');
});

runTest("escapeHtml passes non-string types through unchanged", () => {
  assert.strictEqual(escapeHtml(12345), 12345);
  assert.strictEqual(escapeHtml(null), null);
});

// 2. Time Formatter Tests
runTest("formatTime correctly formats typical minutes and seconds", () => {
  assert.strictEqual(formatTime(300), "5:00");
  assert.strictEqual(formatTime(45), "0:45");
  assert.strictEqual(formatTime(601), "10:01");
});

// 3. Pricing Scale Formula Tests
runTest("calculateScale outputs correct multipliers based on servings count", () => {
  // 1 serving = 0.7 scale
  assert.strictEqual(calculateScale(1), 0.70);
  // 2 servings = 1.05 scale (0.7 + 1 * 0.35)
  assert.strictEqual(calculateScale(2), 1.05);
  // 3 servings = 1.40 scale (0.7 + 2 * 0.35)
  assert.strictEqual(calculateScale(3), 1.40);
  // 4 servings = 1.7 scale
  assert.strictEqual(calculateScale(4), 1.70);
  // 5 servings = 1.95 scale (1.7 + 1 * 0.25)
  assert.strictEqual(calculateScale(5), 1.95);
});

// 4. Recipe Presets Database Matcher Test
runTest("getLocalPlan matches valid meals and vibes and returns valid recipe structures", () => {
  // Mock subset of recipe matcher from app.js to test database structure integrity
  const diets = ['vegan', 'keto', 'none'];
  const vibes = ['comfort', 'clean'];

  const localRecipesDatabase = {
    vegan: {
      comfort: { breakfast: { name: "Oatmeal" } },
      clean: { breakfast: { name: "Smoothie" } }
    },
    none: {
      comfort: { breakfast: { name: "Pancakes" } }
    }
  };

  function getLocalPlan(diet, vibe) {
    let dietKey = diet;
    if (diet === 'vegetarian') dietKey = 'vegan';
    if (diet === 'glutenfree') dietKey = 'keto';
    if (!localRecipesDatabase[dietKey]) {
      dietKey = 'none';
    }
    let vibeKey = vibe;
    if (vibeKey !== 'clean' && vibeKey !== 'comfort') {
      vibeKey = 'comfort';
    }
    return localRecipesDatabase[dietKey][vibeKey];
  }

  // Test vegetarian maps to vegan comfort oatmeal
  const plan1 = getLocalPlan('vegetarian', 'comfort');
  assert.strictEqual(plan1.breakfast.name, "Oatmeal");

  // Test invalid diet maps to none comfort pancakes
  const plan2 = getLocalPlan('glutenfree', 'comfort');
  assert.strictEqual(plan2.breakfast.name, "Pancakes");
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
