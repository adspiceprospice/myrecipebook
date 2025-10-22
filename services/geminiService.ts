import { GoogleGenAI, Type, Modality } from "@google/genai";
import type { Recipe, Ingredient } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const recipeSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    description: { type: Type.STRING },
    servings: { type: Type.INTEGER },
    ingredients: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          quantity: { type: Type.STRING },
        },
        required: ["name", "quantity"],
      },
    },
    instructions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: ["title", "description", "servings", "ingredients", "instructions"],
};

const parseJsonResponse = (jsonString?: string): Partial<Recipe> | null => {
    try {
        if (!jsonString) {
            console.error("AI response was empty or undefined.");
            return null;
        }
        const cleanedJson = jsonString.replace(/```json|```/g, '').trim();
        if (!cleanedJson) {
            console.error("AI response was empty after cleaning markdown.");
            return null;
        }
        return JSON.parse(cleanedJson);
    } catch (error) {
        // FIX: Added curly braces to the catch block to correctly scope the error variable and contain the block's statements.
        console.error("Failed to parse JSON response:", error);
        console.error("Original string that failed parsing:", jsonString);
        return null;
    }
};

export const generateRecipeFromImage = async (mimeType: string, base64Image: string): Promise<Partial<Recipe> | null> => {
  const imagePart = { inlineData: { mimeType, data: base64Image } };
  const textPart = { text: "Analyze this image of a dish. Identify it and create a detailed recipe for it. If you can't identify a specific dish, make a recipe for what you see. Format the response as JSON using the provided schema." };

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: { parts: [imagePart, textPart] },
    config: { responseMimeType: "application/json", responseSchema: recipeSchema },
  });

  return parseJsonResponse(response.text);
};

export const generateRecipeFromUrl = async (url: string): Promise<Partial<Recipe> | null> => {
  // FIX: Refactored to a two-step process to align with API guidelines.
  // First, extract text content using Google Search.
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Extract the recipe from this web page: ${url}. Return only the recipe's text content (ingredients and instructions).`,
    config: {
        tools: [{ googleSearch: {} }],
    },
  });
  // Second, structure the extracted text into a recipe JSON object.
  if (response.text) {
    return structureTextToRecipe(response.text);
  }
  return null;
};

export const generateRecipeFromYoutubeUrl = async (url: string): Promise<Partial<Recipe> | null> => {
    // FIX: Refactored to a two-step process to align with API guidelines.
    // First, extract text content using Google Search.
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Extract the recipe from this YouTube URL: ${url}. Act as if you have the video's full transcript. Use search to find information about the video if necessary. Return only the recipe's text content (ingredients and instructions).`,
        config: {
            tools: [{ googleSearch: {} }],
        },
    });
    // Second, structure the extracted text into a recipe JSON object.
    if (response.text) {
        return structureTextToRecipe(response.text);
    }
    return null;
};


export const structureTextToRecipe = async (text: string): Promise<Partial<Recipe> | null> => {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Take the following text and structure it as a recipe. Format the response as JSON using the provided schema.\n\nText: "${text}"`,
        config: { responseMimeType: "application/json", responseSchema: recipeSchema },
    });
    return parseJsonResponse(response.text);
};

export const adjustIngredients = async (ingredients: Ingredient[], originalServings: number, newServings: number): Promise<Ingredient[] | null> => {
    const ingredientsString = ingredients.map(i => `${i.quantity} ${i.name}`).join('\n');
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `This recipe is for ${originalServings} servings. Adjust the ingredient quantities for ${newServings} servings. Original ingredients:\n${ingredientsString}\n\nReturn ONLY the adjusted ingredients list as a JSON array of objects with "name" and "quantity" keys.`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        quantity: { type: Type.STRING },
                    },
                    required: ["name", "quantity"]
                }
            }
        }
    });
    
    try {
        const text = response.text;
        if (!text) {
            console.error("AI response for ingredient adjustment was empty or undefined.");
            return null;
        }
        const cleanedJson = text.replace(/```json|```/g, '').trim();
        if (!cleanedJson) {
            console.error("AI response for ingredient adjustment was empty after cleaning markdown.");
            return null;
        }
        const parsed = JSON.parse(cleanedJson);
        return parsed as Ingredient[];
    } catch(e) {
        console.error("Failed to parse adjusted ingredients", e);
        if (response) {
            console.error("Original string that failed parsing:", response.text);
        }
        return null;
    }
};

export const textToSpeech = async (text: string): Promise<string | null> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Kore' },
                    },
                },
            },
        });
        return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data ?? null;
    } catch(e) {
        console.error("TTS generation failed", e);
        return null;
    }
};
