"use client";

import { motion } from "framer-motion";
import { AnimateIn } from "@/components/motion/AnimateIn";
import { StaggerChildren, fadeUp } from "@/components/motion/StaggerChildren";

const pillars = [
  {
    title: "Consistency",
    copy: "Generate weekly batches with the same tone, structure, and visual DNA.",
  },
  {
    title: "Speed",
    copy: "Ship 10x more tests without the production calendar drag.",
  },
  {
    title: "Performance",
    copy: "Spot winners fast and compound learnings across packs.",
  },
];

export function FeaturePillars() {
  return (
    <section className="section">
      <div className="container">
        <AnimateIn>
          <div className="flex items-center justify-between mb-10">
            <h3 className="font-display text-2xl sm:text-3xl text-white">The pillars that keep the flywheel spinning</h3>
            <span className="text-xs uppercase tracking-[0.3em] text-[#6B7280] hidden sm:block">
              FEEDR Method
            </span>
          </div>
        </AnimateIn>
        <StaggerChildren className="grid gap-6 md:grid-cols-3">
          {pillars.map((pillar) => (
            <motion.div
              key={pillar.title}
              variants={fadeUp}
              className="rounded-2xl border border-[#1C2230] bg-[#0F131A] p-6"
            >
              <div className="mb-4 h-10 w-10 rounded-xl bg-[#2EE6C9]/15 border border-[#2EE6C9]/30" />
              <h4 className="text-lg text-white font-semibold mb-2">{pillar.title}</h4>
              <p className="text-sm text-[#9CA3AF]">{pillar.copy}</p>
            </motion.div>
          ))}
        </StaggerChildren>
      </div>
    </section>
  );
}
