import { MarketingHeader } from "@/components/nav/MarketingHeader";
import { MarketingFooter } from "@/components/footer/MarketingFooter";
import { Hero } from "@/components/landing/Hero";
import { LogoCarousel } from "@/components/landing/LogoCarousel";
import { Pipeline } from "@/components/landing/Pipeline";
import { FeaturePillars } from "@/components/landing/FeaturePillars";
import { TemplatePacks } from "@/components/landing/TemplatePacks";
import { TestimonialsCarousel } from "@/components/landing/TestimonialsCarousel";
import { FinalCTA } from "@/components/landing/FinalCTA";

export default function MarketingPage() {
  return (
    <div className="landing-bg text-white">
      <MarketingHeader />
      <main>
        <Hero />
        <LogoCarousel />
        <section id="pipeline">
          <Pipeline />
        </section>
        <FeaturePillars />
        <section id="templates">
          <TemplatePacks />
        </section>
        <TestimonialsCarousel />
        <FinalCTA />
      </main>
      <MarketingFooter />
    </div>
  );
}
