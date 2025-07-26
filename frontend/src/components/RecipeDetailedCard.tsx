"use client"

import Link from "next/link"
import { DollarSign, TrendingDown, Clock, Users, ArrowLeft } from "lucide-react"

interface RecipeDetailedCardProps {
  id: string
  title: string
  description: string
  image: string
  prepTime: string
  servings: number
  cost: string
  savings: string
  ingredients: string[]
  instructions: string[]
  groceryList?: {
    store: string
    listItems: string[]
    totalPrice: string
    totalSavings: string
  }
}

export default function RecipeDetailedCard({
  id,
  title,
  description,
  image,
  prepTime,
  servings,
  cost,
  savings,
  ingredients,
  instructions,
  groceryList,
}: RecipeDetailedCardProps) {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Back Button */}
      <Link 
        href="/gallery/meals" 
        className="inline-flex items-center gap-2 text-gray-600 hover:text-black mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Gallery
      </Link>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
        {/* Recipe Header */}
        <div className="relative h-64 md:h-80">
          <img 
            src={image || "/placeholder.svg"} 
            alt={title} 
            className="w-full h-full object-cover" 
          />
          <div className="absolute inset-0 bg-black/20"></div>
          <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
            <h1 className="text-3xl font-bold mb-2">{title}</h1>
            {description && (
              <p className="text-lg opacity-90">{description}</p>
            )}
          </div>
        </div>

        <div className="p-6">
          {/* Recipe Info */}
          <div className="flex items-center gap-6 mb-6 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              <span>{prepTime}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              <span>{servings} servings</span>
            </div>
          </div>

          {/* Cost Information */}
          <div className="flex items-center justify-between mb-8 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-gray-600" />
              <span className="text-xl text-black font-medium">{cost}</span>
            </div>
            <div className="flex items-center gap-2 text-green-600">
              <TrendingDown className="w-5 h-5" />
              <span className="text-xl font-medium">{savings}</span>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Ingredients */}
            <div>
              <h2 className="text-xl font-bold text-black mb-4">Ingredients</h2>
              <ul className="space-y-2">
                {ingredients.map((ingredient, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-gray-400 mr-3 mt-1">•</span>
                    <span className="text-gray-700">{ingredient}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Instructions */}
            <div>
              <h2 className="text-xl font-bold text-black mb-4">Instructions</h2>
              <ol className="space-y-3">
                {instructions.map((instruction, index) => (
                  <li key={index} className="flex">
                    <span className="text-gray-400 mr-3 font-medium min-w-[20px]">
                      {index + 1}.
                    </span>
                    <span className="text-gray-700">{instruction}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* Grocery List */}
          {groceryList && (
            <div className="mt-8 p-6 bg-blue-50 rounded-lg">
              <h2 className="text-xl font-bold text-black mb-4">Grocery List</h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-medium text-black mb-2">Store: {groceryList.store}</h3>
                  <ul className="space-y-1">
                    {groceryList.listItems.map((item, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-gray-400 mr-2">•</span>
                        <span className="text-gray-700">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-gray-600" />
                    <span className="text-lg text-black font-medium">
                      {groceryList.totalPrice}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-green-600">
                    <TrendingDown className="w-5 h-5" />
                    <span className="text-lg font-medium">
                      {groceryList.totalSavings}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 