'use client';

import React, { useState } from 'react';
import type { Recipe, Ingredient } from '@/types';
import { XMarkIcon, PlusIcon, TrashIcon, ArrowUpIcon, ArrowDownIcon, StarIcon, CameraIcon } from './icons';

interface EditRecipeModalProps {
  recipe: Recipe;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedRecipe: Recipe) => void;
}

const EditRecipeModal: React.FC<EditRecipeModalProps> = ({ recipe, isOpen, onClose, onSave }) => {
  const [editedRecipe, setEditedRecipe] = useState<Recipe>(JSON.parse(JSON.stringify(recipe)));
  const [newImageUrl, setNewImageUrl] = useState('');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  if (!isOpen) return null;

  const handleFieldChange = (field: keyof Recipe, value: any) => {
    setEditedRecipe(prev => ({ ...prev, [field]: value }));
  };

  const handleDynamicChange = (list: keyof Recipe, index: number, value: any, subField?: keyof Ingredient) => {
    const newList = [...(editedRecipe[list] as any[])];
    if (subField) {
      newList[index] = { ...newList[index], [subField]: value };
    } else {
      newList[index] = value;
    }
    handleFieldChange(list, newList);
  };

  const handleAddItem = (list: keyof Recipe) => {
    const newItem = list === 'ingredients' ? { name: '', quantity: '' } : '';
    handleFieldChange(list, [...(editedRecipe[list] as any[]), newItem]);
  };
  
  const handleRemoveItem = (list: keyof Recipe, index: number) => {
    handleFieldChange(list, (editedRecipe[list] as any[]).filter((_, i) => i !== index));
  };
  
  const handleMoveItem = (list: keyof Recipe, index: number, direction: 'up' | 'down') => {
    const items = [...(editedRecipe[list] as any[])];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= items.length) return;
    [items[index], items[newIndex]] = [items[newIndex], items[index]]; // Swap
    handleFieldChange(list, items);
  };

  const handleAddImage = () => {
      if(newImageUrl && newImageUrl.startsWith('http')) {
          handleFieldChange('imageUrls', [...editedRecipe.imageUrls, newImageUrl]);
          setNewImageUrl('');
      } else {
          alert('Please enter a valid image URL (starting with http/https).')
      }
  };

  const handleGenerateImage = async () => {
    setIsGeneratingImage(true);
    try {
      const response = await fetch(`/api/recipes/${editedRecipe.id}/generate-image`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        // Add the new image URL to the recipe
        handleFieldChange('imageUrls', [...editedRecipe.imageUrls, data.imageUrl]);
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

  const handleSetPrimaryImage = (index: number) => {
      if (index === 0) return;
      const newImageUrls = [...editedRecipe.imageUrls];
      const primaryImage = newImageUrls.splice(index, 1)[0];
      newImageUrls.unshift(primaryImage);
      handleFieldChange('imageUrls', newImageUrls);
  }

  const handleSave = () => {
    onSave(editedRecipe);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-3xl flex flex-col max-h-[95vh] sm:max-h-[90vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-white rounded-t-2xl z-10 flex-shrink-0">
          <h2 className="text-base sm:text-lg font-bold text-gray-800">Edit Recipe</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <XMarkIcon className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="flex-grow px-4 py-3 overflow-y-auto space-y-4">
            {/* Basic Info */}
            <div>
                <label htmlFor="title" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Title</label>
                <input type="text" id="title" value={editedRecipe.title} onChange={e => handleFieldChange('title', e.target.value)} className="block w-full" />
            </div>
            <div>
                <label htmlFor="description" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea id="description" rows={2} value={editedRecipe.description || ''} onChange={e => handleFieldChange('description', e.target.value)} className="block w-full" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                  <label htmlFor="servings" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Servings</label>
                  <input type="number" id="servings" value={editedRecipe.servings} onChange={e => handleFieldChange('servings', Number(e.target.value))} min="1" className="block w-full" />
              </div>
              <div>
                  <label htmlFor="sourceUrl" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Source URL</label>
                  <input type="url" id="sourceUrl" value={editedRecipe.sourceUrl || ''} onChange={e => handleFieldChange('sourceUrl', e.target.value)} className="block w-full" placeholder="https://..." />
              </div>
            </div>
            <div>
                <label htmlFor="notes" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Your Notes</label>
                <textarea id="notes" rows={3} value={editedRecipe.notes || ''} onChange={e => handleFieldChange('notes', e.target.value)} className="block w-full" placeholder="e.g., 'Tried with almonds instead of walnuts, was great!'" />
            </div>

            {/* Image Gallery */}
            <div>
                <h3 className="text-sm sm:text-base font-semibold text-gray-800 mb-2">Image Gallery</h3>
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                    {editedRecipe.imageUrls.map((url, i) => (
                        <div key={i} className="relative group aspect-square">
                            <img src={url} alt={`Recipe image ${i+1}`} className="w-full h-full object-cover rounded-md" />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 rounded-md">
                                <button title="Set as primary" onClick={() => handleSetPrimaryImage(i)} className="p-1 bg-white/90 rounded-full text-gray-800 hover:bg-white disabled:opacity-50" disabled={i === 0}><StarIcon className="w-3 h-3" solid={i === 0} /></button>
                                <button title="Delete image" onClick={() => handleRemoveItem('imageUrls', i)} className="p-1 bg-white/90 rounded-full text-red-600 hover:bg-white"><TrashIcon className="w-3 h-3" /></button>
                            </div>
                        </div>
                    ))}
                </div>
                 <div className="mt-2 flex flex-col sm:flex-row gap-2">
                    <input type="url" value={newImageUrl} onChange={e => setNewImageUrl(e.target.value)} placeholder="Add image URL..." className="flex-grow block w-full" />
                    <div className="flex gap-2">
                      <button onClick={handleAddImage} className="flex-1 sm:flex-none px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 text-xs sm:text-sm font-medium">Add</button>
                      <button
                        onClick={handleGenerateImage}
                        disabled={isGeneratingImage}
                        className="flex-1 sm:flex-none px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 text-xs sm:text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                      >
                        {isGeneratingImage ? (
                          <>
                            <span className="inline-block w-3 h-3 border-2 border-purple-700 border-t-transparent rounded-full animate-spin"></span>
                            <span className="hidden xs:inline">Generating...</span>
                          </>
                        ) : (
                          <>✨ <span className="hidden xs:inline">Generate</span></>
                        )}
                      </button>
                    </div>
                </div>
            </div>

            {/* Ingredients */}
            <div>
                <h3 className="text-sm sm:text-base font-semibold text-gray-800 mb-2">Ingredients</h3>
                <div className="space-y-1.5">
                    {editedRecipe.ingredients.map((ing, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                            <input type="text" value={ing.quantity} onChange={e => handleDynamicChange('ingredients', i, e.target.value, 'quantity')} placeholder="Qty" className="block w-1/3"/>
                            <input type="text" value={ing.name} onChange={e => handleDynamicChange('ingredients', i, e.target.value, 'name')} placeholder="Name" className="block flex-1"/>
                            <div className="flex gap-0.5">
                              <button onClick={() => handleMoveItem('ingredients', i, 'up')} disabled={i===0} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"><ArrowUpIcon className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleMoveItem('ingredients', i, 'down')} disabled={i===editedRecipe.ingredients.length-1} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"><ArrowDownIcon className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleRemoveItem('ingredients', i)} className="p-1 text-red-500 hover:text-red-700"><TrashIcon className="w-3.5 h-3.5" /></button>
                            </div>
                        </div>
                    ))}
                </div>
                <button onClick={() => handleAddItem('ingredients')} className="mt-2 flex items-center gap-1 text-xs sm:text-sm text-emerald-600 font-medium hover:text-emerald-700"><PlusIcon className="w-3.5 h-3.5"/> Add Ingredient</button>
            </div>

            {/* Instructions */}
            <div>
                <h3 className="text-sm sm:text-base font-semibold text-gray-800 mb-2">Instructions</h3>
                <div className="space-y-1.5">
                     {editedRecipe.instructions.map((step, i) => (
                        <div key={i} className="flex items-start gap-1.5">
                            <span className="pt-2 text-xs font-semibold text-gray-500 w-5">{i+1}.</span>
                            <textarea rows={2} value={typeof step === 'string' ? step : step.text} onChange={e => handleDynamicChange('instructions', i, e.target.value)} className="flex-1 block w-full"/>
                            <div className="flex flex-col gap-0.5">
                              <button onClick={() => handleMoveItem('instructions', i, 'up')} disabled={i===0} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"><ArrowUpIcon className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleMoveItem('instructions', i, 'down')} disabled={i===editedRecipe.instructions.length-1} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"><ArrowDownIcon className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleRemoveItem('instructions', i)} className="p-1 text-red-500 hover:text-red-700"><TrashIcon className="w-3.5 h-3.5" /></button>
                            </div>
                        </div>
                    ))}
                </div>
                <button onClick={() => handleAddItem('instructions')} className="mt-2 flex items-center gap-1 text-xs sm:text-sm text-emerald-600 font-medium hover:text-emerald-700"><PlusIcon className="w-3.5 h-3.5"/> Add Step</button>
            </div>
        </div>

        <div className="px-4 py-3 bg-gray-50 border-t sticky bottom-0 rounded-b-2xl flex gap-2 flex-shrink-0">
            <button onClick={onClose} className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
            <button onClick={handleSave} className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors">Save Changes</button>
        </div>
      </div>
    </div>
  );
};

export default EditRecipeModal;
