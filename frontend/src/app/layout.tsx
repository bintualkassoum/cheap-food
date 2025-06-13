// app/layout.tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);

      // Only redirect if on root, not /auth, /upload, /gallery, etc
      if (pathname === "/") {
        if (user) {
          router.replace("/dashboard");
        } else {
          router.replace("/auth");
        }
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) router.replace("/auth");
    });
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, [router, pathname]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased">
        <Card className="rounded-none border-b-2 shadow-none">
          <header className="flex justify-between items-center px-6 py-4">
            <Link href={user ? "/dashboard" : "/"} className="font-bold text-xl tracking-tight">
              Cheap Food
            </Link>
            <nav className="flex items-center gap-4">
              {user && (
                <>
                  <Link href="/upload" className="text-sm hover:underline text-muted-foreground">Upload</Link>
                  <Link href="/gallery" className="text-sm hover:underline text-muted-foreground">Gallery</Link>
                </>
              )}
              {user ? (
                <>
                  <span className="text-xs text-muted-foreground">{user.email}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await supabase.auth.signOut();
                      setUser(null);
                      router.replace("/auth");
                    }}
                  >
                    Sign out
                  </Button>
                </>
              ) : (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => router.push("/auth")}
                >
                  Sign In
                </Button>
              )}
            </nav>
          </header>
        </Card>
        <main className="max-w-2xl mx-auto py-8 px-4">{children}</main>
      </body>
    </html>
  );
}
