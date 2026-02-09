"use client";

import { motion, type MotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

type AnimateInProps = MotionProps & {
  children: React.ReactNode;
  className?: string;
  delay?: number;
};

export function AnimateIn({ children, className, delay = 0, ...props }: AnimateInProps) {
  return (
    <motion.div
      className={cn(className)}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={{
        hidden: { opacity: 0, y: 20, filter: "blur(6px)" },
        visible: {
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
          transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1], delay },
        },
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
