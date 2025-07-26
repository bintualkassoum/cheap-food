"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import RecipeDetailedCard from "@/components/RecipeDetailedCard";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

export default function MealDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [recipe, setRecipe] = useState<any | null>(null);
  const [groceryList, setGroceryList] = useState<any | null>(null);

  useEffect(() => {
    if (!id) return;

    async function fetchRecipeAndGroceryList() {
      // Fetch recipe
      const { data: recipeData } = await supabase
        .from("recipes")
        .select("*")
        .eq("id", id)
        .single();

      setRecipe(recipeData);

      // Fetch grocery list for this recipe
      if (recipeData) {
        const { data: groceryData } = await supabase
          .from("grocery_lists")
          .select("id, store, list_items, total_price, total_savings")
          .eq("recipe_id", id)
          .single();

        if (groceryData) {
          // Process list_items if it's a JSONB field
          let processedListItems = [];
          if (groceryData.list_items) {
            try {
              const parsed = typeof groceryData.list_items === 'string' 
                ? JSON.parse(groceryData.list_items) 
                : groceryData.list_items;
              
              processedListItems = Array.isArray(parsed) 
                ? parsed.map((item: any) => typeof item === "string" ? item : item.name || item.title || "Unknown item")
                : [];
            } catch (e) {
              console.error('Error parsing list_items:', e);
              processedListItems = [];
            }
          }

          setGroceryList({
            store: groceryData.store || "Unknown Store",
            listItems: processedListItems,
            totalPrice: groceryData.total_price ? `$${Number(groceryData.total_price).toFixed(2)}` : "$--",
            totalSavings: groceryData.total_savings ? `$${Number(groceryData.total_savings).toFixed(2)}` : "$0.00"
          });
        }
      }
    }

    fetchRecipeAndGroceryList();
  }, [id]);

  if (!recipe) return <div>Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto py-10">
      <RecipeDetailedCard
        id={recipe.id}
        title={recipe.title}
        description={recipe.description}
        image={recipe.image_url || "/placeholder.svg"}
        prepTime={recipe.prep_time || "N/A"}
        servings={recipe.servings || 1}
        cost={groceryList?.totalPrice || "N/A"}
        savings={groceryList?.totalSavings || "N/A"}
        ingredients={Array.isArray(recipe.ingredients) 
          ? recipe.ingredients.map((ing: any) => typeof ing === "string" ? ing : ing.name) 
          : []
        }
        instructions={Array.isArray(recipe.instructions) 
          ? recipe.instructions.map((inst: any) => typeof inst === "string" ? inst : inst.step || inst.text) 
          : []
        }
        groceryList={groceryList}
      />
    </div>
  );
}