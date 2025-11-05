/**
 * Utility functions for robust recipe extraction
 */

/**
 * Custom error class for recipe extraction failures
 */
export class RecipeExtractionError extends Error {
  constructor(
    message: string,
    public code: 'NETWORK_ERROR' | 'NO_RECIPE_FOUND' | 'PARSING_ERROR' | 'API_LIMIT' | 'TIMEOUT' | 'VALIDATION_ERROR',
    public url?: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'RecipeExtractionError';
  }
}

/**
 * Retry a function with exponential backoff
 * @param fn Function to retry
 * @param maxRetries Maximum number of retry attempts (default: 3)
 * @param initialDelay Initial delay in ms (default: 1000)
 * @returns Result of the function
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry on certain error types
      if (error instanceof RecipeExtractionError) {
        if (error.code === 'NO_RECIPE_FOUND' || error.code === 'VALIDATION_ERROR') {
          throw error; // These errors won't be fixed by retrying
        }
      }

      // If this is the last attempt, throw the error
      if (attempt === maxRetries - 1) {
        throw lastError;
      }

      // Wait before retrying with exponential backoff
      const delay = initialDelay * Math.pow(2, attempt);
      console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

/**
 * Add timeout to a promise
 * @param promise Promise to wrap
 * @param timeoutMs Timeout in milliseconds (default: 30000)
 * @param errorMessage Custom error message
 * @returns Result of the promise
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 30000,
  errorMessage: string = 'Request timeout'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new RecipeExtractionError(errorMessage, 'TIMEOUT')),
        timeoutMs
      )
    )
  ]);
}

/**
 * Normalize a URL to ensure it's valid
 * @param url URL to normalize
 * @returns Normalized URL
 */
export function normalizeUrl(url: string): string {
  // Add protocol if missing
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  // Validate URL
  try {
    new URL(url);
    return url;
  } catch {
    throw new RecipeExtractionError('Invalid URL format', 'VALIDATION_ERROR', url);
  }
}

/**
 * Check if a URL is valid and accessible
 * @param url URL to check
 * @returns true if valid and accessible
 */
export async function isUrlAccessible(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000) // 5 second timeout for HEAD request
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Extract domain from URL for logging/debugging
 * @param url URL to extract domain from
 * @returns Domain name
 */
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return 'unknown';
  }
}
