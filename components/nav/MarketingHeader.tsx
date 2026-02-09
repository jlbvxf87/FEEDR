"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

export function MarketingHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-all",
        scrolled
          ? "backdrop-blur-xl bg-[#0B0E11]/80 border-b border-[#1C2230] shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
          : "bg-transparent"
      )}
    >
      <div className="container flex items-center justify-between py-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="FEEDR" width={110} height={28} />
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-[#9CA3AF]">
            <a href="#pipeline" className="hover:text-white transition-colors">Pipeline</a>
            <a href="#templates" className="hover:text-white transition-colors">Templates</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden sm:inline-flex px-4 py-2 rounded-full text-xs uppercase tracking-[0.2em] border border-[#1C2230] text-[#9CA3AF] hover:text-white hover:border-[#2EE6C9]/50 transition-colors"
          >
            Login
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-[0.2em] feedr-gradient text-[#0B0E11] hover:opacity-90 transition-opacity"
          >
            Start Feeding
          </Link>
        </div>
      </div>
    </header>
  );
}
