import "@/styles/landing-tailwind.css";
import {
  LandingCustomerStories,
  LandingDeveloperSection,
  LandingFinalCTA,
  LandingFooter,
  LandingHero,
  LandingNavbar,
  LandingNewsSection,
  LandingProducts,
  LandingStatsBar,
  LandingTestimonials,
} from "@/components/landing";

function Index() {
  return (
    <div className="landing-page min-h-screen bg-[#0a0a0f] text-base text-[#f8fafc] antialiased selection:bg-[#FF6B00]/30 selection:text-[#f8fafc]">
      <LandingNavbar />
      <main>
        <LandingHero />
        <LandingStatsBar />
        <LandingProducts />
        <LandingCustomerStories />
        <LandingTestimonials />
        <LandingDeveloperSection />
        <LandingNewsSection />
        <LandingFinalCTA />
      </main>
      <LandingFooter />
    </div>
  );
}

export default Index;
