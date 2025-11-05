/**
 * Structured data parser for recipe extraction
 * Supports JSON-LD (schema.org Recipe) and OpenGraph meta tags
 */

import * as cheerio from 'cheerio';
import { RecipeExtractionError, extractDomain } from './extraction-utils';

export interface ParsedRecipeData {
  title: string;
  description: string;
  servings: number;
  ingredients: Array<{ name: string; quantity: string }>;
  instructions: string[];
}

/**
 * Parse JSON-LD structured data from a webpage
 * @param html HTML content
 * @param url Source URL for error reporting
 * @returns Parsed recipe data or null if not found
 */
export function parseJsonLdRecipe(html: string, url: string): ParsedRecipeData | null {
  try {
    const $ = cheerio.load(html);
    const jsonLdScripts = $('script[type="application/ld+json"]');

    for (let i = 0; i < jsonLdScripts.length; i++) {
      try {
        const scriptContent = $(jsonLdScripts[i]).html();
        if (!scriptContent) continue;

        const data = JSON.parse(scriptContent);

        // Handle both single objects and arrays of objects
        const recipes = Array.isArray(data) ? data : [data];

        for (const item of recipes) {
          // Check if this is a Recipe or if it has a Recipe in @graph
          let recipe = null;

          if (item['@type'] === 'Recipe') {
            recipe = item;
          } else if (item['@graph']) {
            // Some sites nest recipes in @graph array
            recipe = item['@graph'].find((g: any) => g['@type'] === 'Recipe');
          } else if (Array.isArray(item['@type']) && item['@type'].includes('Recipe')) {
            recipe = item;
          }

          if (recipe) {
            const parsed = transformSchemaOrgToRecipe(recipe);
            if (parsed) {
              console.log(`✅ Successfully parsed JSON-LD recipe from ${extractDomain(url)}`);
              return parsed;
            }
          }
        }
      } catch (err) {
        // Continue to next script tag if parsing fails
        console.log(`Failed to parse JSON-LD script ${i}, continuing...`);
        continue;
      }
    }

    return null;
  } catch (error) {
    console.error('Error parsing JSON-LD:', error);
    return null;
  }
}

/**
 * Transform schema.org Recipe format to our internal format
 * @param schemaRecipe Schema.org Recipe object
 * @returns Parsed recipe data or null
 */
function transformSchemaOrgToRecipe(schemaRecipe: any): ParsedRecipeData | null {
  try {
    // Extract title
    const title = schemaRecipe.name || schemaRecipe.headline;
    if (!title) return null;

    // Extract description
    const description = schemaRecipe.description || '';

    // Extract servings (try multiple fields)
    let servings = 4; // Default
    if (schemaRecipe.recipeYield) {
      const yieldValue = Array.isArray(schemaRecipe.recipeYield)
        ? schemaRecipe.recipeYield[0]
        : schemaRecipe.recipeYield;

      // Try to extract number from string like "4 servings" or "serves 4"
      const match = String(yieldValue).match(/\d+/);
      if (match) {
        servings = parseInt(match[0], 10);
      }
    }

    // Extract ingredients
    const ingredientsList = schemaRecipe.recipeIngredient || [];
    const ingredients = parseIngredients(ingredientsList);

    if (ingredients.length === 0) return null; // Must have ingredients

    // Extract instructions
    const instructions = parseInstructions(
      schemaRecipe.recipeInstructions || []
    );

    if (instructions.length === 0) return null; // Must have instructions

    return {
      title,
      description,
      servings,
      ingredients,
      instructions,
    };
  } catch (error) {
    console.error('Error transforming schema.org recipe:', error);
    return null;
  }
}

/**
 * Parse ingredients from various schema.org formats
 * @param ingredientsList Ingredients in schema.org format
 * @returns Array of ingredient objects
 */
function parseIngredients(ingredientsList: any[]): Array<{ name: string; quantity: string }> {
  if (!Array.isArray(ingredientsList) || ingredientsList.length === 0) {
    return [];
  }

  return ingredientsList.map((ingredient) => {
    // Handle string format (most common)
    if (typeof ingredient === 'string') {
      return parseIngredientString(ingredient);
    }

    // Handle object format with structured data
    if (typeof ingredient === 'object' && ingredient !== null) {
      const text = ingredient.text || ingredient.name || ingredient['@value'];
      if (text) {
        return parseIngredientString(text);
      }
    }

    // Fallback
    return { name: String(ingredient), quantity: '' };
  }).filter(ing => ing.name.trim().length > 0);
}

