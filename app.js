/* ==========================================================================
   SOUSCHEF AI - APPLICATION LOGIC & ENGINE
   ========================================================================== */

// --- Global Application State ---
const state = {
  theme: 'dark',
  currentStep: 1,
  totalSteps: 3,
  
  // User Inputs
  preferences: {
    schedule: '',
    timeLimit: 60,
    energy: 'medium',
    vibes: [],
    diet: 'none',
    servings: 2,
    budget: 25
  },

  // Active Plan Data (generated or fetched)
  plan: null,

  // User Swaps state: { originalIngredientName: alternativeIngredientName }
  activeSwaps: {},
  
  // Checklist states
  groceryChecked: {},
  timelineChecked: {}
};

// --- Theme Toggle ---
const themeToggleBtn = document.getElementById('theme-toggle');
themeToggleBtn.addEventListener('click', () => {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  document.body.setAttribute('data-theme', state.theme);
  
  const sunIcon = themeToggleBtn.querySelector('.sun-icon');
  const moonIcon = themeToggleBtn.querySelector('.moon-icon');
  
  if (state.theme === 'dark') {
    sunIcon.classList.remove('hidden');
    moonIcon.classList.add('hidden');
  } else {
    sunIcon.classList.add('hidden');
    moonIcon.classList.remove('hidden');
  }
});

// --- Toast System ---
function showToast(message, duration = 4000) {
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toast-message');
  toastMessage.textContent = message;
  toast.classList.remove('hidden');
  
  setTimeout(() => {
    toast.classList.add('hidden');
  }, duration);
}

// --- Textarea Suggestions ---
document.querySelectorAll('.suggestion-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const text = chip.textContent;
    document.getElementById('schedule-input').value = text;
  });
});

// --- Range Slider Badge Update ---
const timeLimitInput = document.getElementById('time-limit');
const timeLimitVal = document.getElementById('time-limit-val');
timeLimitInput.addEventListener('input', (e) => {
  timeLimitVal.textContent = `${e.target.value} mins`;
});

// --- Dynamic Budget Tier Update ---
const budgetInput = document.getElementById('budget-input');
const budgetTier = document.getElementById('budget-tier');
budgetInput.addEventListener('input', (e) => {
  const val = parseFloat(e.target.value) || 0;
  if (val <= 15) {
    budgetTier.textContent = "Budget Saver";
    budgetTier.style.background = "var(--success-light)";
    budgetTier.style.color = "var(--success)";
    budgetTier.style.borderColor = "rgba(16, 185, 129, 0.3)";
  } else if (val <= 40) {
    budgetTier.textContent = "Moderate";
    budgetTier.style.background = "var(--accent-gold-light)";
    budgetTier.style.color = "var(--accent-gold)";
    budgetTier.style.borderColor = "rgba(245, 158, 11, 0.3)";
  } else {
    budgetTier.textContent = "Gourmet / Premium";
    budgetTier.style.background = "var(--primary-light)";
    budgetTier.style.color = "var(--primary)";
    budgetTier.style.borderColor = "rgba(255, 107, 74, 0.3)";
  }
});

// --- Wizard Stepper UI Logic ---
document.querySelectorAll('.next-step').forEach(btn => {
  btn.addEventListener('click', () => {
    if (state.currentStep === 1) {
      const scheduleInput = document.getElementById('schedule-input');
      if (!scheduleInput.value.trim()) {
        scheduleInput.reportValidity();
        return;
      }
    }
    changeStep(state.currentStep + 1);
  });
});

document.querySelectorAll('.prev-step').forEach(btn => {
  btn.addEventListener('click', () => {
    changeStep(state.currentStep - 1);
  });
});

function changeStep(newStep) {
  if (newStep < 1 || newStep > state.totalSteps) return;
  
  // Hide current step, show new step
  document.querySelector(`.wizard-step[data-step="${state.currentStep}"]`).classList.remove('active');
  document.querySelector(`.wizard-step[data-step="${newStep}"]`).classList.add('active');
  
  // Update step indicators
  document.querySelectorAll('.step-dot').forEach((dot, index) => {
    const stepNum = index + 1;
    dot.classList.remove('active', 'completed');
    if (stepNum === newStep) {
      dot.classList.add('active');
    } else if (stepNum < newStep) {
      dot.classList.add('completed');
    }
  });

  state.currentStep = newStep;
  
  // Update progress bar
  const progressPercent = (newStep / state.totalSteps) * 100;
  document.getElementById('wizard-progress').style.width = `${progressPercent}%`;

  // Gemini API Toggle Visibility
  const isGemini = document.getElementById('engine-gemini').checked;
  const geminiConfig = document.getElementById('gemini-config');
  if (isGemini && newStep === 3) {
    geminiConfig.classList.remove('hidden');
  } else {
    geminiConfig.classList.add('hidden');
  }
}

// Watch engine radio buttons to show/hide Gemini config
document.querySelectorAll('input[name="engine"]').forEach(radio => {
  radio.addEventListener('change', () => {
    const geminiConfig = document.getElementById('gemini-config');
    if (radio.id === 'engine-gemini') {
      geminiConfig.classList.remove('hidden');
    } else {
      geminiConfig.classList.add('hidden');
    }
  });
});

// Toggle password visibility
const toggleKeyBtn = document.getElementById('toggle-key-visibility');
toggleKeyBtn.addEventListener('click', () => {
  const apiKeyInput = document.getElementById('api-key-input');
  const eyeIcon = toggleKeyBtn.querySelector('i');
  if (apiKeyInput.type === 'password') {
    apiKeyInput.type = 'text';
    eyeIcon.setAttribute('data-lucide', 'eye-off');
  } else {
    apiKeyInput.type = 'password';
    eyeIcon.setAttribute('data-lucide', 'eye');
  }
  lucide.createIcons();
});

// Attempt to load API key from localStorage
window.addEventListener('load', () => {
  const savedKey = localStorage.getItem('gemini_api_key');
  if (savedKey) {
    document.getElementById('api-key-input').value = savedKey;
  }
  lucide.createIcons();
});

