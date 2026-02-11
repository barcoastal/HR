"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const statusRingColors = {
  active: "ring-green-500",
  onboarding: "ring-yellow-500",
  offline: "ring-gray-400",
} as const;

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  status?: "active" | "onboarding" | "offline";
}

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, status, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
        status && `ring-2 ring-offset-2 ring-offset-[var(--color-background)] ${statusRingColors[status]}`,
        className
      )}
      {...props}
    />
  )
);
Avatar.displayName = "Avatar";

const AvatarImage = React.forwardRef<
  HTMLImageElement,
  React.ImgHTMLAttributes<HTMLImageElement>
>(({ className, ...props }, ref) => (
  <img
    ref={ref}
    className={cn("aspect-square h-full w-full object-cover", className)}
    {...props}
  />
));
AvatarImage.displayName = "AvatarImage";

const AvatarFallback = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)] text-sm font-semibold",
      className
    )}
    {...props}
  />
));
AvatarFallback.displayName = "AvatarFallback";

export { Avatar, AvatarImage, AvatarFallback };
