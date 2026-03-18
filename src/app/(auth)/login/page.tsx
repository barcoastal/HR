"use client";

import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const errorParam = searchParams.get("error");
  const errorMessage =
    errorParam === "domain"
      ? "Only @coastaldebt.com accounts can sign in."
      : errorParam === "not-invited"
        ? "You haven't been invited yet. Ask your admin for access."
        : errorParam === "unauthorized"
          ? "You don't have permission to access that page."
          : null;

  return (
    <>
      {errorMessage && (
        <div className="flex items-center gap-2 p-3 mb-6 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {errorMessage}
        </div>
      )}

      <button
        onClick={() => signIn("google", { callbackUrl })}
        className={cn(
          "w-full flex items-center justify-center gap-3 py-3 rounded-xl text-sm font-medium",
          "bg-[var(--color-background)] border border-[var(--color-border)]",
          "text-[var(--color-text-primary)]",
          "hover:bg-[var(--color-surface-hover)] transition-colors",
          "active:scale-[0.98]"
        )}
      >
        <GoogleIcon className="h-5 w-5" />
        Sign in with Google
      </button>
    </>
  );
}

export default function LoginPage() {
  const [branding, setBranding] = useState<{ companyName: string; logoUrl: string | null }>({
    companyName: "",
    logoUrl: null,
  });

  useEffect(() => {
    fetch("/api/branding")
      .then((r) => r.json())
      .then((data) => setBranding(data))
      .catch(() => setBranding({ companyName: "Coastal HR", logoUrl: null }));
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)] px-4">
      <div className="fixed inset-0 bg-gradient-to-br from-[var(--color-accent)]/5 via-transparent to-purple-500/5 pointer-events-none" />

      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-[var(--color-accent)]/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div
          className={cn(
            "glass-card rounded-3xl p-8",
            "shadow-xl shadow-black/10"
          )}
        >
          <div className="text-center mb-8">
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={branding.companyName}
                className="h-14 max-w-[200px] object-contain mx-auto mb-4"
              />
            ) : (
              <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-gradient-to-br from-[var(--color-accent)] to-purple-600 mb-4 shadow-[0_0_20px_var(--color-accent-glow)] animate-glow-pulse">
                <span className="text-white font-bold text-lg">
                  {branding.companyName?.[0] || "C"}
                </span>
              </div>
            )}
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
              {branding.companyName || "\u00A0"}
            </h1>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              Sign in with your company account
            </p>
          </div>

          <Suspense fallback={<div className="text-center text-sm text-[var(--color-text-muted)] py-4">Loading...</div>}>
            <LoginForm />
          </Suspense>
        </div>

        <p className="text-center text-xs text-[var(--color-text-muted)] mt-6">
          Only @coastaldebt.com accounts can sign in.
        </p>
      </div>
    </div>
  );
}
