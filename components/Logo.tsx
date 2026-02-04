"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";

interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizes = {
  sm: { icon: 24, text: "text-lg" },
  md: { icon: 32, text: "text-xl" },
  lg: { icon: 48, text: "text-2xl" },
  xl: { icon: 80, text: "text-4xl" },
};

export function Logo({ className, showText = true, size = "md" }: LogoProps) {
  const { icon, text } = sizes[size];

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Image
        src="/logo.png"
        alt="FEEDR"
        width={showText ? icon * 4 : icon}
        height={icon}
        className="object-contain"
        priority
      />
    </div>
  );
}

// Icon-only version for favicon, loading states, etc.
export function LogoIcon({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="feedr-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2EE6C9" />
          <stop offset="100%" stopColor="#1FB6FF" />
        </linearGradient>
      </defs>
      {/* F Arrow Icon */}
      <path
        d="M8 12L24 4L40 12L40 20L24 28L8 20V12Z"
        fill="url(#feedr-gradient)"
        fillOpacity="0.9"
      />
      <path
        d="M8 20L24 28L24 44L8 36V20Z"
        fill="#3A7CFF"
        fillOpacity="0.9"
      />
      <path
        d="M24 28L40 20V28L24 36V28Z"
        fill="#2EE6C9"
        fillOpacity="0.7"
      />
    </svg>
  );
}
