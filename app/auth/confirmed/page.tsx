"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { cn } from "@/lib/utils";

export default function EmailConfirmedPage() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push("/");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B0E11] relative overflow-hidden">
      {/* Radial glow */}
      <div 
        className="absolute w-[800px] h-[800px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(34, 197, 94, 0.1) 0%, transparent 60%)",
        }}
      />

      <div className="relative z-10 text-center p-8">
        {/* Logo */}
        <div className="mb-8">
          <Image
            src="/logo.png"
            alt="FEEDR"
            width={200}
            height={50}
            className="object-contain mx-auto"
            priority
          />
        </div>

        {/* Success Icon */}
        <div className="mb-6">
          <div className="w-20 h-20 mx-auto rounded-full bg-[#22C55E]/20 flex items-center justify-center">
            <svg
              className="w-10 h-10 text-[#22C55E]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>

        {/* Message */}
        <h1 className="text-white text-2xl font-semibold mb-2">
          You're in.
        </h1>
        <p className="text-[#6B7280] text-sm uppercase tracking-wider mb-8">
          Email confirmed successfully
        </p>

        {/* Countdown */}
        <div className="text-[#6B7280] text-xs uppercase tracking-wider">
          Entering the terminal in {countdown}...
        </div>

        {/* Progress bar */}
        <div className="mt-4 w-48 mx-auto">
          <div className="h-[2px] bg-[#1C2230] rounded-full overflow-hidden">
            <div 
              className={cn(
                "h-full rounded-full transition-all duration-1000 ease-linear bg-[#22C55E]"
              )}
              style={{
                width: `${((3 - countdown) / 3) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* Skip button */}
        <button
          onClick={() => router.push("/")}
          className="mt-8 text-[#6B7280] hover:text-white text-xs uppercase tracking-wider transition-colors"
        >
          Enter now
        </button>
      </div>
    </div>
  );
}
