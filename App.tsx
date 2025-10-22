
import React, { useState, useMemo, useRef } from 'react';
import type { Recipe, AppView, Ingredient, ShoppingListItem } from './types';
import { ChefHatIcon, BookOpenIcon, ShoppingCartIcon, PlusIcon, MicrophoneIcon, SpeakerWaveIcon, XMarkIcon, DocumentTextIcon, PhotoIcon, LinkIcon, VideoCameraIcon, PencilIcon, TrashIcon } from './components/icons';
import Spinner from './components/Spinner';
import CookingAssistant from './components/CookingAssistant';
import EditRecipeModal from './components/EditRecipeModal';
import AddRecipeModal from './components/AddRecipeModal';
import * as gemini from './services/geminiService';
import * as audioUtils from './utils/audioUtils';

// Mock data
const MOCK_RECIPES: Recipe[] = [
    {
        id: '1',
        title: 'Classic Chocolate Chip Cookies',
        description: 'The perfect chewy and soft chocolate chip cookies, a timeless classic for all ages.',
        servings: 24,
        imageUrls: [
            'https://images.unsplash.com/photo-1593231060852-5f34085817a2?q=80&w=800',
            'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?q=80&w=800',
        ],
        notes: "Make sure the butter is properly softened, but not melted, for the best texture. Using a mix of dark and milk chocolate chips is also a great variation.",
        ingredients: [
            { name: 'All-purpose flour', quantity: '2 1/4 cups' },
            { name: 'Baking soda', quantity: '1 tsp' },
            { name: 'Salt', quantity: '1/2 tsp' },
            { name: 'Unsalted butter, softened', quantity: '1 cup' },
            { name: 'Granulated sugar', quantity: '3/4 cup' },
            { name: 'Brown sugar, packed', quantity: '3/4 cup' },
            { name: 'Vanilla extract', quantity: '1 tsp' },
            { name: 'Large eggs', quantity: '2' },
            { name: 'Semi-sweet chocolate chips', quantity: '2 cups' },
        ],
        instructions: [
            'Preheat oven to 375°F (190°C). Line baking sheets with parchment paper.',
            'In a small bowl, whisk together flour, baking soda, and salt.',
            'In a large bowl, beat butter, granulated sugar, and brown sugar with an electric mixer until creamy, about 2-3 minutes.',
            'Beat in vanilla and eggs, one at a time.',
            'Gradually mix in the dry ingredients until just combined. Stir in chocolate chips.',
            'Drop rounded tablespoons of dough onto the prepared baking sheets.',
            'Bake for 10-12 minutes, or until golden brown.',
            'Let cool on the baking sheets for a few minutes before transferring to a wire rack to cool completely.',
        ],
    }
];

const placeholderImage = (id: string) => `https://picsum.photos/seed/${id}/600/400`;

// --- UI Components ---

