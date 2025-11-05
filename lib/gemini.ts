import { GoogleGenAI, Type, Modality } from "@google/genai";
import type { Ingredient } from '@/types';
import {
  RecipeExtractionError,
  withRetry,
  withTimeout,
  normalizeUrl,
  extractDomain
} from './extraction-utils';
import {
  parseJsonLdRecipe,
  parseOpenGraphTags,
  fetchHtmlContent,
  type ParsedRecipeData,
} from './structured-data-parser';
import {
  validateRecipeData,
  sanitizeRecipeData,
  type ValidatedRecipeData
} from './recipe-validation';

function getAI() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

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
  try {
    console.log(`📸 Starting recipe generation from image...`);

    const recipeData = await withRetry(async () => {
      const ai = getAI();
      const imagePart = { inlineData: { mimeType, data: base64Image } };
      const textPart = { text: "Analyze this image of a dish. Identify it and create a detailed recipe for it. If you can't identify a specific dish, make a recipe for what you see. Format the response as JSON using the provided schema." };

      const response = await withTimeout(
        ai.models.generateContent({
          model: 'gemini-2.5-pro',
          contents: { parts: [imagePart, textPart] },
          config: { responseMimeType: "application/json", responseSchema: recipeSchema },
        }),
        30000,
        'Image analysis timeout'
      );

      return parseJsonResponse(response.text);
    }, 2); // Retry up to 2 times

    // Sanitize and validate
    const sanitized = sanitizeRecipeData(recipeData);
    const validated = validateRecipeData(sanitized);

    console.log(`✅ Image recipe generation complete: ${validated.title}`);

    return validated;
  } catch (error) {
    console.error('Failed to generate recipe from image:', error);
    if (error instanceof RecipeExtractionError) {
      throw new Error(error.message);
    }
    throw new Error('Failed to analyze image and generate recipe');
  }
}

export async function structureTextToRecipe(text: string) {
  try {
    return await withRetry(async () => {
      const ai = getAI();
      const response = await withTimeout(
        ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `Take the following text and structure it as a recipe. Format the response as JSON using the provided schema.\n\nText: "${text}"`,
          config: { responseMimeType: "application/json", responseSchema: recipeSchema },
        }),
        20000,
        'Recipe structuring timeout'
      );

      return parseJsonResponse(response.text);
    }, 2); // Retry up to 2 times
  } catch (error) {
    console.error('Failed to structure text as recipe:', error);
    throw new RecipeExtractionError(
      'Failed to structure recipe data',
      'PARSING_ERROR',
      undefined,
      error instanceof Error ? error : undefined
    );
  }
}

