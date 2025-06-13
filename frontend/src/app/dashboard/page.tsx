"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const [user, setUser] = useState<any | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, []);

  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="font-semibold text-2xl mb-4">Welcome{user && `, ${user.email}`}</h2>
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