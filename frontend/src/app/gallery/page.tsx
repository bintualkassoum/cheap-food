"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent } from "@/components/ui/card";

export default function GalleryPage() {
  const [recipes, setRecipes] = useState<any[]>([]);

  useEffect(() => {
    async function fetchRecipes() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return;
      const { data, error } = await supabase
        .from("recipes")
        .select("*")
        .eq("user_id", userData.user.id)
        .order("created_at", { ascending: false });
      if (!error && data) setRecipes(data);
    }
    fetchRecipes();
  }, []);

  return (
    <div className="grid gap-4 p-8 md:grid-cols-3">
      {recipes.map((recipe) => (
        <Card key={recipe.id}>
          <CardContent>
            <div className="font-bold">{recipe.title}</div>
            <div>
              <strong>Ingredients:</strong>
              <ul className="list-disc pl-5">
                {Array.isArray(recipe.ingredients)
                  ? recipe.ingredients.map((ing: any, i: number) =>
                      typeof ing === "string" ? (
                        <li key={i}>{ing}</li>
                      ) : (
                        <li key={i}>
                          {ing.name}
                          {ing.amount ? ` (${ing.amount})` : ""}
                        </li>
                      )
                    )
                  : <li>{JSON.stringify(recipe.ingredients)}</li>
                }
              </ul>
            </div>
            <div>
              <strong>Instructions:</strong>
              <p className="whitespace-pre-line">{recipe.instructions}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
