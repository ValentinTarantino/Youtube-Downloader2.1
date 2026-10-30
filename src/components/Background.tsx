"use client";

import { motion, useScroll, useSpring, useTransform, useReducedMotion } from "framer-motion";

export default function Background() {
  const { scrollY } = useScroll();
  const prefersReducedMotion = useReducedMotion();

  // The brick layer is 200% tall (top: -50%), so shifting it up to -24%
  // still covers the viewport. Percentages are relative to the layer itself.
  const rawY = useTransform(scrollY, [0, 2400], ["0%", "-24%"]);
  const y = useSpring(rawY, { stiffness: 60, damping: 20, mass: 0.3 });

  return (
    <>
      <motion.div
        className="pixel-brick-background"
        style={{ y: prefersReducedMotion ? "0%" : y }}
        aria-hidden="true"
      />
      <div className="pixel-scanlines" aria-hidden="true" />
    </>
  );
}
