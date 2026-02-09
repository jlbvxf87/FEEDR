"use client";

import { motion, type MotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

const easeOut = [0.16, 1, 0.3, 1] as const;

export const fadeUp = {
  hidden: { opacity: 0, y: 18, filter: "blur(6px)" },
  visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.5, ease: easeOut } },
};

type StaggerChildrenProps = MotionProps & {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
  delayChildren?: number;
};

export function StaggerChildren({
  children,
  className,
  stagger = 0.08,
  delayChildren = 0,
  ...props
}: StaggerChildrenProps) {
  return (
    <motion.div
      className={cn(className)}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={{
        hidden: {},
        visible: {
          transition: { staggerChildren: stagger, delayChildren },
        },
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
