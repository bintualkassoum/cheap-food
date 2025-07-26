"use client"

import Link from "next/link"
import { DollarSign, TrendingDown, Clock, Users } from "lucide-react"

interface RecipeCardProps {
  id: string
  title: string
  description: string
  image: string
  prepTime: string
  servings: number
  cost: string
  savings: string
  ingredients: string[]
}

export default function RecipeCard({
  id,
  title,
  description,
  image,
  prepTime,
  servings,
  cost,
  savings,
  ingredients,
}: RecipeCardProps) {
  return (
    <Link href={`/gallery/meals/${id}`} className="block">
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer">
        {/* Recipe Image */}
        <div className="w-full h-48 bg-gray-100 relative overflow-hidden">
          <img src={image || "/placeholder.svg"} alt={title} className="w-full h-full object-cover rounded-lg" />
          <div className="absolute top-3 right-3 bg-white/90 rounded-full p-2">
            <div className="w-2 h-2 bg-black rounded-full"></div>
          </div>
        </div>

        {/* Recipe Content */}
        <div className="p-4">
          <h3 className="font-bold text-lg text-black mb-3">{title}</h3>

          {/* Recipe Info */}
          <div className="flex items-center gap-4 mb-3 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>{prepTime}</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span>{servings} servings</span>
            </div>
          </div>

          {/* Cost Information */}
          <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-1">
              <DollarSign className="w-4 h-4 text-gray-600" />
              <span className="text-black font-medium">{cost}</span>
            </div>
            <div className="flex items-center gap-1 text-green-600">
              <TrendingDown className="w-4 h-4" />
              <span className="font-medium">{savings}</span>
            </div>
          </div>

          {/* Ingredients Preview */}
          <div>
            <p className="text-sm font-medium text-black mb-2">Key Ingredients:</p>
            <div className="flex flex-wrap gap-1">
              {ingredients.slice(0, 3).map((ingredient, index) => (
                <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                  {ingredient}
                </span>
              ))}
              {ingredients.length > 3 && (
                <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                  +{ingredients.length - 3} more
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
