import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { RecipeInput } from '@/types';

// GET /api/recipes/[id] - Get a single recipe
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const recipe = await prisma.recipe.findUnique({
      where: { id },
      include: {
        ingredients: true,
        instructions: {
          orderBy: {
            step: 'asc',
          },
        },
      },
    });

    if (!recipe) {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
    }

    return NextResponse.json(recipe);
  } catch (error) {
    console.error('Error fetching recipe:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recipe' },
      { status: 500 }
    );
  }
}

// PUT /api/recipes/[id] - Update a recipe
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: RecipeInput = await request.json();

    // Delete existing ingredients and instructions
    await prisma.ingredient.deleteMany({
      where: { recipeId: id },
    });
    await prisma.instruction.deleteMany({
      where: { recipeId: id },
    });

    // Update recipe with new data
    const recipe = await prisma.recipe.update({
      where: { id },
      data: {
        title: body.title,
        description: body.description || null,
        servings: body.servings,
        notes: body.notes || null,
        sourceUrl: body.sourceUrl || null,
        imageUrls: body.imageUrls || [],
        ingredients: {
          create: body.ingredients.map((ing) => ({
            name: ing.name,
            quantity: ing.quantity,
          })),
        },
        instructions: {
          create: body.instructions.map((text, index) => ({
            step: index + 1,
            text,
          })),
        },
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

    return NextResponse.json(recipe);
  } catch (error) {
    console.error('Error updating recipe:', error);
    return NextResponse.json(
      { error: 'Failed to update recipe' },
      { status: 500 }
    );
  }
}

// DELETE /api/recipes/[id] - Delete a recipe
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.recipe.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting recipe:', error);
    return NextResponse.json(
      { error: 'Failed to delete recipe' },
      { status: 500 }
    );
  }
}
