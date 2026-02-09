"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { AnimateIn } from "@/components/motion/AnimateIn";
import { cn } from "@/lib/utils";

export function Hero() {
  return (
    <section className="section">
      <div className="container grid gap-12 lg:grid-cols-[1.1fr_0.9fr] items-center">
        <div className="space-y-7">
          <AnimateIn>
            <p className="text-xs uppercase tracking-[0.3em] text-[#6B7280]">
              FEEDR Creator Lab
            </p>
          </AnimateIn>
          <AnimateIn delay={0.05}>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl leading-[1.05] text-white">
              Generate. Scroll. Pick winners.
            </h1>
          </AnimateIn>
          <AnimateIn delay={0.1}>
            <p className="text-[#9CA3AF] text-base sm:text-lg max-w-xl">
              FEEDR turns one idea into a scrollable batch of UGC variants, then helps you quickly promote what wins.
            </p>
          </AnimateIn>
          <AnimateIn delay={0.15}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-xs font-semibold uppercase tracking-[0.2em] feedr-gradient text-[#0B0E11] hover:opacity-90 transition-opacity"
              >
                Start Feeding
              </Link>
              <a
                href="#pipeline"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-xs font-semibold uppercase tracking-[0.2em] border border-[#1C2230] text-[#9CA3AF] hover:text-white hover:border-[#2EE6C9]/50 transition-colors"
              >
                Watch Pipeline
              </a>
            </div>
          </AnimateIn>
          <AnimateIn delay={0.2}>
            <p className="text-[11px] uppercase tracking-[0.3em] text-[#4B5563]">
              No prompt engineering. Just momentum.
            </p>
          </AnimateIn>
        </div>

        <motion.div
          className="relative"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <div className="absolute -inset-10 rounded-[40px] bg-[radial-gradient(circle_at_top,_rgba(46,230,201,0.25),_transparent_60%)] blur-2xl" />
          <div className="relative rounded-[28px] border border-[#1C2230] bg-[#0F131A]/90 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
            <div className="flex items-center justify-between text-xs text-[#6B7280] uppercase tracking-[0.3em] mb-6">
              <span>Tray</span>
              <span>12 Variants</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {["Glow Serum", "Recovery Balm", "Hair Mist", "Night Oil"].map((label, index) => (
                <motion.div
                  key={label}
                  className={cn(
                    "rounded-2xl border border-[#1C2230] bg-[#11151C] p-4",
                    "shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
                  )}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.15 + index * 0.08, duration: 0.5 }}
                >
                  <div className="h-20 rounded-xl bg-gradient-to-br from-[#2EE6C9]/20 to-[#1FB6FF]/10 border border-[#1C2230]" />
                  <p className="mt-3 text-sm text-white font-medium">{label}</p>
                  <p className="text-xs text-[#6B7280]">UGC Hook Pack</p>
                </motion.div>
              ))}
            </div>
            <div className="mt-6 flex items-center justify-between rounded-xl border border-[#1C2230] bg-[#0B0E11] px-4 py-3">
              <span className="text-xs text-[#6B7280] uppercase tracking-[0.3em]">Winner Rate</span>
              <span className="text-sm text-white font-semibold">38% ↑</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
