"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [recipe, setRecipe] = useState<any | null>(null);
  const [groceryLists, setGroceryLists] = useState<any[]>([]); 
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [recipeSaved, setRecipeSaved] = useState(false);
  const [savedLists, setSavedLists] = useState<string[]>([]);
  const [justSaved, setJustSaved] = useState<string | null>(null);
  const [alreadySaved, setAlreadySaved] = useState(false);

  const PANTRY_ITEMS = [
    "salt",
    "black pepper",
    "olive oil",
    "vegetable oil",
    "canola oil",
    "cooking oil",
    "sugar",
    "flour"
  ];

  interface Ingredient {
    name: string;
    amount?: string;
  }

  function isPantryItem(name: string) {
    return PANTRY_ITEMS.some(pantry =>
      (name || "").toLowerCase().includes(pantry)
    );
  }

  useEffect(() => {
    async function checkAlreadySaved() {
      if (!user || !recipe || !groceryLists.length) return;
      const { data: existing } = await supabase
        .from("gallery")
        .select("id")
        .eq("user_id", user.id)
        .eq("recipe_id", recipe.id)
        .eq("grocery_list_id", groceryLists[0].id)
        .single();
      setAlreadySaved(!!existing);
    }
    checkAlreadySaved();
  }, [user, recipe, groceryLists]);

  async function handleUpload() {
    setMessage(null);
    setError(null);
    setRecipe(null);
    setGroceryLists([]);
    setLoading(true);

    if (!file) {
      setError("Please select an image or media file before uploading.");
      setLoading(false);
      return;
    }

    setMessage("Uploading file...");

    try {
      // 1. Get the current user
      const { data: userData } = await supabase.auth.getUser();

      if (!userData?.user) {
        setError("You must be logged in to upload files.");
        setLoading(false);
        return;
      }

      setUser(userData.user);

      // 2. Generate unique file name
      const uniqueName = `${userData.user.id}_${Date.now()}_${file.name}`;

      // 3. Upload file to Supabase Storage
      const { data, error: uploadError } = await supabase.storage
        .from("uploads")
        .upload(uniqueName, file, { upsert: true });

      if (uploadError) {
        setError(`Upload error: ${uploadError.message}`);
        setLoading(false);
        return;
      }

      // 4. Get public URL
      const { data: publicData } = supabase
        .storage
        .from("uploads")
        .getPublicUrl(uniqueName);

      const publicUrl = publicData.publicUrl;
      setImageUrl(publicUrl);

      // 5. Insert file metadata
      const insertResp = await supabase.from("uploads").insert([
        {
          user_id: userData.user.id,
          upload_type: file.type.startsWith("image") ? "image" : "video",
          file_url: uniqueName,
          source: "direct_upload",
          processed: false,
          description: file.name,
        }
      ]).select();

      if (insertResp.error || !insertResp.data) {
        setError(`Metadata error: ${insertResp.error?.message}`);
        setLoading(false);
        return;
      }

      const uploadId = insertResp.data[0].id;
      const fileUrl = uniqueName;

      setMessage("File uploaded. Parsing with AI...");

      // 6. Send request to backend to parse the file
      const response = await fetch("http://localhost:8000/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          upload_id: uploadId, 
          file_url: fileUrl, 
          user_id: userData.user.id,
          image_url: publicUrl
        }),
      });

      if (!response.ok) {
        throw new Error(`Backend error: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.status === "success" && result.recipe) {
        setMessage("Recipe and grocery lists generated successfully!");
        setRecipe(result.recipe);
        setGroceryLists(result.grocery_lists || []);
      } else {
        setError("Failed to parse recipe. Please try again.");
      }
    } catch (e) {
      setError(`Error: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveRecipe(recipeId: string) {
    if (!user) return;
    
    try {
      const { error } = await supabase.from("saved_recipes").insert([
        {
          user_id: user.id,
          recipe_id: recipeId,
          saved_at: new Date().toISOString()
        }
      ]);
      if (error) {
        console.error("Error saving recipe:", error);
        return;
      }
      setRecipeSaved(true);
    } catch (e) {
      console.error("Error saving recipe:", e);
    }
  }

  async function handleSaveGroceryList(listId: string, recipeId: string) {
    if (!user) return;
    try {
      const { error } = await supabase.from("saved_grocery_lists").insert([
        {
          user_id: user.id,
          grocery_list_id: listId,
          recipe_id: recipeId,
          saved_at: new Date().toISOString()
        }
      ]);
      if (!error) {
        setSavedLists(prev => [...prev, listId]);
        setJustSaved(listId);
        setTimeout(() => setJustSaved(null), 2000);
      }
    } catch (e) {
      // handle error
    }
  }

  async function handleSave() {
    if (alreadySaved) return;
    if (!user || !recipe || !groceryLists.length) return;
    try {
      const { error } = await supabase.from("gallery").insert([
        {
          user_id: user.id,
          recipe_id: recipe.id,
          grocery_list_id: groceryLists[0].id,
          saved_at: new Date().toISOString()
        }
      ]);
      if (error) {
        console.error("Error saving recipe and grocery list:", error);
        return;
      }
      setRecipeSaved(true);
      setSavedLists(prev => [...prev, groceryLists[0].id]);
      setJustSaved(groceryLists[0].id);
    } catch (e) {
      console.error("Error saving recipe and grocery list:", e);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-4xl">
        <CardContent className="p-6">
          <div className="mb-6">
            <Input
              type="file"
              accept="image/*,video/*"
              onChange={e => setFile(e.target.files ? e.target.files[0] : null)}
              className="mb-4"
            />
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button 
              className="w-full" 
              onClick={handleUpload}
              disabled={loading}
            >
              {loading ? "Processing..." : "Upload and Parse"}
            </Button>
            {message && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                {message}
              </div>
            )}
          </div>

          {imageUrl && (
            <div className="mb-6">
              <img src={imageUrl} alt="Uploaded" className="w-full max-w-md rounded shadow" />
            </div>
          )}
          
          {recipe && (
            <div className="mb-8">
              <div className="flex justify-between items-start mb-4">
                <h2 className="font-bold text-2xl">{recipe.title}</h2>
              </div>
              
              {recipe.description && (
                <p className="text-gray-600 mb-4">{recipe.description}</p>
              )}

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-lg mb-2">Ingredients:</h3>
                  <ul className="list-disc pl-5 space-y-1">
                    {Array.isArray(recipe.ingredients)
                      ? recipe.ingredients.map((ing: any, i: number) =>
                          typeof ing === "string" ? (
                            <li key={i}>{ing}</li>
                          ) : (
                            <li key={i}>
                              {ing.name}
                              {ing.amount ? ` (${ing.amount})` : ""}
                              {isPantryItem(ing.name) && (
                                <span className="ml-2 text-xs text-gray-400">(pantry)</span>
                              )}
                            </li>
                          )
                        )
                      : <li>{JSON.stringify(recipe.ingredients)}</li>
                    }
                  </ul>
                  
                  {/* Pantry Note */}
                  {(() => {
                    const pantryInRecipe = Array.isArray(recipe.ingredients)
                      ? recipe.ingredients.filter(
                          (ing: Ingredient | string) => typeof ing !== "string" && isPantryItem(ing.name)
                        )
                      : [];
                    return pantryInRecipe.length > 0 ? (
                      <div className="mt-3 text-sm text-gray-500 bg-yellow-50 p-3 rounded">
                        <strong>Note:</strong> This list assumes you already have{" "}
                        {pantryInRecipe.map((ing: Ingredient) => ing.name).join(", ")} in your pantry.
                      </div>
                    ) : null;
                  })()}
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-2">Instructions:</h3>
                  <div className="whitespace-pre-line text-gray-700">
                    {recipe.instructions}
                  </div>
                  
                  {recipe.prep_time && (
                    <div className="mt-3 text-sm text-gray-600">
                      <strong>Cooking Time:</strong> {recipe.prep_time}
                    </div>
                  )}
                  
                  {recipe.servings && (
                    <div className="mt-1 text-sm text-gray-600">
                      <strong>Servings:</strong> {recipe.servings}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {groceryLists.length > 0 && (
            <div>
              <h2 className="font-bold text-xl mb-4">Grocery Recommendations</h2>
              <div className="grid gap-4">
                {groceryLists.map((list, idx) => (
                  <Card key={idx} className="border border-gray-200 shadow">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-center mb-3">
                        <div>
                          <h3 className="text-lg font-semibold">
                            {list.store}
                          </h3>
                          <p className="text-sm text-gray-500">
                            Rank #{list.recommendation_rank || idx + 1}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            onClick={() => handleSaveGroceryList(list.id, recipe.id)}
                            size="sm"
                            variant="outline"
                            disabled={savedLists.includes(list.id)}
                          >
                            {savedLists.includes(list.id) ? "Saved" : "Save"}
                          </Button>
                          {justSaved === list.id && (
                            <span className="text-green-600 text-xs ml-2">Saved!</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-medium mb-2">Items:</h4>
                          <ul className="space-y-1 text-sm">
                            {list.list_items?.map((item: any, i: number) => (
                              <li key={i} className="flex justify-between">
                                <span>
                                  {item.name}
                                  {item.qty && ` (${item.qty})`}
                                </span>
                                <span className="text-gray-600">
                                  {item.price ? `$${item.price}` : "N/A"}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        
                        <div>
                          <h4 className="font-medium mb-2">Savings Breakdown:</h4>
                          <div className="space-y-1 text-sm">
                            {list.list_items?.filter((item: any) => item.is_on_sale).map((item: any, i: number) => (
                              <div key={i} className="flex justify-between text-green-600">
                                <span>{item.name}</span>
                                <span>-${item.savings}</span>
                              </div>
                            ))}
                            {list.list_items?.filter((item: any) => !item.is_on_sale).length === 0 && (
                              <p className="text-gray-500">No items on sale</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
