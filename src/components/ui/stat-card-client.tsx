"use client";

import { AnimatedCounter } from "./motion";

export function AnimatedCounterClient({ value }: { value: number }) {
  return <AnimatedCounter value={value} />;
}
