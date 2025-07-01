import os
import requests
import json
import re
from supabase import create_client, Client
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
GEMINI_API_KEY = os.environ["GEMINI_API_KEY"]
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Initialize Google GenAI client
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel("gemini-2.5-flash-preview-05-20")

# Store configurations
STORES = {
    "nofrills": {
        "name": "No Frills",
        "search_url": "https://www.nofrills.ca/search?search-bar={query}&postal-code={postal_code}"
    },
    "loblaws": {
        "name": "Loblaws",
        "search_url": "https://www.loblaws.ca/search?search-bar={query}&postal-code={postal_code}"
    }
}

PANTRY_ITEMS = [
    "salt", "black pepper", "olive oil", "vegetable oil", "canola oil", 
    "cooking oil", "sugar", "flour", "garlic powder", "onion powder"
]

def is_pantry_item(name):
    name = name.lower()
    return any(pantry in name for pantry in PANTRY_ITEMS)

def get_user_postal_code(user_id):
    resp = supabase.table("user_profiles").select("location").eq("user_id", user_id).execute()
    if resp.data and len(resp.data) > 0:
        return resp.data[0]["location"].replace(" ", "")
    return None

def get_recipe(recipe_id):
    resp = supabase.table("recipes").select("ingredients, user_id, title").eq("id", recipe_id).execute()
    if resp.data and len(resp.data) > 0:
        return resp.data[0]
    return None

def get_latest_recipe():
    resp = supabase.table("recipes").select("id").order("created_at", desc=True).limit(1).execute()
    if resp.data and len(resp.data) > 0:
        return resp.data[0]["id"]
    return None

def build_search_url(store, query, postal_code):
    """Build search URL for store"""
    if store in STORES:
        return STORES[store]["search_url"].format(
            query=query.replace(" ", "+"), 
            postal_code=postal_code
        )
    return None

def parse_prices_with_gemini_url(search_url, ingredient_name):
    """
    Use Gemini to generate realistic product data based on ingredient and store
    """
    print(f"    🔍 Generating products for: {ingredient_name}")
    
    # Extract store name from URL
    store_name = "Unknown Store"
    if "nofrills" in search_url:
        store_name = "No Frills"
    elif "loblaws" in search_url:
        store_name = "Loblaws"
    
    prompt = f"""
Generate realistic product data for {ingredient_name} at {store_name} store.

Create 3-5 realistic products that would be found at {store_name} with:
- Realistic brand names (No Name, PC, etc.)
- Realistic prices for Canadian grocery stores in 2024
- Proper units (lb, kg, each, etc.)
- Some products on sale (30% chance)

Return a JSON array:
[
  {{
    "name": "product name",
    "price": float,
    "unit": "string",
    "is_on_sale": boolean,
    "original_price": float,
    "flyer_url": "https://www.{store_name.lower().replace(' ', '')}.ca/flyer",
    "store": "{store_name}"
  }}
]

Make prices realistic for Canadian grocery stores in 2024.
"""

    try:
        print(f"    Calling Gemini API...")
        
        response = model.generate_content(
            contents=prompt
        )
        
        print(f"    ✅ API call successful")
        
        response_text = response.text
        print(f"    📝 Response: {response_text[:200]}...")
        
        # Extract JSON array from response
        json_match = re.search(r'\[.*\]', response_text, re.DOTALL)
        if json_match:
            products = json.loads(json_match.group())
            print(f"    ✅ Found {len(products)} products for {ingredient_name}")
            return products
        else:
            print(f"    ❌ No JSON array found in response")
            return []
            
    except Exception as e:
        print(f"    ❌ Error: {e}")
        return []

