import { NextRequest, NextResponse } from 'next/server';
import {
  structureTextToRecipe,
  generateRecipeFromYoutubeUrl,
  generateRecipeFromUrl,
  generateRecipeFromImage,
} from '@/lib/ai';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, content } = body;

    let recipeData;

    switch (type) {
      case 'text':
        recipeData = await structureTextToRecipe(content);
        break;
      case 'url':
        if (content.includes('youtube.com') || content.includes('youtu.be')) {
          recipeData = await generateRecipeFromYoutubeUrl(content);
        } else {
          recipeData = await generateRecipeFromUrl(content);
        }
        // Add sourceUrl to the recipe data when extracted from a URL
        recipeData = { ...recipeData, sourceUrl: content };
        break;
      case 'image':
        const { mimeType, base64Image } = body;
        recipeData = await generateRecipeFromImage(mimeType, base64Image);
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid generation type' },
          { status: 400 }
        );
    }

    return NextResponse.json(recipeData);
  } catch (error) {
    console.error('Error generating recipe:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate recipe' },
      { status: 500 }
    );
  }
}
