type ProviderPlan = {
  name: string;
  monthlyUsd: number;
  includedUnits: number | null;
  priceStatus: "public" | "starting";
};

type ScenarioInput = {
  mau: number;
  marketRefreshWindows: number;
  tokenColdShare: number;
  renderUsd: number;
  supabaseUsd: number;
};

type DemandProfile = {
  name: "base";
  sessionsPerMau: number;
  marketRefreshFactor: number;
  tokenColdFactor: number;
  walletColdShare: number;
  activityColdShare: number;
  activityPages: number;
  tokenChartColdShare: number;
  aiUsageFactor: number;
};

const payerMix = {
  lite: 0.0125,
  plus: 0.005,
  pro: 0.0025,
};

const monthlyAlertDeliveryLimits = {
  lite: 100,
  plus: 500,
  pro: 2_000,
};

const monthlyPrices = {
  lite: 39,
  plus: 79,
  pro: 149,
};

const baseProfile: DemandProfile = {
  name: "base",
  sessionsPerMau: 8,
  marketRefreshFactor: 1,
  tokenColdFactor: 1,
  walletColdShare: 0.9,
  activityColdShare: 0.35,
  activityPages: 3,
  tokenChartColdShare: 0.3,
  aiUsageFactor: 1,
};

const scenarios: ScenarioInput[] = [
  {
    mau: 300,
    marketRefreshWindows: 180,
    tokenColdShare: 0.3,
    renderUsd: 7,
    supabaseUsd: 0,
  },
  {
    mau: 3_000,
    marketRefreshWindows: 720,
    tokenColdShare: 0.3,
    renderUsd: 25,
    supabaseUsd: 25,
  },
  {
    mau: 30_000,
    marketRefreshWindows: 2_880,
    tokenColdShare: 0.2,
    renderUsd: 50,
    supabaseUsd: 30,
  },
];

const providerPlans: Record<string, ProviderPlan[]> = {
  coingecko: [
    { name: "Demo", monthlyUsd: 0, includedUnits: 10_000, priceStatus: "public" },
    { name: "Basic", monthlyUsd: 35, includedUnits: 100_000, priceStatus: "public" },
    { name: "Analyst", monthlyUsd: 129, includedUnits: 500_000, priceStatus: "public" },
    { name: "Lite", monthlyUsd: 499, includedUnits: 2_000_000, priceStatus: "public" },
  ],
  birdeye: [
    { name: "Standard", monthlyUsd: 0, includedUnits: 30_000, priceStatus: "public" },
    { name: "Lite", monthlyUsd: 39, includedUnits: 1_500_000, priceStatus: "public" },
    { name: "Starter", monthlyUsd: 99, includedUnits: 5_000_000, priceStatus: "public" },
  ],
  mobula: [
    { name: "Free", monthlyUsd: 0, includedUnits: 10_000, priceStatus: "public" },
    { name: "Start-up", monthlyUsd: 50, includedUnits: 125_000, priceStatus: "public" },
    { name: "Growth", monthlyUsd: 400, includedUnits: 1_250_000, priceStatus: "public" },
    { name: "Enterprise (starting price)", monthlyUsd: 750, includedUnits: null, priceStatus: "starting" },
  ],
  helius: [
    { name: "Free", monthlyUsd: 0, includedUnits: 1_000_000, priceStatus: "public" },
    { name: "Developer", monthlyUsd: 49, includedUnits: 10_000_000, priceStatus: "public" },
    { name: "Business", monthlyUsd: 499, includedUnits: 100_000_000, priceStatus: "public" },
  ],
  zerion: [
    { name: "Developer", monthlyUsd: 0, includedUnits: 60_000, priceStatus: "public" },
    { name: "Builder", monthlyUsd: 149, includedUnits: 250_000, priceStatus: "public" },
    { name: "Startup", monthlyUsd: 499, includedUnits: 1_000_000, priceStatus: "public" },
    { name: "Growth", monthlyUsd: 999, includedUnits: 2_500_000, priceStatus: "public" },
  ],
};

function smallestPlan(provider: string, units: number): ProviderPlan {
  const plan = providerPlans[provider]?.find(
    (candidate) => candidate.includedUnits == null || units <= candidate.includedUnits,
  );
  if (!plan) throw new Error(`No provider plan covers ${provider}: ${units}`);
  return plan;
}