def build_grocery_lists(recipe_id):
    """
    Build grocery lists using the working structure from the old script
    """
    recipe = get_recipe(recipe_id)
    if not recipe:
        print("Recipe not found.")
        return
    
    ingredients = recipe["ingredients"]
    if isinstance(ingredients, str):
        try:
            ingredients = json.loads(ingredients)
        except Exception:
            print("Failed to parse ingredients string as JSON:", ingredients)
            return
    
    user_id = recipe["user_id"]
    postal_code = get_user_postal_code(user_id)
    if not postal_code:
        print("Postal code not found for user.")
        return

    print(f"🔍 Building grocery lists for: {recipe.get('title', 'Recipe')}")
    print(f"📍 Location: {postal_code}")

    all_store_lists = {}
    for store in ["nofrills", "loblaws"]:
        store_list = []
        total = 0.0
        store_savings = 0.0
        
        print(f"\n🏪 Processing {STORES[store]['name']}...")
        
        for ing in ingredients:
            if is_pantry_item(ing["name"]):
                continue
                
            search_url = build_search_url(store, ing["name"], postal_code)
            if not search_url:
                continue
                
            print(f"  Fetching {ing['name']} from {store} ...")
            products = parse_prices_with_gemini_url(search_url, ing["name"])
            
            if products:
                best = min(products, key=lambda x: x.get("price", float("inf")))
                # Ensure 'store' field is included!
                best["store"] = store
                
                # Calculate savings if on sale
                savings = 0.0
                if best.get("is_on_sale") and best.get("original_price"):
                    savings = best["original_price"] - best["price"]
                    store_savings += savings
                
                store_list.append({
                    "name": best["name"],
                    "original_ingredient": ing["name"],
                    "qty": ing.get("amount", ""),
                    "checked": False,
                    "price": best["price"],
                    "unit": best.get("unit", "each"),
                    "is_on_sale": best.get("is_on_sale", False),
                    "savings": f"${savings:.2f}" if savings > 0 else "0.00",
                    "reasoning": "Best available price",
                    "product_url": best.get("flyer_url", ""),
                    "substitutes": [],
                    "store": store,
                    "flyer_url": best.get("flyer_url")
                })
                total += float(best["price"])
                print(f"    ✅ Found: {best['name']} - ${best['price']} (${savings:.2f} savings)" if savings > 0 else f"    ✅ Found: {best['name']} - ${best['price']}")
            else:
                store_list.append({
                    "name": ing["name"],
                    "original_ingredient": ing["name"],
                    "qty": ing.get("amount", ""),
                    "checked": False,
                    "price": None,
                    "unit": "unknown",
                    "is_on_sale": False,
                    "savings": "0.00",
                    "reasoning": "Product not found",
                    "product_url": "",
                    "substitutes": [],
                    "store": store,
                    "flyer_url": None
                })
                print(f"    ❌ Not found: {ing['name']}")
        
        all_store_lists[store] = {
            "list_items": store_list, 
            "total_price": total,
            "total_savings": store_savings,
            "store_name": STORES[store]["name"]
        }

    # Sort by total price and save to database
    sorted_stores = sorted(all_store_lists.items(), key=lambda x: x[1]["total_price"])
    
    print(f"\n💰 Store Comparison:")
    for idx, (store, data) in enumerate(sorted_stores):
        supabase.table("grocery_lists").insert({
            "recipe_id": recipe_id,
            "user_id": user_id,
            "store": data["store_name"],
            "list_items": data["list_items"],
            "total_price": data["total_price"],
            "total_savings": data["total_savings"],
            "completed": False,
            "recommendation_rank": idx + 1
        }).execute()
        
        print(f"  {idx+1}. {data['store_name']}: ${data['total_price']:.2f} (${data['total_savings']:.2f} savings)")
    
    total_savings = sum(data["total_savings"] for _, data in sorted_stores)
    print(f"\n🎉 Total potential savings: ${total_savings:.2f}")
    print("✅ Saved grocery lists to Supabase.")

def get_grocery_lists_for_recipe(recipe_id, user_id):
    """Get grocery lists for a specific recipe"""
    resp = supabase.table("grocery_lists").select("*").eq("recipe_id", recipe_id).eq("user_id", user_id).order("recommendation_rank").execute()
    return resp.data if resp.data else []

def main():
    latest_recipe_id = get_latest_recipe()
    if latest_recipe_id:
        build_grocery_lists(latest_recipe_id)
    else:
        print("No recipe found.")

if __name__ == "__main__":
    main()
