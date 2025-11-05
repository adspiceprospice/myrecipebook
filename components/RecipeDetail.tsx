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
}

export default function RecipeDetail({
  recipe,
  onBack,
  onAddToShoppingList,
  onStartAssistant,
  onEdit,
  onDelete,
}: RecipeDetailProps) {
  const [servings, setServings] = useState(recipe.servings);
  const [isAdding, setIsAdding] = useState(false);
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