// --- Dynamic Mock Recipes Database ---
// This dataset represents premium quality culinary configurations.
// We map these to user choices (Diet & Vibe) to make the Simulated Engine incredibly detailed.
const localRecipesDatabase = {
  vegan: {
    comfort: {
      vibeSummary: "Warm, satisfying plant-based comfort dishes",
      breakfast: {
        name: "Maple Pecan Coconut Oatmeal",
        description: "Hearty rolled oats simmered in coconut milk, topped with toasted maple pecans and banana.",
        prepTime: 5, cookTime: 10, difficulty: "Easy", calories: 420, protein: 8, carbs: 54, fat: 18,
        ingredients: [
          { name: "Rolled Oats", amount: "1 cup", category: "Pantry", price: 0.80 },
          { name: "Coconut Milk", amount: "1.5 cups", category: "Dairy/Alternatives", price: 1.50, substitutes: [{ name: "Almond Milk", diff: -0.50 }, { name: "Oat Milk", diff: -0.20 }] },
          { name: "Pecan Halves", amount: "1/4 cup", category: "Pantry", price: 2.20, substitutes: [{ name: "Sunflower Seeds", diff: -1.40, label: "Budget Saver swap" }] },
          { name: "Maple Syrup", amount: "2 tbsp", category: "Pantry", price: 1.10 },
          { name: "Banana", amount: "1 medium", category: "Produce", price: 0.35 }
        ],
        instructions: [
          "In a small saucepan, bring the coconut milk to a gentle boil.",
          "Stir in the rolled oats, reducing heat to low, and cook for 8 minutes until creamy.",
          "Meanwhile, toast pecans in a dry skillet for 2-3 minutes until fragrant.",
          "Slice the banana and arrange over the oatmeal alongside the toasted pecans.",
          "Drizzle warm maple syrup on top and serve."
        ]
      },
      lunch: {
        name: "Crispy Chickpea & Avocado Wrap",
        description: "Spiced pan-roasted chickpeas rolled in whole wheat wraps with fresh avocado smash.",
        prepTime: 10, cookTime: 10, difficulty: "Easy", calories: 510, protein: 12, carbs: 62, fat: 22,
        ingredients: [
          { name: "Canned Chickpeas", amount: "1 can", category: "Pantry", price: 1.20 },
          { name: "Avocado", amount: "1 large", category: "Produce", price: 2.00 },
          { name: "Whole Wheat Wraps", amount: "2 wraps", category: "Pantry", price: 1.50 },
          { name: "Cherry Tomatoes", amount: "1/2 cup", category: "Produce", price: 1.30 },
          { name: "Spicy Tahini Dressing", amount: "3 tbsp", category: "Pantry", price: 1.20 }
        ],
        instructions: [
          "Drain, rinse, and thoroughly dry the canned chickpeas.",
          "Toss chickpeas in cumin, garlic powder, and salt. Cook in a skillet with olive oil for 8 minutes.",
          "In a bowl, mash the avocado with lime juice, salt, and pepper.",
          "Warm the whole wheat wraps in a dry pan for 30 seconds.",
          "Spread mashed avocado on wraps, top with roasted chickpeas, halved tomatoes, and a drizzle of spicy tahini."
        ]
      },
      dinner: {
        name: "Creamy Coconut Squash & Lentil Curry",
        description: "Rich, fragrant curry simmered with red lentils, butternut squash, and fresh spinach.",
        prepTime: 15, cookTime: 25, difficulty: "Medium", calories: 580, protein: 18, carbs: 75, fat: 20,
        ingredients: [
          { name: "Butternut Squash", amount: "2 cups cubed", category: "Produce", price: 2.50 },
          { name: "Red Lentils", amount: "3/4 cup", category: "Pantry", price: 0.90 },
          { name: "Coconut Milk (Canned)", amount: "1 can", category: "Pantry", price: 1.80 },
          { name: "Spinach", amount: "2 cups", category: "Produce", price: 1.50 },
          { name: "Basmati Rice", amount: "1 cup", category: "Pantry", price: 0.70 }
        ],
        instructions: [
          "Rinse basmati rice and cook in a pot with 2 cups of water and salt.",
          "In a deep pot, sauté onions and garlic in olive oil, then add curry paste.",
          "Add cubed butternut squash, red lentils, canned coconut milk, and 1 cup of vegetable broth.",
          "Bring to a boil, then cover and simmer on low for 20 minutes until squash is tender.",
          "Stir in fresh spinach until wilted, adjust seasoning, and ladle over warm basmati rice."
        ]
      }
    },
    clean: {
      vibeSummary: "Vibrant, antioxidant-packed raw and steamed plant-based foods",
      breakfast: {
        name: "Superfood Berry Green Smoothie Bowl",
        description: "Antioxidant-rich spinach and berry puree topped with chia seeds, coconut flakes, and hemp seeds.",
        prepTime: 8, cookTime: 0, difficulty: "Easy", calories: 340, protein: 10, carbs: 42, fat: 12,
        ingredients: [
          { name: "Frozen Mixed Berries", amount: "1 cup", category: "Pantry", price: 1.90 },
          { name: "Baby Spinach", amount: "2 cups", category: "Produce", price: 1.20 },
          { name: "Almond Milk", amount: "1 cup", category: "Dairy/Alternatives", price: 1.00 },
          { name: "Chia Seeds", amount: "1.5 tbsp", category: "Pantry", price: 0.80 },
          { name: "Hemp Hearts", amount: "1 tbsp", category: "Pantry", price: 1.40 }
        ],
        instructions: [
          "In a high-speed blender, combine the frozen mixed berries, baby spinach, and almond milk.",
          "Blend on high until completely smooth and thick, adding a splash of water if needed.",
          "Pour the green smoothie base into a chilled bowl.",
          "Decorate the top with chia seeds, hemp hearts, and additional fresh berries.",
          "Eat immediately with a spoon."
        ]
      },
      lunch: {
        name: "Mediterranean Quinoa Salad",
        description: "Fluffy quinoa tossed with cucumbers, olives, parsley, and a tangy lemon vinaigrette.",
        prepTime: 12, cookTime: 12, difficulty: "Easy", calories: 450, protein: 11, carbs: 58, fat: 16,
        ingredients: [
          { name: "Quinoa", amount: "3/4 cup", category: "Pantry", price: 1.10 },
          { name: "English Cucumber", amount: "1/2", category: "Produce", price: 0.90 },
          { name: "Kalamata Olives", amount: "1/4 cup", category: "Pantry", price: 2.10 },
          { name: "Fresh Parsley", amount: "1/2 cup", category: "Produce", price: 1.00 },
          { name: "Lemon Vinaigrette", amount: "3 tbsp", category: "Pantry", price: 0.80 }
        ],
        instructions: [
          "Rinse quinoa and boil in 1.5 cups of salted water for 12 minutes, then let steam covered for 5 minutes.",
          "Dice cucumber, slice Kalamata olives, and finely chop fresh parsley.",
          "Fluff the quinoa with a fork and let cool slightly.",
          "In a large bowl, combine quinoa, cucumbers, olives, and parsley.",
          "Toss with lemon vinaigrette and serve cold."
        ]
      },
      dinner: {
        name: "Sesame Ginger Baked Tofu Buddha Bowl",
        description: "Perfectly seasoned sesame tofu cubes baked crispy, served with broccoli, carrots, and brown rice.",
        prepTime: 15, cookTime: 25, difficulty: "Medium", calories: 510, protein: 22, carbs: 65, fat: 15,
        ingredients: [
          { name: "Firm Tofu", amount: "14 oz block", category: "Protein", price: 2.30 },
          { name: "Broccoli Florets", amount: "2 cups", category: "Produce", price: 1.80 },
          { name: "Brown Rice", amount: "1 cup", category: "Pantry", price: 0.80 },
          { name: "Carrots (Shredded)", amount: "1/2 cup", category: "Produce", price: 0.70 },
          { name: "Sesame Ginger Glaze", amount: "4 tbsp", category: "Pantry", price: 1.50 }
        ],
        instructions: [
          "Preheat oven to 400°F (200°C). Press the tofu to remove excess moisture and cut into cubes.",
          "Toss tofu in 2 tablespoons of sesame ginger glaze and place on a baking sheet.",
          "Roast tofu for 25 minutes, flipping halfway, until crispy and golden.",
          "Steam broccoli florets in a basket over boiling water for 5 minutes until vibrant green.",
          "Assemble the bowl with a base of cooked brown rice, baked tofu, steamed broccoli, raw shredded carrots, and drizzle with remaining glaze."
        ]
      }
    }
  },
  keto: {
    comfort: {
      vibeSummary: "High-protein, healthy fat comforting low-carb recipes",
      breakfast: {
        name: "Avocado, Bacon & Cheddar Bake",
        description: "Warm avocados stuffed with smoked bacon bits and melted sharp cheddar cheese.",
        prepTime: 5, cookTime: 12, difficulty: "Easy", calories: 490, protein: 16, carbs: 6, fat: 42,
        ingredients: [
          { name: "Avocado", amount: "2 large", category: "Produce", price: 4.00 },
          { name: "Bacon Strips", amount: "4 strips", category: "Protein", price: 2.80, substitutes: [{ name: "Turkey Bacon", diff: -0.80 }] },
          { name: "Sharp Cheddar", amount: "1/2 cup shredded", category: "Dairy/Alternatives", price: 1.80 },
          { name: "Fresh Chives", amount: "2 tbsp", category: "Produce", price: 1.00 }
        ],
        instructions: [
          "Preheat oven to 375°F (190°C). Slice avocados in half and remove pits.",
          "Scoop out about 1 tablespoon of avocado flesh from each center to make room.",
          "Cook bacon in a skillet until extra crispy, drain grease, and crumble.",
          "Place avocado halves on a baking sheet. Stuff with bacon and shredded cheddar.",
          "Bake for 10-12 minutes until cheese is bubbly. Garnish with chopped chives."
        ]
      },
      lunch: {
        name: "Buffalo Chicken Salad Lettuce Boats",
        description: "Creamy buffalo chicken salad loaded into crunchy, refreshing butter lettuce leaves.",
        prepTime: 10, cookTime: 5, difficulty: "Easy", calories: 460, protein: 32, carbs: 4, fat: 34,
        ingredients: [
          { name: "Canned Chicken Breast", amount: "10 oz", category: "Protein", price: 3.50, substitutes: [{ name: "Canned Tuna", diff: -1.50, label: "Budget Saver swap" }] },
          { name: "Mayonnaise", amount: "4 tbsp", category: "Pantry", price: 0.60 },
          { name: "Buffalo Hot Sauce", amount: "2 tbsp", category: "Pantry", price: 0.80 },
          { name: "Butter Lettuce", amount: "1 head", category: "Produce", price: 2.20 },
          { name: "Celery", amount: "2 stalks", category: "Produce", price: 0.90 }
        ],
        instructions: [
          "In a bowl, mix shredded canned chicken, mayonnaise, buffalo hot sauce, and finely diced celery.",
          "Separate butter lettuce leaves and wash/dry them thoroughly.",
          "Ladle chicken salad mixture evenly into lettuce leaves.",
          "Top with an extra splash of hot sauce if desired and enjoy like wraps."
        ]
      },
      dinner: {
        name: "Garlic Butter Ribeye & Zoodles",
        description: "Pan-seared ribeye steak basted in garlic butter, served with fresh zucchini noodles.",
        prepTime: 10, cookTime: 15, difficulty: "Medium", calories: 750, protein: 48, carbs: 8, fat: 58,
        ingredients: [
          { name: "Ribeye Steak", amount: "12 oz", category: "Protein", price: 12.00, substitutes: [{ name: "Chicken Breast", diff: -7.00, label: "Budget Saver swap" }, { name: "Pork Chops", diff: -5.00 }] },
          { name: "Zucchini Noodles", amount: "2 packs", category: "Produce", price: 3.50 },
          { name: "Salted Butter", amount: "3 tbsp", category: "Dairy/Alternatives", price: 1.00 },
          { name: "Garlic Cloves", amount: "4 minced", category: "Produce", price: 0.50 }
        ],
        instructions: [
          "Bring ribeye steak to room temperature, pat dry with paper towels, and season generously with salt and pepper.",
          "Heat a heavy cast-iron skillet on high heat until smoking.",
          "Sear steak for 3-4 minutes per side. In the last 2 minutes, add butter, crushed garlic, and baste steak.",
          "Remove steak, cover in foil, and let rest for 5 minutes.",
          "Add zucchini noodles directly into the same pan with garlic butter drippings, tossing for 2 minutes until tender."
        ]
      }
    },
    clean: {
      vibeSummary: "Light, low-carb whole food keto options",
      breakfast: {
        name: "Spinach, Goat Cheese & Mushroom Scramble",
        description: "Fluffy scrambled eggs folded with sautéed mushrooms, organic spinach, and tangy goat cheese.",
        prepTime: 5, cookTime: 8, difficulty: "Easy", calories: 360, protein: 22, carbs: 4, fat: 28,
        ingredients: [
          { name: "Fresh Eggs", amount: "4 large", category: "Protein", price: 1.20 },
          { name: "Cremini Mushrooms", amount: "1 cup sliced", category: "Produce", price: 1.80 },
          { name: "Baby Spinach", amount: "2 cups", category: "Produce", price: 1.20 },
          { name: "Goat Cheese", amount: "2 oz", category: "Dairy/Alternatives", price: 2.50 }
        ],
        instructions: [
          "Whisk eggs with salt and pepper in a bowl until airy.",
          "Sauté sliced mushrooms in olive oil in a skillet for 4 minutes until browned.",
          "Add baby spinach and cook for 1 minute until wilted.",
          "Pour in the eggs, stirring gently on medium-low heat until soft curds form.",
          "Crumble goat cheese over the warm eggs, let melt slightly, and serve."
        ]
      },
      lunch: {
        name: "Cucumber Smoked Salmon Boats",
        description: "Fresh hollowed cucumbers filled with cold-smoked salmon and chive cream cheese spread.",
        prepTime: 10, cookTime: 0, difficulty: "Easy", calories: 390, protein: 24, carbs: 5, fat: 30,
        ingredients: [
          { name: "Smoked Salmon", amount: "4 oz", category: "Protein", price: 6.50 },
          { name: "English Cucumber", amount: "1 large", category: "Produce", price: 1.50 },
          { name: "Cream Cheese", amount: "4 oz", category: "Dairy/Alternatives", price: 1.80 },
          { name: "Fresh Dill", amount: "1 sprig", category: "Produce", price: 1.00 }
        ],
        instructions: [
          "Cut cucumber in half lengthwise and scrape out seeds with a spoon.",
          "In a small bowl, whip cream cheese with finely chopped dill and a pinch of black pepper.",
          "Spread the cream cheese mixture into the cucumber cavities.",
          "Arrange smoked salmon strips over the cream cheese.",
          "Cut into slices and serve chilled."
        ]
      },
      dinner: {
        name: "Herb Butter Grilled Salmon & Asparagus",
        description: "Rich, flaky salmon fillets seared with garlic herb butter and tender asparagus spears.",
        prepTime: 10, cookTime: 12, difficulty: "Easy", calories: 590, protein: 42, carbs: 6, fat: 44,
        ingredients: [
          { name: "Salmon Fillets", amount: "12 oz", category: "Protein", price: 9.50 },
          { name: "Asparagus", amount: "1 bunch", category: "Produce", price: 3.00 },
          { name: "Salted Butter", amount: "2 tbsp", category: "Dairy/Alternatives", price: 0.80 },
          { name: "Lemon", amount: "1", category: "Produce", price: 0.60 }
        ],
        instructions: [
          "Preheat a grill pan or skillet over medium-high heat.",
          "Brush salmon and trimmed asparagus with olive oil, salt, and pepper.",
          "Cook salmon skin-side down first for 5 minutes, then flip and cook 4 minutes longer.",
          "Grill asparagus alongside the salmon for 6-8 minutes, turning occasionally.",
          "Top hot salmon with herb butter, squeeze fresh lemon juice over asparagus, and serve."
        ]
      }
    }
  },
  none: {
    comfort: {
      vibeSummary: "Satisfying home-style classics with full ingredients",
      breakfast: {
        name: "Fluffy Buttermilk Pancakes",
        description: "Classic golden buttermilk pancakes served with maple syrup and breakfast sausage.",
        prepTime: 10, cookTime: 10, difficulty: "Medium", calories: 550, protein: 15, carbs: 68, fat: 22,
        ingredients: [
          { name: "Pancake Mix", amount: "1.5 cups", category: "Pantry", price: 1.20 },
          { name: "Whole Milk", amount: "1 cup", category: "Dairy/Alternatives", price: 0.80 },
          { name: "Breakfast Sausage", amount: "4 links", category: "Protein", price: 2.50 },
          { name: "Maple Syrup", amount: "4 tbsp", category: "Pantry", price: 1.20 },
          { name: "Eggs", amount: "1 large", category: "Protein", price: 0.30 }
        ],
        instructions: [
          "Cook breakfast sausage links in a skillet on medium heat for 8-10 minutes, rolling occasionally.",
          "In a bowl, whisk pancake mix, milk, and egg until just combined (leave small lumps).",
          "Heat a buttered griddle, pour batter, and flip when bubbles appear (about 2 minutes per side).",
          "Stack hot pancakes, top with butter, and drizzle with maple syrup alongside the cooked sausages."
        ]
      },
      lunch: {
        name: "Gourmet Grilled Cheese & Tomato Soup",
        description: "Melted cheddar and Swiss cheese on sourdough, paired with warm tomato basil soup.",
        prepTime: 5, cookTime: 10, difficulty: "Easy", calories: 620, protein: 20, carbs: 55, fat: 34,
        ingredients: [
          { name: "Sourdough Bread", amount: "4 slices", category: "Pantry", price: 2.00 },
          { name: "Cheddar & Swiss Cheese", amount: "4 slices", category: "Dairy/Alternatives", price: 2.20 },
          { name: "Tomato Basil Soup", amount: "1 can", category: "Pantry", price: 1.80 },
          { name: "Butter", amount: "2 tbsp", category: "Dairy/Alternatives", price: 0.60 }
        ],
        instructions: [
          "Heat tomato basil soup in a small saucepan over medium heat, stirring occasionally.",
          "Butter one side of each sourdough bread slice.",
          "Place cheese slices between bread, buttered sides facing outwards.",
          "Grill sandwiches in a pan over medium heat for 4 minutes per side until golden brown and cheese melts.",
          "Slice diagonally and serve immediately alongside the warm soup."
        ]
      },
      dinner: {
        name: "Creamy Tuscan Garlic Chicken Pasta",
        description: "Tender pan-seared chicken breast tossed in a garlic, spinach, and sun-dried tomato cream sauce over penne.",
        prepTime: 15, cookTime: 20, difficulty: "Medium", calories: 790, protein: 44, carbs: 80, fat: 32,
        ingredients: [
          { name: "Chicken Breast", amount: "12 oz", category: "Protein", price: 4.50, substitutes: [{ name: "Tofu Block", diff: -2.20, label: "Vegetarian/Budget swap" }] },
          { name: "Penne Pasta", amount: "8 oz", category: "Pantry", price: 1.00 },
          { name: "Heavy Cream", amount: "1/2 cup", category: "Dairy/Alternatives", price: 1.60, substitutes: [{ name: "Coconut Milk", diff: 0.20 }] },
          { name: "Sun-Dried Tomatoes", amount: "1/3 cup", category: "Pantry", price: 2.80 },
          { name: "Spinach", amount: "2 cups", category: "Produce", price: 1.20 }
        ],
        instructions: [
          "Boil penne pasta in salted water for 10-11 minutes, drain and set aside.",
          "Season chicken breasts with salt, pepper, oregano. Sear in olive oil in a skillet for 6 minutes per side.",
          "Remove chicken, let rest, then slice.",
          "In the same skillet, sauté garlic, sun-dried tomatoes, and spinach. Pour in heavy cream and bring to simmer.",
          "Add cooked pasta and sliced chicken back into the skillet, tossing until cream sauce thickens."
        ]
      }
    },
    clean: {
      vibeSummary: "Light, protein-forward and organic meals",
      breakfast: {
        name: "Egg White Omelet with Avocado toast",
        description: "Fluffy egg whites folded with baby spinach, served with fresh avocado on sprouted grain toast.",
        prepTime: 10, cookTime: 6, difficulty: "Easy", calories: 380, protein: 26, carbs: 32, fat: 16,
        ingredients: [
          { name: "Egg Whites", amount: "1 cup", category: "Protein", price: 2.20 },
          { name: "Sprouted Grain Bread", amount: "2 slices", category: "Pantry", price: 1.50 },
          { name: "Avocado", amount: "1/2", category: "Produce", price: 1.00 },
          { name: "Baby Spinach", amount: "1 cup", category: "Produce", price: 0.80 }
        ],
        instructions: [
          "Toast sprouted grain bread slices to desired crispness.",
          "Sauté spinach in a non-stick skillet for 1 minute until wilted.",
          "Pour egg whites into skillet over the spinach, cook on medium-low, flipping once until set.",
          "Mash avocado with salt, pepper, lemon juice, and spread over the toast.",
          "Serve the egg white omelet alongside the fresh avocado toast."
        ]
      },
      lunch: {
        name: "Sesame Ginger Chicken Salad",
        description: "Shredded chicken breast tossed with shredded cabbage, carrots, sliced almonds, and ginger vinaigrette.",
        prepTime: 12, cookTime: 0, difficulty: "Easy", calories: 430, protein: 35, carbs: 18, fat: 18,
        ingredients: [
          { name: "Pre-cooked Chicken Breast", amount: "8 oz shredded", category: "Protein", price: 3.50 },
          { name: "Shredded Cabbage Mix", amount: "3 cups", category: "Produce", price: 1.80 },
          { name: "Sliced Almonds", amount: "1/4 cup", category: "Pantry", price: 2.00, substitutes: [{ name: "Sunflower Seeds", diff: -1.20, label: "Budget Saver swap" }] },
          { name: "Sesame Ginger Vinaigrette", amount: "3 tbsp", category: "Pantry", price: 1.00 }
        ],
        instructions: [
          "In a large serving bowl, layer shredded cabbage and carrots.",
          "Add shredded chicken breast and sliced almonds.",
          "Drizzle sesame ginger vinaigrette over the salad.",
          "Toss everything together until coated and serve cool."
        ]
      },
      dinner: {
        name: "Maple Mustard Salmon & Asparagus",
        description: "Seared salmon glazed with maple syrup and Dijon mustard, baked with roasted asparagus.",
        prepTime: 10, cookTime: 15, difficulty: "Medium", calories: 540, protein: 38, carbs: 14, fat: 28,
        ingredients: [
          { name: "Salmon Fillets", amount: "12 oz", category: "Protein", price: 9.50 },
          { name: "Asparagus", amount: "1 bunch", category: "Produce", price: 3.00 },
          { name: "Maple Mustard Glaze", amount: "3 tbsp", category: "Pantry", price: 1.20 }
        ],
        instructions: [
          "Preheat oven to 400°F (200°C).",
          "Line a baking sheet with parchment paper. Arrange trimmed asparagus and salmon fillets.",
          "Brush salmon generously with maple mustard glaze.",
          "Drizzle asparagus with olive oil, salt, and pepper.",
          "Roast in the oven for 12-15 minutes until salmon flakes easily with a fork and asparagus is tender."
        ]
      }
    }
  }
};

