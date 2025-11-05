import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateImageForRecipe } from '@/lib/ai';
import { uploadBase64Image } from '@/lib/blob';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get the recipe
    const recipe = await prisma.recipe.findUnique({
      where: { id },
      include: {
        ingredients: true,
      },
    });

    if (!recipe) {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
    }

    // Generate the image using AI
    const base64Image = await generateImageForRecipe(
      recipe.title,
      recipe.description || ''
    );

    if (!base64Image) {
      return NextResponse.json(
        { error: 'Failed to generate image' },
        { status: 500 }
      );
    }

    // Upload to Vercel Blob
    const imageUrl = await uploadBase64Image(base64Image, `recipe-${id}-${Date.now()}.png`);

    // Add the image URL to the recipe
    const updatedRecipe = await prisma.recipe.update({
      where: { id },
      data: {
        imageUrls: [...recipe.imageUrls, imageUrl],
      },
      include: {
        ingredients: true,
        instructions: {
          orderBy: {
            step: 'asc',
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      imageUrl,
      recipe: updatedRecipe,
    });
  } catch (error) {
    console.error('Error generating image:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate image' },
      { status: 500 }
    );
  }
}
