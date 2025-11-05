/**
 * Recipe data validation using Zod
 */

import { z } from 'zod';
import { RecipeExtractionError } from './extraction-utils';

/**
 * Ingredient schema
 */
export const IngredientSchema = z.object({
  name: z.string().min(1, 'Ingredient name is required'),
  quantity: z.string(), // Can be empty for "to taste" items
});

/**
 * Recipe data schema
 */
export const RecipeDataSchema = z.object({
  title: z.string().min(1, 'Recipe title is required').max(200, 'Title too long'),
  description: z.string().min(1, 'Recipe description is required'),
  servings: z.number().int().positive('Servings must be a positive number').default(4),
  ingredients: z
    .array(IngredientSchema)
    .min(1, 'At least one ingredient is required')
    .max(100, 'Too many ingredients'),
  instructions: z
    .array(z.string().min(1, 'Instruction step cannot be empty'))
    .min(1, 'At least one instruction step is required')
    .max(50, 'Too many instruction steps'),
  imageUrls: z.array(z.string().url()).optional().default([]),
  sourceUrl: z.string().url().optional(),
});

/**
 * Type for validated recipe data
 */
export type ValidatedRecipeData = z.infer<typeof RecipeDataSchema>;

/**
 * Validate recipe data
 * @param data Recipe data to validate
 * @returns Validated recipe data
 * @throws RecipeExtractionError if validation fails
 */
export function validateRecipeData(data: unknown): ValidatedRecipeData {
  try {
    const validated = RecipeDataSchema.parse(data);
    return validated;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ');
      throw new RecipeExtractionError(
        `Recipe validation failed: ${issues}`,
        'VALIDATION_ERROR'
      );
    }
    throw error;
  }
}

/**
 * Validate recipe data with safe parsing (returns result object)
 * @param data Recipe data to validate
 * @returns Validation result with success flag and data/error
 */
export function safeValidateRecipeData(data: unknown): {
  success: boolean;
  data?: ValidatedRecipeData;
  error?: string;
} {
  const result = RecipeDataSchema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  } else {
    const issues = result.error.issues
      .map(issue => `${issue.path.join('.')}: ${issue.message}`)
      .join(', ');
    return { success: false, error: issues };
  }
}

/**
 * Sanitize and clean recipe data before validation
 * @param data Raw recipe data
 * @returns Cleaned recipe data
 */
export function sanitizeRecipeData(data: any): any {
  return {
    title: sanitizeString(data.title),
    description: sanitizeString(data.description),
    servings: sanitizeNumber(data.servings, 4),
    ingredients: sanitizeIngredients(data.ingredients),
    instructions: sanitizeInstructions(data.instructions),
    imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls : [],
    sourceUrl: data.sourceUrl || undefined,
  };
}

/**
 * Sanitize a string value
 * @param value Value to sanitize
 * @returns Sanitized string
 */
function sanitizeString(value: any): string {
  if (typeof value === 'string') {
    return value.trim();
  }
  return '';
}

/**
 * Sanitize a number value
 * @param value Value to sanitize
 * @param defaultValue Default value if invalid
 * @returns Sanitized number
 */
function sanitizeNumber(value: any, defaultValue: number): number {
  const num = parseInt(String(value), 10);
  return !isNaN(num) && num > 0 ? num : defaultValue;
}

/**
 * Sanitize ingredients array
 * @param ingredients Raw ingredients
 * @returns Sanitized ingredients
 */
function sanitizeIngredients(ingredients: any): Array<{ name: string; quantity: string }> {
  if (!Array.isArray(ingredients)) {
    return [];
  }

  return ingredients
    .filter((ing) => ing && typeof ing === 'object')
    .map((ing) => ({
      name: sanitizeString(ing.name),
      quantity: sanitizeString(ing.quantity),
    }))
    .filter((ing) => ing.name.length > 0); // Remove empty ingredients
}

/**
 * Sanitize instructions array
 * @param instructions Raw instructions
 * @returns Sanitized instructions
 */
function sanitizeInstructions(instructions: any): string[] {
  if (!Array.isArray(instructions)) {
    return [];
  }

  return instructions
    .map((instruction) => sanitizeString(instruction))
    .filter((instruction) => instruction.length > 0); // Remove empty instructions
}