function calculateScenario(
  scenario: ScenarioInput,
  profile: DemandProfile,
) {
  const liteUsers = scenario.mau * payerMix.lite;
  const plusUsers = scenario.mau * payerMix.plus;
  const proUsers = scenario.mau * payerMix.pro;
  const paidUsers = liteUsers + plusUsers + proUsers;
  const monthlyRevenue =
    liteUsers * monthlyPrices.lite +
    plusUsers * monthlyPrices.plus +
    proUsers * monthlyPrices.pro;

  // Database-first TTLs collapse repeated visits within the same resource window.
  const tokenColdLoads =
    scenario.mau *
    profile.sessionsPerMau *
    0.7 *
    Math.min(1, scenario.tokenColdShare * profile.tokenColdFactor);
  const walletColdLoads =
    scenario.mau * profile.sessionsPerMau * 0.5 * profile.walletColdShare;
  const walletActivityPages =
    scenario.mau *
    profile.sessionsPerMau *
    0.2 *
    profile.activityColdShare *
    profile.activityPages;
  const tokenChartRequests =
    scenario.mau *
    profile.sessionsPerMau *
    0.15 *
    profile.tokenChartColdShare *
    2;

  const marketRefreshWindows = Math.round(
    scenario.marketRefreshWindows * profile.marketRefreshFactor,
  );
  const coingeckoCredits = marketRefreshWindows * 17 + tokenColdLoads * 15;
  const birdeyeCu = marketRefreshWindows * 135;
  const mobulaCredits = tokenColdLoads + walletColdLoads * 21 + walletActivityPages;

  // Plus/Pro users are the only baseline users of the wash-trading AI analysis.
  const washAnalysisCalls =
    (plusUsers + proUsers) *
    profile.sessionsPerMau *
    0.08 *
    profile.aiUsageFactor;
  const heliusCredits = walletColdLoads * 100 + washAnalysisCalls * 100;

  const coingeckoPlan = smallestPlan("coingecko", coingeckoCredits);
  const birdeyePlan = smallestPlan("birdeye", birdeyeCu);
  const mobulaPlan = smallestPlan("mobula", mobulaCredits);
  const publishedHeliusPlan = smallestPlan("helius", heliusCredits);
  const heliusAdditionalCreditMillions =
    heliusCredits > 10_000_000 && heliusCredits <= 100_000_000
      ? Math.ceil((heliusCredits - 10_000_000) / 1_000_000)
      : 0;
  const heliusPlan: ProviderPlan =
    publishedHeliusPlan.name == "Business" && heliusAdditionalCreditMillions > 0
      ? {
          name: `Developer + ${heliusAdditionalCreditMillions}M additional credits`,
          monthlyUsd: 49 + heliusAdditionalCreditMillions * 5,
          includedUnits: 10_000_000 + heliusAdditionalCreditMillions * 1_000_000,
          priceStatus: "public",
        }
      : publishedHeliusPlan;
  const zerionPlan = smallestPlan("zerion", tokenChartRequests);
  const providerUsd =
    coingeckoPlan.monthlyUsd +
    birdeyePlan.monthlyUsd +
    mobulaPlan.monthlyUsd +
    heliusPlan.monthlyUsd +
    zerionPlan.monthlyUsd;

  const geminiUsdPerGeneralUser =
    profile.sessionsPerMau *
    (0.25 * 1.5 * 0.0121 +
      0.15 * 1.5 * 0.0075 +
      0.3 * 2 * 0.0152 +
      0.35 * 2 * 0.0038);
  const washGeminiUsdPerEligibleUser =
    profile.sessionsPerMau *
    (0.08 * 0.0054 + 0.05 * 1.5 * 0.003);
  const geminiUsd =
    profile.aiUsageFactor *
    (scenario.mau * geminiUsdPerGeneralUser +
      (plusUsers + proUsers) * washGeminiUsdPerEligibleUser);

  // Pilot fan-out: Ask fallback 25%, Chart News 1 search, Volatility 3 searches.
  const braveRequests =
    scenario.mau *
    profile.sessionsPerMau *
    profile.aiUsageFactor *
    (0.25 * 1.5 * 0.25 + 0.3 * 2 + 0.35 * 2 * 3);
  const braveUsd = Math.max(0, braveRequests - 1_000) * 0.005;
  const aiUsd = geminiUsd + braveUsd;

  // Alert entitlement is planned but not enforced yet. Budget 10% utilization
  // of the monthly delivery allowance and a 5% password-reset rate per MAU.
  const alertEmails =
    (liteUsers * monthlyAlertDeliveryLimits.lite +
      plusUsers * monthlyAlertDeliveryLimits.plus +
      proUsers * monthlyAlertDeliveryLimits.pro) *
    0.1;
  const passwordResetEmails = scenario.mau * 0.05;
  const resendEmails = alertEmails + passwordResetEmails;
  // Review before 70% of the Free quota to retain room for daily traffic spikes.
  const resendUsd = resendEmails <= 2_100 ? 0 : resendEmails <= 50_000 ? 20 : 35;

  const paymentUsd = monthlyRevenue * 0.029 + paidUsers * 0.3;
  const infrastructureUsd = scenario.renderUsd + scenario.supabaseUsd;
  const totalCostUsd =
    providerUsd + aiUsd + resendUsd + paymentUsd + infrastructureUsd;
  const contributionUsd = monthlyRevenue - totalCostUsd;

  return {
    mau: scenario.mau,
    demandProfile: profile.name,
    users: { lite: liteUsers, plus: plusUsers, pro: proUsers, paid: paidUsers },
    monthlyRevenue,
    demand: {
      marketRefreshWindows,
      tokenColdLoads,
      walletColdLoads,
      walletActivityPages,
      tokenChartRequests,
      alertEmails,
      passwordResetEmails,
      resendEmails,
    },
    providerUsage: {
      coingeckoCredits,
      birdeyeCu,
      mobulaCredits,
      heliusCredits,
      zerionRequests: tokenChartRequests,
    },
    providerPlans: {
      coingecko: coingeckoPlan,
      birdeye: birdeyePlan,
      mobula: mobulaPlan,
      helius: heliusPlan,
      zerion: zerionPlan,
    },
    costs: {
      providerUsd,
      geminiUsd,
      braveUsd,
      aiUsd,
      resendUsd,
      renderUsd: scenario.renderUsd,
      supabaseUsd: scenario.supabaseUsd,
      paymentUsd,
      totalCostUsd,
    },
    contributionUsd,
    contributionMargin: contributionUsd / monthlyRevenue,
  };
}

