import os
import requests
import asyncio
from supabase import create_client, Client
from dotenv import load_dotenv
from playwright.async_api import async_playwright
import time

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Store-specific configurations
STORE_CONFIGS = {
    "No Frills": {
        "url": "https://www.nofrills.ca",
        "search_selector": "input[placeholder*='search' i], input[name*='search' i]",
        "add_to_cart_selector": "button[aria-label*='add' i], button:has-text('Add'), .add-to-cart",
        "cart_selector": "a[href*='cart' i], button:has-text('Cart'), .cart-button",
        "checkout_selector": "button:has-text('Checkout'), button:has-text('Continue')",
        "postal_code_selector": "input[name*='postal' i], input[placeholder*='postal' i]",
        "address_selector": "input[name*='address' i], input[placeholder*='address' i]",
        "phone_selector": "input[name*='phone' i], input[type='tel']",
        "email_selector": "input[name*='email' i], input[type='email']"
    },
    "Loblaws": {
        "url": "https://www.loblaws.ca",
        "search_selector": "input[placeholder*='search' i], input[name*='search' i]",
        "add_to_cart_selector": "button[aria-label*='add' i], button:has-text('Add'), .add-to-cart",
        "cart_selector": "a[href*='cart' i], button:has-text('Cart'), .cart-button",
        "checkout_selector": "button:has-text('Checkout'), button:has-text('Continue')",
        "postal_code_selector": "input[name*='postal' i], input[placeholder*='postal' i]",
        "address_selector": "input[name*='address' i], input[placeholder*='address' i]",
        "phone_selector": "input[name*='phone' i], input[type='tel']",
        "email_selector": "input[name*='email' i], input[type='email']"
    }
}

# Add this near the top of your file
TIMEOUT_CONFIG = {
    "browser_launch": 120000,      # 2 minutes
    "page_navigation": 120000,     # 2 minutes
    "element_wait": 30000,         # 30 seconds
    "search_wait": 5000,           # 5 seconds
    "cart_wait": 5000,             # 5 seconds
    "checkout_wait": 10000         # 10 seconds
}

# Utility: Fetch grocery list and user info from Supabase
def fetch_grocery_list(grocery_list_id):
    """Fetch grocery list with enhanced validation"""
    resp = supabase.table("grocery_lists").select("*").eq("id", grocery_list_id).single().execute()
    if resp.data:
        # Validate required fields
        if not resp.data.get("list_items"):
            raise ValueError("Grocery list has no items")
        if not resp.data.get("store"):
            raise ValueError("Store not specified in grocery list")
        return resp.data
    else:
        raise ValueError("Grocery list not found")

def fetch_user(user_id):
    """Fetch user with enhanced validation"""
    resp = supabase.table("user_profiles").select("*").eq("user_id", user_id).single().execute()
    if resp.data:
        # Validate required fields
        if not resp.data.get("location"):
            raise ValueError("User location not found")
        return resp.data
    else:
        raise ValueError("User not found")

def validate_shopping_data(grocery_list, user):
    """Validate all data before starting automation"""
    required_user_fields = ["location", "email"]
    missing_fields = [field for field in required_user_fields if not user.get(field)]
    
    if missing_fields:
        raise ValueError(f"Missing user fields: {missing_fields}")
    
    if not grocery_list.get("list_items"):
        raise ValueError("No items in grocery list")
    
    return True

# Step 1: Build the cart (MVP version: return a simple summary)
def build_cart_for_user(grocery_list_id, user_id):
    grocery_list = fetch_grocery_list(grocery_list_id)
    user = fetch_user(user_id)
    postal_code = user["location"].replace(" ", "")

    cart = {
        "store": grocery_list["store"],
        "postal_code": postal_code,
        "items": grocery_list["list_items"],
        "total_price": grocery_list["total_price"],
        "status": "built",
    }
    return cart

