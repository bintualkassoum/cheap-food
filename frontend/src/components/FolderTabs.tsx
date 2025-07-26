"use client"

import type React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { UtensilsCrossed, Sparkles, Heart, DollarSign, TrendingDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabaseClient"

interface Tab {
  id: string
  label: string
  icon: React.ReactNode
  content: React.ReactNode
}

export default function FolderTabs() {
  const [activeTab, setActiveTab] = useState("meals")
  const [meals, setMeals] = useState<any[]>([])
  const router = useRouter()

  // Fetch a few meals for the preview
  useEffect(() => {
    async function fetchMeals() {
      // Get the latest 3 saved meals from the gallery
      const { data: galleryRows, error } = await supabase
        .from("gallery")
        .select("id, recipe_id, grocery_list_id")
        .order("saved_at", { ascending: false })
        .limit(3);

      if (!galleryRows) {
        setMeals([]);
        return;
      }

      // For each, fetch the recipe and grocery list
      const mealsWithDetails = await Promise.all(
        galleryRows.map(async (row) => {
          // Fetch recipe
          const { data: recipe } = await supabase
            .from("recipes")
            .select("id, title, image_url, ingredients, instructions, description")
            .eq("id", row.recipe_id)
            .single();

          // Fetch grocery list - use the correct column names
          const { data: grocery, error: groceryError } = await supabase
            .from("grocery_lists")
            .select("id, store, list_items, total_price, total_savings")
            .eq("id", row.grocery_list_id)
            .single();

          console.log('Grocery query result:', {
            grocery_list_id: row.grocery_list_id,
            grocery,
            groceryError,
            hasData: !!grocery
          });

          // Handle grocery list data with proper error handling
          let processedListItems = [];
          if (grocery?.list_items) {
            try {
              // Handle if list_items is a JSON string
              const parsed = typeof grocery.list_items === 'string' 
                ? JSON.parse(grocery.list_items) 
                : grocery.list_items;
              
              // Handle if it's an array of objects vs array of strings
              processedListItems = Array.isArray(parsed) 
                ? parsed.map((item: any) => typeof item === "string" ? item : item.name || item.title || "Unknown item")
                : [];
            } catch (e) {
              console.error('Error parsing list_items:', e);
              processedListItems = [];
            }
          }

          return {
            id: row.id,
            recipe_id: row.recipe_id,
            grocery_list_id: row.grocery_list_id,
            title: recipe?.title || "Untitled",
            image_url: recipe?.image_url || "/placeholder.svg",
            ingredients: Array.isArray(recipe?.ingredients)
              ? recipe.ingredients.map((ing: any) => typeof ing === "string" ? ing : ing.name)
              : [],
            total_price: grocery?.total_price ? `$${Number(grocery.total_price).toFixed(2)}` : "$--",
            total_savings: grocery?.total_savings ? `Save $${Number(grocery.total_savings).toFixed(2)}` : "Save $--",
            store: grocery?.store || "Unknown Store",
            store_id: null, // This column doesn't exist in your table
            list_items: processedListItems,
          };
        })
      );

      setMeals(mealsWithDetails);
    }
    fetchMeals();
  }, [])

  const mealsTabContent = (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-black">Meals</h3>
        <button
          className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-black border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          onClick={() => router.push("/gallery/meals")}
        >
          See All
        </button>
      </div>
      <div className="grid gap-3">
        {meals.length === 0 && <div>No meals found.</div>}
        {meals.map((meal) => (
          <Link key={meal.id} href={`/gallery/meals/${meal.recipe_id}`} className="block">
            <div className="flex gap-4 p-4 bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow cursor-pointer">
              <div className="w-24 h-24 bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center relative overflow-hidden">
                <img
                  src={meal.image_url}
                  alt={meal.title}
                  className="w-full h-full object-cover rounded-lg"
                />
              </div>
              <div className="flex-1">
                <p className="font-medium text-black">{meal.title}</p>
                <p className="text-sm text-gray-600 mb-2">
                  {meal.ingredients.slice(0, 4).join(", ")}
                </p>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <DollarSign className="w-4 h-4 text-gray-600" />
                    <span className="text-black font-medium">
                      {meal.total_price}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-green-600">
                    <TrendingDown className="w-4 h-4" />
                    <span className="font-medium">
                      {meal.total_savings}
                    </span>
                  </div>
                  {meal.store && (
                    <div className="flex items-center gap-1 text-gray-600">
                      <span className="text-xs">at {meal.store}</span>
                    </div>
                  )}
                  {Array.isArray(meal.list_items) && meal.list_items.length > 0 && (
                    <div className="flex items-center gap-1 text-gray-600">
                      <span className="text-xs">{meal.list_items.length} items</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )

  const tabs: Tab[] = [
    {
      id: "meals",
      label: "Meals",
      icon: <UtensilsCrossed className="w-4 h-4" />,
      content: mealsTabContent,
    },
    {
      id: "makeup",
      label: "Makeup",
      icon: <Sparkles className="w-4 h-4" />,
      content: (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-black">Makeup Looks</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-white rounded-lg border border-gray-200">
              <div className="w-full h-32 bg-gray-100 rounded-lg mb-3 flex items-center justify-center relative overflow-hidden">
                <img
                  src="/placeholder.svg?height=128&width=200"
                  alt="Natural Glam Look"
                  className="w-full h-full object-cover rounded-lg grayscale"
                />
              </div>
              <p className="font-medium text-black mb-1">Natural Glam Look</p>
              <p className="text-sm text-gray-600 mb-3">Rose blush, nude lips, soft eyes</p>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4 text-gray-600" />
                  <span className="text-black font-medium">$45.99</span>
                </div>
                <div className="flex items-center gap-1 text-green-600">
                  <TrendingDown className="w-4 h-4" />
                  <span className="font-medium">Save $12.50</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-white rounded-lg border border-gray-200">
              <div className="w-full h-32 bg-gray-100 rounded-lg mb-3 flex items-center justify-center relative overflow-hidden">
                <img
                  src="/placeholder.svg?height=128&width=200"
                  alt="Smokey Eye Look"
                  className="w-full h-full object-cover rounded-lg grayscale"
                />
              </div>
              <p className="font-medium text-black mb-1">Smokey Eye Look</p>
              <p className="text-sm text-gray-600 mb-3">Purple shadows, winged liner</p>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4 text-gray-600" />
                  <span className="text-black font-medium">$38.75</span>
                </div>
                <div className="flex items-center gap-1 text-green-600">
                  <TrendingDown className="w-4 h-4" />
                  <span className="font-medium">Save $8.25</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-white rounded-lg border border-gray-200">
              <div className="w-full h-32 bg-gray-100 rounded-lg mb-3 flex items-center justify-center relative overflow-hidden">
                <img
                  src="/placeholder.svg?height=128&width=200"
                  alt="Bold Red Lip Look"
                  className="w-full h-full object-cover rounded-lg grayscale"
                />
              </div>
              <p className="font-medium text-black mb-1">Bold Red Lip Look</p>
              <p className="text-sm text-gray-600 mb-3">Classic red lips, minimal eyes</p>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4 text-gray-600" />
                  <span className="text-black font-medium">$29.50</span>
                </div>
                <div className="flex items-center gap-1 text-green-600">
                  <TrendingDown className="w-4 h-4" />
                  <span className="font-medium">Save $6.75</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-white rounded-lg border border-gray-200">
              <div className="w-full h-32 bg-gray-100 rounded-lg mb-3 flex items-center justify-center relative overflow-hidden">
                <img
                  src="/placeholder.svg?height=128&width=200"
                  alt="Summer Bronze Look"
                  className="w-full h-full object-cover rounded-lg grayscale"
                />
              </div>
              <p className="font-medium text-black mb-1">Summer Bronze Look</p>
              <p className="text-sm text-gray-600 mb-3">Golden glow, warm bronzer</p>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4 text-gray-600" />
                  <span className="text-black font-medium">$52.25</span>
                </div>
                <div className="flex items-center gap-1 text-green-600">
                  <TrendingDown className="w-4 h-4" />
                  <span className="font-medium">Save $15.80</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "skincare",
      label: "Skincare",
      icon: <Heart className="w-4 h-4" />,
      content: (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-black">Skincare Routines</h3>
          <div className="space-y-4">
            <div className="flex items-start gap-4 p-4 bg-white rounded-lg border border-gray-200">
              <div className="w-20 h-20 bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center relative overflow-hidden">
                <img
                  src="/placeholder.svg?height=80&width=80"
                  alt="Morning Routine"
                  className="w-full h-full object-cover rounded-lg grayscale"
                />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center text-white font-bold text-xs">
                    AM
                  </div>
                  <p className="font-medium text-black">Morning Routine</p>
                </div>
                <p className="text-sm text-gray-600 mb-3">Cleanser → Vitamin C Serum → Moisturizer → SPF</p>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <DollarSign className="w-4 h-4 text-gray-600" />
                    <span className="text-black font-medium">$67.50</span>
                  </div>
                  <div className="flex items-center gap-1 text-green-600">
                    <TrendingDown className="w-4 h-4" />
                    <span className="font-medium">Save $18.25</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 bg-white rounded-lg border border-gray-200">
              <div className="w-20 h-20 bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center relative overflow-hidden">
                <img
                  src="/placeholder.svg?height=80&width=80"
                  alt="Evening Routine"
                  className="w-full h-full object-cover rounded-lg grayscale"
                />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center text-white font-bold text-xs">
                    PM
                  </div>
                  <p className="font-medium text-black">Evening Routine</p>
                </div>
                <p className="text-sm text-gray-600 mb-3">Double Cleanse → Retinol → Hyaluronic Acid → Night Cream</p>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <DollarSign className="w-4 h-4 text-gray-600" />
                    <span className="text-black font-medium">$89.75</span>
                  </div>
                  <div className="flex items-center gap-1 text-green-600">
                    <TrendingDown className="w-4 h-4" />
                    <span className="font-medium">Save $24.50</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 bg-white rounded-lg border border-gray-200">
              <div className="w-20 h-20 bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center relative overflow-hidden">
                <img
                  src="/placeholder.svg?height=80&width=80"
                  alt="Weekly Treatments"
                  className="w-full h-full object-cover rounded-lg grayscale"
                />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center text-white font-bold text-xs">
                    2x
                  </div>
                  <p className="font-medium text-black">Weekly Treatments</p>
                </div>
                <p className="text-sm text-gray-600 mb-3">Exfoliating Mask → Hydrating Sheet Mask</p>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <DollarSign className="w-4 h-4 text-gray-600" />
                    <span className="text-black font-medium">$32.25</span>
                  </div>
                  <div className="flex items-center gap-1 text-green-600">
                    <TrendingDown className="w-4 h-4" />
                    <span className="font-medium">Save $9.75</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
    },
  ]

  const activeTabContent = tabs.find((tab) => tab.id === activeTab)?.content

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
        {/* Folder Tabs */}
        <div className="relative">
          <div className="flex">
            {tabs.map((tab, index) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative px-6 py-3 font-medium text-sm transition-all duration-200 flex items-center gap-2",
                  "border-t-2 border-l-2 border-r-2 rounded-t-lg",
                  "hover:bg-gray-50",
                  activeTab === tab.id
                    ? "bg-white border-gray-300 text-black z-10 -mb-px"
                    : "bg-gray-50 border-gray-300 text-gray-600 mt-1",
                )}
                style={{
                  marginLeft: index > 0 ? "-1px" : "0",
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
          {/* Folder base line */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gray-300 z-0"></div>
        </div>

        {/* Folder Content */}
        <div className="border-l-2 border-r-2 border-b-2 border-gray-300 bg-white">
          <div className="p-6 min-h-[400px]">{activeTabContent}</div>
        </div>
      </div>
    </div>
  )
}