// Map other options to main presets (Vegetarian/GlutenFree maps to Vegan/Keto fallbacks with adjustments)
function getLocalPlan(diet, vibe) {
  let dietKey = diet;
  if (diet === 'vegetarian') dietKey = 'vegan'; // Map vegetarian queries to vegan structures
  if (diet === 'glutenfree') dietKey = 'keto';   // Gluten-free is easily mapped to keto's flourless templates
  if (!localRecipesDatabase[dietKey]) {
    dietKey = 'none';
  }

  let vibeKey = vibe;
  if (vibe !== 'clean' && vibe !== 'comfort') {
    vibeKey = 'comfort'; // Fallback default
  }

  // Deep clone database structure to avoid direct mutations
  const preset = JSON.parse(JSON.stringify(localRecipesDatabase[dietKey][vibeKey]));
  
  // Custom tweaks based on specific sub-diets
  if (diet === 'vegetarian') {
    // If vegetarian, we can restore egg/cheese if they were vegan templates
    // But keeping it vegan is safe for vegetarians!
  }
  
  return preset;
}

// --- Live Gemini API Engine Generator ---
async function generatePlanWithGemini(key, prefs) {
  const model = "gemini-1.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  
  const prompt = `
  You are an expert AI chef. Generate a customized personal daily culinary plan based on the following user constraints:
  - Daily Schedule/Context: "${prefs.schedule}"
  - Dietary Restrictions: "${prefs.diet}"
  - Energy level for cooking: "${prefs.energy}"
  - Available kitchen time: ${prefs.timeLimit} minutes total
  - Number of servings: ${prefs.servings} people
  - Target budget: $${prefs.budget} USD for all ingredients
  - General Vibes requested: ${prefs.vibes.join(', ')}

  You MUST return a JSON object that strictly adheres to the following JSON structure:
  {
    "vibeSummary": "Short 1-sentence summary of the plan's style",
    "breakfast": {
      "name": "Recipe Name",
      "description": "Short mouthwatering description",
      "prepTime": 5,
      "cookTime": 10,
      "difficulty": "Easy",
      "calories": 400,
      "protein": 15,
      "carbs": 40,
      "fat": 12,
      "ingredients": [
        { "name": "Ingredient Name", "amount": "1 cup", "category": "Pantry", "price": 1.20 }
      ],
      "instructions": [
        "Step 1...",
        "Step 2..."
      ]
    },
    "lunch": {
       ... same structure as breakfast ...
    },
    "dinner": {
       ... same structure as breakfast ...
    }
  }

  RULES FOR THE RESPONSE:
  1. Estimated price must be a number in USD representing realistic grocery prices.
  2. The sum of all ingredient prices across breakfast, lunch, and dinner must be calculated realistically.
  3. Ensure ingredients match the dietary restrictions ("${prefs.diet}").
  4. Ensure prep and cook times fit the schedule constraints.
  5. Return ONLY the raw JSON text inside the block. Do not wrap it in markdown code fences (\`\`\`json).
  `;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        responseMimeType: "application/json"
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API Error (Status ${response.status}): ${errText}`);
  }

  const resJson = await response.json();
  const textResponse = resJson.candidates[0].content.parts[0].text;
  
  // Clean JSON response (just in case they returned markdown)
  let cleanText = textResponse.trim();
  if (cleanText.startsWith("```json")) {
    cleanText = cleanText.substring(7);
  }
  if (cleanText.startsWith("```")) {
    cleanText = cleanText.substring(3);
  }
  if (cleanText.endsWith("```")) {
    cleanText = cleanText.substring(0, cleanText.length - 3);
  }
  
  return JSON.parse(cleanText.trim());
}

