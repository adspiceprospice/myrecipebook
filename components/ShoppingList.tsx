'use client';

import React, { useMemo } from 'react';
import type { ShoppingListItem } from '@/types';
import { ShoppingCartIcon } from './icons';

interface ShoppingListProps {
  list: ShoppingListItem[];
  onClear: () => void;
}

export default function ShoppingList({ list, onClear }: ShoppingListProps) {
  const groupedList = useMemo(() => {
    return list.reduce((acc, item) => {
      (acc[item.recipeTitle] = acc[item.recipeTitle] || []).push(item);
      return acc;
    }, {} as Record<string, ShoppingListItem[]>);
  }, [list]);

  return (
    <div className="max-w-2xl mx-auto px-3 py-3 sm:px-4 sm:py-4">
      <div className="flex justify-between items-center mb-3 sm:mb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Shopping List</h1>
        {list.length > 0 && (
          <button
            onClick={onClear}
            className="text-xs sm:text-sm font-medium text-red-600 hover:text-red-700 px-2 py-1 hover:bg-red-50 rounded-lg transition-colors"
          >
            Clear All
          </button>
        )}
      </div>
      <div className="bg-white rounded-lg border border-gray-100 p-4">
        {list.length > 0 ? (
          <div className="space-y-4">
            {Object.entries(groupedList).map(([title, items]) => (
              <div key={title}>
                <h2 className="text-sm sm:text-base font-semibold text-emerald-700 border-b border-emerald-200 pb-1.5 mb-2">
                  {title}
                </h2>
                <ul className="space-y-1.5">
                  {items.map((item, index) => (
                    <li key={`${title}-${index}`} className="flex items-center">
                      <input
                        id={`${title}-${index}`}
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 focus:ring-2"
                      />
                      <label
                        htmlFor={`${title}-${index}`}
                        className="ml-2.5 block text-sm text-gray-900 cursor-pointer"
                      >
                        <span className="font-medium">{item.name}</span> <span className="text-gray-500">({item.quantity})</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 sm:py-12">
            <ShoppingCartIcon className="mx-auto w-10 h-10 sm:w-12 sm:h-12 text-gray-300" />
            <h3 className="mt-3 text-base sm:text-lg font-semibold text-gray-900">
              Your shopping list is empty
            </h3>
            <p className="mt-1 text-xs sm:text-sm text-gray-500">
              Add ingredients from a recipe to see them here
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
