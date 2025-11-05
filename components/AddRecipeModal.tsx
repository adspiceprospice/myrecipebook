'use client';

import React, { useState, useRef } from 'react';
import type { Recipe } from '@/types';
import * as fileUtils from '@/utils/fileUtils';
import { XMarkIcon, DocumentTextIcon, PhotoIcon, LinkIcon, VideoCameraIcon } from './icons';

interface AddRecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddRecipe: (recipe: Partial<Recipe>) => void;
  liveLogs: string[];
  addLog: (log: string) => void;
  clearLogs: () => void;
}

const SpinnerInline = () => (
    <>
        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Generating...
    </>
);


const AddRecipeModal: React.FC<AddRecipeModalProps> = ({ isOpen, onClose, onAddRecipe, liveLogs, addLog, clearLogs }) => {
    const [activeTab, setActiveTab] = useState<'text' | 'image' | 'url' | 'youtube'>('text');
    const [text, setText] = useState('');
    const [url, setUrl] = useState('');
    const [youtubeUrl, setYoutubeUrl] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleClose = () => {
        if (isGenerating) return;
        clearLogs();
        onClose();
    }

    const handleAdd = async (recipePromise: Promise<Partial<Recipe> | null>) => {
        setIsGenerating(true);
        try {
            const recipe = await recipePromise;
            if (recipe) {
                addLog('✅ Recipe generation complete!');
                setTimeout(() => {
                    onAddRecipe(recipe);
                }, 1000);
            } else {
                addLog('❌ Could not generate a recipe. The AI might not have understood the input. Please try again or use a different method.');
            }
        } catch (error) {
            console.error("Failed to generate recipe:", error);
            const errorMessage = `An error occurred: ${(error as Error).message}`;
            addLog(`❌ ${errorMessage}`);
        } finally {
            setIsGenerating(false);
        }
    };
    
    const generateRecipe = async (type: string, content: string, mimeType?: string, base64Image?: string): Promise<Partial<Recipe> | null> => {
        try {
            const response = await fetch('/api/recipes/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, content, mimeType, base64Image }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to generate recipe');
            }

            return await response.json();
        } catch (error) {
            console.error('Error generating recipe:', error);
            throw error;
        }
    };

    const handleTextSubmit = () => {
        if (!text) return;
        clearLogs();
        addLog("Structuring your recipe...");
        handleAdd(generateRecipe('text', text));
    };

    const handleUrlSubmit = () => {
        if (!url) return;
        clearLogs();
        addLog("Fetching recipe from URL...");
        handleAdd(generateRecipe('url', url));
    };

    const handleYoutubeSubmit = () => {
        if (!youtubeUrl) return;
        clearLogs();
        addLog("Generating recipe from YouTube video...");
        handleAdd(generateRecipe('url', youtubeUrl));
    };

    const handleFileSubmit = async (file: File) => {
        if (!file) return;
        clearLogs();
        addLog(`Analyzing image...`);
        const base64 = await fileUtils.fileToBase64(file);
        handleAdd(generateRecipe('image', '', file.type, base64));
    };

    const tabs = [
        { id: 'text', icon: DocumentTextIcon, label: 'From Text' },
        { id: 'image', icon: PhotoIcon, label: 'From Image' },
        { id: 'url', icon: LinkIcon, label: 'From URL' },
        { id: 'youtube', icon: VideoCameraIcon, label: 'From YouTube' },
    ];
    
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col">
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-lg font-bold text-gray-800">Add a New Recipe</h2>
                    <button onClick={handleClose} className="p-2 rounded-full hover:bg-gray-200 transition-colors disabled:opacity-50" disabled={isGenerating}>
                        <XMarkIcon className="w-6 h-6 text-gray-600" />
                    </button>
                </div>
                <fieldset disabled={isGenerating}>
                    <div className="p-6">
                        <div className="border-b border-gray-200 mb-4">
                            <nav className="-mb-px flex space-x-4 overflow-x-auto" aria-label="Tabs">
                                {tabs.map(tab => (
                                    <button key={tab.id} onClick={() => { setActiveTab(tab.id as any); clearLogs(); }}
                                        className={`whitespace-nowrap flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm ${activeTab === tab.id ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                                        <tab.icon className="w-5 h-5"/> {tab.label}
                                    </button>
                                ))}
                            </nav>
                        </div>

                        {activeTab === 'text' && (
                            <div className="space-y-3">
                                <label htmlFor="recipe-text" className="text-sm font-medium text-gray-700">Paste your recipe text below:</label>
                                <textarea id="recipe-text" rows={10} value={text} onChange={e => setText(e.target.value)} className="w-full p-2 border rounded-md focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-gray-100" placeholder="e.g., 2 cups flour, 1 cup sugar... mix and bake at 350F for 20 minutes."></textarea>
                                <button onClick={handleTextSubmit} className="w-full py-2 px-4 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 font-semibold flex items-center justify-center disabled:bg-emerald-400 disabled:cursor-not-allowed">
                                    {isGenerating ? <SpinnerInline/> : 'Generate Recipe'}
                                </button>
                            </div>
                        )}
                        {activeTab === 'image' && (
                            <div className="space-y-3 text-center">
                                <p className="text-sm text-gray-600">Upload an image of a dish and let AI create the recipe for you.</p>
                                <input type="file" ref={fileInputRef} hidden accept='image/*' onChange={(e) => e.target.files && handleFileSubmit(e.target.files[0])} />
                                <button onClick={() => fileInputRef.current?.click()} className="w-full py-2 px-4 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 font-semibold flex items-center justify-center disabled:bg-emerald-400 disabled:cursor-not-allowed">
                                    {isGenerating ? <SpinnerInline/> : 'Select Image File'}
                                </button>
                            </div>
                        )}
                        {activeTab === 'url' && (
                            <div className="space-y-3">
                                <label htmlFor="recipe-url" className="text-sm font-medium text-gray-700">Enter a URL to a recipe page:</label>
                                <input type="url" id="recipe-url" value={url} onChange={e => setUrl(e.target.value)} className="w-full p-2 border rounded-md focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-gray-100" placeholder="https://example.com/best-cookies-ever" />
                                <button onClick={handleUrlSubmit} className="w-full py-2 px-4 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 font-semibold flex items-center justify-center disabled:bg-emerald-400 disabled:cursor-not-allowed">
                                    {isGenerating ? <SpinnerInline/> : 'Fetch Recipe'}
                                </button>
                            </div>
                        )}
                        {activeTab === 'youtube' && (
                            <div className="space-y-3">
                                <label htmlFor="youtube-url" className="text-sm font-medium text-gray-700">Enter a YouTube video URL:</label>
                                <input type="url" id="youtube-url" value={youtubeUrl} onChange={e => setYoutubeUrl(e.target.value)} className="w-full p-2 border rounded-md focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-gray-100" placeholder="https://www.youtube.com/watch?v=..." />
                                <button onClick={handleYoutubeSubmit} className="w-full py-2 px-4 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 font-semibold flex items-center justify-center disabled:bg-emerald-400 disabled:cursor-not-allowed">
                                    {isGenerating ? <SpinnerInline/> : 'Generate from YouTube'}
                                </button>
                            </div>
                        )}
                    </div>
                </fieldset>

                {liveLogs.length > 0 && (
                     <div className="px-6 pb-6">
                        <div className="bg-gray-900 text-white rounded-lg p-3 font-mono text-xs max-h-32 overflow-y-auto">
                            {liveLogs.map((log, index) => (
                                <p key={index} className="whitespace-pre-wrap animate-fade-in">{`> ${log}`}</p>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AddRecipeModal;
