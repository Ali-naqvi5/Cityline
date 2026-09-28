"use client";

import { m, type Transition, type Variants } from "motion/react";
import type { ReactNode } from "react";

/**
 * Fade-and-rise wrapper for anything that should arrive as it scrolls into
 * view. Wrap a section, a card, an image — no boilerplate at the call site.
 *
 *   <ScrollFadeIn as="section" className="py-16">…</ScrollFadeIn>
 *
 * Only `opacity` and `transform` are animated. Both are handled by the
 * compositor, so this cannot force layout or paint and cannot shift the page
 * (NFR-01, no Cumulative Layout Shift).
 *
 * Reduced motion is handled globally by `MotionProvider`, which strips the
 * movement and leaves a plain fade.
 *
 * `data-reveal` exists so that, with JavaScript unavailable, the `<noscript>`
 * rule in the root layout can force this visible. Motion renders its `initial`
 * state into the server HTML, so without that rule a failed bundle would leave
 * the page blank.
 */
export type FadeDirection = "up" | "down" | "left" | "right" | "none";

/** The handful of elements worth animating; keeps the component typed. */
const TAGS = {
  div: m.div,
  section: m.section,
  article: m.article,
  aside: m.aside,
  header: m.header,
  li: m.li,
  ul: m.ul,
  figure: m.figure,
} as const;

export type MotionTag = keyof typeof TAGS;

export interface ScrollFadeInProps {
  children: ReactNode;
  /** Element to render. Use a real tag so the markup stays meaningful. */
  as?: MotionTag;
  className?: string;
  /** Seconds before it starts, for hand-sequencing two neighbours. */
  delay?: number;
  duration?: number;
  /** How far it travels, in pixels. Keep it small — long slides read as slow. */
  distance?: number;
  direction?: FadeDirection;
  /** Animate once (default) or every time it re-enters the viewport. */
  once?: boolean;
  /** Fraction of the element that must be visible before it starts. */
  amount?: number | "some" | "all";
}

function offset(direction: FadeDirection, distance: number) {
  switch (direction) {
    case "up":
      return { y: distance };
    case "down":
      return { y: -distance };
    case "left":
      return { x: distance };
    case "right":
      return { x: -distance };
    case "none":
      return {};
  }
}

/**
 * Long, heavily front-loaded ease-out.
 *
 * The curve matters more than the number here. With this easing the element is
 * roughly 85% of the way there in the first fifth of the duration, then drifts
 * gently into place — so the duration does not mean that long spent as
 * unreadable half-faded text, it means a quick arrival and a gentle settle.
 */
export const REVEAL_DURATION = 2.5;

export const EASE_OUT: Transition = {
  duration: REVEAL_DURATION,
  ease: [0.22, 1, 0.36, 1],
};

/**
 * Shrinks the bottom of the viewport for trigger purposes, so an element must
 * scroll a quarter of the way up the screen before it starts.
 *
 * This, not the duration, is what stops things animating before you reach
 * them: a fraction-based threshold behaves differently on a short card and a
 * tall section, whereas this is the same line on screen every time.
 */
export const REVEAL_VIEWPORT_MARGIN = "0px 0px -25% 0px";

export function ScrollFadeIn({
  children,
  as = "div",
  className,
  delay = 0,
  duration = REVEAL_DURATION,
  distance = 28,
  direction = "up",
  once = true,
  amount = 0.1,
}: ScrollFadeInProps) {
  const Component = TAGS[as];

  const variants: Variants = {
    hidden: { opacity: 0, ...offset(direction, distance) },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: { ...EASE_OUT, duration, delay },
    },
  };

  return (
    <Component
      data-reveal
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount, margin: REVEAL_VIEWPORT_MARGIN }}
    >
      {children}
    </Component>
  );
}
