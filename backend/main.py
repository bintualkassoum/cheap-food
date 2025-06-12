import os
import tempfile
import requests
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
from supabase import create_client, Client
import google.generativeai as genai

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
SUPABASE_BUCKET = os.getenv("SUPABASE_STORAGE_BUCKET")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel("gemini-2.5-flash-preview-05-20")

app = FastAPI()

class ParseRequest(BaseModel):
    upload_id: str
    file_url: str

def fetch_file_from_supabase(file_url: str) -> str:
    """Downloads the file from Supabase storage and returns local path."""
    # file_url is typically 'public/filename.jpg'
    storage_url = f"{SUPABASE_URL}/storage/v1/object/public/{file_url}"
    response = requests.get(storage_url)
    if response.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to fetch file from storage")
    tmp = tempfile.NamedTemporaryFile(delete=False)
    tmp.write(response.content)
    tmp.close()
    return tmp.name

def parse_image_with_gemini(image_path: str) -> dict:
    """Calls Gemini Vision API and returns parsed recipe."""
    with open(image_path, "rb") as f:
        result = model.generate_content(
            [   # prompt and content schema can be improved
                "You are an AI chef. Analyze the image, and return a JSON with the recipe title, a list of ingredients (with amounts if possible), and step-by-step instructions.",
                {"mime_type": "image/jpeg", "data": f.read()}
            ],
            stream=False
        )
    # Gemini output is in 'text' attribute as a string (usually JSON)
    import json
    try:
        return json.loads(result.text)
    except Exception:
        # fallback: just return plain text
        return {"raw_response": result.text}

@app.post("/parse")
def parse_upload(req: ParseRequest):
    # 1. Download file
    local_path = fetch_file_from_supabase(req.file_url)

    # 2. Run Gemini
    parsed = parse_image_with_gemini(local_path)

    # 3. Save to recipes table
    # Try to parse the fields (fallback to raw if needed)
    title = parsed.get("title") or "Recipe"
    ingredients = parsed.get("ingredients") or []
    instructions = parsed.get("instructions") or parsed.get("steps") or ""

    # For simplicity, assume the upload/user is legit. For production: validate the user, check ownership.
    response = supabase.table("recipes").insert({
        "upload_id": req.upload_id,
        # For MVP, you may set user_id = null or pass it from the frontend if you wish to enforce it
        "title": title,
        "ingredients": ingredients,
        "instructions": instructions,
        "ai_summary": "",
    }).execute()

    return {
        "recipe": {
            "title": title,
            "ingredients": ingredients,
            "instructions": instructions,
            "ai_summary": "",
        },
        "supabase_result": response.data,
        "gemini_raw": parsed,
    }
