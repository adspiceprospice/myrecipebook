'use client';

import React, { useState, useMemo, useEffect } from 'react';
import type { Recipe, AppView, Ingredient, ShoppingListItem, Instruction } from '@/types';
import { ChefHatIcon, BookOpenIcon, ShoppingCartIcon, PlusIcon } from './icons';
import Spinner from './Spinner';
import CookingAssistant from './CookingAssistant';
import EditRecipeModal from './EditRecipeModal';
import AddRecipeModal from './AddRecipeModal';
import RecipeDetail from './RecipeDetail';
import RecipeList from './RecipeList';
import ShoppingList from './ShoppingList';

const Header: React.FC<{
  activeView: AppView;
  onViewChange: (view: AppView) => void;
  shoppingListCount: number
}> = ({ activeView, onViewChange, shoppingListCount }) => (
  <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
    <nav className="max-w-7xl mx-auto px-3 sm:px-4 flex justify-between items-center h-14">
      <div className="flex items-center gap-2">
        <ChefHatIcon className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-600" />
        <h1 className="text-base sm:text-lg font-bold text-gray-800">My Recipe Book</h1>
      </div>
      <div className="flex items-center gap-1 sm:gap-2">
        <button
          onClick={() => onViewChange('list')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg text-sm font-medium transition-colors ${
            activeView === 'list' || activeView === 'recipe'
              ? 'bg-emerald-100 text-emerald-700'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <BookOpenIcon className="w-5 h-5" />
          <span className="hidden sm:inline">Recipes</span>
        </button>
        <button
          onClick={() => onViewChange('shoppingList')}
          className={`relative flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg text-sm font-medium transition-colors ${
            activeView === 'shoppingList'
              ? 'bg-emerald-100 text-emerald-700'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <ShoppingCartIcon className="w-5 h-5" />
          <span className="hidden sm:inline">Shopping</span>
          {shoppingListCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
              {shoppingListCount}
            </span>
          )}
        </button>
      </div>
    </nav>
  </header>
);

export default function RecipeApp() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [currentView, setCurrentView] = useState<AppView>('list');
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [shoppingList, setShoppingList] = useState<ShoppingListItem[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [isLoading, setIsLoading] = useState<{ active: boolean, message: string }>({
    active: false,
    message: ''
  });
  const [assistantRecipe, setAssistantRecipe] = useState<Recipe | null>(null);
  const [liveLogs, setLiveLogs] = useState<string[]>([]);

  const addLog = (log: string) => setLiveLogs(prev => [...prev, log]);
  const clearLogs = () => setLiveLogs([]);

  // Fetch recipes on mount
  useEffect(() => {
    fetchRecipes();
  }, []);

  const fetchRecipes = async () => {
    try {
      const response = await fetch('/api/recipes');
      if (response.ok) {
        const data = await response.json();
        // Convert instructions to array of strings
        const formattedRecipes = data.map((recipe: any) => ({
          ...recipe,
          instructions: recipe.instructions
            .sort((a: Instruction, b: Instruction) => a.step - b.step)
            .map((inst: Instruction) => inst.text),
          description: recipe.description || '',
          notes: recipe.notes || '',
        }));
        setRecipes(formattedRecipes);
      }
    } catch (error) {
      console.error('Error fetching recipes:', error);
    }
  };

  const selectedRecipe = useMemo(
    () => recipes.find(r => r.id === selectedRecipeId),
    [recipes, selectedRecipeId]
  );

  const handleSelectRecipe = (id: string) => {
    setSelectedRecipeId(id);
    setCurrentView('recipe');
  };

  const handleViewChange = (view: AppView) => {
    if (view === 'list') setSelectedRecipeId(null);
    setCurrentView(view);
  };

  const handleAddRecipe = async (newRecipe: Partial<Recipe>) => {
    try {
      const response = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newRecipe.title || 'Untitled Recipe',
          description: newRecipe.description || '',
          servings: newRecipe.servings || 1,
          ingredients: newRecipe.ingredients || [],
          instructions: newRecipe.instructions || [],
          imageUrls: newRecipe.imageUrls || [],
          notes: newRecipe.notes || '',
          sourceUrl: newRecipe.sourceUrl || '',
        }),
      });

      if (response.ok) {
        await fetchRecipes();
        setIsAddModalOpen(false);
        const createdRecipe = await response.json();
        handleSelectRecipe(createdRecipe.id);
      }
    } catch (error) {
      console.error('Error adding recipe:', error);
      alert('Failed to add recipe');
    }
  };

  const handleSaveRecipe = async (updatedRecipe: Recipe) => {
    try {
      const response = await fetch(`/api/recipes/${updatedRecipe.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: updatedRecipe.title,
          description: updatedRecipe.description || '',
          servings: updatedRecipe.servings,
          ingredients: updatedRecipe.ingredients,
          instructions: updatedRecipe.instructions,
          imageUrls: updatedRecipe.imageUrls,
          notes: updatedRecipe.notes || '',
          sourceUrl: updatedRecipe.sourceUrl || '',
        }),
      });

      if (response.ok) {
        await fetchRecipes();
        setEditingRecipe(null);
      }
    } catch (error) {
      console.error('Error updating recipe:', error);
      alert('Failed to update recipe');
    }
  };

  const handleDeleteRecipe = async (id: string) => {
    try {
      const response = await fetch(`/api/recipes/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchRecipes();
        handleViewChange('list');
      }
    } catch (error) {
      console.error('Error deleting recipe:', error);
      alert('Failed to delete recipe');
    }
  };

  const handleAddToShoppingList = async (recipe: Recipe, servings: number) => {
    setIsLoading({ active: true, message: `Adjusting ingredients for ${servings} servings...` });

    let ingredientsToAdd: Ingredient[] = recipe.ingredients;

    if (servings !== recipe.servings) {
      try {
        const response = await fetch(`/api/recipes/${recipe.id}/adjust-servings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newServings: servings }),
        });

        if (response.ok) {
          const data = await response.json();
          ingredientsToAdd = data.ingredients;
        } else {
          alert("Could not adjust ingredients. Adding original amounts.");
        }
      } catch (error) {
        console.error('Error adjusting ingredients:', error);
        alert("Could not adjust ingredients. Adding original amounts.");
      }
    }

    const newItems: ShoppingListItem[] = ingredientsToAdd.map(ing => ({
      name: ing.name,
      quantity: ing.quantity,
      recipeTitle: recipe.title
    }));

    setShoppingList(prev => [...prev, ...newItems]);
    alert(`${newItems.length} items added to your shopping list!`);
    setIsLoading({ active: false, message: '' });
    setCurrentView('shoppingList');
  };

  const renderContent = () => {
    switch (currentView) {
      case 'recipe':
        return selectedRecipe ? (
          <RecipeDetail
            recipe={selectedRecipe}
            onBack={() => handleViewChange('list')}
            onAddToShoppingList={handleAddToShoppingList}
            onStartAssistant={setAssistantRecipe}
            onEdit={() => setEditingRecipe(selectedRecipe)}
            onDelete={handleDeleteRecipe}
          />
        ) : null;
      case 'shoppingList':
        return <ShoppingList list={shoppingList} onClear={() => setShoppingList([])} />;
      case 'list':
      default:
        return (
          <RecipeList
            recipes={recipes}
            onSelectRecipe={handleSelectRecipe}
            onOpenModal={() => setIsAddModalOpen(true)}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 font-sans">
      <Header
        activeView={currentView}
        onViewChange={handleViewChange}
        shoppingListCount={shoppingList.length}
      />

      <main>
        {renderContent()}
      </main>

      <AddRecipeModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddRecipe={handleAddRecipe}
        liveLogs={liveLogs}
        addLog={addLog}
        clearLogs={clearLogs}
      />

      {editingRecipe && (
        <EditRecipeModal
          isOpen={!!editingRecipe}
          recipe={editingRecipe}
          onClose={() => setEditingRecipe(null)}
          onSave={handleSaveRecipe}
        />
      )}

      {assistantRecipe && (
        <CookingAssistant
          recipe={assistantRecipe}
          onClose={() => setAssistantRecipe(null)}
        />
      )}

      {isLoading.active && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] backdrop-blur-sm">
          <Spinner message={isLoading.message} />
        </div>
      )}
    </div>
  );
}
