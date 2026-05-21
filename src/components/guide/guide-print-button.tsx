"use client";

import { Icon } from "@/components/ui/icon";

export function GuidePrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]"
    >
      <Icon name="picture_as_pdf" size={16} />
      Download as PDF
    </button>
  );
}
