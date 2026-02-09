"use client";

import { useEffect, useState } from "react";
import { AnimateIn } from "@/components/motion/AnimateIn";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const steps = [
  { title: "Type idea", detail: "Single prompt, full batch." },
  { title: "Pick vibe", detail: "Auto or preset styles." },
  { title: "FEED", detail: "Generate a tray of variants." },
  { title: "Tray", detail: "Scroll, mark winners, kill duds." },
  { title: "Decide", detail: "Winner rate + insights." },
  { title: "Ship", detail: "Promote what wins." },
];

const stepCards = [
  {
    label: "Idea",
    meta: "UGC hook test",
  },
  {
    label: "Vibe",
    meta: "Founder POV",
  },
  {
    label: "Tray",
    meta: "12 clips",
  },
  {
    label: "Winners",
    meta: "3 promoted",
  },
  {
    label: "Insights",
    meta: "38% win rate",
  },
  {
    label: "Ship",
    meta: "Launch pack",
  },
];

export function Pipeline() {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % steps.length);
    }, 3200);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="section">
      <div className="container grid gap-10 lg:grid-cols-[1fr_1fr] items-center">
        <div className="space-y-6">
          <AnimateIn>
            <p className="text-xs uppercase tracking-[0.4em] text-[#6B7280]">Pipeline</p>
          </AnimateIn>
          <AnimateIn delay={0.05}>
            <h2 className="font-display text-3xl sm:text-4xl text-white">
              Not a video tool. A testing engine.
            </h2>
          </AnimateIn>
          <AnimateIn delay={0.1}>
            <p className="text-[#9CA3AF]">
              Batch &gt; tray &gt; decision &gt; repeat. FEEDR keeps you in the loop from idea to winner.
            </p>
          </AnimateIn>
          <div className="space-y-3">
            {steps.map((step, index) => (
              <div
                key={step.title}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors",
                  index === activeStep
                    ? "border-[#2EE6C9]/60 bg-[#0F131A]"
                    : "border-[#1C2230] bg-[#0B0E11]"
                )}
              >
                <div
                  className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    index === activeStep ? "bg-[#2EE6C9]" : "bg-[#1C2230]"
                  )}
                />
                <div>
                  <p className="text-sm text-white font-medium">{step.title}</p>
                  <p className="text-xs text-[#6B7280]">{step.detail}</p>
                </div>
              </div>
            ))}
          </div>
          <AnimateIn delay={0.15}>
            <div className="rounded-2xl border border-[#1C2230] bg-[#0F131A] p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-[#6B7280] mb-3">
                What FEEDR automates
              </p>
              <div className="grid grid-cols-2 gap-3 text-sm text-[#9CA3AF]">
                <span>Hook research</span>
                <span>Script variants</span>
                <span>Voice + edit</span>
                <span>Winner tagging</span>
              </div>
            </div>
          </AnimateIn>
        </div>

        <div className="relative">
          <div className="absolute -inset-8 rounded-[32px] bg-[radial-gradient(circle_at_top,_rgba(31,182,255,0.2),_transparent_60%)] blur-2xl" />
          <div className="relative rounded-[26px] border border-[#1C2230] bg-[#0F131A]/90 p-6">
            <div className="flex items-center justify-between mb-6">
              <span className="text-xs uppercase tracking-[0.3em] text-[#6B7280]">Step</span>
              <span className="text-xs text-[#2EE6C9]">{activeStep + 1} / {steps.length}</span>
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeStep}
                initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -12, filter: "blur(6px)" }}
                transition={{ duration: 0.5 }}
                className="space-y-5"
              >
                <div className="rounded-2xl border border-[#1C2230] bg-[#11151C] p-5">
                  <p className="text-lg text-white font-semibold">{steps[activeStep].title}</p>
                  <p className="text-sm text-[#6B7280]">{steps[activeStep].detail}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[0, 1, 2, 3].map((i) => {
                    const card = stepCards[(activeStep + i) % stepCards.length];
                    return (
                      <div key={`${card.label}-${i}`} className="rounded-xl border border-[#1C2230] bg-[#0B0E11] p-4">
                        <p className="text-sm text-white font-medium">{card.label}</p>
                        <p className="text-xs text-[#6B7280]">{card.meta}</p>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