// --- Submit & Generate Action ---
const generateBtn = document.getElementById('generate-btn');
generateBtn.addEventListener('click', async () => {
  // Capture Inputs
  const scheduleVal = document.getElementById('schedule-input').value.trim();
  if (!scheduleVal) {
    document.getElementById('schedule-input').reportValidity();
    return;
  }
  
  // Parse checkboxes
  const vibeChecked = [];
  document.querySelectorAll('.vibe-tags input[type="checkbox"]:checked').forEach(cb => {
    vibeChecked.push(cb.value);
  });
  
  state.preferences = {
    schedule: scheduleVal,
    timeLimit: parseInt(document.getElementById('time-limit').value) || 60,
    energy: document.querySelector('input[name="energy"]:checked').value,
    vibes: vibeChecked,
    diet: document.getElementById('diet-select').value,
    servings: parseInt(document.getElementById('servings-select').value) || 2,
    budget: parseFloat(document.getElementById('budget-input').value) || 25
  };

  const isGemini = document.getElementById('engine-gemini').checked;
  const apiKey = document.getElementById('api-key-input').value.trim();

  // Transition UI to Loader
  document.getElementById('wizard-screen').classList.add('hidden');
  const loaderScreen = document.getElementById('loader-screen');
  loaderScreen.classList.remove('hidden');

  const statusText = document.getElementById('loader-status');
  const subtextText = document.getElementById('loader-subtext');

  // Reset local states
  state.activeSwaps = {};
  state.groceryChecked = {};
  state.timelineChecked = {};

  try {
    if (isGemini) {
      if (!apiKey) {
        throw new Error("Gemini API key is required when selecting the Gemini Engine. Please go back or enter a key.");
      }
      // Save key locally
      localStorage.setItem('gemini_api_key', apiKey);
      
      statusText.textContent = "Connecting to Gemini...";
      subtextText.textContent = "Crafting a bespoke culinary plan for your schedule...";
      
      const plan = await generatePlanWithGemini(apiKey, state.preferences);
      state.plan = plan;
    } else {
      statusText.textContent = "Simulating local AI...";
      subtextText.textContent = "Selecting seasonal recipes matching your constraints...";
      
      // Artificial delay to make it feel premium
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Determine vibe category
      let vibe = 'comfort';
      if (state.preferences.vibes.includes('Light & Clean')) {
        vibe = 'clean';
      }
      
      state.plan = getLocalPlan(state.preferences.diet, vibe);
    }

    // Success transition
    loaderScreen.classList.add('hidden');
    renderDashboard();
    document.getElementById('dashboard-screen').classList.remove('hidden');
    showToast("Culinary Plan Generated successfully! Bon appétit.");
  } catch (error) {
    console.error(error);
    loaderScreen.classList.add('hidden');
    document.getElementById('wizard-screen').classList.remove('hidden');
    showToast(`Failed: ${error.message}. Falling back to inputs.`);
  }
});

