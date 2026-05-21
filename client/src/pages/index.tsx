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
} from "@/components/landing";
import { createLandingThemeStyles } from "@/components/landing/tokens";
import { useUserTheme } from "@/contexts/ThemeContext";
import { useNavigate } from "react-router";

const MAPS = {
  TEST_401: "/test-401",
} as const;

const MOCK_UNAUTHORIZED_STATE = {
  from: "/secret-admin-dashboard",
} as const;

function Index() {
  const navigate = useNavigate();
  const { theme } = useUserTheme();

  return (
    <div
      className="landing-page relative isolate min-h-full overflow-hidden bg-(--landing-bg) text-(--landing-foreground) antialiased selection:bg-(--landing-accent)/25 selection:text-(--landing-bg)"
      style={createLandingThemeStyles(theme)}
    >
      <main className="relative flex flex-col">
        {import.meta.env.DEV && (
          <div className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() =>
                navigate(MAPS.TEST_401, {
                  state: MOCK_UNAUTHORIZED_STATE,
                })
              }
              className="rounded-md border border-(--landing-border) bg-(--landing-surface) px-4 py-2 text-sm font-medium text-(--landing-foreground) transition-colors hover:bg-(--landing-surface-strong)"
            >
              Test Unauthorized UI
            </button>
          </div>
        )}
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
