"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const [user, setUser] = useState<any | null>(null);

  // Check or create user profile
  useEffect(() => {
    const fetchAndEnsureProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        // Check if user profile exists
        const { data: profile, error } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("user_id", user.id)
          .single();

        // If not found, insert a new profile row
        if (!profile) {
          await supabase.from("user_profiles").insert([
            {
              user_id: user.id,
              // Add any other default fields here
              location: "",
            }
          ]);
        }
      }
    };

    fetchAndEnsureProfile();
  }, []);

  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="font-semibold text-2xl mb-4">
          Welcome{user && `, ${user.email}`}
        </h2>
        <p className="mb-4">Here you can upload a meal image, view your recipes, and more.</p>
        <div className="flex gap-4">
          <Button asChild>
            <Link href="/upload">Upload</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/gallery">Gallery</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
