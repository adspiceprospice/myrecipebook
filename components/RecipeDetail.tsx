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
    <div className="max-w-4xl mx-auto px-3 py-3 sm:px-4 sm:py-4">
      <button
        onClick={onBack}
        className="mb-3 text-emerald-600 hover:text-emerald-700 text-sm font-medium flex items-center gap-1"
      >
        &larr; Back
      </button>
      <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-100">
        <img
          src={recipe.imageUrls?.[0] || placeholderImage(recipe.id)}
          alt={recipe.title}
          className="w-full h-48 sm:h-64 object-cover"
        />
        {recipe.imageUrls && recipe.imageUrls.length > 1 && (
          <div className="p-2 sm:p-3 bg-gray-50 flex gap-2 overflow-x-auto">
            {recipe.imageUrls.map((url, index) => (
              <img
                key={index}
                src={url}
                alt={`${recipe.title} ${index + 1}`}
                className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-md cursor-pointer border-2 border-transparent hover:border-emerald-500 flex-shrink-0"
              />
            ))}
          </div>
        )}
        <div className="p-4 sm:p-5">
          <div className="flex justify-between items-start gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                {recipe.title}
              </h1>
              <p className="mt-1.5 text-sm sm:text-base text-gray-600">{recipe.description}</p>
              {(recipe.sourceUrl || recipe.createdAt) && (
                <div className="mt-2 space-y-0.5 text-xs sm:text-sm text-gray-500">
                  {recipe.createdAt && (
                    <div>
                      Added: {new Date(recipe.createdAt).toLocaleDateString()}
                    </div>
                  )}
                  {recipe.sourceUrl && (
                    <div className="truncate">
                      Source: <a
                        href={recipe.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-600 hover:text-emerald-700 hover:underline"
                      >
                        {new URL(recipe.sourceUrl).hostname}
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => onEdit(recipe.id)}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"
                title="Edit Recipe"
              >
                <PencilIcon className="w-5 h-5" />
              </button>
              <button
                onClick={handleDelete}
                className="p-2 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors"
                title="Delete Recipe"
              >
                <TrashIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          <button
            onClick={() => onStartAssistant(recipe)}
            className="mt-3 inline-flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <MicrophoneIcon className="w-4 h-4" /> Start Cooking Assistant
          </button>

          {recipe.notes && (
            <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <h3 className="font-semibold text-sm text-amber-900">My Notes</h3>
              <p className="mt-1.5 text-sm text-amber-700 whitespace-pre-wrap">{recipe.notes}</p>
            </div>
          )}

          <div className="mt-5 space-y-5">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-800 border-b-2 border-emerald-500 pb-1.5 mb-3">
                Ingredients
              </h2>
              <ul className="space-y-1.5 text-sm text-gray-700">
                {recipe.ingredients.map((ing, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-gray-400">•</span>
                    <span>{ing.quantity} {ing.name}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <label htmlFor="servings" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Servings
                </label>
                <input
                  type="number"
                  id="servings"
                  value={servings}
                  onChange={e => setServings(Number(e.target.value))}
                  min="1"
                  className="block w-full"
                />
                <button
                  onClick={handleAddToShoppingList}
                  disabled={isAdding}
                  className="mt-2 w-full inline-flex justify-center items-center px-3 py-2 text-sm font-medium rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 transition-colors"
                >
                  {isAdding ? 'Adding...' : 'Add to Shopping List'}
                </button>
              </div>
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-800 border-b-2 border-emerald-500 pb-1.5 mb-3">
                Instructions
              </h2>
              <ol className="space-y-3">
                {recipe.instructions.map((step, i) => {
                  const stepText = typeof step === 'string' ? step : step.text;
                  return (
                    <li key={i} className="flex items-start gap-3">
                      <span className="flex-shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-emerald-600 text-white text-xs font-bold">
                        {i + 1}
                      </span>
                      <span className="flex-1 text-sm text-gray-700 pt-0.5">{stepText}</span>
                      <button
                        onClick={() => handlePlayAudio(stepText)}
                        className="flex-shrink-0 p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <SpeakerWaveIcon className="w-4 h-4" />
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
