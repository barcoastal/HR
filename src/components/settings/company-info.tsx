"use client";

import { cn } from "@/lib/utils";
import { Building, Save, Upload, Check } from "lucide-react";
import { useState, useEffect } from "react";

const STORAGE_KEY = "coastal-hr-company-info";

type CompanyInfo = {
  companyName: string;
  domain: string;
  industry: string;
  companySize: string;
};

const defaults: CompanyInfo = {
  companyName: "Coastal HR Inc.",
  domain: "coastalhr.io",
  industry: "Technology",
  companySize: "48",
};

function InputField({
  label,
  placeholder,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full px-3 py-2 rounded-lg text-sm",
          "bg-[var(--color-background)] border border-[var(--color-border)]",
          "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
          "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]",
          "transition-all"
        )}
      />
    </div>
  );
}

export function CompanyInfo() {
  const [info, setInfo] = useState<CompanyInfo>(defaults);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setInfo(JSON.parse(stored));
      }
    } catch {
      // ignore parse errors, use defaults
    }
    setLoaded(true);
  }, []);

  function update(field: keyof CompanyInfo) {
    return (value: string) => {
      setInfo((prev) => ({ ...prev, [field]: value }));
      setSaved(false);
    };
  }

  function handleSave() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(info));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // localStorage may be unavailable
    }
  }

  if (!loaded) {
    return (
      <section className={cn("rounded-xl p-6", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
        <div className="flex items-center gap-2 mb-5">
          <Building className="h-5 w-5 text-[var(--color-accent)]" />
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Company Information</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[62px] rounded-lg bg-[var(--color-background)] animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className={cn("rounded-xl p-6", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
      <div className="flex items-center gap-2 mb-5">
        <Building className="h-5 w-5 text-[var(--color-accent)]" />
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Company Information</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <InputField label="Company Name" placeholder="Your company name" value={info.companyName} onChange={update("companyName")} />
        <InputField label="Domain" placeholder="yourdomain.com" value={info.domain} onChange={update("domain")} />
        <InputField label="Industry" placeholder="Technology, Healthcare, etc." value={info.industry} onChange={update("industry")} />
        <InputField label="Company Size" placeholder="Number of employees" value={info.companySize} onChange={update("companySize")} />
      </div>
      <div className="mb-5">
        <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Company Logo</label>
        <div className={cn("flex items-center justify-center gap-3 p-6 rounded-lg border-2 border-dashed", "border-[var(--color-border)] hover:border-[var(--color-accent)]/50", "transition-colors cursor-pointer")}>
          <Upload className="h-5 w-5 text-[var(--color-text-muted)]" />
          <div className="text-center">
            <p className="text-sm text-[var(--color-text-primary)]">Click to upload or drag and drop</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">SVG, PNG, or JPG (max 2MB)</p>
          </div>
        </div>
      </div>
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium",
            saved
              ? "bg-emerald-500 text-white"
              : "bg-[var(--color-accent)] text-white",
            saved
              ? "hover:bg-emerald-600"
              : "hover:bg-[var(--color-accent-hover)]",
            "transition-colors",
            !saved && "shadow-[0_0_12px_var(--color-accent-glow)]"
          )}
        >
          {saved ? (
            <>
              <Check className="h-4 w-4" />Saved!
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />Save Changes
            </>
          )}
        </button>
      </div>
    </section>
  );
}
