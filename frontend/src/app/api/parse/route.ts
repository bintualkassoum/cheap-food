// app/api/parse/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

// (Pseudo) Example function to send image to Gemini and get result
async function parseWithGemini(imageUrl: string) {
  // You'd call Gemini API here, passing the image URL or bytes
  // Replace this with real API call!
  const dummyResponse = {
    title: "Avocado Toast",
    ingredients: [
      { name: "avocado", amount: "1" },
      { name: "bread", amount: "2 slices" }
    ],
    instructions: "Mash avocado, spread on toast, enjoy."
  };
  return dummyResponse;
}

export async function POST(req: NextRequest) {
  const { uploadId, fileUrl } = await req.json();

  // 1. Call AI model
  const parsed = await parseWithGemini(fileUrl);

  // 2. Save recipe result to Supabase
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    return NextResponse.json({ error: "User not authenticated" }, { status: 401 });
  }

  const { error: insertError } = await supabase.from("recipes").insert([
    {
      upload_id: uploadId,
      user_id: userData.user.id,
      title: parsed.title,
      ingredients: parsed.ingredients, // as JSON
      instructions: parsed.instructions,
      ai_summary: "",
    }
  ]);
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ message: "Recipe created!", recipe: parsed });
}