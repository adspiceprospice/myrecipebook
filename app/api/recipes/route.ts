import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { RecipeInput } from '@/types';

// GET /api/recipes - Get all recipes
export async function GET() {
  try {
    const recipes = await prisma.recipe.findMany({
      include: {
        ingredients: true,
        instructions: {
          orderBy: {
            step: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(recipes);
  } catch (error) {
    console.error('Error fetching recipes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recipes' },
      { status: 500 }
    );
  }
}

// POST /api/recipes - Create a new recipe
export async function POST(request: NextRequest) {
  try {
    const body: RecipeInput = await request.json();

    const recipe = await prisma.recipe.create({
      data: {
        title: body.title,
        description: body.description || null,
        servings: body.servings,
        notes: body.notes || null,
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

    return NextResponse.json(recipe, { status: 201 });
  } catch (error) {
    console.error('Error creating recipe:', error);
    return NextResponse.json(
      { error: 'Failed to create recipe' },
      { status: 500 }
    );
  }
}
