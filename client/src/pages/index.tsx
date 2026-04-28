import "@/styles/landing-tailwind.css";
import {
  LandingCustomerStories,
  LandingDeveloperSection,
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
import { useNavigate } from "react-router";

const MAPS = {
  TEST_401: "/test-401",
} as const;

const MOCK_UNAUTHORIZED_STATE = {
  from: "/secret-admin-dashboard",
} as const;

function Index() {
  const navigate = useNavigate();

  return (
    <div className="landing-page min-h-screen bg-[#0a0a0f] text-base text-[#f8fafc] antialiased selection:bg-[#9945FF]/35 selection:text-[#f8fafc]">
      <LandingNavbar />
      <main>
        {import.meta.env.DEV && (
          <div className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() =>
                navigate(MAPS.TEST_401, {
                  state: MOCK_UNAUTHORIZED_STATE,
                })
              }
              className="rounded-md border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
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
        <LandingDeveloperSection />
        <LandingNewsSection />
        <LandingFinalCTA />
      </main>
      <LandingFooter />
    </div>
  );
}

export default Index;
