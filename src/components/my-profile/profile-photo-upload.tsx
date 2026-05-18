"use client";

import { cn } from "@/lib/utils";
import { useState, useRef } from "react";
import { updateProfilePhoto } from "@/lib/actions/my-profile";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";

export function ProfilePhotoUpload({
  employeeId,
  currentPhoto,
  initials,
  colorClass,
}: {
  employeeId: string;
  currentPhoto: string | null;
  initials: string;
  colorClass: string;
}) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be under 5MB");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/onboarding-docs/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = await res.json();
      await updateProfilePhoto(employeeId, url);
      router.refresh();
    } catch {
      alert("Failed to upload photo");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="relative group cursor-pointer" onClick={() => fileRef.current?.click()}>
      {currentPhoto ? (
        <img
          src={currentPhoto}
          alt="Profile"
          className="h-20 w-20 rounded-2xl object-cover"
        />
      ) : (
        <div className={cn("h-20 w-20 rounded-2xl flex items-center justify-center text-white text-2xl font-bold", colorClass)}>
          {initials}
        </div>
      )}
      <div className={cn(
        "absolute inset-0 rounded-2xl flex items-center justify-center transition-opacity",
        "bg-black/50 opacity-0 group-hover:opacity-100"
      )}>
        {uploading ? (
          <Icon name="progress_activity" className="animate-material-spin text-white animate-spin" />
        ) : (
          <Icon name="photo_camera" className="text-white" />
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleUpload}
        className="hidden"
      />
    </div>
  );
}
