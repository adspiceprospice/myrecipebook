'use client';

import React from 'react';
import type { Recipe } from '@/types';
import { ChefHatIcon, PlusIcon } from './icons';

const placeholderImage = (id: string) => `https://picsum.photos/seed/${id}/600/400`;

const RecipeCard: React.FC<{ recipe: Recipe; onSelect: (id: string) => void }> = ({
  recipe,
  onSelect,
}) => (
  <div
    onClick={() => onSelect(recipe.id)}
    className="bg-white rounded-lg shadow-md overflow-hidden cursor-pointer hover:shadow-xl transition-shadow duration-300 group"
  >
    <img
      src={recipe.imageUrls?.[0] || placeholderImage(recipe.id)}
      alt={recipe.title}
      className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
    />
    <div className="p-4">
      <h3 className="text-lg font-bold text-gray-800 truncate">{recipe.title}</h3>
      <p className="text-sm text-gray-600 mt-1 h-10 overflow-hidden">{recipe.description}</p>
    </div>
  </div>
);

interface RecipeListProps {
  recipes: Recipe[];
  onSelectRecipe: (id: string) => void;
  onOpenModal: () => void;
}

export default function RecipeList({ recipes, onSelectRecipe, onOpenModal }: RecipeListProps) {
  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">My Recipes</h1>
        <button
          onClick={onOpenModal}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white font-semibold rounded-lg shadow-md hover:bg-emerald-700 transition-colors"
        >
          <PlusIcon /> Add Recipe
        </button>
      </div>
      {recipes.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {recipes.map(recipe => (
            <RecipeCard key={recipe.id} recipe={recipe} onSelect={onSelectRecipe} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-lg shadow">
          <ChefHatIcon className="mx-auto w-16 h-16 text-gray-300" />
          <h3 className="mt-2 text-xl font-semibold text-gray-900">No recipes yet!</h3>
          <p className="mt-1 text-sm text-gray-500">Click "Add Recipe" to get started.</p>
        </div>
      )}
    </div>
  );
}
