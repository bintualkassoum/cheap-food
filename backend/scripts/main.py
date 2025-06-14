import os
import tempfile
import mimetypes
import requests
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
from supabase import create_client, Client
import google.generativeai as genai

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # or ["*"] for all origins in dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
  "description": string // A 1-2 sentence summary of the meal, including ingredient highlights and possible substitutions
}

**Return ONLY the JSON, no markdown or extra text.** 
If any part is missing from the image, use your best guess. Be concise, and always include all four fields. Example:

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
  "description": "Classic Chicken Alfredo Pasta with creamy parmesan sauce. Substitute chicken with mushrooms for a vegetarian option."
}
"""

class ParseRequest(BaseModel):
    upload_id: str
    file_url: str

def fetch_file_from_supabase(file_url: str) -> str:
    """Downloads the file from Supabase storage and returns local path with correct extension."""
    # file_url is typically 'some_id_somefile.jpg'
    storage_url = f"{SUPABASE_URL}/storage/v1/object/uploads/{file_url}"
    response = requests.get(storage_url)
    if response.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to fetch file from storage")
    
    # Extract extension from the file_url (e.g., '.jpg', '.mp4')
    _, ext = os.path.splitext(file_url)
    if not ext:
        ext = ".bin"  # fallback if no extension

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
    tmp.write(response.content)
    tmp.close()
    return tmp.name

def parse_media_with_gemini(file_path: str) -> dict:
    # Detect mime type
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
    print("Gemini raw output:", result.text)
    import json, re
    try:
        cleaned = re.sub(r"^```json|```$", "", result.text.strip(), flags=re.MULTILINE).strip()
        return json.loads(cleaned)
    except Exception as e:
        print("Error parsing Gemini output:", e)
        return {"raw_response": result.text}

@app.post("/parse")
def parse_upload(req: ParseRequest):
    # 1. Download file
    local_path = fetch_file_from_supabase(req.file_url)

    # 2. Run Gemini
    parsed = parse_media_with_gemini(local_path)

    # 3. Save to recipes table
    # Try to parse the fields (fallback to raw if needed)
    title = parsed.get("title") or "Recipe"
    ingredients = parsed.get("ingredients") or []
    instructions = parsed.get("instructions") or parsed.get("steps") or ""
    description = parsed.get("description") or ""

    # For simplicity, assume the upload/user is legit. For production: validate the user, check ownership.
    response = supabase.table("recipes").insert({
        "upload_id": req.upload_id,
        # For MVP, you may set user_id = null or pass it from the frontend if you wish to enforce it
        "title": title,
        "ingredients": ingredients,
        "instructions": instructions,
        "description": description,
    }).execute()

    return {
        "recipe": {
            "title": title,
            "ingredients": ingredients,
            "instructions": instructions,
            "description": description,
        },
        "supabase_result": response.data,
        "gemini_raw": parsed,
    }
