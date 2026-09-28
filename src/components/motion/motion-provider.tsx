"use client";

import { LazyMotion, MotionConfig, domAnimation } from "motion/react";
import type { ReactNode } from "react";

/**
 * Wraps the app once, in the root layout.
 *
 * `LazyMotion` with `domAnimation` loads a ~15kB feature bundle instead of the
 * full library, and `strict` makes the `motion.*` components throw so we are
 * forced to use `m.*` — which is what keeps the saving (NFR-01).
 *
 * `reducedMotion="user"` is the important part for accessibility (NFR-05):
 * when someone has asked their operating system to reduce motion, Motion drops
 * every transform and layout animation automatically and leaves only the fade.
 * Nothing slides, so the vestibular trigger is gone, and we do not have to
 * remember the check at each call site.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
