"use client";

import Link from "next/link";
import { AnimateIn } from "@/components/motion/AnimateIn";

export function FinalCTA() {
  return (
    <section className="section">
      <div className="container">
        <div className="rounded-[28px] border border-[#1C2230] bg-[#0F131A] p-10 md:p-14 relative overflow-hidden">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[radial-gradient(circle,_rgba(46,230,201,0.2),_transparent_70%)] blur-2xl" />
          <AnimateIn>
            <h3 className="font-display text-3xl sm:text-4xl text-white mb-4">
              Start Feeding your next batch
            </h3>
          </AnimateIn>
          <AnimateIn delay={0.05}>
            <p className="text-[#9CA3AF] max-w-xl mb-8">
              Move from one idea to a winner tray in minutes. Launch faster, learn faster, win faster.
            </p>
          </AnimateIn>
          <AnimateIn delay={0.1}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-xs font-semibold uppercase tracking-[0.2em] feedr-gradient text-[#0B0E11] hover:opacity-90 transition-opacity"
              >
                Start Feeding
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-xs font-semibold uppercase tracking-[0.2em] border border-[#1C2230] text-[#9CA3AF] hover:text-white hover:border-[#2EE6C9]/50 transition-colors"
              >
                Book a pipeline demo
              </Link>
            </div>
            <div className="mt-6 text-[11px] uppercase tracking-[0.3em] text-[#4B5563]">
              No credit card · Cancel anytime
            </div>
          </AnimateIn>
        </div>
      </div>
    </section>
  );
}