// --- Restart / Reset Plan ---
document.getElementById('reset-btn').addEventListener('click', () => {
  document.getElementById('dashboard-screen').classList.add('hidden');
  document.getElementById('wizard-screen').classList.remove('hidden');
  changeStep(1);
});

// --- Tab Navigation in Dashboard ---
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const parent = btn.closest('.meal-tabs-card');
    parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    parent.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

    btn.classList.add('active');
    const tabName = btn.getAttribute('data-tab');
    document.getElementById(`tab-${tabName}`).classList.add('active');
  });
});

// --- Dashboard Render Engine ---
function renderDashboard() {
  const p = state.plan;
  const prefs = state.preferences;

  // 1. Update Top Bar Meta
  document.getElementById('sum-vibe').textContent = p.vibeSummary || "Custom Plan";
  document.getElementById('sum-servings').textContent = `${prefs.servings} Servings`;
  document.getElementById('sum-time').textContent = `Max ${prefs.timeLimit} mins`;

  // 2. Render Meals (Breakfast, Lunch, Dinner)
  renderMealCard('breakfast', p.breakfast);
  renderMealCard('lunch', p.lunch);
  renderMealCard('dinner', p.dinner);

  // 3. Render Substitutions Panel
  renderSubstitutions();

  // 4. Calculate Costs & Render Grocery & Budget feasibility
  calculateAndRenderFinances();

  // 5. Render Cooking To-Do list (Timeline)
  renderTimeline();

  // Refresh Lucide Icons
  lucide.createIcons();
}

