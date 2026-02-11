"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Newspaper,
  Users,
  Building2,
  ClipboardCheck,
  Menu,
  UserPlus,
  UserMinus,
  Settings,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/", label: "Feed", icon: Newspaper },
  { href: "/people", label: "People", icon: Users },
  { href: "/org", label: "Org", icon: Building2 },
  { href: "/reviews", label: "Tasks", icon: ClipboardCheck },
] as const;

const drawerLinks = [
  { href: "/onboarding", label: "Onboarding", icon: UserPlus },
  { href: "/offboarding", label: "Offboarding", icon: UserMinus },
  { href: "/reviews", label: "Reviews", icon: ClipboardCheck },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function MobileNav() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <>
      {/* Bottom tab bar */}
      <div
        className={cn(
          "glass fixed bottom-0 left-0 right-0 z-50 flex md:hidden",
          "border-t border-[var(--color-border)]"
        )}
      >
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2 transition-colors duration-200",
                active
                  ? "text-[var(--color-accent)]"
                  : "text-[var(--color-text-muted)]"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}

        {/* More tab */}
        <button
          onClick={() => setDrawerOpen(true)}
          className={cn(
            "flex flex-1 flex-col items-center gap-1 py-2 transition-colors duration-200",
            "text-[var(--color-text-muted)]"
          )}
        >
          <Menu className="h-5 w-5" />
          <span className="text-[10px] font-medium">More</span>
        </button>
      </div>

      {/* Slide-up drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/50 md:hidden"
              onClick={() => setDrawerOpen(false)}
            />

            {/* Drawer */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className={cn(
                "glass fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl md:hidden",
                "border-t border-[var(--color-border)]"
              )}
            >
              {/* Drawer handle */}
              <div className="flex items-center justify-between px-5 pb-2 pt-4">
                <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                  More
                </span>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="rounded-full p-1 text-[var(--color-text-muted)] transition-colors duration-200 hover:bg-[var(--color-surface-hover)]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Drawer links */}
              <nav className="space-y-1 px-3 pb-8 pt-1">
                {drawerLinks.map(({ href, label, icon: Icon }) => {
                  const active = isActive(href);
                  return (
                    <Link
                      key={label}
                      href={href}
                      onClick={() => setDrawerOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium",
                        "transition-colors duration-200",
                        active
                          ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                          : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
                      )}
                    >
                      <Icon className="h-[18px] w-[18px]" />
                      {label}
                    </Link>
                  );
                })}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