# Add this new function for browser automation
async def automate_shopping(store_config, items, user_info):
    """
    Enhanced shopping automation with better error handling and logging
    """
    shopping_results = {
        "successful_items": [],
        "failed_items": [],
        "cart_total": 0,
        "screenshots": []
    }
    
    try:
        async with async_playwright() as p:
            # Launch browser with increased timeout
            browser = await p.chromium.launch(
                headless=False,
                timeout=120000  # 2 minutes timeout for browser launch
            )
            page = await browser.new_page()
            
            # Set page timeout to 2 minutes
            page.set_default_timeout(120000)  # 2 minutes
            page.set_default_navigation_timeout(120000)  # 2 minutes for navigation
            
            # Navigate to store
            await page.goto(store_config["url"], timeout=120000)
            await page.wait_for_load_state("networkidle", timeout=120000)
            
            # Take initial screenshot
            await page.screenshot(path="shopping_start.png")
            shopping_results["screenshots"].append("shopping_start.png")
            
            # Add items to cart
            for item in items:
                try:
                    item_name = item.get("name", "")
                    item_quantity = item.get("quantity", 1)
                    
                    print(f"Adding item: {item_name}")
                    
                    # Search for item with increased timeout
                    await page.fill(store_config["search_selector"], item_name)
                    await page.press(store_config["search_selector"], "Enter")
                    await page.wait_for_timeout(5000)  # Wait 5 seconds for search results
                    
                    # Try to add to cart with increased timeout
                    add_button = await page.query_selector(store_config["add_to_cart_selector"])
                    if add_button:
                        await add_button.click()
                        await page.wait_for_timeout(3000)  # Wait 3 seconds after adding
                        
                        # Add quantity if needed
                        if item_quantity > 1:
                            quantity_selector = "input[type='number'], .quantity-input"
                            quantity_input = await page.query_selector(quantity_selector)
                            if quantity_input:
                                await quantity_input.fill(str(item_quantity))
                        
                        shopping_results["successful_items"].append({
                            "name": item_name,
                            "quantity": item_quantity,
                            "status": "added"
                        })
                        print(f"✅ Added: {item_name}")
                    else:
                        shopping_results["failed_items"].append({
                            "name": item_name,
                            "reason": "Add to cart button not found"
                        })
                        print(f"❌ Failed to add: {item_name} - button not found")
                        
                except Exception as e:
                    shopping_results["failed_items"].append({
                        "name": item_name,
                        "reason": str(e)
                    })
                    print(f"❌ Error adding {item_name}: {e}")
                    continue
            
            # Go to cart with increased timeout
            await page.click(store_config["cart_selector"])
            await page.wait_for_timeout(5000)  # Wait 5 seconds for cart to load
            
            # Take cart screenshot
            await page.screenshot(path="cart_review.png")
            shopping_results["screenshots"].append("cart_review.png")
            
            # Extract cart total if possible
            try:
                total_selector = ".cart-total, .total-price, [data-testid='total']"
                total_element = await page.query_selector(total_selector)
                if total_element:
                    total_text = await total_element.text_content()
                    shopping_results["cart_total"] = total_text
            except:
                pass
            
            await browser.close()
            return shopping_results
            
    except Exception as e:
        print(f"Automation error: {e}")
        return shopping_results

# Replace your existing place_order function
def place_order(store, user_info, cart_info):
    """
    Place the order using browser automation
    """
    # Map stores to their URLs
    store_urls = {
        "No Frills": "https://www.nofrills.ca",
        "Loblaws": "https://www.loblaws.ca",
        # Add more stores as needed
    }
    
    store_url = store_urls.get(store, "https://www.google.com")
    
    # Run the automation
    try:
        success = asyncio.run(automate_shopping(STORE_CONFIGS[store], cart_info["items"], user_info))
        
        if success["successful_items"]:
            order_confirmation = {
                "store": store,
                "order_status": "IN_PROGRESS",
                "total_price": cart_info["total_price"],
                "message": "Order placed successfully via browser automation",
                "user_info": user_info,
                "cart_info": cart_info,
                "automation_success": True,
                "shopping_results": success
            }
        else:
            order_confirmation = {
                "store": store,
                "order_status": "FAILED",
                "total_price": cart_info["total_price"],
                "message": "Automation failed - manual intervention required",
                "user_info": user_info,
                "cart_info": cart_info,
                "automation_success": False,
                "shopping_results": success
            }
            
    except Exception as e:
        order_confirmation = {
            "store": store,
            "order_status": "ERROR",
            "total_price": cart_info["total_price"],
            "message": f"Error during automation: {str(e)}",
            "user_info": user_info,
            "cart_info": cart_info,
            "automation_success": False,
            "shopping_results": success
        }
    
    return order_confirmation

# Step 3: Main entry point for FastAPI or MCP
async def shop_for_me_complete(grocery_list_id, user_id, user_confirmation=None):
    """
    Complete shopping flow from grocery list to order placement
    """
    try:
        # Phase 1: Data preparation
        grocery_list = fetch_grocery_list(grocery_list_id)
        user = fetch_user(user_id)
        validate_shopping_data(grocery_list, user)
        
        # Get store configuration
        store_name = grocery_list["store"]
        store_config = STORE_CONFIGS.get(store_name)
        if not store_config:
            raise ValueError(f"Store '{store_name}' not configured")
        
        # Phase 2: Shopping automation
        print(f"Starting shopping at {store_name}...")
        shopping_results = await automate_shopping(
            store_config, 
            grocery_list["list_items"], 
            user
        )
        
        # Phase 3: Generate cart summary
        cart_summary = generate_cart_summary(shopping_results, grocery_list["list_items"])
        
        # If no user confirmation provided, return cart summary for review
        if not user_confirmation:
            return {
                "status": "cart_ready_for_review",
                "cart_summary": cart_summary,
                "next_step": "user_confirmation_required"
            }
        
        # Phase 4: Complete checkout
        print("Completing checkout...")
        checkout_result = await complete_checkout(store_config, user_confirmation)
        
        # Save order to database
        order_data = {
            "grocery_list_id": grocery_list_id,
            "user_id": user_id,
            "store": store_name,
            "order_status": checkout_result["status"],
            "cart_summary": cart_summary,
            "order_id": checkout_result.get("order_id"),
            "total_price": cart_summary["cart_total"]
        }
        
        # Save to Supabase
        resp = supabase.table("orders").insert(order_data).execute()
        
        return {
            "status": "order_completed",
            "order_data": order_data,
            "checkout_result": checkout_result
        }
        
    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }

