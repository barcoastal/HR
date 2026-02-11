"use client";

import { cn } from "@/lib/utils";
import { Lock, Mail, Eye, EyeOff, Chrome } from "lucide-react";
import { useState } from "react";

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

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)] px-4">
      {/* Subtle background gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-[var(--color-accent)]/5 via-transparent to-purple-500/5 pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div
          className={cn(
            "rounded-2xl p-8",
            "bg-[var(--color-surface)] border border-[var(--color-border)]",
            "shadow-xl shadow-black/10"
          )}
        >
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-gradient-to-br from-[var(--color-accent)] to-purple-600 mb-4 shadow-[0_0_20px_var(--color-accent-glow)]">
              <span className="text-white font-bold text-lg">P</span>
            </div>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">PeopleHub</h1>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              Sign in to your HR platform
            </p>
          </div>

          {/* Form */}
          <div className="space-y-4">
            {/* Email Field */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5"
              >
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-muted)]" />
                <input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
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

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-[var(--color-text-primary)]"
                >
                  Password
                </label>
                <button className="text-xs text-[var(--color-accent)] hover:underline">
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-muted)]" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
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
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Sign In Button */}
            <button
              className={cn(
                "w-full py-2.5 rounded-lg text-sm font-semibold",
                "bg-gradient-to-r from-[var(--color-accent)] to-purple-600 text-white",
                "hover:from-[var(--color-accent-hover)] hover:to-purple-500",
                "transition-all",
                "shadow-[0_0_20px_var(--color-accent-glow)]",
                "active:scale-[0.98]"
              )}
            >
              Sign In
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-[var(--color-border)]" />
            <span className="text-xs text-[var(--color-text-muted)]">or continue with</span>
            <div className="flex-1 h-px bg-[var(--color-border)]" />
          </div>

          {/* SSO Buttons */}
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
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-[var(--color-text-muted)] mt-6">
          By signing in, you agree to our{" "}
          <button className="text-[var(--color-accent)] hover:underline">Terms of Service</button>{" "}
          and{" "}
          <button className="text-[var(--color-accent)] hover:underline">Privacy Policy</button>.
        </p>
      </div>
    </div>
  );
}
