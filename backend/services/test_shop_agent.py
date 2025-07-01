import asyncio
import os
from dotenv import load_dotenv
from supabase import create_client, Client
import uuid
from shop_agent import shop_for_me, shop_for_me_complete, generate_cart_summary, supabase
import traceback

load_dotenv ()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_test_ids():
    """Get real IDs from database or create test data if none exist"""
    print("🔍 Fetching real IDs from database...")
    
    # Try to get existing grocery lists
    try:
        grocery_lists = supabase.table('grocery_lists').select('id, store, created_at').limit(5).execute()
        if grocery_lists.data:
            print("\n📋 Available Grocery Lists:")
            for i, gl in enumerate(grocery_lists.data):
                print(f"   {i+1}. ID: {gl['id']}")
                print(f"      Store: {gl.get('store', 'N/A')}")
                print(f"      Created: {gl.get('created_at', 'N/A')}")
            
            # Use the first grocery list
            grocery_list_id = grocery_lists.data[0]['id']
            print(f"\n✅ Using grocery list: {grocery_list_id}")
        else:
            print("❌ No grocery lists found, creating test data...")
            grocery_list_id = create_test_grocery_list()
            
    except Exception as e:
        print(f"❌ Error fetching grocery lists: {e}")
        print("Creating test data...")
        grocery_list_id = create_test_grocery_list()
    
    # Try to get existing users
    try:
        users = supabase.table('user_profiles').select('user_id, location, created_at').limit(5).execute()
        if users.data:
            print("\n👥 Available Users:")
            for i, user in enumerate(users.data):
                print(f"   {i+1}. ID: {user['user_id']}")
                print(f"      Location: {user.get('location', 'N/A')}")
                print(f"      Created: {user.get('created_at', 'N/A')}")
            
            # Use the first user
            user_id = users.data[0]['user_id']
            print(f"\n✅ Using user: {user_id}")
        else:
            print("❌ No users found, creating test data...")
            user_id = create_test_user()
            
    except Exception as e:
        print(f"❌ Error fetching users: {e}")
        print("Creating test data...")
        user_id = create_test_user()
    
    return grocery_list_id, user_id

def create_test_user():
    """Create a test user if none exist"""
    test_user_id = f"test_user_{uuid.uuid4().hex[:8]}"
    user_data = {
        "user_id": test_user_id,
        "location": "M5V 3A8",
        "email": "test@example.com",
        "phone": "416-555-0123"
    }
    
    try:
        user_resp = supabase.table('user_profiles').insert(user_data).execute()
        print(f"✅ Created test user: {test_user_id}")
        return test_user_id
    except Exception as e:
        print(f"⚠️  Error creating user: {e}")
        # Return a fallback ID
        return "test_user_123456"

def create_test_grocery_list():
    """Create a test grocery list if none exist"""
    test_grocery_list_id = str(uuid.uuid4())
    grocery_data = {
        "id": test_grocery_list_id,
        "user_id": "test_user_123456",  # Will be updated if user exists
        "store": "No Frills",
        "list_items": [
            {"name": "bananas", "quantity": 1},
            {"name": "milk", "quantity": 1},
            {"name": "bread", "quantity": 1},
            {"name": "eggs", "quantity": 1}
        ],
        "total_price": 25.50
    }
    
    try:
        grocery_resp = supabase.table('grocery_lists').insert(grocery_data).execute()
        print(f"✅ Created test grocery list: {test_grocery_list_id}")
        return test_grocery_list_id
    except Exception as e:
        print(f"⚠️  Error creating grocery list: {e}")
        # Return a fallback ID
        return "550e8400-e29b-41d4-a716-446655440000"

def ensure_grocery_list_has_store(grocery_list_id):
    """Ensure the grocery list has a store specified"""
    try:
        # Check if store is already set
        grocery_list = supabase.table('grocery_lists').select('store').eq('id', grocery_list_id).single().execute()
        
        if not grocery_list.data.get('store'):
            # Update with a default store
            supabase.table('grocery_lists').update({
                "store": "No Frills"
            }).eq('id', grocery_list_id).execute()
            print(f"✅ Updated grocery list with store: No Frills")
        else:
            print(f"✅ Grocery list already has store: {grocery_list.data['store']}")
            
    except Exception as e:
        print(f"⚠️  Error checking/updating store: {e}")

# Get real test IDs
TEST_GROCERY_LIST_ID, TEST_USER_ID = get_test_ids()
ensure_grocery_list_has_store(TEST_GROCERY_LIST_ID)

def test_basic_functionality():
    """Test basic cart building without automation"""
    print("🔍 Testing basic cart building...")
    
    try:
        from shop_agent import build_cart_for_user
        cart = build_cart_for_user(TEST_GROCERY_LIST_ID, TEST_USER_ID)
        print(f"✅ Cart built successfully: {cart['store']} - {len(cart['items'])} items")
        return True
    except Exception as e:
        print(f"❌ Cart building failed: {e}")
        print(f"Full error: {traceback.format_exc()}")
        return False