# Synchronous wrapper for compatibility
def shop_for_me(grocery_list_id, user_id, user_confirmation=None):
    """Synchronous wrapper for the async shopping function"""
    return asyncio.run(shop_for_me_complete(grocery_list_id, user_id, user_confirmation))

# If you want to test directly
if __name__ == "__main__":
    # Provide hardcoded IDs for testing (replace with real ones)
    test_grocery_list_id = "YOUR_GROCERY_LIST_ID"
    test_user_id = "YOUR_USER_ID"
    print(shop_for_me(test_grocery_list_id, test_user_id))

def generate_cart_summary(shopping_results, original_items):
    """Generate a user-friendly cart summary"""
    successful_count = len(shopping_results["successful_items"])
    failed_count = len(shopping_results["failed_items"])
    total_items = len(original_items)
    
    summary = {
        "total_items_requested": total_items,
        "items_added": successful_count,
        "items_failed": failed_count,
        "success_rate": f"{(successful_count/total_items)*100:.1f}%",
        "cart_total": shopping_results.get("cart_total", "Unknown"),
        "successful_items": shopping_results["successful_items"],
        "failed_items": shopping_results["failed_items"],
        "screenshots": shopping_results["screenshots"]
    }
    
    return summary

def collect_user_confirmation(cart_summary, user_info):
    """
    Collect user confirmation and additional information
    This would typically be handled by your frontend/API
    """
    confirmation_data = {
        "cart_summary": cart_summary,
        "user_info": user_info,
        "delivery_info": {
            "address": user_info.get("address", ""),
            "phone": user_info.get("phone", ""),
            "email": user_info.get("email", ""),
            "delivery_instructions": ""
        },
        "payment_info": {
            "payment_method": "credit_card",  # Default
            "card_number": "",
            "expiry": "",
            "cvv": ""
        },
        "order_preferences": {
            "delivery_time": "",
            "substitutions_allowed": True,
            "contactless_delivery": True
        }
    }
    
    return confirmation_data

async def complete_checkout(store_config, confirmation_data):
    """
    Complete the checkout process with user-provided information
    """
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=False,
                timeout=120000  # 2 minutes timeout
            )
            page = await browser.new_page()
            
            # Set page timeout to 2 minutes
            page.set_default_timeout(120000)
            page.set_default_navigation_timeout(120000)
            
            # Navigate to cart/checkout
            await page.goto(store_config["url"], timeout=120000)
            await page.click(store_config["cart_selector"])
            await page.wait_for_timeout(5000)  # Wait 5 seconds
            
            # Click checkout
            await page.click(store_config["checkout_selector"])
            await page.wait_for_timeout(10000)  # Wait 10 seconds for checkout page
            
            # Fill delivery information
            delivery_info = confirmation_data["delivery_info"]
            
            if delivery_info.get("address"):
                await page.fill(store_config["address_selector"], delivery_info["address"])
            
            if delivery_info.get("phone"):
                await page.fill(store_config["phone_selector"], delivery_info["phone"])
            
            if delivery_info.get("email"):
                await page.fill(store_config["email_selector"], delivery_info["email"])
            
            # Fill postal code
            postal_code = confirmation_data["user_info"]["location"].replace(" ", "")
            await page.fill(store_config["postal_code_selector"], postal_code)
            
            # Continue to payment
            await page.click("button:has-text('Continue'), button:has-text('Next')")
            await page.wait_for_timeout(10000)  # Wait 10 seconds
            
            # Take final screenshot
            await page.screenshot(path="checkout_complete.png")
            
            # Note: Actual payment processing would require secure handling
            # For now, we'll simulate order placement
            
            await browser.close()
            
            return {
                "status": "checkout_completed",
                "order_id": f"ORDER_{int(time.time())}",
                "screenshot": "checkout_complete.png"
            }
            
    except Exception as e:
        return {
            "status": "checkout_failed",
            "error": str(e)
        }
