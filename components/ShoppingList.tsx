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
    <div className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Shopping List</h1>
        {list.length > 0 && (
          <button
            onClick={onClear}
            className="text-sm font-semibold text-red-600 hover:text-red-800"
          >
            Clear All
          </button>
        )}
      </div>
      <div className="bg-white rounded-lg shadow-lg p-6">
        {list.length > 0 ? (
          <div className="space-y-6">
            {Object.entries(groupedList).map(([title, items]) => (
              <div key={title}>
                <h2 className="text-lg font-bold text-emerald-700 border-b pb-2 mb-3">
                  {title}
                </h2>
                <ul className="space-y-2">
                  {items.map((item, index) => (
                    <li key={`${title}-${index}`} className="flex items-center">
                      <input
                        id={`${title}-${index}`}
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <label
                        htmlFor={`${title}-${index}`}
                        className="ml-3 block text-sm text-gray-900"
                      >
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
            <h3 className="mt-2 text-lg font-semibold text-gray-900">
              Your shopping list is empty
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Add ingredients from a recipe to see them here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
