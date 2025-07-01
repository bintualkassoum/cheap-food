"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

type GroceryListItem = {
  name: string;
  qty?: string;
  price?: number;
  is_on_sale?: boolean;
  savings?: string;
};

type GroceryList = {
  id: string;
  store?: string;
  total_price?: number;
  total_savings?: number;
  list_items?: GroceryListItem[];
  recommendation_rank?: number;
};

type Recipe = {
  id: string;
  title: string;
  description?: string;
  ingredients: any[];
  instructions: string;
  created_at: string;
};

type SavedRecipe = {
  id: string;
  recipe: Recipe;
  grocery_lists: GroceryList[];
  saved_at: string;
};

export default function GalleryPage() {
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteStatus, setDeleteStatus] = useState<string | null>(null);
  const [user, setUser] = useState<any | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        fetchSavedRecipes(user.id);
      }
    };
    getUser();
  }, []);

  async function fetchSavedRecipes(userId: string) {
    setLoading(true);
    setDeleteStatus(null);
    
    try {
      // Get saved recipes
      const { data: savedRecipesData, error } = await supabase
        .from("saved_recipes")
        .select(`
          id,
          saved_at,
          recipe:recipes (
            id,
            title,
            description,
            ingredients,
            instructions,
            created_at
          )
        `)
        .eq("user_id", userId)
        .order("saved_at", { ascending: false });

      if (error) {
        console.error("Error fetching saved recipes:", error);
        setSavedRecipes([]);
        return;
      }

      // For each saved recipe, get its grocery lists
      const recipesWithGroceryLists = await Promise.all(
        savedRecipesData.map(async (savedRecipe) => {
          // Fix: Handle the case where recipe might be an array
          const recipeData = Array.isArray(savedRecipe.recipe) 
            ? savedRecipe.recipe[0] 
            : savedRecipe.recipe;
          
          if (!recipeData || !recipeData.id) {
            console.error("Invalid recipe data:", savedRecipe);
            return null;
          }

          const { data: groceryLists } = await supabase
            .from("grocery_lists")
            .select("*")
            .eq("recipe_id", recipeData.id)
            .order("recommendation_rank");

          return {
            id: savedRecipe.id,
            saved_at: savedRecipe.saved_at,
            recipe: recipeData,
            grocery_lists: groceryLists || []
          };
        })
      );

      // Filter out null values and set state
      const validRecipes = recipesWithGroceryLists.filter(recipe => recipe !== null) as SavedRecipe[];
      setSavedRecipes(validRecipes);
    } catch (error) {
      console.error("Error fetching gallery:", error);
      setSavedRecipes([]);
    }
    
    setLoading(false);
  }

  async function handleDelete(savedRecipeId: string) {
    setDeleteStatus(null);
    
    try {
      const { error } = await supabase
        .from("saved_recipes")
        .delete()
        .eq("id", savedRecipeId);

      if (error) {
        setDeleteStatus("Failed to delete. Try again.");
        return;
      }

      setDeleteStatus("Deleted!");
      if (user) {
        fetchSavedRecipes(user.id);
      }
    } catch (error) {
      setDeleteStatus("Failed to delete. Try again.");
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 text-xl">
        Loading...
      </div>
    );
  }

  if (!savedRecipes.length) {
    return (
      <div className="flex justify-center items-center h-64 text-xl">
        No saved recipes yet.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-10">
      <h1 className="text-3xl font-bold mb-8 text-center">My Saved Recipes</h1>
      
      {deleteStatus && (
        <Alert className="mb-6" variant={deleteStatus === "Deleted!" ? "default" : "destructive"}>
          <AlertTitle>{deleteStatus === "Deleted!" ? "Success" : "Error"}</AlertTitle>
          <AlertDescription>{deleteStatus}</AlertDescription>
        </Alert>
      )}
      
      <div className="grid gap-6">
        {savedRecipes.map((savedRecipe) => (
          <Card key={savedRecipe.id} className="border shadow-lg">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-semibold text-xl mb-2">
                    {savedRecipe.recipe.title}
                  </h3>
                  {savedRecipe.recipe.description && (
                    <p className="text-gray-600 mb-2">
                      {savedRecipe.recipe.description}
                    </p>
                  )}
                  <p className="text-sm text-gray-500">
                    Saved on {new Date(savedRecipe.saved_at).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(savedRecipe.id)}
                >
                  Delete
                </Button>
              </div>

              {/* Recipe Details */}
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div>
                  <h4 className="font-medium mb-2">Ingredients:</h4>
                  <ul className="list-disc pl-5 text-sm space-y-1">
                    {Array.isArray(savedRecipe.recipe.ingredients)
                      ? savedRecipe.recipe.ingredients.map((ing: any, i: number) => (
                          <li key={i}>
                            {typeof ing === "string" ? ing : `${ing.name}${ing.amount ? ` (${ing.amount})` : ""}`}
                          </li>
                        ))
                      : <li>No ingredients listed</li>
                    }
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Instructions:</h4>
                  <div className="text-sm text-gray-700 whitespace-pre-line">
                    {savedRecipe.recipe.instructions}
                  </div>
                </div>
              </div>

              {/* Grocery Lists */}
              {savedRecipe.grocery_lists.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3">Grocery Recommendations:</h4>
                  <div className="grid gap-3">
                    {savedRecipe.grocery_lists.map((list, idx) => (
                      <div key={list.id} className="border rounded-lg p-3 bg-gray-50">
                        <div className="flex justify-between items-center mb-2">
                          <div>
                            <span className="font-medium">{list.store}</span>
                            <span className="text-sm text-gray-500 ml-2">
                              (Rank #{list.recommendation_rank || idx + 1})
                            </span>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-green-700">
                              ${list.total_price?.toFixed(2) || "N/A"}
                            </div>
                            {list.total_savings && list.total_savings > 0 && (
                              <div className="text-sm text-green-600">
                                Save ${list.total_savings.toFixed(2)}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium">Items:</span>
                            <ul className="mt-1 space-y-1">
                              {list.list_items?.slice(0, 5).map((item: any, i: number) => (
                                <li key={i} className="flex justify-between">
                                  <span>{item.name}</span>
                                  <span className="text-gray-600">
                                    {item.price ? `$${item.price}` : "N/A"}
                                  </span>
                                </li>
                              ))}
                              {list.list_items && list.list_items.length > 5 && (
                                <li className="text-gray-500">
                                  +{list.list_items.length - 5} more items
                                </li>
                              )}
                            </ul>
                          </div>
                          <div>
                            <span className="font-medium">On Sale:</span>
                            <div className="mt-1">
                              {list.list_items && list.list_items.filter((item: any) => item.is_on_sale).length > 0 ? (
                                list.list_items
                                  .filter((item: any) => item.is_on_sale)
                                  .slice(0, 3)
                                  .map((item: any, i: number) => (
                                    <div key={i} className="text-green-600 text-sm">
                                      {item.name} -{item.savings}
                                    </div>
                                  ))
                              ) : (
                                <span className="text-gray-500 text-sm">No items on sale</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
