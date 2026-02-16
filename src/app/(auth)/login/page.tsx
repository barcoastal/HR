"use client";

import { cn } from "@/lib/utils";
import { Lock, Mail, Eye, EyeOff, Chrome, AlertCircle } from "lucide-react";
import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password");
    } else {
      router.push(callbackUrl);
      router.refresh();
    }
  }

  return (
    <>
      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
            Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-muted)]" />
            <input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={cn(
                "w-full pl-10 pr-4 py-2.5 rounded-lg text-sm",
                "bg-[var(--color-background)] border border-[var(--color-border)]",
                "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
                "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]",
                "transition-all"
              )}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="password" className="block text-sm font-medium text-[var(--color-text-primary)]">
              Password
            </label>
            <button type="button" className="text-xs text-[var(--color-accent)] hover:underline">
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-muted)]" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={cn(
                "w-full pl-10 pr-10 py-2.5 rounded-lg text-sm",
                "bg-[var(--color-background)] border border-[var(--color-border)]",
                "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
                "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]",
                "transition-all"
              )}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className={cn(
            "w-full py-2.5 rounded-lg text-sm font-semibold",
            "bg-gradient-to-r from-[var(--color-accent)] to-purple-600 text-white",
            "hover:from-[var(--color-accent-hover)] hover:to-purple-500",
            "transition-all",
            "shadow-[0_0_20px_var(--color-accent-glow)]",
            "active:scale-[0.98]",
            "disabled:opacity-60 disabled:cursor-not-allowed"
          )}
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>

      <div className="flex items-center gap-3 my-6">
        <div className="flex-1 h-px bg-[var(--color-border)]" />
        <span className="text-xs text-[var(--color-text-muted)]">or continue with</span>
        <div className="flex-1 h-px bg-[var(--color-border)]" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          className={cn(
            "flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium",
            "bg-[var(--color-background)] border border-[var(--color-border)]",
            "text-[var(--color-text-primary)]",
            "hover:bg-[var(--color-surface-hover)] transition-colors"
          )}
        >
          <Chrome className="h-4 w-4" />
          Google
        </button>
        <button
          className={cn(
            "flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium",
            "bg-[var(--color-background)] border border-[var(--color-border)]",
            "text-[var(--color-text-primary)]",
            "hover:bg-[var(--color-surface-hover)] transition-colors"
          )}
        >
          <MicrosoftIcon className="h-4 w-4" />
          Microsoft
        </button>
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)] px-4">
      <div className="fixed inset-0 bg-gradient-to-br from-[var(--color-accent)]/5 via-transparent to-purple-500/5 pointer-events-none" />

      <div className="relative w-full max-w-md">
        <div
          className={cn(
            "rounded-2xl p-8",
            "bg-[var(--color-surface)] border border-[var(--color-border)]",
            "shadow-xl shadow-black/10"
          )}
        >
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-gradient-to-br from-[var(--color-accent)] to-purple-600 mb-4 shadow-[0_0_20px_var(--color-accent-glow)]">
              <span className="text-white font-bold text-lg">C</span>
            </div>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Coastal HR</h1>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              Sign in to your HR platform
            </p>
          </div>

          <Suspense fallback={<div className="text-center text-sm text-[var(--color-text-muted)] py-4">Loading...</div>}>
            <LoginForm />
          </Suspense>
        </div>

        <p className="text-center text-xs text-[var(--color-text-muted)] mt-6">
          By signing in, you agree to our{" "}
          <button className="text-[var(--color-accent)] hover:underline">Terms of Service</button>{" "}
          and{" "}
          <button className="text-[var(--color-accent)] hover:underline">Privacy Policy</button>.
        </p>

        {/* Demo credentials hint */}
        <div className="mt-4 p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
          <p className="font-medium text-[var(--color-text-primary)] mb-1">Demo accounts:</p>
          <p>Admin: admin@coastalhr.io / admin123</p>
          <p>Manager: manager@coastalhr.io / manager123</p>
          <p>Employee: employee@coastalhr.io / employee123</p>
        </div>
      </div>
    </div>
  );
}
