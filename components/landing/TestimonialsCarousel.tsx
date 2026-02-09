"use client";

import useEmblaCarousel from "embla-carousel-react";
import { AnimateIn } from "@/components/motion/AnimateIn";

const testimonials = [
  {
    quote: "We replaced three separate freelancers with FEEDR trays. Our weekly testing cadence doubled overnight.",
    name: "Sasha K.",
    role: "Growth Lead",
    platform: "TikTok",
    metric: "+32% winners",
  },
  {
    quote: "The tray view makes it easy to tag winners fast. We actually ship the insights now.",
    name: "Luis R.",
    role: "Creative Strategist",
    platform: "Meta",
    metric: "18 new hooks",
  },
  {
    quote: "FEEDR is a testing engine, not a video tool. We finally have repeatable UGC output.",
    name: "Mia H.",
    role: "Founder",
    platform: "YouTube",
    metric: "3x output",
  },
];

export function TestimonialsCarousel() {
  const [emblaRef] = useEmblaCarousel({ loop: true, align: "center" });

  return (
    <section className="section">
      <div className="container">
        <AnimateIn>
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-display text-3xl text-white">Proof from the feed</h3>
            <span className="text-xs uppercase tracking-[0.3em] text-[#6B7280] hidden sm:block">
              Testimonials
            </span>
          </div>
        </AnimateIn>

        <div className="relative">
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex gap-6">
              {testimonials.map((item) => (
                <div key={item.name} className="flex-[0_0_86%] md:flex-[0_0_45%] lg:flex-[0_0_32%]">
                  <div className="h-full rounded-2xl border border-[#1C2230] bg-[#0F131A] p-6 flex flex-col">
                    <p className="text-sm text-white mb-6">“{item.quote}”</p>
                    <div className="mt-auto flex items-center justify-between">
                      <div>
                        <p className="text-sm text-white font-semibold">{item.name}</p>
                        <p className="text-xs text-[#6B7280]">{item.role} · {item.platform}</p>
                      </div>
                      <span className="text-xs uppercase tracking-[0.2em] text-[#2EE6C9] border border-[#2EE6C9]/40 rounded-full px-3 py-1">
                        {item.metric}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-[#0B0E11] to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-[#0B0E11] to-transparent" />
        </div>
      </div>
    </section>
  );
}