const results = scenarios.map((scenario) =>
  calculateScenario(scenario, baseProfile),
);

// Scan a continuous MAU range so plan changes are not tied to presentation anchors.
const providerUpgradeBreakpoints: Array<{
  provider: string;
  estimatedMau: number;
  from: string;
  to: string;
}> = [];
let previousPlans: Record<string, string> | null = null;

for (let mau = 100; mau <= 50_000; mau += 25) {
  const marketGrowthExponent = Math.log(4) / Math.log(10);
  const marketRefreshWindows = Math.round(
    Math.min(2_880, 180 * Math.pow(mau / 300, marketGrowthExponent)),
  );
  const tokenScalePosition = Math.min(
    1,
    Math.max(0, Math.log10(mau / 3_000)),
  );
  const tokenColdShare = 0.3 - tokenScalePosition * 0.1;
  const scanned = calculateScenario(
    {
      mau,
      marketRefreshWindows,
      tokenColdShare,
      renderUsd: mau < 3_000 ? 7 : mau < 30_000 ? 25 : 50,
      supabaseUsd: mau < 3_000 ? 0 : mau < 30_000 ? 25 : 30,
    },
    baseProfile,
  );
  const currentPlans: Record<string, string> = {
    coingecko: scanned.providerPlans.coingecko.name,
    birdeye: scanned.providerPlans.birdeye.name,
    mobula: scanned.providerPlans.mobula.name,
    helius: scanned.providerPlans.helius.name,
    zerion: scanned.providerPlans.zerion.name,
  };

  if (previousPlans) {
    for (const [provider, plan] of Object.entries(currentPlans)) {
      const previousPlan = previousPlans[provider];
      if (previousPlan != plan) {
        providerUpgradeBreakpoints.push({
          provider,
          estimatedMau: mau,
          from: previousPlan,
          to: plan,
        });
      }
    }
  }
  previousPlans = currentPlans;
}

console.log(
  JSON.stringify(
    {
      representativeScenarios: results,
      providerUpgradeBreakpoints,
    },
    null,
    2,
  ),
);
