"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabaseBrowser";
import { useRouter } from "next/navigation";
import { SplashScreen } from "@/components/SplashScreen";
import Image from "next/image";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [showSplash, setShowSplash] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
      } else {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--feedr-bg)] flex items-center justify-center">
        <div className="w-1.5 h-1.5 rounded-full bg-[var(--feedr-teal)] animate-pulse" />
      </div>
    );
  }

  return (
    <>
      {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
      
      <div className="min-h-screen bg-[var(--feedr-bg)]">
        {/* Header */}
        <header className="border-b border-[var(--feedr-border)]">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <Image
              src="/logo.png"
              alt="FEEDR"
              width={120}
              height={30}
              className="object-contain"
              priority
            />
            <button
              onClick={handleSignOut}
              className="text-xs text-[var(--feedr-text-muted)] hover:text-[var(--feedr-text)] transition-colors duration-150 uppercase tracking-wider"
            >
              Exit
            </button>
          </div>
        </header>

        {/* Main content */}
        <main className="max-w-6xl mx-auto px-6 py-8">
          {children}
        </main>
      </div>
    </>
  );
}