export async function generateImageForRecipe(title: string, description: string): Promise<string | null> {
  try {
    const ai = getAI();
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
    const transcript = await withRetry(async () => {
      const ai = getAI();
      const response = await withTimeout(
        ai.models.generateContent({
          model: 'gemini-2.5-pro',
          contents: prompt,
          config: { tools: [{ googleSearch: {} }] },
        }),
        30000,
        'YouTube transcript extraction timeout'
      );

      const text = response.text?.trim();

      if (!text || text.toUpperCase() === "ERROR" || text.length < 100) {
        return null;
      }
      return text;
    }, 2); // Retry up to 2 times

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
  try {
    console.log(`🎥 Starting recipe extraction from YouTube: ${url}`);

    const transcript = await getTranscriptFromYoutubeUrl(url);
    if (!transcript) {
      throw new RecipeExtractionError(
        "Failed to retrieve transcript from YouTube video. The video may not have captions or may not contain a recipe.",
        'NO_RECIPE_FOUND',
        url
      );
    }

    const recipeData = await structureTextToRecipe(transcript);

    // Sanitize and validate
    const sanitized = sanitizeRecipeData(recipeData);
    const validated = validateRecipeData(sanitized);

    // Get thumbnail
    let finalImageUrls: string[] = [];
    const videoId = getYoutubeVideoId(url);
    if (videoId) {
      const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
      finalImageUrls.push(thumbnailUrl);
    } else {
      const generatedImage = await generateImageForRecipe(
        validated.title,
        validated.description
      );
      if (generatedImage) {
        finalImageUrls.push(generatedImage);
      }
    }

    console.log(`✅ YouTube recipe extraction complete: ${validated.title}`);

    return { ...validated, imageUrls: finalImageUrls };
  } catch (error) {
    if (error instanceof RecipeExtractionError) {
      console.error(`❌ YouTube extraction failed: ${error.message}`);
      throw new Error(error.message);
    }
    throw error;
  }
}

/**
 * Extract recipe data from URL using multi-tier strategy:
 * 1. Try JSON-LD structured data (fast, free, reliable)
 * 2. Try OpenGraph meta tags (basic info)
 * 3. Fall back to AI extraction (slow, paid, flexible)
 */
async function extractRecipeFromUrl(url: string): Promise<ParsedRecipeData | null> {
  const normalizedUrl = normalizeUrl(url);
  const domain = extractDomain(normalizedUrl);

  console.log(`🔍 Extracting recipe from ${domain}...`);

  try {
    // TIER 1: Try JSON-LD structured data
    console.log(`📄 Trying JSON-LD structured data...`);
    const html = await withTimeout(
      fetchHtmlContent(normalizedUrl),
      15000,
      'Timeout fetching webpage'
    );

    const jsonLdRecipe = parseJsonLdRecipe(html, normalizedUrl);
    if (jsonLdRecipe) {
      console.log(`✅ Successfully extracted recipe using JSON-LD`);
      return jsonLdRecipe;
    }

    // TIER 2: Try OpenGraph meta tags (partial data)
    console.log(`📋 JSON-LD not found, trying OpenGraph tags...`);
    const ogData = parseOpenGraphTags(html, normalizedUrl);

    // If we have basic metadata from OG tags, try to enhance with AI using the HTML
    if (ogData && ogData.title) {
      console.log(`🤖 Found basic metadata, using AI to extract full recipe from HTML...`);
      const textContent = extractTextFromHtml(html);
      if (textContent) {
        const aiRecipe = await getTextContentFromUrlWithAI(normalizedUrl, textContent);
        if (aiRecipe) {
          return aiRecipe;
        }
      }
    }

    // TIER 3: Fall back to AI extraction with Google Search
    console.log(`🤖 No structured data found, falling back to AI extraction...`);
    const aiRecipe = await getTextContentFromUrlWithAI(normalizedUrl);
    if (aiRecipe) {
      return aiRecipe;
    }

    throw new RecipeExtractionError(
      'No recipe found on this page. Please make sure the URL contains a recipe.',
      'NO_RECIPE_FOUND',
      normalizedUrl
    );
  } catch (error) {
    if (error instanceof RecipeExtractionError) {
      throw error;
    }

    console.error("Recipe extraction failed:", error);
    throw new RecipeExtractionError(
      `Failed to extract recipe: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'PARSING_ERROR',
      normalizedUrl,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Extract text content from HTML (simple text extraction for AI processing)
 */
function extractTextFromHtml(html: string): string | null {
  try {
    // Remove script and style tags
    let text = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ') // Remove HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    return text.length > 100 ? text : null;
  } catch {
    return null;
  }
}

/**
 * Use AI to extract recipe from URL or text content
 * @param url URL to extract from
 * @param textContent Optional pre-fetched text content
 */
async function getTextContentFromUrlWithAI(url: string, textContent?: string): Promise<ParsedRecipeData | null> {
  const prompt = textContent
    ? `Extract the recipe from this webpage text and structure it as a recipe. Text: "${textContent.substring(0, 10000)}"` // Limit text length
    : `Please extract the main recipe content from the webpage at this URL: ${url}. Include the title, description, ingredients, and instructions. Return only the text of the recipe. If you cannot access the URL or find a recipe on the page, return the single word "ERROR".`;

  try {
    const recipeText = await withRetry(async () => {
      const ai = getAI();
      const response = await withTimeout(
        ai.models.generateContent({
          model: 'gemini-2.5-pro',
          contents: prompt,
          config: textContent ? {} : { tools: [{ googleSearch: {} }] }, // Only use Google Search if no text provided
        }),
        30000,
        'AI extraction timeout'
      );

      const text = response.text;
      if (!text || text.trim().toUpperCase() === "ERROR") {
        return null;
      }
      return text;
    }, 2); // Retry up to 2 times

    if (!recipeText) {
      return null;
    }

    // Structure the extracted text as a recipe using AI
    const recipeData = await structureTextToRecipe(recipeText);
    return recipeData;
  } catch (e) {
    console.error("AI extraction failed", e);
    return null;
  }
}

export async function generateRecipeFromUrl(url: string) {
  try {
    console.log(`🔗 Starting recipe extraction from URL: ${url}`);

    // Extract recipe using multi-tier strategy
    const recipeData = await extractRecipeFromUrl(url);
    if (!recipeData) {
      throw new RecipeExtractionError(
        "Failed to extract recipe from URL",
        'NO_RECIPE_FOUND',
        url
      );
    }

    // Sanitize and validate the extracted data
    const sanitized = sanitizeRecipeData(recipeData);
    const validated = validateRecipeData(sanitized);

    // Generate or find images
    let finalImageUrls: string[] = [];
    const generatedImage = await generateImageForRecipe(
      validated.title,
      validated.description
    );
    if (generatedImage) {
      finalImageUrls.push(generatedImage);
    }

    console.log(`✅ Recipe extraction complete: ${validated.title}`);

    return { ...validated, imageUrls: finalImageUrls };
  } catch (error) {
    if (error instanceof RecipeExtractionError) {
      console.error(`❌ Recipe extraction failed: ${error.message}`);
      throw new Error(error.message);
    }
    throw error;
  }
}

export async function adjustIngredients(ingredients: Ingredient[], originalServings: number, newServings: number) {
  const ai = getAI();
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
    const ai = getAI();
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
