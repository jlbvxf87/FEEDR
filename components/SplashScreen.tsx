"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface SplashScreenProps {
  onComplete: () => void;
  minDuration?: number;
}

export function SplashScreen({ onComplete, minDuration = 2000 }: SplashScreenProps) {
  const [phase, setPhase] = useState<"logo" | "tagline" | "fade">("logo");

  useEffect(() => {
    const timer1 = setTimeout(() => setPhase("tagline"), 600);
    const timer2 = setTimeout(() => setPhase("fade"), minDuration - 400);
    const timer3 = setTimeout(() => onComplete(), minDuration);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [onComplete, minDuration]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex flex-col items-center justify-center",
        "bg-[var(--feedr-bg)] transition-opacity duration-400",
        phase === "fade" && "opacity-0 pointer-events-none"
      )}
    >
      {/* Subtle grid background */}
      <div className="absolute inset-0 opacity-[0.02] feedr-grid-pattern" />

      {/* Radial glow behind logo */}
      <div 
        className={cn(
          "absolute w-[600px] h-[600px] rounded-full",
          "transition-opacity duration-1000",
          phase === "logo" ? "opacity-0" : "opacity-100"
        )}
        style={{
          background: "radial-gradient(circle, rgba(46, 230, 201, 0.08) 0%, transparent 70%)",
        }}
      />

      {/* Logo */}
      <div
        className={cn(
          "relative z-10 transition-all duration-700",
          phase === "logo" && "animate-fade-in",
          phase !== "logo" && "animate-pulse-glow"
        )}
      >
        <Image
          src="/logo.png"
          alt="FEEDR"
          width={320}
          height={80}
          className="object-contain"
          priority
        />
      </div>

      {/* Tagline */}
      <div
        className={cn(
          "relative z-10 mt-8 text-center transition-all duration-500",
          phase === "tagline" || phase === "fade"
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-4"
        )}
      >
        <p className="text-[var(--feedr-text-muted)] text-sm tracking-[0.2em] uppercase font-medium">
          Generate. Scroll. Pick winners.
        </p>
      </div>

      {/* Loading indicator */}
      <div
        className={cn(
          "absolute bottom-12 flex gap-1.5 transition-opacity duration-300",
          phase === "fade" ? "opacity-0" : "opacity-100"
        )}
      >
        <div 
          className="w-1.5 h-1.5 rounded-full bg-[var(--feedr-teal)] animate-pulse" 
          style={{ animationDelay: "0ms" }} 
        />
        <div 
          className="w-1.5 h-1.5 rounded-full bg-[var(--feedr-teal)] animate-pulse" 
          style={{ animationDelay: "200ms" }} 
        />
        <div 
          className="w-1.5 h-1.5 rounded-full bg-[var(--feedr-teal)] animate-pulse" 
          style={{ animationDelay: "400ms" }} 
        />
      </div>
    </div>
  );
}