function renderMealCard(type, meal) {
  const panel = document.getElementById(`tab-${type}`);
  if (!meal) {
    panel.innerHTML = `<div class="empty-tab">No recipe generated for this slot.</div>`;
    return;
  }

  // Assemble Active Ingredients List (considering active swaps)
  let ingredientsHTML = '';
  meal.ingredients.forEach(ing => {
    // Check if swapped
    let displayName = ing.name;
    let displayPrice = ing.price;
    const swappedVal = state.activeSwaps[ing.name];
    
    if (swappedVal) {
      displayName = `${swappedVal} (Swap)`;
      // Look up substitute cost adjustment
      if (ing.substitutes) {
        const sub = ing.substitutes.find(s => s.name === swappedVal);
        if (sub) {
          displayPrice = Math.max(0.10, ing.price + sub.diff);
        }
      }
    }

    ingredientsHTML += `<li>${ing.amount} ${displayName}</li>`;
  });

  // Assemble instructions, substituting keywords if swapped
  let stepsHTML = '';
  meal.instructions.forEach((step, idx) => {
    let stepText = step;
    // Replace original ingredient names with swapped names in text
    Object.keys(state.activeSwaps).forEach(original => {
      const regex = new RegExp(original, 'gi');
      stepText = stepText.replace(regex, `<strong>${state.activeSwaps[original]}</strong>`);
    });

    stepsHTML += `
      <div class="recipe-step-item">
        <span class="recipe-step-number">${idx + 1}</span>
        <span class="recipe-step-text">${stepText}</span>
      </div>
    `;
  });

  panel.innerHTML = `
    <div class="recipe-hero">
      <div class="recipe-placeholder-img">
        <i data-lucide="${type === 'breakfast' ? 'coffee' : (type === 'lunch' ? 'sandwich' : 'soup')}"></i>
      </div>
      <div class="recipe-intro">
        <h4>${meal.name}</h4>
        <p class="recipe-desc">${meal.description}</p>
      </div>
    </div>

    <div class="recipe-meta-grid">
      <div class="recipe-meta-box">
        <span>Active Cook</span>
        <span>${meal.cookTime} mins</span>
      </div>
      <div class="recipe-meta-box">
        <span>Difficulty</span>
        <span>${meal.difficulty}</span>
      </div>
      <div class="recipe-meta-box">
        <span>Calories</span>
        <span>${meal.calories} kcal</span>
      </div>
    </div>

    <div class="recipe-section-title">
      <i data-lucide="check"></i> Ingredients List
    </div>
    <ul class="recipe-ingredients-list">
      ${ingredientsHTML}
    </ul>

    <div class="recipe-section-title">
      <i data-lucide="list-ordered"></i> Preparation & Steps
    </div>
    <div class="recipe-steps-list">
      ${stepsHTML}
    </div>
  `;
}

