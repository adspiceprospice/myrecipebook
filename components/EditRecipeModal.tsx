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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 className="text-xl font-bold text-gray-800">Edit Recipe</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 transition-colors">
            <XMarkIcon className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        <div className="flex-grow p-6 overflow-y-auto space-y-6">
            {/* Basic Info */}
            <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700">Title</label>
                <input type="text" id="title" value={editedRecipe.title} onChange={e => handleFieldChange('title', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm" />
            </div>
            <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
                <textarea id="description" rows={3} value={editedRecipe.description || ''} onChange={e => handleFieldChange('description', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm" />
            </div>
             <div>
                <label htmlFor="servings" className="block text-sm font-medium text-gray-700">Servings</label>
                <input type="number" id="servings" value={editedRecipe.servings} onChange={e => handleFieldChange('servings', Number(e.target.value))} min="1" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm" />
            </div>
            <div>
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700">Your Notes</label>
                <textarea id="notes" rows={4} value={editedRecipe.notes || ''} onChange={e => handleFieldChange('notes', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm" placeholder="e.g., 'Tried with almonds instead of walnuts, was great!'" />
            </div>

            {/* Image Gallery */}
            <div>
                <h3 className="text-lg font-medium text-gray-800 mb-2">Image Gallery</h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                    {editedRecipe.imageUrls.map((url, i) => (
                        <div key={i} className="relative group aspect-square">
                            <img src={url} alt={`Recipe image ${i+1}`} className="w-full h-full object-cover rounded-md" />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 rounded-md">
                                <button title="Set as primary" onClick={() => handleSetPrimaryImage(i)} className="p-1.5 bg-white/80 rounded-full text-gray-800 hover:bg-white disabled:opacity-50" disabled={i === 0}><StarIcon className="w-4 h-4" solid={i === 0} /></button>
                                <button title="Delete image" onClick={() => handleRemoveItem('imageUrls', i)} className="p-1.5 bg-white/80 rounded-full text-red-600 hover:bg-white"><TrashIcon className="w-4 h-4" /></button>
                            </div>
                        </div>
                    ))}
                </div>
                 <div className="mt-2 flex gap-2">
                    <input type="url" value={newImageUrl} onChange={e => setNewImageUrl(e.target.value)} placeholder="Add new image URL..." className="flex-grow block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm" />
                    <button onClick={handleAddImage} className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-md hover:bg-emerald-200 text-sm font-semibold">Add</button>
                    <button
                      onClick={handleGenerateImage}
                      disabled={isGeneratingImage}
                      className="px-3 py-1 bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      {isGeneratingImage ? (
                        <>
                          <span className="inline-block w-3 h-3 border-2 border-purple-700 border-t-transparent rounded-full animate-spin"></span>
                          Generating...
                        </>
                      ) : (
                        <>✨ Generate</>
                      )}
                    </button>
                </div>
            </div>

            {/* Ingredients */}
            <div>
                <h3 className="text-lg font-medium text-gray-800 mb-2">Ingredients</h3>
                <div className="space-y-2">
                    {editedRecipe.ingredients.map((ing, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <input type="text" value={ing.quantity} onChange={e => handleDynamicChange('ingredients', i, e.target.value, 'quantity')} placeholder="Quantity" className="block w-1/3 rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"/>
                            <input type="text" value={ing.name} onChange={e => handleDynamicChange('ingredients', i, e.target.value, 'name')} placeholder="Name" className="block w-2/3 rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"/>
                            <button onClick={() => handleMoveItem('ingredients', i, 'up')} disabled={i===0} className="p-1 text-gray-500 hover:text-gray-800 disabled:opacity-30"><ArrowUpIcon className="w-4 h-4" /></button>
                            <button onClick={() => handleMoveItem('ingredients', i, 'down')} disabled={i===editedRecipe.ingredients.length-1} className="p-1 text-gray-500 hover:text-gray-800 disabled:opacity-30"><ArrowDownIcon className="w-4 h-4" /></button>
                            <button onClick={() => handleRemoveItem('ingredients', i)} className="p-1 text-red-500 hover:text-red-700"><TrashIcon className="w-5 h-5" /></button>
                        </div>
                    ))}
                </div>
                <button onClick={() => handleAddItem('ingredients')} className="mt-2 flex items-center gap-1 text-sm text-emerald-600 font-semibold hover:text-emerald-800"><PlusIcon className="w-4 h-4"/> Add Ingredient</button>
            </div>

            {/* Instructions */}
            <div>
                <h3 className="text-lg font-medium text-gray-800 mb-2">Instructions</h3>
                <div className="space-y-2">
                     {editedRecipe.instructions.map((step, i) => (
                        <div key={i} className="flex items-start gap-2">
                            <span className="pt-2 font-semibold text-gray-500">{i+1}.</span>
                            <textarea rows={2} value={typeof step === 'string' ? step : step.text} onChange={e => handleDynamicChange('instructions', i, e.target.value)} className="flex-grow block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"/>
                             <div className="flex flex-col">
                                <button onClick={() => handleMoveItem('instructions', i, 'up')} disabled={i===0} className="p-1 text-gray-500 hover:text-gray-800 disabled:opacity-30"><ArrowUpIcon className="w-4 h-4" /></button>
                                <button onClick={() => handleMoveItem('instructions', i, 'down')} disabled={i===editedRecipe.instructions.length-1} className="p-1 text-gray-500 hover:text-gray-800 disabled:opacity-30"><ArrowDownIcon className="w-4 h-4" /></button>
                             </div>
                            <button onClick={() => handleRemoveItem('instructions', i)} className="p-1 text-red-500 hover:text-red-700 mt-1"><TrashIcon className="w-5 h-5" /></button>
                        </div>
                    ))}
                </div>
                <button onClick={() => handleAddItem('instructions')} className="mt-2 flex items-center gap-1 text-sm text-emerald-600 font-semibold hover:text-emerald-800"><PlusIcon className="w-4 h-4"/> Add Step</button>
            </div>
        </div>

        <div className="p-4 bg-gray-50 border-t sticky bottom-0 rounded-b-2xl flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50">Cancel</button>
            <button onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 border border-transparent rounded-md shadow-sm hover:bg-emerald-700">Save Changes</button>
        </div>
      </div>
    </div>
  );
};

export default EditRecipeModal;
