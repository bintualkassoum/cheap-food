// app/upload/page.tsx
"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleUpload() {
    if (!file) return;

    // Step 1: Upload to Storage
    const { data, error } = await supabase.storage
      .from("uploads")
      .upload(`public/${file.name}`, file);

    if (error) {
      setMessage(`Error: ${error.message}`);
      return;
    }

    // Step 2: Insert row in uploads table
    const { data: userData } = await supabase.auth.getUser();

    if (!userData?.user) {
      setMessage("Error: You must be logged in to upload files.");
      return;
    }

    const insertResp = await supabase.from("uploads").insert([
      {
        user_id: userData.user.id,
        upload_type: file.type.startsWith("image") ? "image" : "video",
        file_url: data.path,
        source: "direct_upload",
        processed: false,
        description: file.name,
      }
    ]);

    if (insertResp.error) {
      setMessage(`Error saving metadata: ${insertResp.error.message}`);
      return;
    }

    setMessage("Upload successful!");
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-md">
        <CardContent>
          <Input
            type="file"
            onChange={e => setFile(e.target.files ? e.target.files[0] : null)}
            className="mb-4"
          />
          <Button className="w-full" onClick={handleUpload}>
            Upload
          </Button>
          {message && <div className="mt-4">{message}</div>}
        </CardContent>
      </Card>
    </div>
  );
}
