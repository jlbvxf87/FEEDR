"use client";

import { useEffect } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { AnimateIn } from "@/components/motion/AnimateIn";

const brands = [
  "Luma Labs",
  "Glowline",
  "Reverb",
  "CloudMint",
  "Ardent",
  "PulseKit",
  "Trialwise",
  "Workweek",
];

const AUTOPLAY_INTERVAL_MS = 3000;

export function LogoCarousel() {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: "start",
    skipSnaps: false,
  });

  // Auto-advance carousel horizontally
  useEffect(() => {
    if (!emblaApi) return;
    const interval = setInterval(() => {
      emblaApi.scrollNext();
    }, AUTOPLAY_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [emblaApi]);

  return (
    <section className="section pt-0">
      <div className="container">
        <AnimateIn>
          <p className="text-center text-xs uppercase tracking-[0.4em] text-[#6B7280] mb-8">
            Trusted by teams shipping weekly
          </p>
        </AnimateIn>

        <div className="relative">
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex gap-4 touch-pan-x">
              {brands.map((brand) => (
                <div key={brand} className="flex-[0_0_70%] min-w-0 sm:flex-[0_0_45%] lg:flex-[0_0_28%]">
                  <div className="rounded-2xl border border-[#1C2230] bg-[#0F131A] px-6 py-5 text-center text-sm text-[#9CA3AF] uppercase tracking-[0.2em]">
                    {brand}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-[#0B0E11] to-transparent z-10" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-[#0B0E11] to-transparent z-10" />
        </div>
      </div>
    </section>
  );
}
