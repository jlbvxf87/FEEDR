"use client";

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

function BrandCard({ brand }: { brand: string }) {
  return (
    <div className="shrink-0 w-[280px] sm:w-[320px]">
      <div className="rounded-2xl border border-[#1C2230] bg-[#0F131A] px-6 py-5 text-center text-sm text-[#9CA3AF] uppercase tracking-[0.2em]">
        {brand}
      </div>
    </div>
  );
}

export function LogoCarousel() {
  return (
    <section className="section pt-0">
      <div className="container">
        <AnimateIn>
          <p className="text-center text-xs uppercase tracking-[0.4em] text-[#6B7280] mb-8">
            Trusted by teams shipping weekly
          </p>
        </AnimateIn>

        <div className="relative overflow-hidden">
          <div className="flex gap-4 w-max animate-marquee">
            {[...brands, ...brands].map((brand, i) => (
              <BrandCard key={`${brand}-${i}`} brand={brand} />
            ))}
          </div>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[#0B0E11] to-transparent z-10" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#0B0E11] to-transparent z-10" />
        </div>
      </div>
    </section>
  );
}
