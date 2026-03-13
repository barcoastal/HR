"use client";

import { cn } from "@/lib/utils";
import { Building, Save, Upload, Check, X, Image, Globe } from "lucide-react";
import { useState, useRef } from "react";
import { updateCompanySettings } from "@/lib/actions/company-settings";
import { useRouter } from "next/navigation";

type CompanySettingsData = {
  companyName: string;
  domain: string;
  industry: string;
  companySize: string;
  logoUrl: string | null;
  faviconUrl: string | null;
};

function InputField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">{label}</label>
      <input
        type="text"
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

function ImageUpload({
  label,
  description,
  currentUrl,
  uploadType,
  icon: Icon,
  onUploaded,
  onRemoved,
}: {
  label: string;
  description: string;
  currentUrl: string | null;
  uploadType: "logo" | "favicon";
  icon: typeof Image;
  onUploaded: (url: string) => void;
  onRemoved: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(file: File) {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", uploadType);
    try {
      const res = await fetch("/api/branding", { method: "POST", body: formData });
      if (res.ok) {
        const { url } = await res.json();
        onUploaded(url);
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">{label}</label>
      {currentUrl ? (
        <div className="flex items-center gap-4 p-3 rounded-lg bg-[var(--color-background)] border border-[var(--color-border)]">
          <img
            src={currentUrl}
            alt={label}
            className={cn(
              "object-contain bg-white rounded-lg border border-[var(--color-border)]",
              uploadType === "favicon" ? "h-8 w-8" : "h-12 w-auto max-w-[160px]"
            )}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-[var(--color-text-primary)] truncate">Current {label.toLowerCase()}</p>
            <p className="text-xs text-[var(--color-text-muted)]">Click remove to change</p>
          </div>
          <button
            onClick={onRemoved}
            className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
            title="Remove"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <>
          <input
            type="file"
            ref={inputRef}
            accept="image/png,image/jpeg,image/svg+xml,image/x-icon,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
            }}
          />
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className={cn(
              "flex items-center justify-center gap-3 w-full p-5 rounded-lg border-2 border-dashed",
              "border-[var(--color-border)] hover:border-[var(--color-accent)]/50",
              "transition-colors cursor-pointer"
            )}
          >
            {uploading ? (
              <p className="text-sm text-[var(--color-text-muted)]">Uploading...</p>
            ) : (
              <>
                <Icon className="h-5 w-5 text-[var(--color-text-muted)]" />
                <div className="text-left">
                  <p className="text-sm text-[var(--color-text-primary)]">Click to upload {label.toLowerCase()}</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{description}</p>
                </div>
              </>
            )}
          </button>
        </>
      )}
    </div>
  );
}

export function CompanyInfo({ settings }: { settings: CompanySettingsData }) {
  const [info, setInfo] = useState(settings);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  function update(field: keyof Pick<CompanySettingsData, "companyName" | "domain" | "industry" | "companySize">) {
    return (value: string) => {
      setInfo((prev) => ({ ...prev, [field]: value }));
      setSaved(false);
    };
  }

  async function handleSave() {
    setSaving(true);
    await updateCompanySettings({
      companyName: info.companyName,
      domain: info.domain,
      industry: info.industry,
      companySize: info.companySize,
      logoUrl: info.logoUrl,
      faviconUrl: info.faviconUrl,
    });
    setSaved(true);
    setSaving(false);
    router.refresh();
    setTimeout(() => setSaved(false), 2000);
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <ImageUpload
          label="Company Logo"
          description="PNG, JPG, or SVG (max 2MB). Used in sidebar."
          currentUrl={info.logoUrl}
          uploadType="logo"
          icon={Image}
          onUploaded={(url) => { setInfo((p) => ({ ...p, logoUrl: url })); setSaved(false); }}
          onRemoved={() => { setInfo((p) => ({ ...p, logoUrl: null })); setSaved(false); }}
        />
        <ImageUpload
          label="Favicon"
          description="ICO, PNG, or SVG (max 2MB). Browser tab icon."
          currentUrl={info.faviconUrl}
          uploadType="favicon"
          icon={Globe}
          onUploaded={(url) => { setInfo((p) => ({ ...p, faviconUrl: url })); setSaved(false); }}
          onRemoved={() => { setInfo((p) => ({ ...p, faviconUrl: null })); setSaved(false); }}
        />
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium",
            saved ? "bg-emerald-500 text-white" : "bg-[var(--color-accent)] text-white",
            saved ? "hover:bg-emerald-600" : "hover:bg-[var(--color-accent-hover)]",
            "transition-colors disabled:opacity-50",
            !saved && "shadow-[0_0_12px_var(--color-accent-glow)]"
          )}
        >
          {saved ? (
            <><Check className="h-4 w-4" />Saved!</>
          ) : saving ? (
            <>Saving...</>
          ) : (
            <><Save className="h-4 w-4" />Save Changes</>
          )}
        </button>
      </div>
    </section>
  );
}
