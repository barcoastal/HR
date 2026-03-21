"use client";

import { FAB } from "@/components/ui/fab";

export default function OrgFABWrapper() {
  return (
    <FAB
      icon="add_moderator"
      variant="solid"
      onClick={() => document.getElementById("dept-actions")?.scrollIntoView({ behavior: "smooth" })}
    />
  );
}
