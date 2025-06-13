"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [recipe, setRecipe] = useState<any | null>(null);

  async function handleUpload() {
    setMessage("Uploading file...");
    setRecipe(null);

    if (!file) return;

    // 1. Upload file to Supabase Storage
    const { data, error } = await supabase.storage
      .from("uploads")
      .upload(`public/${file.name}`, file);

    if (error) {
      setMessage(`Upload error: ${error.message}`);
      return;
    }

    // 2. Get public URL for the uploaded file
    const { data: publicData } = supabase
      .storage
      .from("uploads")
      .getPublicUrl(data.path);

    const publicUrl = publicData.publicUrl;
    setImageUrl(publicUrl);

    // 3. Insert file metadata into uploads table
    const { data: userData } = await supabase.auth.getUser();

    if (!userData?.user) {
      setMessage("You must be logged in to upload files.");
      return;
    }

    const insertResp = await supabase.from("uploads").insert([
      {
        user_id: userData.user.id,
        upload_type: file.type.startsWith("image") ? "image" : "video",
        file_url: data.path, // still use the storage path for backend parsing
        source: "direct_upload",
        processed: false,
        description: file.name,
      }
    ]).select();

    if (insertResp.error || !insertResp.data) {
      setMessage(`Metadata error: ${insertResp.error?.message}`);
      return;
    }

    const uploadId = insertResp.data[0].id;
    const fileUrl = data.path; // <-- Now defined

    setMessage("File uploaded. Parsing with AI...");

    // 4. Send request to backend to parse the file with Gemini
    try {
      const response = await fetch("http://localhost:8000/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upload_id: uploadId, file_url: fileUrl }),
      });
      const result = await response.json();
      if (result.recipe) {
        setMessage("Recipe generated!");
        setRecipe(result.recipe);
      } else {
        setMessage("Parsing failed.");
      }
    } catch (e) {
      setMessage("Error calling backend AI parser.");
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-md">
        <CardContent>
          <Input
            type="file"
            onChange={e => setFile(e.target.files ? e.target.files[0] : null)}
            className="mb-4"
          />
          <Button className="w-full" onClick={handleUpload}>
            Upload and Parse
          </Button>
          {message && <div className="mt-4">{message}</div>}
          {imageUrl && <img src={imageUrl} alt="Uploaded" className="mt-4 w-full rounded" />}
          {recipe && (
            <div className="mt-6">
              <h2 className="font-bold text-lg mb-2">{recipe.title}</h2>
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
              <div className="mt-2">
                <strong>Instructions:</strong>
                <p className="whitespace-pre-line">{recipe.instructions}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}