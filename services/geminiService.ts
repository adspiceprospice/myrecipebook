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
        console.error("Failed to parse JSON response:", error);
        console.error("Original string that failed parsing:", jsonString);
        return null;
    }
};

export const generateRecipeFromImage = async (mimeType: string, base64Image: string, log: (message: string) => void): Promise<Partial<Recipe> | null> => {
  log("Identifying dish and creating recipe...");
  const imagePart = { inlineData: { mimeType, data: base64Image } };
  const textPart = { text: "Analyze this image of a dish. Identify it and create a detailed recipe for it. If you can't identify a specific dish, make a recipe for what you see. Format the response as JSON using the provided schema." };

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: { parts: [imagePart, textPart] },
    config: { responseMimeType: "application/json", responseSchema: recipeSchema },
  });
  log("Recipe structured successfully.");
  return parseJsonResponse(response.text);
};


export const structureTextToRecipe = async (text: string, log: (message: string) => void): Promise<Partial<Recipe> | null> => {
    log("AI is structuring the recipe...");
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Take the following text and structure it as a recipe. Format the response as JSON using the provided schema.\n\nText: "${text}"`,
        config: { responseMimeType: "application/json", responseSchema: recipeSchema },
    });
    log("Recipe structured.");
    return parseJsonResponse(response.text);
};


export const generateImageForRecipe = async (title: string, description: string, log: (message: string) => void): Promise<string | null> => {
    log(`Generating a new image for "${title}"...`);
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [{ text: `Generate a delicious-looking photo of "${title}". It is described as: "${description}"` }],
            },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                log("Image generated successfully.");
                return `data:image/png;base64,${part.inlineData.data}`;
            }
        }
        return null;
    } catch (e) {
        log(`Image generation failed: ${(e as Error).message}`);
        console.error("Image generation failed", e);
        return null;
    }
};

// --- YouTube URL Processing ---

const getTranscriptFromYoutubeUrl = async (url: string, log: (message: string) => void): Promise<string | null> => {
    log(`Attempting to retrieve video transcript for: ${url}`);
    const prompt = `Please retrieve the full text transcript for the YouTube video at this URL: ${url}. Return only the verbatim transcript text. Do not add any commentary or summary. If a transcript is not available or you cannot access it, return the single word "ERROR".`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: prompt,
            config: { tools: [{ googleSearch: {} }] },
        });
        const transcript = response.text;
        
        if (!transcript || transcript.trim().toUpperCase() === "ERROR") {
            log("❌ Failed to retrieve a valid transcript from the video.");
            return null;
        }
        log("✅ Transcript retrieved successfully.");
        return transcript;
    } catch (e) {
        log(`❌ An error occurred while fetching the transcript: ${(e as Error).message}`);
        console.error("Transcript fetching failed", e);
        return null;
    }
}

const getYoutubeVideoId = (url: string): string | null => {
    const regex = /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/ ]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

export const generateRecipeFromYoutubeUrl = async (url: string, log: (message: string) => void): Promise<Partial<Recipe> | null> => {
    const transcript = await getTranscriptFromYoutubeUrl(url, log);
    if (!transcript) {
        log("Halting process as no transcript was found.");
        return null;
    }

    const recipeData = await structureTextToRecipe(transcript, log);
    if (!recipeData) {
        log("❌ Failed to structure the recipe from the transcript.");
        return null;
    }

    let finalImageUrls: string[] = [];
    const videoId = getYoutubeVideoId(url);
    if (videoId) {
        const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        finalImageUrls.push(thumbnailUrl);
        log("✅ Found video thumbnail.");
    } else {
        log("Could not parse video ID to get thumbnail. Attempting to generate an image.");
        const generatedImage = await generateImageForRecipe(recipeData.title || "the dish", recipeData.description || "", log);
        if (generatedImage) {
            finalImageUrls.push(generatedImage);
        }
    }
    
    return { ...recipeData, imageUrls: finalImageUrls };
};

// --- Standard URL Processing ---

const getTextContentFromUrl = async (url: string, log: (message: string) => void): Promise<string | null> => {
    log(`Attempting to retrieve page content for: ${url}`);
    const prompt = `Please extract the main recipe content from the webpage at this URL: ${url}. Include the title, description, ingredients, and instructions. Return only the text of the recipe. If you cannot access the URL or find a recipe on the page, return the single word "ERROR".`;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: prompt,
            config: { tools: [{ googleSearch: {} }] },
        });
        const text = response.text;
        
        if (!text || text.trim().toUpperCase() === "ERROR") {
            log("❌ Failed to retrieve valid content from the URL.");
            return null;
        }
        log("✅ Page content retrieved successfully.");
        return text;
    } catch (e) {
        log(`❌ An error occurred while fetching page content: ${(e as Error).message}`);
        console.error("Page content fetching failed", e);
        return null;
    }
}

export const generateRecipeFromUrl = async (url: string, log: (message: string) => void): Promise<Partial<Recipe> | null> => {
    const pageText = await getTextContentFromUrl(url, log);
    if (!pageText) {
        log("Halting process as no content was found.");
        return null;
    }

    const recipeData = await structureTextToRecipe(pageText, log);
    if (!recipeData) {
        log("❌ Failed to structure the recipe from the page content.");
        return null;
    }
    
    log("Attempting to generate an image for the recipe.");
    let finalImageUrls: string[] = [];
    const generatedImage = await generateImageForRecipe(recipeData.title || "the dish", recipeData.description || "", log);
    if (generatedImage) {
        finalImageUrls.push(generatedImage);
    }
    
    return { ...recipeData, imageUrls: finalImageUrls };
};


// --- Other Functions ---

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