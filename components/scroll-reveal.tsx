"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type ScrollRevealProps = {
  children: ReactNode;
  className?: string;
  /** Stagger direct children instead of animating the wrapper as one block. */
  stagger?: boolean;
};

/**
 * Reveals content the first time it scrolls into view. The hiding class is only
 * added after hydration, so no-JS visitors and crawlers always see the content,
 * and prefers-reduced-motion skips the effect entirely.
 */
export function ScrollReveal({ children, className, stagger = false }: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    node.classList.add("payna-reveal-init");
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          node.classList.add("is-inview");
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.1 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={cn(stagger && "payna-stagger", className)}>
      {children}
    </div>
  );
}