// Render dynamic dropdown swaps based on recipe substitutes in plan
function renderSubstitutions() {
  const container = document.getElementById('substitutions-list');
  container.innerHTML = '';

  const p = state.plan;
  const allIngredients = [
    ...(p.breakfast ? p.breakfast.ingredients : []),
    ...(p.lunch ? p.lunch.ingredients : []),
    ...(p.dinner ? p.dinner.ingredients : [])
  ];

  // Filter ingredients that have substitutes specified
  const eligible = allIngredients.filter(ing => ing.substitutes && ing.substitutes.length > 0);

  if (eligible.length === 0) {
    container.innerHTML = `<p class="help-text">No modular substitutions available for this recipe set.</p>`;
    return;
  }

  // De-duplicate by ingredient name
  const seen = new Set();
  const uniqueEligible = [];
  eligible.forEach(item => {
    if (!seen.has(item.name)) {
      seen.add(item.name);
      uniqueEligible.push(item);
    }
  });

  uniqueEligible.forEach(ing => {
    const selectId = `sub-select-${ing.name.replace(/\s+/g, '-')}`;
    
    let optionsHTML = `<option value="original">Original: ${ing.name}</option>`;
    ing.substitutes.forEach(sub => {
      const isSelected = state.activeSwaps[ing.name] === sub.name ? 'selected' : '';
      const priceText = sub.diff < 0 ? `(saves $${Math.abs(sub.diff).toFixed(2)})` : `(+$${sub.diff.toFixed(2)})`;
      optionsHTML += `<option value="${sub.name}" ${isSelected}>${sub.name} ${priceText}</option>`;
    });

    const subItem = document.createElement('div');
    subItem.className = 'substitution-item';
    subItem.innerHTML = `
      <div class="sub-details">
        <h4>${ing.name}</h4>
        <p>Swap item to accommodate taste or save budget</p>
      </div>
      <div class="sub-select-wrapper">
        <select id="${selectId}" class="sub-select">
          ${optionsHTML}
        </select>
      </div>
    `;

    container.appendChild(subItem);

    // Event listener
    const selectEl = document.getElementById(selectId);
    selectEl.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val === 'original') {
        delete state.activeSwaps[ing.name];
      } else {
        state.activeSwaps[ing.name] = val;
      }
      
      // Trigger full re-render of components affected by ingredient swaps
      renderMealCard('breakfast', p.breakfast);
      renderMealCard('lunch', p.lunch);
      renderMealCard('dinner', p.dinner);
      calculateAndRenderFinances();
      renderTimeline();
      lucide.createIcons();
    });
  });
}

// Calculate total costs, manage budget warning bar, suggest specific swaps
function calculateAndRenderFinances() {
  const p = state.plan;
  const prefs = state.preferences;

  let totalCost = 0;
  const ingredientsMap = {};

  // Compile ingredients list, adjusting prices for swaps
  const addIngredients = (meal) => {
    if (!meal) return;
    meal.ingredients.forEach(ing => {
      let finalName = ing.name;
      let finalPrice = ing.price;
      const swap = state.activeSwaps[ing.name];

      if (swap) {
        finalName = `${swap} (Swap)`;
        if (ing.substitutes) {
          const sub = ing.substitutes.find(s => s.name === swap);
          if (sub) {
            finalPrice = Math.max(0.10, ing.price + sub.diff);
          }
        }
      }

      if (!ingredientsMap[finalName]) {
        ingredientsMap[finalName] = {
          name: finalName,
          category: ing.category || 'Pantry',
          price: finalPrice
        };
      }
    });
  };

  addIngredients(p.breakfast);
  addIngredients(p.lunch);
  addIngredients(p.dinner);

  // Sum up unique prices (multiplied by servings logic, standard base is 2 servings)
  // Let's scale prices slightly with servings (e.g. 1 serving = 70% cost, 4 servings = 170% cost)
  let scale = 1.0;
  if (prefs.servings === 1) scale = 0.7;
  if (prefs.servings === 4) scale = 1.7;

  Object.values(ingredientsMap).forEach(item => {
    totalCost += item.price * scale;
  });

  const targetBudget = prefs.budget;
  
  // Render displays
  document.getElementById('target-budget-display').textContent = `$${targetBudget.toFixed(2)}`;
  document.getElementById('estimated-cost-display').textContent = `$${totalCost.toFixed(2)}`;

  // Budget progress percentage
  const budgetPercent = Math.min(100, (totalCost / targetBudget) * 100);
  const progressBar = document.getElementById('budget-progress');
  progressBar.style.width = `${budgetPercent}%`;

  // Color classes for progress
  progressBar.className = "progress-bar"; // clear first
  if (totalCost <= targetBudget) {
    progressBar.classList.add('progress-bar-gold');
  } else {
    progressBar.className = "progress-bar";
    progressBar.style.background = "var(--error)";
  }

  // Banner State
  const alertBanner = document.getElementById('budget-alert');
  const savingPanel = document.getElementById('cost-saving-suggestions');
  
  if (totalCost <= targetBudget * 0.8) {
    alertBanner.className = "budget-alert-banner under";
    alertBanner.innerHTML = `<i data-lucide="check-circle-2"></i> <span><strong>Well Under Budget!</strong> You are saving money on today's meals.</span>`;
    savingPanel.classList.add('hidden');
  } else if (totalCost <= targetBudget) {
    alertBanner.className = "budget-alert-banner warning";
    alertBanner.innerHTML = `<i data-lucide="info"></i> <span><strong>On Target.</strong> You are within your budget bounds.</span>`;
    savingPanel.classList.add('hidden');
  } else {
    alertBanner.className = "budget-alert-banner over";
    alertBanner.innerHTML = `<i data-lucide="alert-triangle"></i> <span><strong>Over Budget!</strong> This menu exceeds your target by $${(totalCost - targetBudget).toFixed(2)}. Apply suggestions below.</span>`;
    savingPanel.classList.remove('hidden');
    renderCostSavings(scale);
  }

  // Render Grocery List Checklist
  renderGroceryList(ingredientsMap, scale);
}

// Generate the cost-saving suggestions clickable grid
function renderCostSavings(scale) {
  const list = document.getElementById('cost-saving-list');
  list.innerHTML = '';

  const p = state.plan;
  const allIngredients = [
    ...(p.breakfast ? p.breakfast.ingredients : []),
    ...(p.lunch ? p.lunch.ingredients : []),
    ...(p.dinner ? p.dinner.ingredients : [])
  ];

  // Find all swaps that decrease price and are NOT already active
  const savingSwaps = [];
  allIngredients.forEach(ing => {
    if (ing.substitutes) {
      ing.substitutes.forEach(sub => {
        // If it saves money (diff < 0) and isn't the active swap
        if (sub.diff < 0 && state.activeSwaps[ing.name] !== sub.name) {
          savingSwaps.push({
            original: ing.name,
            alternative: sub.name,
            saving: Math.abs(sub.diff) * scale
          });
        }
      });
    }
  });

  if (savingSwaps.length === 0) {
    list.innerHTML = `<p class="help-text">No further automated cost-saving swaps found.</p>`;
    return;
  }

  // De-duplicate suggestions
  const seen = new Set();
  savingSwaps.forEach(swap => {
    const key = `${swap.original}->${swap.alternative}`;
    if (!seen.has(key)) {
      seen.add(key);

      const card = document.createElement('div');
      card.className = 'cost-saving-card';
      card.innerHTML = `
        <div class="swap-text">
          <h5>Swap ${swap.original}</h5>
          <p>Use ${swap.alternative} instead</p>
        </div>
        <span class="swap-benefit">-$${swap.saving.toFixed(2)}</span>
      `;
      
      card.addEventListener('click', () => {
        // Apply swap
        state.activeSwaps[swap.original] = swap.alternative;
        showToast(`Applied swap: ${swap.alternative} instead of ${swap.original}`);
        // Re-render
        renderDashboard();
      });

      list.appendChild(card);
    }
  });
}

