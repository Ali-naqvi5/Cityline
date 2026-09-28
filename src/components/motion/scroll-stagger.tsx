"use client";

import { m, type Variants } from "motion/react";
import type { ReactNode } from "react";

import { EASE_OUT, REVEAL_VIEWPORT_MARGIN, type MotionTag } from "./scroll-fade-in";

/**
 * Staggered reveal for grids and lists — cards arrive one after another rather
 * than all at once.
 *
 *   <ScrollStagger as="ul" className="grid gap-6">
 *     {items.map((item) => (
 *       <StaggerItem as="li" key={item.id}>…</StaggerItem>
 *     ))}
 *   </ScrollStagger>
 *
 * Only the parent watches the viewport. The children inherit the "visible"
 * state through Motion's variant propagation, which is what produces the
 * sequence — giving each child its own `whileInView` would fire them all at
 * once as the grid scrolls in, and cost an observer per card.
 *
 * `stagger` is the gap between each card starting, not the animation length,
 * so the whole grid is still moving well before the last card begins.
 */
const PARENT_TAGS = {
  div: m.div,
  ul: m.ul,
  ol: m.ol,
  section: m.section,
} as const;

const CHILD_TAGS = {
  div: m.div,
  li: m.li,
  article: m.article,
  figure: m.figure,
} as const;

export interface ScrollStaggerProps {
  children: ReactNode;
  as?: keyof typeof PARENT_TAGS;
  className?: string;
  /** Seconds between each child. */
  stagger?: number;
  /** Seconds before the first child starts. */
  delayChildren?: number;
  once?: boolean;
  amount?: number | "some" | "all";
}

export function ScrollStagger({
  children,
  as = "div",
  className,
  stagger = 0.22,
  delayChildren = 0,
  once = true,
  amount = 0.1,
}: ScrollStaggerProps) {
  const Component = PARENT_TAGS[as];

  const variants: Variants = {
    hidden: {},
    visible: {
      transition: { staggerChildren: stagger, delayChildren },
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

export interface StaggerItemProps {
  children: ReactNode;
  as?: keyof typeof CHILD_TAGS;
  className?: string;
  distance?: number;
}

export function StaggerItem({
  children,
  as = "div",
  className,
  distance = 28,
}: StaggerItemProps) {
  const Component = CHILD_TAGS[as];

  const variants: Variants = {
    hidden: { opacity: 0, y: distance },
    visible: { opacity: 1, y: 0, transition: EASE_OUT },
  };

  // No `initial`/`whileInView` here on purpose — the parent drives this.
  return (
    <Component className={className} variants={variants}>
      {children}
    </Component>
  );
}

export type { MotionTag };
