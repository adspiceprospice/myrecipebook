import { GoogleGenAI, Type, Modality } from "@google/genai";
import type { Ingredient } from '@/types';

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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

const parseJsonResponse = (jsonString?: string): any => {
  try {
    if (!jsonString) {
      throw new Error("AI response was empty or undefined.");
    }
    const cleanedJson = jsonString.replace(/```json|```/g, '').trim();
    if (!cleanedJson) {
      throw new Error("AI response was empty after cleaning markdown.");
    }
    return JSON.parse(cleanedJson);
  } catch (error) {
    console.error("Failed to parse JSON response:", error);
    console.error("Original string that failed parsing:", jsonString);
    throw error;
  }
};

export async function generateRecipeFromImage(mimeType: string, base64Image: string) {
  const imagePart = { inlineData: { mimeType, data: base64Image } };
  const textPart = { text: "Analyze this image of a dish. Identify it and create a detailed recipe for it. If you can't identify a specific dish, make a recipe for what you see. Format the response as JSON using the provided schema." };

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: { parts: [imagePart, textPart] },
    config: { responseMimeType: "application/json", responseSchema: recipeSchema },
  });

  return parseJsonResponse(response.text);
}

export async function structureTextToRecipe(text: string) {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Take the following text and structure it as a recipe. Format the response as JSON using the provided schema.\n\nText: "${text}"`,
    config: { responseMimeType: "application/json", responseSchema: recipeSchema },
  });

  return parseJsonResponse(response.text);
}

export async function generateImageForRecipe(title: string, description: string): Promise<string | null> {
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
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (e) {
    console.error("Image generation failed", e);
    return null;
  }
}

async function getTranscriptFromYoutubeUrl(url: string): Promise<string | null> {
  const prompt = `You are a specialized AI assistant with expertise in processing YouTube video data. Your task is to find and return the full text transcript for a given YouTube video URL.
Video URL: ${url}

Instructions:
1. Analyze the provided URL to identify the video.
2. Use your search capabilities to find the official or auto-generated captions/transcript for this specific video.
3. Extract the complete, verbatim text from the transcript.
4. Return ONLY the raw text of the transcript. Do not include timestamps, summaries, introductions, or any other conversational text.
5. If you successfully find the transcript, provide only the text.
6. If after a thorough search you cannot find any transcript or captions for this video, you MUST return the single word: "ERROR". Do not explain why or apologize.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] },
    });
    const transcript = response.text?.trim();

    if (!transcript || transcript.toUpperCase() === "ERROR" || transcript.length < 100) {
      return null;
    }
    return transcript;
  } catch (e) {
    console.error("Transcript fetching failed", e);
    return null;
  }
}

function getYoutubeVideoId(url: string): string | null {
  const regex = /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/ ]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

export async function generateRecipeFromYoutubeUrl(url: string) {
  const transcript = await getTranscriptFromYoutubeUrl(url);
  if (!transcript) {
    throw new Error("Failed to retrieve transcript from YouTube video");
  }

  const recipeData = await structureTextToRecipe(transcript);

  let finalImageUrls: string[] = [];
  const videoId = getYoutubeVideoId(url);
  if (videoId) {
    const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    finalImageUrls.push(thumbnailUrl);
  } else {
    const generatedImage = await generateImageForRecipe(recipeData.title || "the dish", recipeData.description || "");
    if (generatedImage) {
      finalImageUrls.push(generatedImage);
    }
  }

  return { ...recipeData, imageUrls: finalImageUrls };
}

async function getTextContentFromUrl(url: string): Promise<string | null> {
  const prompt = `Please extract the main recipe content from the webpage at this URL: ${url}. Include the title, description, ingredients, and instructions. Return only the text of the recipe. If you cannot access the URL or find a recipe on the page, return the single word "ERROR".`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] },
    });
    const text = response.text;

    if (!text || text.trim().toUpperCase() === "ERROR") {
      return null;
    }
    return text;
  } catch (e) {
    console.error("Page content fetching failed", e);
    return null;
  }
}

export async function generateRecipeFromUrl(url: string) {
  const pageText = await getTextContentFromUrl(url);
  if (!pageText) {
    throw new Error("Failed to retrieve content from URL");
  }

  const recipeData = await structureTextToRecipe(pageText);

  let finalImageUrls: string[] = [];
  const generatedImage = await generateImageForRecipe(recipeData.title || "the dish", recipeData.description || "");
  if (generatedImage) {
    finalImageUrls.push(generatedImage);
  }

  return { ...recipeData, imageUrls: finalImageUrls };
}

export async function adjustIngredients(ingredients: Ingredient[], originalServings: number, newServings: number) {
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

  return parseJsonResponse(response.text) as Ingredient[];
}

export async function textToSpeech(text: string): Promise<string | null> {
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
}
