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
    className="bg-white rounded-lg shadow-sm hover:shadow-md overflow-hidden cursor-pointer transition-all active:scale-98 group border border-gray-100"
  >
    <img
      src={recipe.imageUrls?.[0] || placeholderImage(recipe.id)}
      alt={recipe.title}
      className="w-full h-36 sm:h-40 object-cover"
    />
    <div className="p-3">
      <h3 className="text-sm sm:text-base font-semibold text-gray-800 truncate">{recipe.title}</h3>
      <p className="text-xs sm:text-sm text-gray-600 mt-1 line-clamp-2">{recipe.description}</p>
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
    <div className="max-w-7xl mx-auto px-3 py-3 sm:px-4 sm:py-4">
      <div className="flex justify-between items-center mb-3 sm:mb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">My Recipes</h1>
        <button
          onClick={onOpenModal}
          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
        >
          <PlusIcon className="w-4 h-4" /> <span className="hidden xs:inline">Add Recipe</span><span className="xs:hidden">Add</span>
        </button>
      </div>
      {recipes.length > 0 ? (
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {recipes.map(recipe => (
            <RecipeCard key={recipe.id} recipe={recipe} onSelect={onSelectRecipe} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 sm:py-16 bg-white rounded-lg border border-gray-200">
          <ChefHatIcon className="mx-auto w-12 h-12 sm:w-16 sm:h-16 text-gray-300" />
          <h3 className="mt-3 text-lg sm:text-xl font-semibold text-gray-900">No recipes yet</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by adding your first recipe</p>
        </div>
      )}
    </div>
  );
}
