import { generateObject, generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import type { Ingredient } from '@/types';

// Zod schema for recipe structure
const recipeSchema = z.object({
  title: z.string(),
  description: z.string(),
  servings: z.number().int(),
  ingredients: z.array(
    z.object({
      name: z.string(),
      quantity: z.string(),
    })
  ),
  instructions: z.array(z.string()),
});

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
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }

  const { object } = await generateObject({
    model: openai('gpt-4o-mini'),
    schema: recipeSchema,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Analyze this image of a dish. Identify it and create a detailed recipe for it. If you can\'t identify a specific dish, make a recipe for what you see.',
          },
          {
            type: 'image',
            image: `data:${mimeType};base64,${base64Image}`,
          },
        ],
      },
    ],
  });

  return object;
}

export async function structureTextToRecipe(text: string) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }

  const { object } = await generateObject({
    model: openai('gpt-4o-mini'),
    schema: recipeSchema,
    prompt: `Take the following text and structure it as a recipe.\n\nText: "${text}"`,
  });

  return object;
}

export async function generateImageForRecipe(title: string, description: string): Promise<string | null> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY environment variable is not set");
    }

    // Import Google GenAI directly for image generation (not supported in Vercel AI SDK yet)
    const { GoogleGenAI, Modality } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: `Generate a delicious-looking photo of "${title}". It is described as: "${description}"` }],
      },
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    return null;
  } catch (e) {
    console.error("Image generation failed", e);
    return null;
  }
}

async function getTranscriptFromYoutubeUrl(url: string): Promise<string | null> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }

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
    // Use Google model with search grounding for YouTube transcript extraction
    const { text } = await generateText({
      model: google('gemini-2.0-flash-exp', {
        useSearchGrounding: true,
      }),
      prompt,
    });

    const transcript = text?.trim();
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
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }

  const prompt = `Please extract the main recipe content from the webpage at this URL: ${url}. Include the title, description, ingredients, and instructions. Return only the text of the recipe. If you cannot access the URL or find a recipe on the page, return the single word "ERROR".`;

  try {
    // Use Google model with search grounding for web scraping
    const { text } = await generateText({
      model: google('gemini-2.0-flash-exp', {
        useSearchGrounding: true,
      }),
      prompt,
    });

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
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }

  const ingredientsString = ingredients.map(i => `${i.quantity} ${i.name}`).join('\n');

  const ingredientSchema = z.array(
    z.object({
      name: z.string(),
      quantity: z.string(),
    })
  );

  const { object } = await generateObject({
    model: openai('gpt-4o-mini'),
    schema: ingredientSchema,
    prompt: `This recipe is for ${originalServings} servings. Adjust the ingredient quantities for ${newServings} servings. Original ingredients:\n${ingredientsString}\n\nReturn the adjusted ingredients list.`,
  });

  return object as Ingredient[];
}
