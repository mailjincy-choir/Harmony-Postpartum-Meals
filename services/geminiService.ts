
import { GoogleGenAI, Type } from "@google/genai";
import { UserState, DailyMessage } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

/**
 * Delays execution for a given number of milliseconds.
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Retries a function with exponential backoff.
 */
async function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries: number = 3): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      // Check if it's a 429 error
      const isQuotaError = error?.message?.includes('429') || error?.status === 429 || JSON.stringify(error).includes('429');
      
      if (isQuotaError && i < maxRetries - 1) {
        const waitTime = Math.pow(2, i) * 2000; // 2s, 4s, 8s...
        console.warn(`Quota exceeded (429). Retrying in ${waitTime}ms... (Attempt ${i + 1}/${maxRetries})`);
        await sleep(waitTime);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export async function generateDailyMessage(
  userState: UserState,
  symptomIds: string[]
): Promise<DailyMessage> {
  const daysSinceBirth = Math.floor(
    (new Date().getTime() - new Date(userState.birthDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  const symptomList = symptomIds.length > 0 ? symptomIds.join(', ') : "none (feeling steady)";

  const systemInstruction = `
    You are a deeply compassionate postpartum companion for ${userState.name}.
    Persona: A wise elder sister providing a safe space.
    
    CRITICAL RULES FOR 'reassurance':
    - Respond with EXACTLY ONE short sentence.
    - VALIDATE: Acknowledge the feeling or physical sensation.
    - NO ADVICE: Do not give tips or suggestions in this field.
    - NO QUESTIONS: Do not ask how she is or anything else.
    - NO SOLUTIONS: Do not try to fix the feeling.
    - Use everyday, simple language.
    - Do not sound automated.
    - Do not mention the app or system.
    - It should feel like a quiet, empathetic nod of understanding.
    - Example: "I hear how much your body is aching today." or "That exhaustion is a heavy weight to carry."

    Current Context:
    - Day ${daysSinceBirth} postpartum.
    - Symptoms: ${symptomList}.
    - Milestone: ${daysSinceBirth <= 42 ? "Sacred Window" : daysSinceBirth <= 180 ? "The Strengthening" : "The Return"}.

    Meal Plan (If opted in):
    - 3 simple, warm, easy-to-digest meals.
    - Max 3 steps each.

    Output as JSON:
    {
      "reassurance": "The single validating sentence.",
      "focus": "3-5 words only.",
      "actions": ["1-3 simple tasks"],
      "ignore": "Something to let go of today.",
      "meals": [...],
      "spouseMessage": "1 short sentence for her partner."
    }
  `;

  // Fallback data in case the API completely fails after retries
  const fallbackData: DailyMessage = {
    reassurance: "I hear the heaviness you're carrying in your body today.",
    focus: "Gentle rest and warmth.",
    actions: ["Sip warm water", "Keep your feet covered", "Deep belly breaths"],
    ignore: "Unfinished household tasks.",
    meals: userState.optedIntoFood ? [
      { 
        name: "Warm Rice Porridge", 
        ingredients: ["Rice", "Water", "Pinch of Salt"],
        steps: ["Boil rice until very soft.", "Add salt.", "Serve warm."] 
      },
      { 
        name: "Simple Mung Dal", 
        ingredients: ["Mung Dal", "Turmeric", "Ghee"],
        steps: ["Cook dal with turmeric.", "Stir in ghee.", "Serve hot."] 
      },
      { 
        name: "Stewed Apple", 
        ingredients: ["Apple", "Cinnamon"],
        steps: ["Slice apple.", "Simmer with cinnamon until soft.", "Eat warm."] 
      }
    ] : [],
    spouseMessage: "Please take care of all chores today so she can simply focus on her recovery."
  };

  try {
    const generateContent = async () => {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Symptoms: ${symptomList}. Day: ${daysSinceBirth}. Plan for food: ${userState.optedIntoFood}.`,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reassurance: { type: Type.STRING },
              focus: { type: Type.STRING },
              actions: { type: Type.ARRAY, items: { type: Type.STRING } },
              ignore: { type: Type.STRING },
              meals: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
                    steps: { type: Type.ARRAY, items: { type: Type.STRING } }
                  },
                  required: ["name", "ingredients", "steps"]
                }
              },
              spouseMessage: { type: Type.STRING }
            },
            required: ["reassurance", "focus", "actions", "ignore", "spouseMessage", "meals"]
          }
        }
      });
      return JSON.parse(response.text || "{}");
    };

    return await retryWithBackoff(generateContent, 3);
  } catch (error: any) {
    console.error("Gemini Service Error:", error);
    
    // Check if it's specifically a quota error for the final fallback return
    const isQuotaError = error?.message?.includes('429') || error?.status === 429 || JSON.stringify(error).includes('429');
    
    if (isQuotaError) {
      // If it's a quota error, we provide a slightly different reassurance
      return {
        ...fallbackData,
        reassurance: "The guidance is resting for a moment, but I still see you and the effort you are making."
      };
    }
    
    return fallbackData;
  }
}
