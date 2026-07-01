import "@/styles/landing-tailwind.css";
import {
  LandingCustomerStories,
  LandingFinalCTA,
  LandingFooter,
  LandingHero,
  MarketIntelligenceSection,
  LandingNewsSection,
  LandingProducts,
  LandingStatsBar,
  LandingTestimonials,
  LandingNavbar,
} from "@/components/landing";
import { createLandingThemeStyles } from "@/components/landing/tokens";
import { useUserTheme } from "@/contexts/ThemeContext";

function Index() {
  const { theme } = useUserTheme();

  return (
    <div
      className="landing-page relative isolate h-screen overflow-y-auto bg-[var(--landing-bg)] text-[var(--landing-foreground)] antialiased selection:bg-[var(--landing-accent)]/25 selection:text-[var(--landing-bg)]"
      style={createLandingThemeStyles(theme)}
    >
      <LandingNavbar />
      <main className="relative flex flex-col">
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
