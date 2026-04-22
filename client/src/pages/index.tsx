import "@/styles/landing-tailwind.css";
import {
  LandingCustomerStories,
  LandingFinalCTA,
  LandingFooter,
  LandingHero,
  MarketIntelligenceSection,
  LandingNavbar,
  LandingNewsSection,
  LandingProducts,
  LandingStatsBar,
  LandingTestimonials,
} from "@/components/landing";

function Index() {
  return (
    <div className="landing-page min-h-screen bg-[#0a0a0f] text-base text-[#f8fafc] antialiased selection:bg-[#9945FF]/35 selection:text-[#f8fafc]">
      <LandingNavbar />
      <main>
        <LandingHero />
        <LandingStatsBar />
        <LandingProducts />
        <MarketIntelligenceSection />
        <LandingCustomerStories />
        <LandingTestimonials />
        <LandingNewsSection />
        <LandingFinalCTA />
      </main>
      <LandingFooter />
    </div>
  );
}

export default Index;
