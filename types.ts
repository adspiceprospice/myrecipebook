
export interface Ingredient {
  name: string;
  quantity: string;
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  ingredients: Ingredient[];
  instructions: string[];
  servings: number;
  imageUrls?: string[];
  notes?: string;
}

export type AppView = 'list' | 'recipe' | 'shoppingList';

export interface ShoppingListItem {
    name: string;
    quantity: string;
    recipeTitle: string;
}