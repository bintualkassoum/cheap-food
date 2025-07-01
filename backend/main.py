from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv

from services.fetch_recipes import (
    fetch_file_from_supabase,
    parse_media_with_gemini,
    save_recipe_to_supabase,
)
from services.fetch_grocery_lists import build_grocery_lists, get_grocery_lists_for_recipe

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Cheap Food Recipe & Grocery API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # or ["*"] for all origins in dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

load_dotenv()

class ParseRequest(BaseModel):
    upload_id: str
    file_url: str
    user_id: str

class GroceryListRequest(BaseModel):
    recipe_id: str
    user_id: str

@app.post("/parse")
def parse_upload(req: ParseRequest):
    """
    Parse uploaded image/video and generate recipe with grocery recommendations
    """
    try:
        print(f"Processing upload: {req.upload_id}")
        
        # 1. Fetch file from Supabase
        local_path = fetch_file_from_supabase(req.file_url)
        print(f"File downloaded: {local_path}")
        
        # 2. Parse media with Gemini
        parsed = parse_media_with_gemini(local_path)
        print(f"🍳 Recipe parsed: {parsed.get('title', 'Untitled')}")
        
        # 3. Save recipe to Supabase
        recipe_row = save_recipe_to_supabase(req.upload_id, req.user_id, parsed)
        recipe_id = recipe_row["id"]
        print(f"💾 Recipe saved with ID: {recipe_id}")

        # 4. Generate grocery lists with pricing and recommendations
        print(f"Generating grocery recommendations...")
        build_grocery_lists(recipe_id)

        # 5. Fetch generated grocery lists
        grocery_lists = get_grocery_lists_for_recipe(recipe_id, req.user_id)
        print(f"✅ Generated {len(grocery_lists)} grocery list recommendations")

        return {
            "status": "success",
            "message": "Recipe parsed and grocery lists generated successfully",
            "recipe": {
                "id": recipe_id,
                "title": recipe_row["title"],
                "ingredients": recipe_row["ingredients"],
                "instructions": recipe_row["instructions"],
                "description": recipe_row["description"],
                "cooking_time": recipe_row.get("cooking_time"),
                "servings": recipe_row.get("servings"),
                "difficulty": recipe_row.get("difficulty"),
                "created_at": recipe_row.get("created_at")
            },
            "grocery_lists": grocery_lists,
            "summary": {
                "total_stores": len(grocery_lists),
                "total_savings": sum(gl.get("total_savings", 0) for gl in grocery_lists),
                "price_range": {
                    "min": min(gl.get("total_price", 0) for gl in grocery_lists) if grocery_lists else 0,
                    "max": max(gl.get("total_price", 0) for gl in grocery_lists) if grocery_lists else 0
                }
            }
        }
        
    except Exception as e:
        print(f"❌ Error processing upload: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/grocery-lists/{recipe_id}")
def get_grocery_lists(recipe_id: str, user_id: str):
    """
    Get grocery list recommendations for a specific recipe
    """
    try:
        grocery_lists = get_grocery_lists_for_recipe(recipe_id, user_id)
        
        if not grocery_lists:
            raise HTTPException(status_code=404, detail="No grocery lists found for this recipe")
        
        return {
            "status": "success",
            "recipe_id": recipe_id,
            "grocery_lists": grocery_lists,
            "summary": {
                "total_stores": len(grocery_lists),
                "total_savings": sum(gl.get("total_savings", 0) for gl in grocery_lists),
                "price_range": {
                    "min": min(gl.get("total_price", 0) for gl in grocery_lists),
                    "max": max(gl.get("total_price", 0) for gl in grocery_lists)
                }
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/regenerate-grocery-lists")
def regenerate_grocery_lists(req: GroceryListRequest):
    """
    Regenerate grocery lists for an existing recipe
    """
    try:
        print(f"🔄 Regenerating grocery lists for recipe: {req.recipe_id}")
        
        # Delete existing grocery lists for this recipe
        from services.fetch_grocery_lists import supabase
        supabase.table("grocery_lists").delete().eq("recipe_id", req.recipe_id).execute()
        
        # Generate new grocery lists
        build_grocery_lists(req.recipe_id)
        
        # Fetch the new lists
        grocery_lists = get_grocery_lists_for_recipe(req.recipe_id, req.user_id)
        
        return {
            "status": "success",
            "message": "Grocery lists regenerated successfully",
            "recipe_id": req.recipe_id,
            "grocery_lists": grocery_lists
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health_check():
    """
    Health check endpoint
    """
    return {
        "status": "healthy",
        "service": "Cheap Food Recipe & Grocery API",
        "version": "1.0.0"
    }

# Remove the shop endpoint since we're not using shopping automation
# @app.post("/shop")
# def shop_endpoint(grocery_list_id: str, user_id: str):
#     # This endpoint is removed since we're not using shopping automation
#     pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
