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

// 4. Mock Local Presets Database for Matcher Testing
const localRecipesDatabase = {
  vegan: {
    comfort: { 
      vibeSummary: "Cozy warm plants",
      breakfast: { 
        name: "Oatmeal", 
        description: "warm rolled oats", 
        prepTime: 10, 
        cookTime: 10, 
        protein: 10, 
        calories: 300, 
        ingredients: [
          { name: "Oats", amount: "1 cup", category: "Pantry", price: 1.00 }
        ],
        instructions: ["Cook oats."]
      } 
    }
  },
  none: {
    comfort: { 
      breakfast: { 
        name: "Pancakes",
        description: "fluffy pancakes",
        ingredients: [{ name: "Flour", price: 0.50 }] 
      } 
    }
  }
};

// 5. Recipe Matcher & local NLP Engine
function getLocalPlan(diet, vibe, scheduleText) {
  let dietKey = diet;
  if (diet === 'vegetarian') dietKey = 'vegan';
  if (diet === 'glutenfree') dietKey = 'keto';
  if (!localRecipesDatabase[dietKey]) {
    dietKey = 'none';
  }

  let vibeKey = vibe;
  if (vibe !== 'clean' && vibe !== 'comfort') {
    vibeKey = 'comfort';
  }

  // Deep clone database structure
  const preset = JSON.parse(JSON.stringify(localRecipesDatabase[dietKey][vibeKey]));
  
  // Local NLP schedule matching & customizations
  if (scheduleText) {
    const text = scheduleText.toLowerCase();
    
    // Gym/Protein boost
    if (text.includes('gym') || text.includes('workout') || text.includes('protein') || text.includes('exercise')) {
      preset.vibeSummary = `${preset.vibeSummary || ""} (Enhanced with High Protein)`.trim();
      ['breakfast', 'lunch', 'dinner'].forEach(m => {
        if (preset[m]) {
          preset[m].protein = Math.round(preset[m].protein * 1.3);
          preset[m].calories = Math.round(preset[m].calories * 1.15);
          preset[m].ingredients.unshift({ name: "High-Protein Powder/Egg/Tofu Supplement", amount: "1 serving", category: "Protein", price: 1.20 });
        }
      });
    }

    // Time saver
    if (text.includes('busy') || text.includes('work') || text.includes('quick')) {
      preset.vibeSummary = `${preset.vibeSummary || ""} (Optimized for quick preparation)`.trim();
      ['breakfast', 'lunch', 'dinner'].forEach(m => {
        if (preset[m]) {
          preset[m].prepTime = Math.max(2, Math.round(preset[m].prepTime * 0.5));
          preset[m].cookTime = Math.max(5, Math.round(preset[m].cookTime * 0.7));
          preset[m].instructions.unshift("Quickly gather ingredients.");
        }
      });
    }

    // Cozy weather
    if (text.includes('cold') || text.includes('cozy') || text.includes('rain')) {
      preset.vibeSummary = `${preset.vibeSummary || ""} (Crafted for warm, relaxing vibes)`.trim();
      ['breakfast', 'lunch', 'dinner'].forEach(m => {
        if (preset[m]) {
          preset[m].description = `Cozy: ${preset[m].description}`;
        }
      });
    }
  }

  return preset;
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
  assert.strictEqual(calculateScale(1), 0.70);
  assert.strictEqual(calculateScale(2), 1.05);
  assert.strictEqual(calculateScale(3), 1.40);
  assert.strictEqual(calculateScale(4), 1.70);
  assert.strictEqual(calculateScale(5), 1.95);
});

// 4. Recipe Presets Database Matcher Test
runTest("getLocalPlan matches valid meals and vibes and maps vegetarian correctly", () => {
  const plan = getLocalPlan('vegetarian', 'comfort');
  assert.strictEqual(plan.breakfast.name, "Oatmeal");
});

// 5. NLP Schedule Customization Tests
runTest("getLocalPlan personalizes recipes for 'gym' workouts with protein boost", () => {
  const plan = getLocalPlan('vegetarian', 'comfort', "Gym after 6 PM");
  
  // Vibe summary updated
  assert.ok(plan.vibeSummary.includes("High Protein"));
  // Protein increased by 30% (from 10 to 13)
  assert.strictEqual(plan.breakfast.protein, 13);
  // Protein supplement added to ingredients
  assert.strictEqual(plan.breakfast.ingredients[0].name, "High-Protein Powder/Egg/Tofu Supplement");
});

runTest("getLocalPlan personalizes recipes for 'busy' days with time saving prep", () => {
  const plan = getLocalPlan('vegetarian', 'comfort', "Busy work day");
  
  assert.ok(plan.vibeSummary.includes("quick preparation"));
  // Prep time reduced by 50% (from 10 to 5)
  assert.strictEqual(plan.breakfast.prepTime, 5);
  // Cook time reduced by 30% (from 10 to 7)
  assert.strictEqual(plan.breakfast.cookTime, 7);
  // Quick-prep instruction added
  assert.strictEqual(plan.breakfast.instructions[0], "Quickly gather ingredients.");
});

runTest("getLocalPlan personalizes recipes for 'cozy' weather with customized description", () => {
  const plan = getLocalPlan('vegetarian', 'comfort', "Cold rainy night");
  
  assert.ok(plan.vibeSummary.includes("relaxing vibes"));
  // Description prepended with cozy prefix
  assert.strictEqual(plan.breakfast.description, "Cozy: warm rolled oats");
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