// Grocery List renderer
function renderGroceryList(ingredientsMap, scale) {
  const sectionsContainer = document.getElementById('grocery-sections');
  sectionsContainer.innerHTML = '';

  // Group by category
  const categories = {};
  Object.values(ingredientsMap).forEach(item => {
    if (!categories[item.category]) {
      categories[item.category] = [];
    }
    categories[item.category].push(item);
  });

  let totalItems = 0;
  let checkedItems = 0;

  Object.keys(categories).forEach(cat => {
    const deptTitle = document.createElement('div');
    deptTitle.className = 'grocery-dept-title';
    deptTitle.textContent = cat;
    sectionsContainer.appendChild(deptTitle);

    const ul = document.createElement('ul');
    ul.className = 'grocery-dept-list';

    categories[cat].forEach(item => {
      totalItems++;
      const isChecked = state.groceryChecked[item.name] ? 'checked' : '';
      if (isChecked) checkedItems++;

      const li = document.createElement('li');
      li.className = 'grocery-item';
      li.innerHTML = `
        <label class="grocery-item-check" for="grocery-${item.name.replace(/\s+/g, '-')}">
          <input type="checkbox" id="grocery-${item.name.replace(/\s+/g, '-')}" ${isChecked}>
          <span class="grocery-item-name">${item.name}</span>
        </label>
        <span class="grocery-item-price">$${(item.price * scale).toFixed(2)}</span>
      `;

      // Checkbox listener
      const checkbox = li.querySelector('input');
      checkbox.addEventListener('change', (e) => {
        state.groceryChecked[item.name] = e.target.checked;
        updateGroceryCount();
      });

      ul.appendChild(li);
    });

    sectionsContainer.appendChild(ul);
  });

  // Update badge count
  document.getElementById('grocery-count').textContent = `${checkedItems}/${totalItems} Items`;
}

function updateGroceryCount() {
  const checkboxes = document.querySelectorAll('#grocery-sections input[type="checkbox"]');
  let checked = 0;
  checkboxes.forEach(cb => {
    if (cb.checked) checked++;
  });
  document.getElementById('grocery-count').textContent = `${checked}/${checkboxes.length} Items`;
}

// Timeline To-Do renderer
function renderTimeline() {
  const container = document.getElementById('cooking-timeline');
  container.innerHTML = '';

  const p = state.plan;

  // Extract instructions from active recipes
  const items = [];

  const addMealSteps = (meal, mealName) => {
    if (!meal) return;
    meal.instructions.forEach((step, idx) => {
      let stepText = step;
      // Apply active swaps in instructions text
      Object.keys(state.activeSwaps).forEach(original => {
        const regex = new RegExp(original, 'gi');
        stepText = stepText.replace(regex, state.activeSwaps[original]);
      });

      // Classify steps: simple categorization based on index or text
      let section = 'Active Cook';
      if (idx === 0 || step.toLowerCase().includes('preheat') || step.toLowerCase().includes('marinate') || step.toLowerCase().includes('chop') || step.toLowerCase().includes('prep')) {
        section = 'Prep Ahead';
      } else if (step.toLowerCase().includes('clean') || step.toLowerCase().includes('wash') || step.toLowerCase().includes('leftover') || idx === meal.instructions.length - 1) {
        section = 'Cleanup';
      }

      items.push({
        id: `${mealName}-${idx}`,
        text: stepText,
        mealName: mealName.charAt(0).toUpperCase() + mealName.slice(1),
        cookTime: meal.cookTime,
        section: section
      });
    });
  };

  addMealSteps(p.breakfast, 'breakfast');
  addMealSteps(p.lunch, 'lunch');
  addMealSteps(p.dinner, 'dinner');

  // Group items by Section: Prep Ahead, Active Cook, Cleanup
  const sections = {
    'Prep Ahead': [],
    'Active Cook': [],
    'Cleanup': []
  };

  items.forEach(item => {
    sections[item.section].push(item);
  });

  let totalTasks = 0;
  let completedTasks = 0;

  Object.keys(sections).forEach(secName => {
    const secItems = sections[secName];
    if (secItems.length === 0) return;

    // Header divider
    const divider = document.createElement('div');
    divider.className = 'timeline-section-divider';
    divider.textContent = secName;
    container.appendChild(divider);

    secItems.forEach(item => {
      totalTasks++;
      const isCompleted = state.timelineChecked[item.id] ? true : false;
      if (isCompleted) completedTasks++;

      const tlItem = document.createElement('div');
      tlItem.className = `timeline-item ${isCompleted ? 'completed' : ''}`;
      
      // Determine time spent label
      let timeText = '5 mins';
      if (item.section === 'Active Cook') {
        timeText = `${Math.ceil(item.cookTime / 3)} mins`;
      }

      tlItem.innerHTML = `
        <div class="timeline-dot"></div>
        <div class="timeline-content-wrapper">
          <div class="timeline-task-header">
            <span class="timeline-task-title">${item.text}</span>
            <span class="timeline-task-meta">
              <i data-lucide="clock"></i> ${timeText}
            </span>
          </div>
          <span class="timeline-task-desc">${item.mealName} Preparation</span>
        </div>
      `;

      // Click event on card to toggle complete state
      tlItem.querySelector('.timeline-content-wrapper').addEventListener('click', () => {
        const currentStatus = state.timelineChecked[item.id];
        state.timelineChecked[item.id] = !currentStatus;
        
        // Re-render timeline to update layout & progress
        renderTimeline();
        updateTimelineProgress();
      });

      container.appendChild(tlItem);
    });
  });

  // Initial update of progress gauges
  updateTimelineProgress();
}

function updateTimelineProgress() {
  const items = Object.keys(state.timelineChecked);
  let total = 0;
  let checked = 0;

  // Re-calculate exactly based on current DOM elements
  const cards = document.querySelectorAll('.timeline-item');
  total = cards.length;
  cards.forEach(card => {
    if (card.classList.contains('completed')) checked++;
  });

  const percent = total > 0 ? Math.round((checked / total) * 100) : 0;

  // Update top progress text
  document.getElementById('todo-progress-percent').textContent = `${percent}% Done`;

  // Update circular completion gauge
  const circle = document.getElementById('circle-progress');
  const textVal = document.getElementById('circle-percentage');
  
  if (circle) {
    // Circle circumference for r=15.9155 is ~100
    const strokeDash = `${percent}, 100`;
    circle.setAttribute('stroke-dasharray', strokeDash);
  }
  if (textVal) {
    textVal.textContent = `${percent}%`;
  }
}