def test_shopping_automation():
    """Test the complete shopping automation"""
    print("\n🛒 Testing shopping automation...")
    
    try:
        # Test without user confirmation (cart review mode)
        result = shop_for_me(TEST_GROCERY_LIST_ID, TEST_USER_ID)
        print(f"✅ Shopping automation result: {result['status']}")
        
        if result['status'] == 'cart_ready_for_review':
            cart_summary = result['cart_summary']
            print(f"📊 Cart Summary:")
            print(f"   - Items requested: {cart_summary['total_items_requested']}")
            print(f"   - Items added: {cart_summary['items_added']}")
            print(f"   - Success rate: {cart_summary['success_rate']}")
            print(f"   - Cart total: {cart_summary['cart_total']}")
            
            # Show successful and failed items
            if cart_summary['successful_items']:
                print(f"✅ Successful items:")
                for item in cart_summary['successful_items']:
                    print(f"   - {item['name']} (qty: {item['quantity']})")
            
            if cart_summary['failed_items']:
                print(f"❌ Failed items:")
                for item in cart_summary['failed_items']:
                    print(f"   - {item['name']}: {item['reason']}")
        elif result['status'] == 'error':
            print(f"❌ Shopping automation error: {result.get('error', 'Unknown error')}")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ Shopping automation failed: {e}")
        print(f"Full error: {traceback.format_exc()}")
        return False

def test_with_user_confirmation():
    """Test with user confirmation (full checkout)"""
    print("\n💳 Testing with user confirmation...")
    
    # Mock user confirmation data
    user_confirmation = {
        "delivery_info": {
            "address": "123 Test Street, Toronto, ON M5V 3A8",
            "phone": "416-555-0123",
            "email": "test@example.com",
            "delivery_instructions": "Leave at front door"
        },
        "payment_info": {
            "payment_method": "credit_card",
            "card_number": "4111111111111111",  # Test card number
            "expiry": "12/25",
            "cvv": "123"
        },
        "order_preferences": {
            "delivery_time": "2:00 PM - 4:00 PM",
            "substitutions_allowed": True,
            "contactless_delivery": True
        }
    }
    
    try:
        result = shop_for_me(TEST_GROCERY_LIST_ID, TEST_USER_ID, user_confirmation)
        print(f"✅ Full checkout result: {result['status']}")
        
        if result['status'] == 'order_completed':
            print(f"🎉 Order completed successfully!")
            print(f"   - Order ID: {result['order_data']['order_id']}")
            print(f"   - Store: {result['order_data']['store']}")
            print(f"   - Status: {result['order_data']['order_status']}")
        elif result['status'] == 'error':
            print(f"❌ Checkout error: {result.get('error', 'Unknown error')}")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ Full checkout failed: {e}")
        print(f"Full error: {traceback.format_exc()}")
        return False

def test_individual_functions():
    """Test individual functions"""
    print("\n🔍 Testing individual functions...")
    
    try:
        # Test data fetching
        from shop_agent import fetch_grocery_list, fetch_user
        grocery_list = fetch_grocery_list(TEST_GROCERY_LIST_ID)
        user = fetch_user(TEST_USER_ID)
        print(f"✅ Data fetching successful")
        print(f"   - Store: {grocery_list['store']}")
        print(f"   - Items: {len(grocery_list['list_items'])}")
        print(f"   - User location: {user['location']}")
        
        return True
        
    except Exception as e:
        print(f"❌ Individual function test failed: {e}")
        print(f"Full error: {traceback.format_exc()}")
        return False

def test_playwright_setup():
    """Test if Playwright is working correctly"""
    print("\n🖥 Testing Playwright setup...")
    
    try:
        import asyncio
        from playwright.async_api import async_playwright
        
        async def test_browser():
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                page = await browser.new_page()
                await page.goto('https://www.google.com')
                title = await page.title()
                await browser.close()
                return title
        
        title = asyncio.run(test_browser())
        print(f"✅ Playwright working - Browser title: {title}")
        return True
        
    except Exception as e:
        print(f"❌ Playwright test failed: {e}")
        print(f"Full error: {traceback.format_exc()}")
        return False

def main():
    """Run all tests"""
    print("🚀 Starting Shop Agent Tests...\n")
    
    tests = [
        ("Basic Functionality", test_basic_functionality),
        ("Individual Functions", test_individual_functions),
        ("Playwright Setup", test_playwright_setup),
        ("Shopping Automation", test_shopping_automation),
        ("Full Checkout", test_with_user_confirmation)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        print(f"📋 Running: {test_name}")
        try:
            success = test_func()
            results.append((test_name, success))
        except Exception as e:
            print(f"❌ Test {test_name} crashed: {e}")
            print(f"Full error: {traceback.format_exc()}")
            results.append((test_name, False))
        print("-" * 50)
    
    # Summary
    print("\n📊 Test Results Summary:")
    passed = sum(1 for _, success in results if success)
    total = len(results)
    
    for test_name, success in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"   {status} {test_name}")
    
    print(f"\n🎯 Overall: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Your shop agent is working correctly.")
    else:
        print("⚠️  Some tests failed. Check the errors above.")

if __name__ == "__main__":
    main()