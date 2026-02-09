"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useInView, useMotionValue, useSpring } from "framer-motion";

type AnimatedCounterProps = {
  from?: number;
  to: number;
  suffix?: string;
  className?: string;
  precision?: number;
};

export function AnimatedCounter({
  from = 0,
  to,
  suffix = "",
  className,
  precision = 0,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.6 });
  const motionValue = useMotionValue(from);
  const spring = useSpring(motionValue, { stiffness: 120, damping: 22 });
  const [display, setDisplay] = useState(from);

  useEffect(() => {
    if (isInView) {
      motionValue.set(to);
    }
  }, [isInView, motionValue, to]);

  useEffect(() => {
    const unsub = spring.on("change", (latest) => {
      const factor = 10 ** precision;
      setDisplay(Math.round(latest * factor) / factor);
    });
    return () => unsub();
  }, [precision, spring]);

  const formatted = useMemo(() => {
    if (precision > 0) return display.toFixed(precision);
    return Math.round(display).toString();
  }, [display, precision]);

  return (
    <span ref={ref} className={className}>
      {formatted}
      {suffix}
    </span>
  );
}
