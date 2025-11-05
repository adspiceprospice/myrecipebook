import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { adjustIngredients } from '@/lib/ai';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { newServings } = await request.json();

    const recipe = await prisma.recipe.findUnique({
      where: { id },
      include: {
        ingredients: true,
      },
    });

    if (!recipe) {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
    }

    const adjustedIngredients = await adjustIngredients(
      recipe.ingredients,
      recipe.servings,
      newServings
    );

    return NextResponse.json({
      ingredients: adjustedIngredients,
      servings: newServings,
    });
  } catch (error) {
    console.error('Error adjusting servings:', error);
    return NextResponse.json(
      { error: 'Failed to adjust servings' },
      { status: 500 }
    );
  }
}
