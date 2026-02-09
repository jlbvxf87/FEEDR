"use client";

import { useState } from "react";
import { AnimateIn } from "@/components/motion/AnimateIn";
import { cn } from "@/lib/utils";

const steps = [
  { title: "Type idea", detail: "Single prompt, full batch." },
  { title: "Pick vibe", detail: "Auto or preset styles." },
  { title: "FEED", detail: "Generate a tray of variants." },
  { title: "Tray", detail: "Scroll, mark winners, kill duds." },
  { title: "Decide", detail: "Winner rate + insights." },
  { title: "Ship", detail: "Promote what wins." },
];

const DEMO_VIDEO_SRC = "/demo-pipeline.mp4";

export function Pipeline() {
  const [videoError, setVideoError] = useState(false);

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
                  "border-[#1C2230] bg-[#0B0E11]"
                )}
              >
                <div className="h-2.5 w-2.5 rounded-full bg-[#1C2230]" />
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

        {/* Pipeline demo video – exact flow: idea → tray → winners → ship */}
        <div className="relative">
          <div className="absolute -inset-8 rounded-[32px] bg-[radial-gradient(circle_at_top,_rgba(31,182,255,0.2),_transparent_60%)] blur-2xl" />
          <div className="relative rounded-[26px] border border-[#1C2230] bg-[#0F131A]/90 overflow-hidden">
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.3em] text-[#6B7280]">Pipeline demo</span>
              <span className="text-[10px] text-[#2EE6C9]">Idea → Tray → Winners → Ship</span>
            </div>
            {videoError ? (
              <div className="aspect-video flex flex-col items-center justify-center gap-3 bg-[#0B0E11] border-t border-[#1C2230] p-8 text-center">
                <p className="text-sm text-[#6B7280]">Demo video not loaded.</p>
                <p className="text-xs text-[#4B5563]">
                  Add a screen recording to <code className="px-1.5 py-0.5 rounded bg-[#1C2230] text-[#9CA3AF]">public/demo-pipeline.mp4</code> to show the pipeline.
                </p>
              </div>
            ) : (
              <video
                src={DEMO_VIDEO_SRC}
                controls
                playsInline
                className="w-full aspect-video object-contain bg-black"
                onError={() => setVideoError(true)}
              >
                Your browser does not support the video tag.
              </video>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
