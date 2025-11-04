export interface Ingredient {
  id?: string;
  name: string;
  quantity: string;
  recipeId?: string;
}

export interface Instruction {
  id?: string;
  step: number;
  text: string;
  recipeId?: string;
}

export interface Recipe {
  id: string;
  title: string;
  description: string | null;
  ingredients: Ingredient[];
  instructions: Instruction[];
  servings: number;
  imageUrls: string[];
  notes: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type AppView = 'list' | 'recipe' | 'shoppingList';

export interface ShoppingListItem {
  name: string;
  quantity: string;
  recipeTitle: string;
}

// Form input types for creating/updating recipes
export interface RecipeInput {
  title: string;
  description?: string;
  ingredients: { name: string; quantity: string }[];
  instructions: string[];
  servings: number;
  imageUrls?: string[];
  notes?: string;
}