/**
 * Parse a single ingredient string into name and quantity
 * Examples: "2 cups flour", "1 egg", "Salt to taste"
 * @param ingredientStr Ingredient string
 * @returns Ingredient object with name and quantity
 */
function parseIngredientString(ingredientStr: string): { name: string; quantity: string } {
  const trimmed = ingredientStr.trim();

  // Try to split on common patterns
  // Pattern: "quantity unit name" like "2 cups flour"
  const match = trimmed.match(/^([\d\s\/\-¼½¾⅓⅔⅛⅜⅝⅞]+(?:\s+(?:cup|cups|tablespoon|tablespoons|teaspoon|teaspoons|tbsp|tsp|oz|ounce|ounces|pound|pounds|lb|lbs|gram|grams|g|kg|ml|milliliter|milliliters|liter|liters|inch|inches)?)?)\s+(.+)$/i);

  if (match) {
    return {
      quantity: match[1].trim(),
      name: match[2].trim(),
    };
  }

  // If no clear quantity found, treat whole string as name with empty quantity
  return {
    quantity: '',
    name: trimmed,
  };
}

/**
 * Parse instructions from various schema.org formats
 * @param instructionsList Instructions in schema.org format
 * @returns Array of instruction strings
 */
function parseInstructions(instructionsList: any): string[] {
  // Handle array of strings
  if (Array.isArray(instructionsList)) {
    return instructionsList.map((instruction) => {
      // Handle string format
      if (typeof instruction === 'string') {
        return instruction.trim();
      }

      // Handle HowToStep format
      if (typeof instruction === 'object' && instruction !== null) {
        if (instruction.text) return instruction.text.trim();
        if (instruction.name) return instruction.name.trim();
        if (instruction['@value']) return instruction['@value'].trim();
      }

      return String(instruction).trim();
    }).filter(step => step.length > 0);
  }

  // Handle single string
  if (typeof instructionsList === 'string') {
    // Split on newlines or numbered steps
    const steps = instructionsList
      .split(/\n+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
    return steps;
  }

  return [];
}

/**
 * Parse OpenGraph meta tags as fallback
 * @param html HTML content
 * @param url Source URL for error reporting
 * @returns Partial recipe data or null
 */
export function parseOpenGraphTags(html: string, url: string): Partial<ParsedRecipeData> | null {
  try {
    const $ = cheerio.load(html);

    const title = $('meta[property="og:title"]').attr('content')
                  || $('meta[name="og:title"]').attr('content')
                  || $('title').text();

    const description = $('meta[property="og:description"]').attr('content')
                       || $('meta[name="og:description"]').attr('content')
                       || $('meta[name="description"]').attr('content')
                       || '';

    // OpenGraph doesn't have structured recipe data, but we can extract basic info
    if (title && title.trim().length > 0) {
      console.log(`📋 Extracted basic metadata from OpenGraph tags for ${extractDomain(url)}`);
      return {
        title: title.trim(),
        description: description.trim(),
        servings: 4, // Default
      };
    }

    return null;
  } catch (error) {
    console.error('Error parsing OpenGraph tags:', error);
    return null;
  }
}

/**
 * Fetch HTML content from a URL
 * @param url URL to fetch
 * @returns HTML content
 */
export async function fetchHtmlContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RecipeBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(15000), // 15 second timeout
    });

    if (!response.ok) {
      throw new RecipeExtractionError(
        `HTTP ${response.status}: ${response.statusText}`,
        'NETWORK_ERROR',
        url
      );
    }

    const html = await response.text();
    return html;
  } catch (error) {
    if (error instanceof RecipeExtractionError) {
      throw error;
    }

    // Handle fetch errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new RecipeExtractionError(
      `Failed to fetch URL: ${errorMessage}`,
      'NETWORK_ERROR',
      url,
      error instanceof Error ? error : undefined
    );
  }
}
