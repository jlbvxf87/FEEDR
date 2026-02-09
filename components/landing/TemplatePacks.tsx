"use client";

import { AnimateIn } from "@/components/motion/AnimateIn";
import { AnimatedCounter } from "@/components/motion/AnimatedCounter";

const packs = [
  { title: "Skincare", bestFor: "Glow serums, acne lines", winnerRate: 42, sample: "Glow reset tray" },
  { title: "Haircare", bestFor: "Masks, scalp oils", winnerRate: 36, sample: "Frizz fix tray" },
  { title: "Fitness", bestFor: "Supps, programs", winnerRate: 39, sample: "30-day test tray" },
  { title: "SaaS", bestFor: "Creator tools", winnerRate: 33, sample: "Launch hook tray" },
  { title: "Local", bestFor: "Studios, cafes", winnerRate: 28, sample: "Neighborhood tray" },
];

export function TemplatePacks() {
  return (
    <section className="section" id="pricing">
      <div className="container">
        <AnimateIn>
          <div className="flex items-end justify-between flex-wrap gap-4 mb-10">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[#6B7280] mb-3">Template Packs</p>
              <h3 className="font-display text-3xl text-white">Hook packs built for repeat wins</h3>
            </div>
            <p className="text-sm text-[#9CA3AF] max-w-md">
              Prebuilt packs tuned for category performance so you can test faster and ship smarter.
            </p>
          </div>
        </AnimateIn>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {packs.map((pack) => (
            <div key={pack.title} className="rounded-2xl border border-[#1C2230] bg-[#0F131A] p-6">
              <div className="flex items-center justify-between mb-5">
                <h4 className="text-lg text-white font-semibold">{pack.title}</h4>
                <span className="text-xs uppercase tracking-[0.2em] text-[#6B7280]">Pack</span>
              </div>
              <p className="text-sm text-[#9CA3AF] mb-4">Best for: {pack.bestFor}</p>
              <div className="rounded-xl border border-[#1C2230] bg-[#0B0E11] px-4 py-3 mb-4">
                <p className="text-[11px] uppercase tracking-[0.3em] text-[#6B7280] mb-1">Avg winner rate</p>
                <p className="text-xl text-white font-semibold">
                  <AnimatedCounter from={10} to={pack.winnerRate} suffix="%" />
                </p>
              </div>
              <p className="text-xs text-[#6B7280] uppercase tracking-[0.2em]">Sample tray</p>
              <p className="text-sm text-white">{pack.sample}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
