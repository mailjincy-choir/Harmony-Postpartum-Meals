
import { GoogleGenAI, Type } from "@google/genai";
import { UserState, SymptomCheck, DailyRecoveryPlan } from "../types";

export async function generateSaanviGuidance(
  user: UserState,
  check: SymptomCheck
): Promise<DailyRecoveryPlan> {
  // Always create a new instance right before the call to use the latest API key
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const birthDate = new Date(user.birthDate);
  const now = new Date();
  const daysPost = Math.max(0, Math.floor((now.getTime() - birthDate.getTime()) / 86400000));
  
  const preferencesStr = user.preferences.join(', ') || 'No specific preferences';
  
  const systemInstruction = `
    You are Saanvi, a wise and empathetic postpartum recovery guide. 
    Address the user as ${user.name}.
    Tone: Warm, practical, protective, and minimalist. 

    Context for ${user.name}:
    - Days Postpartum: ${daysPost}
    - Delivery: ${user.deliveryType}
    - Current Symptoms: Physical(${check.physical.join(', ')}), Emotional(${check.emotional.join(', ')}), Lactation(${check.lactation.join(', ')})
    - Dietary Focus: ${user.optedIntoFood ? 'Enabled' : 'Disabled'}
    - Preferences: ${preferencesStr}

    Output Requirement:
    You must return a valid JSON object with the following fields:
    1. "validation": A single affirming sentence for a new mother.
    2. "focus": A 3-word title for her core priority today.
    3. "actions": An array of exactly 3 tiny, manageable wellness actions.
    4. "ignore": One specific chore she has permission to skip today.
    5. "meals": An array of 4 objects for Breakfast, Lunch, Dinner, and Snack.
       - Each meal object MUST include: "category", "name", "why" (benefit for recovery), "ingredients" (array of strings with quantities), and "instructions" (array of step-by-step cooking steps).

    Safety: If heavy bleeding or incision pain is mentioned, include a gentle reminder to contact a doctor in the validation.
    Culinary: Prioritize nutrient-dense, warming foods (e.g., bone broths, oats, turmeric, ginger).
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Saanvi, please provide my daily rhythm and nourishment plan for today.`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            validation: { type: Type.STRING },
            focus: { type: Type.STRING },
            actions: { type: Type.ARRAY, items: { type: Type.STRING } },
            ignore: { type: Type.STRING },
            meals: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  category: { type: Type.STRING, enum: ["Breakfast", "Lunch", "Dinner", "Snack"] },
                  name: { type: Type.STRING },
                  why: { type: Type.STRING },
                  ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
                  instructions: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["category", "name", "why", "ingredients", "instructions"]
              }
            }
          },
          required: ["validation", "focus", "actions", "ignore", "meals"]
        }
      }
    });

    let responseText = response.text || "{}";
    // Strip markdown if the model accidentally included it
    responseText = responseText.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    
    const data = JSON.parse(responseText);
    
    return {
      validation: data.validation || "You are doing beautifully, Mama.",
      focus: data.focus || "Gentle Rest Today",
      actions: Array.isArray(data.actions) ? data.actions : ["Rest", "Hydrate", "Breathe"],
      ignore: data.ignore || "The laundry can wait.",
      meals: Array.isArray(data.meals) ? data.meals.map((m: any) => ({
        category: m.category || 'Snack',
        name: m.name || 'Nourishing Bowl',
        why: m.why || 'For gentle energy.',
        ingredients: Array.isArray(m.ingredients) ? m.ingredients : [],
        instructions: Array.isArray(m.instructions) ? m.instructions : []
      })) : []
    };
  } catch (e) {
    console.error("Saanvi service error:", e);
    // Return a solid fallback to prevent UI spinning indefinitely
    return {
      validation: "Take a deep breath. You are doing enough exactly as you are.",
      focus: "Pure Gentle Healing",
      actions: ["Drink warm water", "Rest when baby rests", "Ask for a hug"],
      ignore: "Unnecessary chores",
      meals: [
        { category: 'Breakfast', name: 'Warm Spiced Oats', why: 'Gentle on digestion and grounding.', ingredients: ['1 cup oats', '2 cups water', 'Pinch of cinnamon'], instructions: ['Boil water', 'Add oats', 'Simmer for 5 mins'] }
      ]
    };
  }
}