const Header: React.FC<{ activeView: AppView; onViewChange: (view: AppView) => void; shoppingListCount: number }> = ({ activeView, onViewChange, shoppingListCount }) => (
    <header className="bg-white shadow-md sticky top-0 z-40">
        <nav className="container mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center py-3">
            <div className="flex items-center gap-2">
                <ChefHatIcon className="w-8 h-8 text-emerald-600" />
                <h1 className="text-xl font-bold text-gray-800">Recipe AI Chef</h1>
            </div>
            <div className="flex items-center gap-4">
                <button onClick={() => onViewChange('list')} className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeView === 'list' || activeView === 'recipe' ? 'bg-emerald-100 text-emerald-700' : 'text-gray-600 hover:bg-gray-100'}`}>
                    <BookOpenIcon className="w-5 h-5" />
                    My Recipes
                </button>
                <button onClick={() => onViewChange('shoppingList')} className={`relative flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeView === 'shoppingList' ? 'bg-emerald-100 text-emerald-700' : 'text-gray-600 hover:bg-gray-100'}`}>
                    <ShoppingCartIcon className="w-5 h-5" />
                    Shopping List
                    {shoppingListCount > 0 && <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">{shoppingListCount}</span>}
                </button>
            </div>
        </nav>
    </header>
);

const RecipeCard: React.FC<{ recipe: Recipe; onSelect: (id: string) => void; }> = ({ recipe, onSelect }) => (
    <div onClick={() => onSelect(recipe.id)} className="bg-white rounded-lg shadow-md overflow-hidden cursor-pointer hover:shadow-xl transition-shadow duration-300 group">
        <img src={recipe.imageUrls?.[0] || placeholderImage(recipe.id)} alt={recipe.title} className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300" />
        <div className="p-4">
            <h3 className="text-lg font-bold text-gray-800 truncate">{recipe.title}</h3>
            <p className="text-sm text-gray-600 mt-1 h-10 overflow-hidden">{recipe.description}</p>
        </div>
    </div>
);

const RecipeDetail: React.FC<{ recipe: Recipe; onBack: () => void; onAddToShoppingList: (recipe: Recipe, servings: number) => Promise<void>; onStartAssistant: (recipe: Recipe) => void; onEdit: (id: string) => void; onDelete: (id: string) => void; }> = ({ recipe, onBack, onAddToShoppingList, onStartAssistant, onEdit, onDelete }) => {
    const [servings, setServings] = useState(recipe.servings);
    const [isAdding, setIsAdding] = useState(false);
    const audioRef = useRef<{ctx: AudioContext, source: AudioBufferSourceNode} | null>(null);

    const handlePlayAudio = async (text: string) => {
        if(audioRef.current) {
            audioRef.current.source.stop();
            audioRef.current.ctx.close();
            audioRef.current = null;
            return;
        }

        const audioData = await gemini.textToSpeech(text);
        if (audioData) {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            const decodedBuffer = await audioUtils.decodeAudioData(audioUtils.decode(audioData), ctx, 24000, 1);
            const source = ctx.createBufferSource();
            source.buffer = decodedBuffer;
            source.connect(ctx.destination);
            source.start();
            audioRef.current = {ctx, source};
            source.onended = () => {
                ctx.close();
                audioRef.current = null;
            }
        }
    };

    const handleAddToShoppingList = async () => {
        setIsAdding(true);
        await onAddToShoppingList(recipe, servings);
        setIsAdding(false);
    }
    
    const handleDelete = () => {
        if (window.confirm(`Are you sure you want to delete "${recipe.title}"?`)) {
            onDelete(recipe.id);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
            <button onClick={onBack} className="mb-6 text-emerald-600 hover:text-emerald-800 font-semibold">&larr; Back to Recipes</button>
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <img src={recipe.imageUrls?.[0] || placeholderImage(recipe.id)} alt={recipe.title} className="w-full h-64 sm:h-80 object-cover" />
                {recipe.imageUrls && recipe.imageUrls.length > 1 && (
                    <div className="p-4 bg-gray-50 flex space-x-2 overflow-x-auto">
                        {recipe.imageUrls.map((url, index) => (
                             <img key={index} src={url} alt={`${recipe.title} ${index+1}`} className="w-24 h-24 object-cover rounded-md cursor-pointer border-2 border-transparent hover:border-emerald-500"/>
                        ))}
                    </div>
                )}
                <div className="p-6 md:p-8">
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">{recipe.title}</h1>
                            <p className="mt-2 text-gray-600">{recipe.description}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                           <button onClick={() => onEdit(recipe.id)} className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors" title="Edit Recipe"><PencilIcon /></button>
                           <button onClick={handleDelete} className="p-2 rounded-full text-red-500 hover:bg-red-100 hover:text-red-700 transition-colors" title="Delete Recipe"><TrashIcon /></button>
                        </div>
                    </div>
                    
                    <button onClick={() => onStartAssistant(recipe)} className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white font-semibold rounded-lg shadow-md hover:bg-emerald-600 transition-colors">
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
                            <h2 className="text-xl font-bold text-gray-800 border-b-2 border-emerald-500 pb-2">Ingredients</h2>
                            <ul className="mt-4 space-y-2 text-gray-700">
                                {recipe.ingredients.map((ing, i) => <li key={i}>{ing.quantity} {ing.name}</li>)}
                            </ul>
                            <div className="mt-6">
                                <label htmlFor="servings" className="block text-sm font-medium text-gray-700">Servings</label>
                                <input type="number" id="servings" value={servings} onChange={e => setServings(Number(e.target.value))} min="1" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm" />
                                <button onClick={handleAddToShoppingList} disabled={isAdding} className="mt-3 w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:bg-gray-400">
                                    {isAdding ? 'Adding...' : 'Add to Shopping List'}
                                </button>
                            </div>
                        </div>
                        <div className="md:col-span-2">
                            <h2 className="text-xl font-bold text-gray-800 border-b-2 border-emerald-500 pb-2">Instructions</h2>
                            <ol className="mt-4 space-y-4 text-gray-700">
                                {recipe.instructions.map((step, i) => (
                                    <li key={i} className="flex items-start">
                                        <span className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-emerald-500 text-white font-bold mr-4">{i + 1}</span>
                                        <span className="flex-grow pt-1">{step}</span>
                                        <button onClick={() => handlePlayAudio(step)} className="ml-2 p-1 text-gray-500 hover:text-emerald-600 rounded-full">
                                            <SpeakerWaveIcon className="w-5 h-5"/>
                                        </button>
                                    </li>
                                ))}
                            </ol>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const RecipeList: React.FC<{ recipes: Recipe[]; onSelectRecipe: (id: string) => void; onOpenModal: () => void; }> = ({ recipes, onSelectRecipe, onOpenModal }) => (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-800">My Recipes</h1>
            <button onClick={onOpenModal} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white font-semibold rounded-lg shadow-md hover:bg-emerald-700 transition-colors">
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

const ShoppingList: React.FC<{ list: ShoppingListItem[]; onClear: () => void; }> = ({ list, onClear }) => {
    const groupedList = useMemo(() => {
        return list.reduce((acc, item) => {
            (acc[item.recipeTitle] = acc[item.recipeTitle] || []).push(item);
            return acc;
        }, {} as Record<string, ShoppingListItem[]>);
    }, [list]);

    return (
        <div className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Shopping List</h1>
                {list.length > 0 && <button onClick={onClear} className="text-sm font-semibold text-red-600 hover:text-red-800">Clear All</button>}
            </div>
            <div className="bg-white rounded-lg shadow-lg p-6">
                {list.length > 0 ? (
                    <div className="space-y-6">
                        {Object.entries(groupedList).map(([title, items]) => (
                            <div key={title}>
                                <h2 className="text-lg font-bold text-emerald-700 border-b pb-2 mb-3">{title}</h2>
                                <ul className="space-y-2">
                                    {items.map((item, index) => (
                                        <li key={`${title}-${index}`} className="flex items-center">
                                            <input id={`${title}-${index}`} type="checkbox" className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
                                            <label htmlFor={`${title}-${index}`} className="ml-3 block text-sm text-gray-900">
                                                <span className="font-medium">{item.name}</span> ({item.quantity})
                                            </label>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-10">
                        <ShoppingCartIcon className="mx-auto w-12 h-12 text-gray-300" />
                        <h3 className="mt-2 text-lg font-semibold text-gray-900">Your shopping list is empty</h3>
                        <p className="mt-1 text-sm text-gray-500">Add ingredients from a recipe to see them here.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Main App Component ---

const App: React.FC = () => {
    const [recipes, setRecipes] = useState<Recipe[]>(MOCK_RECIPES);
    const [currentView, setCurrentView] = useState<AppView>('list');
    const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
    const [shoppingList, setShoppingList] = useState<ShoppingListItem[]>([]);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
    const [isLoading, setIsLoading] = useState<{ active: boolean, message: string }>({ active: false, message: '' });
    const [assistantRecipe, setAssistantRecipe] = useState<Recipe | null>(null);
    const [liveLogs, setLiveLogs] = useState<string[]>([]);

    const addLog = (log: string) => setLiveLogs(prev => [...prev, log]);
    const clearLogs = () => setLiveLogs([]);

    const selectedRecipe = useMemo(() => recipes.find(r => r.id === selectedRecipeId), [recipes, selectedRecipeId]);

    const handleSelectRecipe = (id: string) => {
        setSelectedRecipeId(id);
        setCurrentView('recipe');
    };
    
    const handleViewChange = (view: AppView) => {
        if (view === 'list') setSelectedRecipeId(null);
        setCurrentView(view);
    }

    const handleAddRecipe = (newRecipe: Partial<Recipe>) => {
        const completeRecipe: Recipe = {
            id: new Date().toISOString(),
            title: newRecipe.title || 'Untitled Recipe',
            description: newRecipe.description || '',
            servings: newRecipe.servings || 1,
            ingredients: newRecipe.ingredients || [],
            instructions: newRecipe.instructions || [],
            imageUrls: newRecipe.imageUrls || [],
            notes: newRecipe.notes || '',
        };
        setRecipes(prev => [completeRecipe, ...prev]);
        setIsAddModalOpen(false);
        handleSelectRecipe(completeRecipe.id);
    };

    const handleSaveRecipe = (updatedRecipe: Recipe) => {
        setRecipes(prev => prev.map(r => r.id === updatedRecipe.id ? updatedRecipe : r));
        setEditingRecipe(null);
    };

    const handleDeleteRecipe = (id: string) => {
        setRecipes(prev => prev.filter(r => r.id !== id));
        handleViewChange('list');
    }

    const handleAddToShoppingList = async (recipe: Recipe, servings: number) => {
        setIsLoading({ active: true, message: `Adjusting ingredients for ${servings} servings...` });
        let ingredientsToAdd: Ingredient[] = recipe.ingredients;
        if (servings !== recipe.servings) {
            const adjustedIngredients = await gemini.adjustIngredients(recipe.ingredients, recipe.servings, servings);
            if (adjustedIngredients) {
                ingredientsToAdd = adjustedIngredients;
            } else {
                alert("Could not adjust ingredients. Adding original amounts.");
            }
        }
        
        const newItems: ShoppingListItem[] = ingredientsToAdd.map(ing => ({
            ...ing,
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
                return selectedRecipe ? <RecipeDetail 
                            recipe={selectedRecipe} 
                            onBack={() => handleViewChange('list')} 
                            onAddToShoppingList={handleAddToShoppingList}
                            onStartAssistant={setAssistantRecipe}
                            onEdit={() => setEditingRecipe(selectedRecipe)}
                            onDelete={handleDeleteRecipe}
                        /> : null;
            case 'shoppingList':
                return <ShoppingList list={shoppingList} onClear={() => setShoppingList([])} />;
            case 'list':
            default:
                return <RecipeList recipes={recipes} onSelectRecipe={handleSelectRecipe} onOpenModal={() => setIsAddModalOpen(true)} />;
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 font-sans">
            <Header activeView={currentView} onViewChange={handleViewChange} shoppingListCount={shoppingList.length} />
            
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
                <CookingAssistant recipe={assistantRecipe} onClose={() => setAssistantRecipe(null)} />
            )}

            {isLoading.active && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] backdrop-blur-sm">
                    <Spinner message={isLoading.message} />
                </div>
             )}
        </div>
    );
};

export default App;
