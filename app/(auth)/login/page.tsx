"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabaseBrowser";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [splashPhase, setSplashPhase] = useState<"loading" | "complete" | "hidden">("loading");
  const [loadingProgress, setLoadingProgress] = useState(0);
  const router = useRouter();
  const supabase = createClient();

  // Get the current origin for redirect URL
  const getRedirectUrl = () => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/auth/callback`;
    }
    return "/auth/callback";
  };

  // Splash screen animation
  useEffect(() => {
    // Animate loading bar
    const progressInterval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        // Ease out - slower as it approaches 100
        const increment = Math.max(1, (100 - prev) / 10);
        return Math.min(100, prev + increment);
      });
    }, 50);

    // Complete after 1.5s
    const completeTimer = setTimeout(() => {
      setSplashPhase("complete");
    }, 1500);

    // Hide splash after transition
    const hideTimer = setTimeout(() => {
      setSplashPhase("hidden");
    }, 2000);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(completeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push("/");
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: getRedirectUrl(),
          },
        });
        if (error) throw error;
        
        // Check if email confirmation is required
        if (data.user && !data.session) {
          setSuccess("Check your email to confirm your account.");
        } else if (data.session) {
          // Auto-confirmed (email confirmation disabled in Supabase)
          router.push("/");
          router.refresh();
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something broke. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B0E11] relative overflow-hidden">
      {/* Splash Screen Overlay */}
      {splashPhase !== "hidden" && (
        <div
          className={cn(
            "fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0B0E11]",
            "transition-all duration-500 ease-out",
            splashPhase === "complete" && "opacity-0 pointer-events-none"
          )}
        >
          {/* Radial glow behind logo */}
          <div 
            className="absolute w-[600px] h-[600px] rounded-full opacity-60"
            style={{
              background: "radial-gradient(circle, rgba(46, 230, 201, 0.1) 0%, transparent 70%)",
            }}
          />

          {/* Logo */}
          <div className="relative z-10 mb-12">
            <Image
              src="/logo.png"
              alt="FEEDR"
              width={280}
              height={70}
              className="object-contain"
              priority
            />
          </div>

          {/* Loading Bar */}
          <div className="relative z-10 w-48">
            <div className="h-[2px] bg-[#1C2230] rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-100 ease-out"
                style={{
                  width: `${loadingProgress}%`,
                  background: "linear-gradient(90deg, #2EE6C9 0%, #1FB6FF 100%)",
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Subtle grid background */}
      <div className="absolute inset-0 opacity-[0.02] feedr-grid-pattern" />

      {/* Radial glow */}
      <div 
        className="absolute w-[800px] h-[800px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(46, 230, 201, 0.05) 0%, transparent 60%)",
        }}
      />

      {/* Login Form */}
      <div 
        className={cn(
          "relative z-10 w-full max-w-sm p-8",
          "transition-all duration-700 ease-out",
          splashPhase === "hidden" 
            ? "opacity-100 translate-y-0" 
            : "opacity-0 translate-y-8"
        )}
      >
        {/* Logo */}
        <div className="text-center mb-10">
          <Image
            src="/logo.png"
            alt="FEEDR"
            width={180}
            height={45}
            className="object-contain mx-auto mix-blend-screen"
            priority
          />
          <p className="text-[#6B7280] text-xs mt-4 tracking-[0.2em] uppercase">
            Generate. Scroll. Pick winners.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={cn(
                "w-full px-4 py-3 rounded-lg",
                "bg-[#11151C] border border-[#1C2230]",
                "text-white placeholder:text-[#4B5563]",
                "focus:outline-none focus:border-[#2EE6C9]/50 feedr-input-glow",
                "transition-all duration-150"
              )}
            />
          </div>

          <div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className={cn(
                "w-full px-4 py-3 rounded-lg",
                "bg-[#11151C] border border-[#1C2230]",
                "text-white placeholder:text-[#4B5563]",
                "focus:outline-none focus:border-[#2EE6C9]/50 feedr-input-glow",
                "transition-all duration-150"
              )}
            />
          </div>

          {error && (
            <div className="text-[#FF4D4F] text-xs text-center uppercase tracking-wider">
              {error}
            </div>
          )}

          {success && (
            <div className="text-[#22C55E] text-xs text-center uppercase tracking-wider">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className={cn(
              "w-full py-3 px-4 rounded-lg font-semibold uppercase tracking-wider",
              "feedr-gradient text-[#0B0E11]",
              "hover:opacity-90",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "transition-all duration-150"
            )}
          >
            {isLoading
              ? "..."
              : mode === "signin"
              ? "ENTER"
              : "CREATE"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="text-[#6B7280] hover:text-white text-xs transition-colors duration-150 uppercase tracking-wider"
          >
            {mode === "signin"
              ? "Need access? Sign up"
              : "Have access? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
