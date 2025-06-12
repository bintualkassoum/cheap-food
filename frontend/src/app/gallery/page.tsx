"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent } from "@/components/ui/card";

export default function GalleryPage() {
  const [uploads, setUploads] = useState<any[]>([]);

  useEffect(() => {
    async function fetchUploads() {
      const { data } = await supabase
        .from("uploads")
        .select("*")
        .order("created_at", { ascending: false });
      setUploads(data || []);
    }
    fetchUploads();
  }, []);

  return (
    <div className="grid gap-4 p-8 md:grid-cols-3">
      {uploads.map(upload => (
        <Card key={upload.id}>
          <CardContent>
            <img
              src={`https://hwbruggymqgjmynacbxb.supabase.co/storage/v1/object/public/${upload.file_url}`}
              alt={upload.description || "upload"}
              className="w-full rounded"
            />
            <div className="mt-2 text-xs">{upload.description}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
