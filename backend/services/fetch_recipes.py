# services/fetch_recipes.py
import os
import tempfile
import mimetypes
import requests
from dotenv import load_dotenv
from supabase import create_client, Client
import google.generativeai as genai
from fastapi import HTTPException

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
SUPABASE_BUCKET = os.getenv("SUPABASE_STORAGE_BUCKET")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel("gemini-2.5-flash-preview-05-20")

PROMPT = """
You are an AI chef analyzing an image or video of a meal. 
Given ONLY the provided media, generate a recipe object in **valid JSON** matching the following schema:

{
  "title": string, // Clear, consistent meal title (create if none shown)
  "ingredients": [ { "name": string, "amount": string } ], // List of ingredients with estimated quantities
  "instructions": string, // Step-by-step instructions as a single string (can be numbered or paragraph)
  "description": string, // A 1-2 sentence summary of the meal, including ingredient highlights and possible substitutions
  "prep_time": string, // Estimated preparation and cooking time, e.g. "30 minutes"
  "servings": integer // Estimated number of servings
}

**Return ONLY the JSON, no markdown or extra text.** 
If any part is missing from the image, use your best guess. Be concise, and always include all six fields. Example:

{
  "title": "Chicken Alfredo Pasta",
  "ingredients": [
    {"name": "fettuccine", "amount": "200g"},
    {"name": "chicken breast", "amount": "1"},
    {"name": "heavy cream", "amount": "1 cup"},
    {"name": "parmesan cheese", "amount": "1/2 cup"},
    {"name": "butter", "amount": "2 tbsp"},
    {"name": "garlic", "amount": "2 cloves"},
    {"name": "salt", "amount": "to taste"},
    {"name": "black pepper", "amount": "to taste"}
  ],
  "instructions": "1. Cook pasta according to package instructions. 2. Sauté chicken in butter until cooked. 3. Add garlic, then cream. 4. Simmer, add parmesan, toss with pasta. 5. Season and serve.",
  "description": "Classic Chicken Alfredo Pasta with creamy parmesan sauce. Substitute chicken with mushrooms for a vegetarian option.",
  "prep_time": "30 minutes",
  "servings": 2
}
"""


def fetch_file_from_supabase(file_url: str) -> str:
    storage_url = f"{SUPABASE_URL}/storage/v1/object/uploads/{file_url}"
    response = requests.get(storage_url)
    if response.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to fetch file from storage")
    _, ext = os.path.splitext(file_url)
    if not ext:
        ext = ".bin"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
    tmp.write(response.content)
    tmp.close()
    return tmp.name

def parse_media_with_gemini(file_path: str) -> dict:
    mime_type, _ = mimetypes.guess_type(file_path)
    if mime_type is None:
        raise ValueError(f"Could not determine MIME type for {file_path}")
    with open(file_path, "rb") as f:
        result = model.generate_content(
            [
                PROMPT,
                {"mime_type": mime_type, "data": f.read()}
            ],
            stream=False
        )
    import json, re
    try:
        cleaned = re.sub(r"^```json|```$", "", result.text.strip(), flags=re.MULTILINE).strip()
        return json.loads(cleaned)
    except Exception as e:
        print("Error parsing Gemini output:", e)
        return {"raw_response": result.text}

def save_recipe_to_supabase(upload_id: str, user_id: str, recipe: dict):
    title = recipe.get("title") or "Recipe"
    ingredients = recipe.get("ingredients") or []
    instructions = recipe.get("instructions") or recipe.get("steps") or ""
    description = recipe.get("description") or ""
    image_url = recipe.get("image_url") or ""
    prep_time = recipe.get("prep_time") or ""
    servings = recipe.get("servings") or None
    response = supabase.table("recipes").insert({
        "upload_id": upload_id,
        "user_id": user_id,
        "title": title,
        "ingredients": ingredients,
        "instructions": instructions,
        "description": description,
        "image_url": image_url,
        "prep_time": prep_time,
        "servings": servings,
    }).execute()
    if not response.data:
        raise HTTPException(status_code=500, detail=f"Could not save recipe: {getattr(response, 'message', str(response))}")
    return response.data[0]