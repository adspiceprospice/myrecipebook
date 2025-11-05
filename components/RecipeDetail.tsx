'use client';

import React, { useState, useRef } from 'react';
import type { Recipe } from '@/types';
import { MicrophoneIcon, SpeakerWaveIcon, PencilIcon, TrashIcon } from './icons';

const placeholderImage = (id: string) => `https://picsum.photos/seed/${id}/600/400`;

interface RecipeDetailProps {
  recipe: Recipe;
  onBack: () => void;
  onAddToShoppingList: (recipe: Recipe, servings: number) => Promise<void>;
  onStartAssistant: (recipe: Recipe) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onRecipeUpdate: (updatedRecipe: Recipe) => void;
}

export default function RecipeDetail({
  recipe,
  onBack,
  onAddToShoppingList,
  onStartAssistant,
  onEdit,
  onDelete,
  onRecipeUpdate,
}: RecipeDetailProps) {
  const [servings, setServings] = useState(recipe.servings);
  const [isAdding, setIsAdding] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const audioRef = useRef<{ ctx: AudioContext, source: AudioBufferSourceNode } | null>(null);

  const handlePlayAudio = async (text: string) => {
    if (audioRef.current) {
      audioRef.current.source.stop();
      audioRef.current.ctx.close();
      audioRef.current = null;
      return;
    }

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (response.ok) {
        const { audio: audioData } = await response.json();
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({
          sampleRate: 24000
        });

        // Decode base64 to ArrayBuffer
        const binaryString = atob(audioData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Decode audio data
        const decodedBuffer = await ctx.decodeAudioData(bytes.buffer);
        const source = ctx.createBufferSource();
        source.buffer = decodedBuffer;
        source.connect(ctx.destination);
        source.start();
        audioRef.current = { ctx, source };
        source.onended = () => {
          ctx.close();
          audioRef.current = null;
        };
      }
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  };

  const handleAddToShoppingList = async () => {
    setIsAdding(true);
    await onAddToShoppingList(recipe, servings);
    setIsAdding(false);
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete "${recipe.title}"?`)) {
      onDelete(recipe.id);
    }
  };

  const handleGenerateImage = async () => {
    if (isGeneratingImage) return;

    setIsGeneratingImage(true);
    try {
      const response = await fetch(`/api/recipes/${recipe.id}/generate-image`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        // Update the recipe with the new image
        const updatedRecipe = {
          ...recipe,
          imageUrls: data.recipe.imageUrls,
        };
        onRecipeUpdate(updatedRecipe);
      } else {
        const error = await response.json();
        alert(`Failed to generate image: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error generating image:', error);
      alert('Failed to generate image. Please try again.');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
      <button
        onClick={onBack}
        className="mb-6 text-emerald-600 hover:text-emerald-800 font-semibold"
      >
        &larr; Back to Recipes
      </button>
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <img
          src={recipe.imageUrls?.[0] || placeholderImage(recipe.id)}
          alt={recipe.title}
          className="w-full h-64 sm:h-80 object-cover"
        />
        {recipe.imageUrls && recipe.imageUrls.length > 1 && (
          <div className="p-4 bg-gray-50 flex space-x-2 overflow-x-auto">
            {recipe.imageUrls.map((url, index) => (
              <img
                key={index}
                src={url}
                alt={`${recipe.title} ${index + 1}`}
                className="w-24 h-24 object-cover rounded-md cursor-pointer border-2 border-transparent hover:border-emerald-500"
              />
            ))}
          </div>
        )}
        <div className="p-4 bg-gray-50 border-t">
          <button
            onClick={handleGenerateImage}
            disabled={isGeneratingImage}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-lg shadow-md hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title="Generate a new AI image for this recipe"
          >
            {isGeneratingImage ? (
              <>
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating Image...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                ✨ Generate AI Image
              </>
            )}
          </button>
        </div>
        <div className="p-6 md:p-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
                {recipe.title}
              </h1>
              <p className="mt-2 text-gray-600">{recipe.description}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-4">
              <button
                onClick={() => onEdit(recipe.id)}
                className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"
                title="Edit Recipe"
              >
                <PencilIcon />
              </button>
              <button
                onClick={handleDelete}
                className="p-2 rounded-full text-red-500 hover:bg-red-100 hover:text-red-700 transition-colors"
                title="Delete Recipe"
              >
                <TrashIcon />
              </button>
            </div>
          </div>

          <button
            onClick={() => onStartAssistant(recipe)}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white font-semibold rounded-lg shadow-md hover:bg-emerald-600 transition-colors"
          >
            <MicrophoneIcon /> Start Cooking Assistant
          </button>

          {recipe.notes && (
            <div className="mt-8 p-4 bg-amber-50 rounded-lg">
              <h3 className="font-bold text-amber-800">My Notes</h3>
              <p className="mt-2 text-amber-700 whitespace-pre-wrap">{recipe.notes}</p>
            </div>
          )}

          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-1">
              <h2 className="text-xl font-bold text-gray-800 border-b-2 border-emerald-500 pb-2">
                Ingredients
              </h2>
              <ul className="mt-4 space-y-2 text-gray-700">
                {recipe.ingredients.map((ing, i) => (
                  <li key={i}>
                    {ing.quantity} {ing.name}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <label htmlFor="servings" className="block text-sm font-medium text-gray-700">
                  Servings
                </label>
                <input
                  type="number"
                  id="servings"
                  value={servings}
                  onChange={e => setServings(Number(e.target.value))}
                  min="1"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
                />
                <button
                  onClick={handleAddToShoppingList}
                  disabled={isAdding}
                  className="mt-3 w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:bg-gray-400"
                >
                  {isAdding ? 'Adding...' : 'Add to Shopping List'}
                </button>
              </div>
            </div>
            <div className="md:col-span-2">
              <h2 className="text-xl font-bold text-gray-800 border-b-2 border-emerald-500 pb-2">
                Instructions
              </h2>
              <ol className="mt-4 space-y-4 text-gray-700">
                {recipe.instructions.map((step, i) => {
                  const stepText = typeof step === 'string' ? step : step.text;
                  return (
                    <li key={i} className="flex items-start">
                      <span className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-emerald-500 text-white font-bold mr-4">
                        {i + 1}
                      </span>
                      <span className="flex-grow pt-1">{stepText}</span>
                      <button
                        onClick={() => handlePlayAudio(stepText)}
                        className="ml-2 p-1 text-gray-500 hover:text-emerald-600 rounded-full"
                      >
                        <SpeakerWaveIcon className="w-5 h-5" />
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
