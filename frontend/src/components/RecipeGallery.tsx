"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import RecipeCard from "@/components/RecipeCard"

export default function RecipeGallery() {
  const [recipes, setRecipes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchGallery() {
      setLoading(true)
      // Fetch recent saved combos from gallery
      const { data: galleryRows, error } = await supabase
        .from("gallery")
        .select("id, recipe_id, grocery_list_id")
        .order("saved_at", { ascending: false })
        .limit(12)

      if (!galleryRows) {
        setRecipes([])
        setLoading(false)
        return
      }

      // For each, fetch the recipe and grocery list
      const recipesWithDetails = await Promise.all(
        galleryRows.map(async (row) => {
          // Fetch recipe
          const { data: recipe } = await supabase
            .from("recipes")
            .select("id, title, image_url, ingredients, prep_time, servings")
            .eq("id", row.recipe_id)
            .single()

          // Fetch grocery list (the one referenced in the gallery row)
          const { data: grocery } = await supabase
            .from("grocery_lists")
            .select("total_price, total_savings")
            .eq("id", row.grocery_list_id)
            .single()

          return {
            gallery_id: row.id,
            id: recipe?.id,
            title: recipe?.title || "Untitled",
            image: recipe?.image_url || "/placeholder.svg",
            prepTime: recipe?.prep_time || "N/A",
            servings: recipe?.servings || 1,
            cost: grocery?.total_price !== null && grocery?.total_price !== undefined
              ? `$${Number(grocery.total_price).toFixed(2)}`
              : "N/A",
            savings: grocery?.total_savings !== null && grocery?.total_savings !== undefined
              ? `$${Number(grocery.total_savings).toFixed(2)}`
              : "$0.00",
            ingredients: Array.isArray(recipe?.ingredients)
              ? recipe.ingredients.map((ing: any) => typeof ing === "string" ? ing : ing.name)
              : [],
          }
        })
      )

      setRecipes(recipesWithDetails)
      setLoading(false)
    }

    fetchGallery()
  }, [])

  if (loading) {
    return <div>Loading...</div>
  }

  if (!recipes.length) {
    return <div>No recipes found.</div>
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {recipes.map((recipe) => (
        <RecipeCard
          key={recipe.gallery_id}
          id={recipe.id}
          title={recipe.title}
          description={recipe.description}
          image={recipe.image}
          prepTime={recipe.prepTime}
          servings={recipe.servings}
          cost={recipe.cost}
          savings={recipe.savings}
          ingredients={recipe.ingredients}
        />
      ))}
    </div>
  )
}

