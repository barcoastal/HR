"use client";

import { motion, AnimatePresence, type Variants } from "framer-motion";
import { useEffect, useState, useRef } from "react";

/* ── Page transition wrapper ─────────────────────────────── */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

/* ── Stagger container + item ─────────────────────────────── */
const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06 },
  },
};

const staggerItemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

export function StaggerContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={staggerItemVariants} className={className}>
      {children}
    </motion.div>
  );
}

/* ── Animated counter ────────────────────────────────────── */
export function AnimatedCounter({
  value,
  duration = 1,
  className,
}: {
  value: number;
  duration?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number | null>(null);

  useEffect(() => {
    const start = ref.current ?? 0;
    const diff = value - start;
    if (diff === 0) return;

    const startTime = performance.now();
    const step = (now: number) => {
      const elapsed = Math.min((now - startTime) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - elapsed, 3); // ease-out cubic
      const current = Math.round(start + diff * eased);
      setDisplay(current);
      if (elapsed < 1) {
        requestAnimationFrame(step);
      } else {
        ref.current = value;
      }
    };
    requestAnimationFrame(step);
  }, [value, duration]);

  return <span className={className}>{display.toLocaleString()}</span>;
}

export { AnimatePresence, motion };
