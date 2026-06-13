import type { ApiErrCode } from "@/api/main";
import {
  defineDateTimeFormat,
  defineNumberFormat,
  defineTextFormat,
} from "./util/util-format";
import { defineTranslationWithBase } from "./util/util-translation";

export const langCode = "en-US";

export const format = {
  num: defineNumberFormat(langCode, {
    decimalResolution: {
      resolveCurrency(value: number): number {
        const abs = Math.abs(value);
        if (abs > 1) return 2;
        if (abs > 0.01) return 4;
        if (abs > 0.0001) return 6;
        return 8;
      },
      resolveDecimal(value: number): number {
        const frac = Math.abs(value) % 1;
        if (frac >= 0.01) return 4;
        if (frac >= 0.0001) return 6;
        return 8;
      },
      resolvePercent(): number {
        return 4;
      },
    },
    currencyConfig: {
      currencyCode: () => "USD",
      currencyDisplay: () => "narrowSymbol",
    },
    readableCompactCurrency: {
      format(value: number, opts: Intl.NumberFormatOptions): string {
        const abs = Math.abs(value);
        const sign = value < 0 ? "-" : "";

        if (abs >= 1e12) {
          return `${sign}$${(abs / 1e12).toLocaleString("en-US", opts)} Trillion`;
        }
        if (abs >= 1e9) {
          return `${sign}$${(abs / 1e9).toLocaleString("en-US", opts)} Billion`;
        }
        if (abs >= 1e6) {
          return `${sign}$${(abs / 1e6).toLocaleString("en-US", opts)} Million`;
        }
        if (abs >= 1e3) {
          return `${sign}$${(abs / 1e3).toLocaleString("en-US", opts)} Thousand`;
        }
        return new Intl.NumberFormat("en-US", {
          ...opts,
          style: "currency",
          currency: "USD",
        }).format(value);
      },
    },
    smallCompactThreshold: 1e-4,
  }),
  datetime: defineDateTimeFormat(langCode, {
    datePattern: "MM/DD/YYYY",
    timePattern: "hh:mm A",
    dateTimePattern: "MMM D, YYYY hh:mm A",
    utcDateTimePattern: "MMM D, YYYY HH:mm [UTC]",
    relativeShortTimeConfig: {
      future: "in %s",
      past: "%s ago",
      s: "1s",
      m: "1m",
      mm: "%dm",
      h: "1h",
      hh: "%dh",
      d: "1d",
      dd: "%dd",
      M: "1mo",
      MM: "%dmo",
      y: "1y",
      yy: "%dy",
    },
  }),
  text: defineTextFormat(),
};

const ERROR = {
  INTERNAL_SERVER_ERR:
    "There is a problem with the server. Please try again later.",
  EMAIL_ALREADY_EXISTED: "Email already existed",
  EMAIL_OR_PASSWORD_WAS_INCORRECT: "Email or password was incorrect",
  FAILED_TO_FETCH_REQUESTED_DATA: "Failed to fetch requested data",
  GOOGLE_VERIFICATION_FAILED: "Google authentication failed. Please try again.",
  WALLET_ALREADY_LINKED: "This wallet is already linked to an existing user.",
  WALLET_VERIFICATION_FAILED: "Wallet verification failed. Please try again.",
  WALLET_NONCE_FAILED:
    "Failed to initiate wallet authentication. Please try again.",
  GENERAL_UNKNOWN_ERR: "Unknown error. Please try again.",
  NETWORK_ERR: "Network error. Please check your connection and try again.",
  VALIDATION_ERR: "Invalid input. Please check your data.",
  INVALID_TOKEN_PAYLOAD: "Invalid token payload.",
  PASSWORD_AUTH_NOT_FOUND:
    "Password auth method is not configured for this account.",
  PASSWORD_ALREADY_SET:
    "Password login is already configured for this account.",
  CURRENT_PASSWORD_INVALID: "Current password is invalid.",
  PASSWORD_RESET_CODE_INVALID: "Reset code is invalid.",
  PASSWORD_RESET_CODE_EXPIRED:
    "Reset code has expired. Please request a new code.",
  PASSWORD_RESET_ATTEMPTS_EXCEEDED:
    "Too many reset attempts. Please request a new code.",
  EMAIL_ALREADY_IN_USE: "Email is already in use by another account.",
  ACCOUNT_DELETE_CONFIRM_MISMATCH:
    "Account deletion confirmation text does not match.",
  ACCOUNT_DELETE_FORBIDDEN:
    "Account deletion request is not authorized. Please try again.",
  HOURLY_CHART_HOURLY_EXCEEDED_90_DAYS:
    "Hourly chart data cannot exceed 90 days. Please select a shorter date range.",
  DAILY_CHART_DAILY_EXCEEDED_365_DAYS:
    "Daily chart data cannot exceed 365 days. Please select a shorter date range.",
  NOT_FOUND: "Not found.",
  UNAUTHORIZED: "Unauthorized",
  RATE_LIMIT_EXCEEDED: "Too many requests. Please try again later.",
  BAD_GATEWAY: "Bad gateway. Please try again later.",
} as const satisfies Record<ApiErrCode, string>;

export const translation = {
  misc: {
    badRequest: "Bad Request",
  },
  // Common
  common: {
    cancel: "Cancel",
    confirm: "Confirm",
    submit: "Submit",
    loading: "Loading...",
    error: "Error",
    success: "Success",
    or: "or",
    and: "and",
    noData: "No data available",
  },
  // Table & Pagination
  table: {
    itemsPerPageText: "Items per page",
    pageRangeText: "Page {{count}} of {{total}}",
    itemRangeText: "{{min}}-{{max}} of {{count}} {{item | items}}",
    nextPage: "Next Page",
    previousPage: "Previous Page",
    searchPlaceholder: "Search table...",
    filterLabel: "Filter: {{column}}",
    apply: "Apply",
    selectAll: "Select All",
    from: "From",
    to: "To",
  },
  // Authentication
  auth: {
    authenticating: "Authenticating...",
    or: "Or continue with",
    signIn: "Sign In",
    signUp: "Sign Up",
    signOut: "Sign Out",
    email: "Email",
    displayName: "Display Name",
    password: "Password",
    continueWithPassword: "Continue",
    continueWithGoogle: "Continue with Google",
    continueWithWallet: "Continue with an existing wallet",
    continueWithSelectedWallet: "Continue with {{walletName}}",
    continueWithConnectedWallet:
      "Continue with {{connectedWalletName}} - {{connectedWalletAddress}}",
    confirmPassword: "Confirm Password",
    retypePassword: "Retype Password",
    forgotPassword: "Forgot password?",
    connectingWithWallet: "Connecting...",
    dontHaveAccount: "I don't have an account",
    wantAccount: "Want to have an account?",
    signUpSuggestion: "Don't have an account? {{$createAccount}}",
    createAccount: "Create a new account",
    signUpWithGoogle: "Sign up with Google",
    signUpWithWallet: "Sign up with an existing wallet(s)",
    termsAndPrivacy:
      "By signing up, you agree to our {{$terms}} and {{$privacy}}",
    termsPrefix: "By signing up, you agree to our",
    termsOfService: "Terms of Service",
    privacyPolicy: "Privacy Policy",
    terms: "Terms of Service",
    privacy: "Privacy Policy",
    googleAuthFailed: "Google authentication failed. Please try again.",
    googleAuthCancelled: "Google authentication was cancelled.",
  },
  // Wallet
  wallet: {
    transactionCount: "Transaction Count",
    connectWallet: "Connect Wallet",
    selectWallet: "Select a wallet",
    detected: "Detected",
    notDetected: "No wallet detected",
    installWallet: "Please install a Solana wallet extension",
    blockchain: "Blockchain",
    connecting: "Connecting...",
    connectionFailed: "Connection Failed",
    retry: "Retry",
    popularWallets: "Popular Solana Wallets",
    connectToSignIn: "Connect Wallet to Sign In",
    connectToSignUp: "Connect Wallet to Sign Up",
    web3Auth: "Web3 Authentication",
    selectBlockchain: "Select Blockchain",
    solana: "Solana",
    ethereum: "Ethereum",
    bitcoin: "Bitcoin",
    detectingWallets: "Detecting wallets...",
    scanningWallets: "Scanning for installed {{blockchain}} wallets...",
    detectedWallets: "Detected Wallets",
    otherWallets: "Other Wallets",
    noWalletsDetected: "No Wallets Detected",
    noWalletsFound: "No {{blockchain}} Wallets Found",
    installWalletPrompt:
      "Please install a wallet extension to continue. Click on a wallet below to visit its installation page.",
    install: "Install →",
    termsAgreement:
      "By connecting your wallet, you agree to our Terms of Service and Privacy Policy.",
    detectionFailed: "Failed to detect wallets. Please try again.",
    // Wallet Overview
    shareWallet: "Share this wallet",
    compareWallet: "Compare this wallet",
    createAlert: "Create alert for this wallet",
    bookmarked: "Bookmarked",
    bookmarkWallet: "Bookmark this wallet",
    totalAssetValue: "Total Asset Value",
    tradingVolume: "Trading Volume",
    totalPnL: "Total PnL",
    tokensTraded: "Tokens traded",
    tokensHolding: "Tokens Holding",
    filter24h: "24H",
    filter7d: "7D",
    filter30d: "1M",
    filter90d: "3M",
    filter365d: "1Y",
    filterAll: "All",
    filterCustom: "Custom",
    filterCustomDateUnit: "D",
    buyTransactionCount: "Buy tx count",
    buyVolume: "Buy volume",
    sellTransactionCount: "Sell tx count",
    sellVolume: "Sell volume",
    realizedPnL: "Realized PnL",
    unrealizedPnL: "Unrealized PnL",
    change24hPercent: "24H change",
  },
  aiAnalysisDashboard: {
    header: {
      eyebrow: "AI analysis",
      title: "AI Wallet Behavior Analysis",
      subtitle:
        "Evidence-aware wallet analysis with persona, risk, and signature-backed findings.",
      refresh: "Refresh analysis",
      notGenerated: "Not generated yet",
      generatedUnavailable: "Generated time unavailable",
      generated: "Generated {{time}}",
    },
    loading: {
      title: "Analyzing wallet behavior...",
      description:
        "Building evidence-backed persona, risk, and activity summaries.",
    },
    metrics: {
      ariaLabel: "AI analysis metrics",
      trustScore: "Trust Score",
      trustScoreHelper: "Higher means cleaner observed behavior",
      trustScoreTooltip:
        "Trust Score is calculated as 100 minus Risk Score. Higher means fewer risk signals were observed in the analyzed transaction window.",
      riskLevel: "Risk Level",
      riskLevelHelper: "Based on computed behavioral signals",
      riskLevelTooltip:
        "Risk Level is assigned from the total Risk Score: LOW 0-19, MEDIUM 20-44, HIGH 45-74, CRITICAL 75-100. UNKNOWN is used when there are too few transactions.",
      persona: "Persona",
      personaHelper: "Primary behavior pattern",
      personaTooltip:
        "Persona is the wallet's primary observed behavior pattern. It describes behavior in the analyzed window, not the identity or intent of the wallet owner.",
      personaConfidence: "Persona Confidence",
      personaConfidenceHelper: "Confidence in the persona classification",
      personaConfidenceTooltip:
        "Persona Confidence estimates how strongly the available metrics support the selected persona compared with alternatives. It is not legal or identity certainty.",
      dataCompleteness: "Data Completeness",
      dataCompletenessHelper: "Quality of available analysis inputs",
      dataCompletenessTooltip:
        "Data Completeness estimates how usable the analyzed data is. It is reduced by missing prices, unsupported transactions, parsing warnings, and failed transactions.",
      analyzedTransactions: "Analyzed Transactions",
      analyzedTransactionsHelper: "Transactions in the analysis window",
      analyzedTransactionsTooltip:
        "This is the number of transactions included in the AI analysis window. Results may not represent the wallet's full history.",
      unsupported: "{{count}} unsupported",
      missingPrices: "{{count}} missing prices",
      outOfAnalyzed: "{{items}} out of {{txCount}} analyzed transactions",
      unsupportedOutOfAnalyzed:
        "{{unsupported}} unsupported out of {{txCount}} analyzed transactions.",
    },
    summary: {
      title: "AI Wallet Behavior Summary",
      description: "Plain-language interpretation of the computed wallet profile.",
      noSummary: "No summary was generated for this wallet.",
      walletPersona: "Wallet Persona",
      walletPersonaTooltip:
        "Persona explains what behavior the wallet most resembles. It is separate from Risk Level.",
      riskSummary: "Risk Summary",
      pnlSummary: "PnL Summary",
      pnlSummaryTooltip:
        "PnL summary is based on closed positions and available price data in the analyzed window. It may not include all wallet value changes.",
      whyPersona: "Why this persona?",
      personaVsRisk:
        "Persona explains what behavior the wallet most resembles. Risk Level explains how strong the overall risk signals are.",
      selectedPersona: "Selected Persona",
      selectedPersonaFallbackTooltip:
        "This is a behavioral classification, not an identity claim.",
      commonSignals: "Common Signals",
      observedSupport: "Observed Support",
      personaConfidenceSentence:
        "Persona confidence is {{confidence}} based on how strongly available metrics support this persona compared with alternatives.",
      more: "+{{count}} more",
    },
    findings: {
      title: "Key Findings",
      description:
        "Evidence-backed observations generated from the wallet profile.",
      empty: "No major evidence-backed findings were generated for this wallet.",
      fallbackTitle: "Finding",
      fallbackExplanation: "No explanation was provided.",
      whyItMatters: "Why it matters:",
      evidence: "Evidence",
      evidenceTooltip:
        "Evidence IDs connect this finding to supporting evidence cards and risk factors.",
      signatures: "Signatures",
      signaturesTooltip:
        "Signature chips are representative transactions that support this finding and open in Solscan.",
    },
    riskBreakdown: {
      title: "Risk Breakdown",
      description: "Computed risk factors contributing to the wallet score.",
      empty: "No risk factors were generated for this wallet.",
      fallbackDescription: "No description was provided.",
      whyItMatters: "Why it matters:",
      pointsAdded: "{{points}} added to Risk Score",
      pointsTooltip:
        "This is how many points this factor adds to the total Risk Score. Higher point impact means the factor contributes more strongly to the risk level.",
      unsupportedOutOfTotal:
        "Unsupported transactions: {{unsupported}} out of {{txTotal}} analyzed transactions. Missing Data is a reliability adjustment, not suspicious wallet behavior.",
      evidence: "Evidence",
      evidenceTooltip:
        "Evidence IDs connect this risk factor to supporting evidence cards and key findings.",
    },
    evidence: {
      sectionTitle: "Evidence Highlights",
      sectionDescription:
        "Signals and representative signatures used to support the analysis.",
      howToRead: "How to read evidence cards",
      valueAndThreshold: "Value and Threshold",
      valueAndThresholdDescription:
        "Value is the measured result for this wallet. Threshold is the rule level that triggered the signal.",
      traceability: "Traceability",
      traceabilityDescription:
        "Evidence IDs connect findings, risk factors, and evidence. Signatures are representative transactions users can verify on Solscan.",
      empty: "No evidence highlights are available for this wallet.",
      fallbackTitle: "Evidence",
      evidenceId: "Evidence ID",
      evidenceIdTooltip:
        "Internal reference used to connect findings, risk factors, and evidence.",
      fallbackDescription: "No evidence description was provided.",
      value: "Value",
      valueTooltip:
        "The measured value from this wallet's analyzed transaction window.",
      threshold: "Threshold",
      thresholdTooltip:
        "The rule threshold used to decide whether this signal should be shown.",
      relatedSignatures: "Related Signatures",
      relatedSignaturesTooltip:
        "Representative transactions used as supporting evidence. Opens in Solscan.",
      relatedTokenMints: "Related Token Mints",
      relatedTokenMintsTooltip: "Token addresses involved in this signal.",
      signatureTooltip:
        "Representative transaction used as supporting evidence. Opens in Solscan.",
      tokenMintTooltip: "Token address involved in this signal.",
    },
    howToRead: {
      title: "How to Read This Analysis",
      description: "A compact guide to the labels, scores, and evidence.",
      open: "Open explanation",
      personaVsRiskTitle: "Persona vs Risk",
      personaVsRiskText:
        "Persona describes observed behavior. Risk Level describes the total strength of risk signals.",
      scoresTitle: "Scores",
      scoresText:
        "Trust Score is 100 minus Risk Score. Scores are based only on the analyzed transaction window.",
      evidenceTitle: "Evidence",
      evidenceText:
        "Evidence signatures are representative examples users can verify on Solscan.",
      limitationsTitle: "Limitations",
      limitationsText:
        "This is not financial advice or proof of suspicious behavior. Missing or unsupported transactions can reduce reliability.",
    },
    caution: {
      title: "Caution Notes",
      description: "How to interpret this analysis responsibly.",
      defaultDisclaimer:
        "Risk score reflects observed behavior in the analyzed transaction window. It is not financial advice, a legal judgment, or proof of fraud.",
      labelDisclaimer:
        "Labels such as Bot-like Trader, High Risk Speculator, or Wash Trading Suspect are behavioral classifications, not accusations.",
      backendRiskVerdict:
        "Risk score reflects observed behavior in the analyzed transaction window. It is not a legal, financial, or suspicious behavior verdict.",
      backendFullHistory:
        "Do not claim this analysis represents the wallet's full history unless the analysis window is FULL_HISTORY.",
      backendNoConfirmedSuspicious:
        "Do not claim confirmed suspicious behavior or wash trading.",
      backendNoIntent:
        "Do not infer intent beyond the computed metrics.",
    },
    empty: {
      title: "No analyzable activity found for this wallet.",
      description:
        "Transaction data loaded successfully, but there were no wallet events available for evidence-backed analysis.",
    },
    error: {
      title: "AI analysis could not be loaded",
      fallback: "Please retry the analysis.",
      retry: "Retry AI analysis",
    },
    labels: {
      unknown: "Unknown",
      low: "LOW",
      medium: "MEDIUM",
      high: "HIGH",
      critical: "CRITICAL",
      neutral: "NEUTRAL",
      highRiskSpeculator: "High Risk Speculator",
      botLikeTrader: "Bot-like Trader",
      defiTrader: "DeFi Trader",
      memecoinTrader: "Memecoin Trader",
      smartMoneyLike: "Smart Money-like",
      washTradingSuspect: "Wash Trading Suspect",
      longTermHolder: "Long-term Holder",
      casualUser: "Casual User",
      airdropFarmer: "Airdrop Farmer",
      nftCollector: "NFT Collector",
      highFrequencyActivity: "High Frequency Activity",
      shortHoldingPeriod: "Short Holding Period",
      negativePnl: "Negative PnL",
      lowWinRate: "Low Win Rate",
      highTokenDiversity: "High Token Diversity",
      highPortfolioConcentration: "High Portfolio Concentration",
      washTradingSuspected: "Wash Trading Suspected",
      missingData: "Missing Data",
    },
    severityTooltips: {
      findingHigh:
        "Strong signal. Review this first. It is not proof of wrongdoing.",
      findingMedium:
        "Meaningful signal that contributes to the interpretation.",
      findingLow: "Contextual signal that is useful but not decisive alone.",
      findingNeutral:
        "Severity indicates how important this signal is in the current analysis.",
      riskHigh:
        "High severity means this factor adds 15 or more points to the Risk Score.",
      riskMedium:
        "Medium severity means this factor adds 8 to 14 points to the Risk Score.",
      riskLow:
        "Low severity means this factor adds 1 to 7 points to the Risk Score.",
      riskNeutral:
        "Severity is based on how many risk points this factor adds.",
    },
    personaExplanations: {
      unknown: {
        meaning: "There is not enough clear behavior to assign a specific persona.",
        commonSignals: "Low transaction count, incomplete data, or mixed signals.",
        caution: "Unknown should not be interpreted as safe or risky by itself.",
      },
      longTermHolder: {
        meaning: "Wallet behavior resembles holding assets for longer periods.",
        commonSignals:
          "Low swap count, longer holding periods, low short-term trade ratio, concentrated holdings.",
        caution: "This describes observed behavior in the analyzed window only.",
      },
      casualUser: {
        meaning: "Wallet behavior resembles occasional, lower-intensity usage.",
        commonSignals:
          "Low or medium activity, fewer swaps, limited token diversity, few closed positions.",
        caution:
          "A casual label does not guarantee low risk outside the analyzed window.",
      },
      defiTrader: {
        meaning:
          "Wallet frequently interacts with decentralized trading protocols.",
        commonSignals:
          "Many swaps, high DEX usage, multiple traded tokens, meaningful trading volume.",
        caution: "This label describes protocol usage and trading behavior, not trading skill.",
      },
      memecoinTrader: {
        meaning:
          "Wallet behavior resembles speculative trading across volatile or narrative-driven tokens.",
        commonSignals:
          "High token diversity, short-term trades, heavy DEX usage, smaller average trade sizes.",
        caution:
          "Token category metadata may be incomplete, so this can rely on behavior proxies.",
      },
      nftCollector: {
        meaning: "Wallet behavior includes meaningful NFT-related activity.",
        commonSignals:
          "NFT holdings, NFT marketplace usage, repeated NFT transfer, purchase, or sale events.",
        caution:
          "NFT activity can be incomplete if marketplace or collection metadata is missing.",
      },
      airdropFarmer: {
        meaning:
          "Wallet behavior resembles activity aimed at receiving or claiming token distributions.",
        commonSignals:
          "Repeated airdrop claims, many inbound token transfers, broad token coverage, burst activity.",
        caution: "This does not prove intent; it describes claim-like behavior.",
      },
      botLikeTrader: {
        meaning:
          "Wallet activity resembles automated or high-intensity trading behavior.",
        commonSignals:
          "Dense transaction bursts, short transaction gaps, high swap count, extreme activity level.",
        caution: "This does not prove the wallet is operated by a bot.",
      },
      highRiskSpeculator: {
        meaning: "Wallet behavior resembles aggressive speculative trading.",
        commonSignals:
          "Short holding periods, high token diversity, low win rate, negative PnL, heavy DEX usage.",
        caution: "This describes behavior, not identity or intent.",
      },
      smartMoneyLike: {
        meaning:
          "Wallet shows stronger trading outcomes in the analyzed window.",
        commonSignals:
          "Positive realized PnL, higher win rate, profit factor above threshold, enough closed positions.",
        caution: "This does not guarantee future performance.",
      },
      washTradingSuspect: {
        meaning:
          "Wallet shows patterns that can be associated with potentially suspicious market behavior.",
        commonSignals:
          "High suspicion score, repeated counterparties, circular or reciprocal flow signals.",
        caution:
          "This is not proof of wash trading or suspicious behavior.",
      },
    },
    riskFactorExplanations: {
      highFrequencyActivity: {
        meaning:
          "Activity is concentrated into dense or unusually fast transaction bursts.",
        whyItMatters:
          "Dense transaction bursts can indicate automated or high-intensity trading.",
      },
      shortHoldingPeriod: {
        meaning: "Many positions appear to be opened and closed quickly.",
        whyItMatters:
          "Short holding can indicate speculative or rapid trading behavior.",
      },
      negativePnl: {
        meaning:
          "Closed positions in the analyzed window produced negative realized PnL.",
        whyItMatters:
          "Negative realized PnL means closed positions lost value in this analysis window.",
      },
      lowWinRate: {
        meaning:
          "The wallet has enough closed positions to estimate win rate, and that rate is low.",
        whyItMatters:
          "Low win rate matters only when there are enough closed positions.",
      },
      highTokenDiversity: {
        meaning: "The wallet traded many different tokens in the analyzed window.",
        whyItMatters:
          "Trading many different tokens can indicate broad speculative behavior.",
      },
      highPortfolioConcentration: {
        meaning:
          "A large share of portfolio value appears concentrated in one or a few holdings.",
        whyItMatters:
          "Concentration can increase exposure to one asset or theme.",
      },
      washTradingSuspected: {
        meaning:
          "The wallet shows patterns that can be associated with potentially suspicious market behavior.",
        whyItMatters:
          "This can be a review-priority signal, but it is not proof of wash trading.",
      },
      missingData: {
        meaning: "Some data could not be fully parsed or valued.",
        whyItMatters:
          "This affects reliability, not wallet behavior itself.",
      },
      fallbackMeaning:
        "This risk factor was generated from the wallet's analyzed behavior.",
      fallbackWhy:
        "It contributes to the total Risk Score based on the rule that produced it.",
    },
    dataCompleteness: {
      summary:
        "Data completeness is {{completeness}}. This means {{usability}} of the analyzed data was usable.",
      most: "most",
      some: "some",
      unsupported:
        "{{unsupported}} unsupported out of {{txTotal}} analyzed transactions.",
      missingPrices: "{{count}} transactions were missing price data.",
      none:
        "No missing prices or unsupported transactions were detected in this analysis window.",
    },
    riskLevelExplanation: {
      unknown:
        "Risk Level is UNKNOWN because fewer than 10 transactions were analyzed.",
      known:
        "Risk Level is assigned from total Risk Score. Current Risk Score is {{score}} / 100: LOW 0-19, MEDIUM 20-44, HIGH 45-74, CRITICAL 75-100.",
    },
  },
  // Wallet Page
  walletPage: {
    addressNotFound: "Address not found",
    overview: "Overview",
    holdings: "Holdings",
    activityRisk: "Activity / Risk",
    activity: "Activity",
    asset: "Assets",
    topExchange: "Top exchange",
    topCounterparties: "Top counterparties",
    balanceHistory: "Balance History",
    tokenBalanceHistory: "Token Balance History",
    profitLoss: "Profit & Loss",
    transfer: "Transfer",
    swap: "Swap",
    inflow: "Inflow",
    outflow: "Outflow",
    counterparties: "Counterparties",
    portfolio: "Portfolio",
    signature: "Signature",
    buyer: "Receiver",
    seller: "Sender",
    sender: "Sender",
    receiver: "Receiver",
    currentWallet: "Current wallet",
    type: "Type",
    token: "Token",
    amount: "Amount",
    price: "Price",
    total: "Total",
    time: "Time",
    status: "Status",
    holding: "Holding",
    value: "Value",
    change24h: "Change (24h)",
    // Token Details Demo
    tokensLastTraded: "Last traded tokens",
    tokensLastTradedDescription: "Tokens with recent trading activity",
    balance: "Balance",
    profit: "Profit",
    realizedProfit: "Realized Profit",
    unrealizedProfit: "Unrealized Profit",
    totalBought: "Total Bought",
    totalSold: "Total Sold",
    netValue: "Net Value",
    transactions: "Transactions",
    avgBuySellPrice: "Avg Buy/Sell Price",
    graph: "Graph",
    recentTrades: "Recent trades",
    recentTradesDescription: "Recent trades on this token",
    action: "Action",
    buy: "Buy",
    sell: "Sell",
    exchange: "Exchange",
    transaction: "Transaction",
    openInSolscan: "Open in Solscan",
    avgBuyPrice: "Avg Buy Price",
    avgSellPrice: "Avg Sell Price",
    averageTradingPrice: "Average trading price",
    filter7d: "7d",
    filter30d: "30d",
    filter90d: "90d",
    pair: "Pair",
    tokenSold: "Token Sold",
    tokenBought: "Token Bought",
    totalValueUSD: "Total Value (USD)",
    feeInLamports: "Fee (lamport)",
    identity: "Identity",
    uniqueTokensTraded: "Unique tokens traded",
    tokenList: "Token list",
    trade: "{{count}} Transactions(s)",
    instructions: "Instructions",
    view: "View",
    hide: "Hide",
    feePaid: "Paid",
    feePayer: "Payer",
    feeReceivers: "Receivers",
    baseFee: "Base fee",
    priorityFee: "Priority fee",
    perToken: "/token",
    account: "Account",
    totalVolume: "Total volume",
    unknown: "Unknown",
    unknownEntity: "Unknown Entity",
    identityKnown: "Known",
    identityUnavailable: "Identity Unavailable",
    firstFunderTag: "First funder",
    firstFunderUnavailable: "First funder unavailable",
    openFirstFunderWallet: "Open first funder wallet",
    walletAgeTag: "Wallet age",
    walletAgeUnitDay: "D",
    walletAgeUnitMonth: "Mth",
    walletAgeUnitYear: "Yr",
    manageTagsLabel: "Manage tags",
    signInManageTagsLabel: "Sign in to manage tags",
    defaultWalletName: "Wallet",
    exportPdfFailed: "Failed to export PDF. Please try again.",
    exportXlsxFailed: "Failed to export data (.xlsx). Please try again.",
    exportZipFailed: "Failed to export charts (.zip). Please try again.",
    exportingData: "Exporting data...",
    exportDataXlsx: "Export Data (.xlsx)",
    exportingCharts: "Exporting charts...",
    exportChartsZip: "Export Charts (.zip images)",
    exportingReport: "Exporting report...",
    exportReportPdf: "Export Report (.pdf)",
    aiAnalysis: "AI Analysis",
    aiAnalysisLoading: "Analyzing wallet with AI...",
    aiAnalysisFailed: "Failed to load AI analysis",
    aiAnalysisRetry: "Retry AI analysis",
    aiNoData: "No AI analysis data",
    aiSummary: "Summary",
    aiSwapSummary: {
      button: "View swap analysis",
      title: "AI Swap Summary",
      realizedPnl: "Realized PnL",
      winRate: "Win Rate",
      trades: "Trades",
      volume: "Volume",
      summary: "Summary",
      riskAnalysis: "Risk Analysis",
      cachedResult: "Cached result",
      allTokens: "All Tokens",
      entry: "Entry",
      exit: "Exit",
      hold: "Hold",
      maxLoss: "Max Loss",
      bought: "Bought",
      sold: "Sold",
      buyVolume: "Buy Vol",
      sellVolume: "Sell Vol",
      retry: "Retry",
      sortedBest: "Sorted: best PnL first",
      sortedWorst: "Sorted: worst PnL first",
      pagePrev: "← Prev",
      pageNext: "Next →",
      analyze: "AI Analysis",
      tokenAnalysis: "Token Analysis",
      riskNotes: "Risk Notes",
      tradeTimeline: "Trade Timeline",
      cumulativePnl: "Cumulative PnL",
      pnlDistribution: "PnL Distribution",
      extremeProfit: ">500%",
      highProfit: ">100%",
      profit: ">0%",
      lowLoss: ">-50%",
      highLoss: "≤-50%",
    },
    aiStatusOk: "ok",
    aiStatusInsufficientData: "insufficient_data",
    aiDataReadiness: "Data Readiness",
    aiDataAllAvailable: "All data available",
    aiDataWaiting: "Waiting for required data",
    aiDataSwaps: "Swaps",
    aiDataPortfolio: "Portfolio",
    aiDataFirstFunder: "First funder",
    aiDataIdentity: "Identity",
    aiDataIntelligence: "Intelligence",
    aiDepStatusAvailable: "available",
    aiDepStatusNoData: "no data",
    aiDepStatusFetching: "fetching",
    aiGenerateAnalysis: "Generate analysis",
    aiGenerating: "Generating...",
    aiLastUpdated: "Last updated",
    aiActivityProfile: "Activity Profile",
    aiArchetype: "Archetype",
    aiActivityLevel: "Activity level",
    aiLastActive: "Last active",
    aiInteractionFingerprint: "Interaction Fingerprint",
    aiPreferredProtocols: "Preferred protocols",
    aiTransactionTiming: "Transaction timing",
    aiPreferredTradingTokens: "Preferred trading tokens",
    aiPreferredHoldingTokens: "Preferred holding tokens",
    aiTradingVolumeRange: "Trading volume range",
    aiFunder: "Funder",
    aiFunderType: "Funder type",
    aiNotes: "Notes",
    aiWalletAge: "Wallet age",
    aiAgeCategory: "Age category",
    aiFirstSeen: "First seen",
    aiConsistencyAssessment: "Consistency assessment",
    aiSignals: "Signals",
    from: "From",
    to: "To",
    swapDetails: "Swap Details",
    transferDetails: "Transfer Details",
    sold: "Sold",
    bought: "Bought",
    swappedFor: "Swapped {{$fromAmount}} for {{$toAmount}}",
    totalValue: "Total Value",
    transactionFee: "Transaction Fee",
    sent: "Sent",
    received: "Received",
    transfersInTransaction: "Transfers in This Transaction ({{count}})",
    internal: "Internal",
    list: "List",
    timeline: "Timeline",
    mixed: "Mixed",
  },
  dictionary: {
    tradingStrategy: {
      scalper: {
        name: "Scalper",
        description:
          "Executes many short-horizon trades and prioritizes fast position turnover.",
        benefit: {
          fastTurnover: "Quickly recycles capital into new opportunities.",
          adaptsVolatility: "Can react fast when market volatility spikes.",
        },
        risk: {
          feeHeavy: "Frequent trading can heavily increase fee drag.",
          emotionalPressure: "Requires constant monitoring and fast decisions.",
        },
        rule: {
          minTrades30d: "Minimum trades in last 30 days",
          maxAvgHoldHours: "Maximum average holding hours",
        },
      },
      swing: {
        name: "Swing Trader",
        description:
          "Captures multi-day to multi-week moves and avoids overtrading noise.",
        benefit: {
          balancedPace:
            "Balances opportunity capture with lower execution stress.",
          trendCapture: "Works well in clear medium-term directional trends.",
        },
        risk: {
          gapExposure: "Overnight or weekend gaps can bypass planned exits.",
          lateReversal: "Delayed exits can erode gains after trend reversal.",
        },
        rule: {
          minTrades30d: "Minimum trades in last 30 days",
          minAvgHoldHours: "Minimum average holding hours",
        },
      },
      momentum: {
        name: "Momentum Chaser",
        description:
          "Follows strong directional breakouts with acceleration in price and volume.",
        benefit: {
          strongTrendUpside: "Can scale returns in sustained trend expansions.",
          quickInvalidation:
            "Clear invalidation levels help disciplined exits.",
        },
        risk: {
          falseBreakout: "False breakouts can trigger repeated quick losses.",
          whipsawLosses: "Choppy conditions can cause rapid entry-exit losses.",
        },
        rule: {
          minBuySellRatio: "Minimum buy/sell pressure ratio",
          minTrades30d: "Minimum trades in last 30 days",
        },
      },
      meanRevert: {
        name: "Mean Reverter",
        description:
          "Looks for overextended moves and trades back toward average pricing.",
        benefit: {
          definedEntries:
            "Entry conditions are often measurable and repeatable.",
          riskControlled: "Structured position sizing can limit downside.",
        },
        risk: {
          trendAgainst:
            "Strong trends can remain irrational longer than expected.",
          patienceRequired: "Setups may be infrequent and require discipline.",
        },
        rule: {
          maxTrades30d: "Maximum trades in last 30 days",
          minWinRate: "Minimum required win rate",
        },
      },
      conviction: {
        name: "Conviction Holder",
        description:
          "Builds concentrated positions and holds through broader market cycles.",
        benefit: {
          longCycleUpside:
            "Can capture compounding upside from long trend cycles.",
          lowNoise: "Fewer trades reduce reaction to short-term market noise.",
        },
        risk: {
          concentration: "High concentration can amplify drawdowns.",
          slowExit: "Large positions may be harder to unwind quickly.",
        },
        rule: {
          maxTokensHeld: "Maximum distinct tokens held",
          minAvgHoldDays: "Minimum average holding days",
        },
      },
    },
    walletCategory: {
      smartMoney: {
        name: "Smart Money",
        description:
          "Historically profitable wallet with consistent risk-adjusted decisions.",
      },
      activeTrader: {
        name: "Active Trader",
        description:
          "High activity wallet with frequent rotations and short response cycles.",
      },
      whale: {
        name: "Whale",
        description:
          "Wallet with large capital base capable of moving thin-liquidity markets.",
      },
      newWallet: {
        name: "New Wallet",
        description:
          "Recently active wallet with limited historical behavior footprint.",
      },
      riskWallet: {
        name: "Risk Wallet",
        description:
          "Wallet that shows elevated volatility, adverse signals, or unstable patterns.",
      },
    },
    firstFunderCategory: {
      cex: {
        name: "Centralized Exchange",
        description:
          "First inbound funding appears to come from a centralized exchange hot wallet.",
      },
      dexRouter: {
        name: "DEX Router",
        description:
          "First inbound funding originates from decentralized swap router infrastructure.",
      },
      bridge: {
        name: "Bridge",
        description:
          "First inbound funding indicates cross-chain bridge transfer behavior.",
      },
      otc: {
        name: "OTC Desk",
        description:
          "First inbound funding likely from over-the-counter settlement wallet.",
      },
      unknown: {
        name: "Unknown Source",
        description:
          "Funding source cannot be confidently classified from available on-chain signals.",
      },
    },
  },
  // Market Page
  marketPage: {
    topTokens: "Top tokens",
    topTokensDescription: "Top 50 tokens by market cap",
    tokenPerformanceTitle: "Token Performance",
    trendingTokens: "Trending tokens",
    trending: "Trending",
    trendingTokensDescription: "Top 10 trending tokens",
    profitableTraders: "Profitable traders",
    profitableTradersDescription: "Top 20 traders by market cap",
    topGainers: "Top Gainers",
    topGainersDesc:
      "List of traders with the highest profit in the selected period.",
    topLosers: "Top Losers",
    topLosersDesc:
      "List of traders with the highest loss in the selected period.",
    recentTrades: "Recent trades",
    recentTradesDesc:
      "Latest token swaps across major decentralized exchanges.",
    marketHeatmapDescription: "Treemap of top tokens by market cap",
    marketCap: "Market Cap",
    volume24h: "24h Volume",
    change24h: "24h %",
    price: "Price",
    token: "Token",
    trader: "Trader",
    profits: "Profits",
    volume: "Volume",
    trades: "Trades",
    time: "Time",
    value: "Value",
    amount: "Amount",
    transaction: "Transaction",
    openInSolscan: "Open in Solscan",
    addToWatchlist: "Add to Watchlist",
    removeFromWatchlist: "Remove from Watchlist",
    marketMap: "Market Map",
    clearWatchlist: "Clear Watchlist",
    sortBy: "Sort by",
    more: "more",
    watchlistEmptyTitle: "Your Watchlist is Empty",
    watchlistEmptySubtitle:
      "Start starring tokens in the 'All' tab to track them here!",
    all: "All",
    watchlist: "Watchlist",
    allTokensTitle: "Cryptocurrency Prices by Market Cap",
    allTokensSubtitle:
      "The global cryptocurrency market continues to evolve with significant activity across key assets. Below is an overview of the top tokens by market capitalization and their recent performance.",
    watchlistTitle: "Your Watchlist",
    watchlistSubtitle:
      "Track your favorite tokens and monitor their performance in one place.",
    tradesTitle: "Market Activity & Highlights",
    tradesSubtitle:
      "Discover top performing traders and the latest significant swaps across decentralized exchanges.",
    filterAll: "All",
    filterGreaterThan: "≥{{val}}",
    selectToken: "Select a token to view details",
    allTimeHigh: "All-Time High",
    allTimeLow: "All-Time Low",
    na: "N/A",
  },
  // Wallet Comparison Page
  walletComparison: {
    selectedWallets: "Selected Wallets",
    activeWallet: "Active Wallet",
    addWalletAddress: "Add Wallet Address",
    enterWalletAddress: "Enter wallet address...",
    noWalletsSelected: "No wallets selected. Add wallet addresses to compare.",
    general: "General",
    holdings: "Holdings",
    profitRiskManagement: "Profit & Risk Management",
    exportPdf: "Export PDF",
    generatingPdf: "Generating PDF...",
    pdfReportTitle: "Wallet Comparison Report",
    walletAnalysisReport: "Wallet Analysis Report",
    pdfGeneratedDate: "Generated Date",
    pdfWalletsCompared: "Wallets Compared",
    pdfWalletAddresses: "Wallet Addresses",
    viewDeepDive: "Deep Dive",
    aiChat: "AI Chat",
  },
  // Wallet Report PDF Template
  wallet_report: {
    wallet_audit_report: "Wallet Audit Report",
    export_date: "Export Date:",
    first_funder: "First funder:",
    wallet_age: "Wallet age:",
    wallet_address: "WALLET ADDRESS",
    executive_summary: "Executive Summary",
    total_asset_value: "Total Asset Value",
    total_pnl: "Total PnL",
    total_trading_volume: "Total Trading Volume",
    overview_details: "Overview Details",
    metrics_period: "Metrics Period",
    period_24h: "24H",
    transaction_count: "Transaction Count",
    buy_tx_count: "Buy Tx Count",
    sell_tx_count: "Sell Tx Count",
    buy_volume: "Buy Volume",
    sell_volume: "Sell Volume",
    realized_pnl: "Realized PnL",
    unrealized_pnl: "Unrealized PnL",
    tokens_holding: "Tokens Holding",
    tokens_traded: "Tokens Traded",
    overview: "Overview",
    balance_trend: "Balance Trend",
    profit_loss: "Profit & Loss",
    daily_pnl: "Daily P&L",
    cumulative_pnl: "Cumulative P&L",
    holdings: "Holdings",
    activity_risk: "Activity / Risk",
    asset_change_24h: "Asset Change (24H)",
    no_tags: "No Tags",
  },
  // Navigation
  nav: {
    market: "Market",
    alerts: "Alerts",
    dashboard: "Dashboard",
    notification: "Notifications",
    profile: "Profile",
    settings: "Settings",
    theme: "Theme",
    account: "Account",
    language: "Language",
    search: "Search",
    searchPlaceholder: "Search",
    searchHint: "Type to search for tokens, pools, or wallets",
    searchLoading: "Searching…",
    searchNoResults: "No results found",
    searchTokens: "Tokens",
    searchPools: "Pools",
    searchWallets: "Wallets",
    searchNavigate: "to navigate",
    searchSelect: "to select",
    searchClose: "to close",
    searchStats: "Stats",
    searchRank: "Rank",
    searchMarketCap: "Market Cap",
    searchVolume: "24h Volume",
    searchPrice: "Price",
    searchLast7Days: "Last 7 Days",
    switchToLightTheme: "Switch to Light Theme",
    switchToDarkTheme: "Switch to Dark Theme",
  },
  alertsPage: {
    title: "Wallet alerts",
    subtitle:
      "Follow Solana wallets and push the full list to your Helius enhanced webhook after each change.",
    addressLabel: "Wallet address",
    addressPlaceholder: "Solana address (Base58)",
    labelOptional: "Label (optional)",
    labelPlaceholder: "e.g. Whale tracker",
    followButton: "Follow wallet",
    loadingList: "Loading followed wallets…",
    emptyList: "No wallets followed yet.",
    tableAddress: "Address",
    tableLabel: "Label",
    tableAdded: "Added",
    successSaved: "Wallet saved.",
    successHelius: "Helius webhook synced with the updated address list.",
    partialHelius:
      "Wallet saved, but Helius sync failed. Set HELIUS_API_KEY and WEBHOOK_PUBLIC_URL on the server, then try again.",
    errorInvalidAddress: "That does not look like a valid Solana address.",
    errorDuplicate: "This address is already being followed.",
    errorGeneric: "Something went wrong. Please try again.",
    heliusOk: "Helius: OK",
    heliusFailed: "Helius: failed",
    tableActions: "Actions",
    deleteSuccess: "Wallet removed and Helius synced.",
    deletePartial:
      "Wallet removed, but Helius re-sync failed. The old address may still receive events until the next successful sync.",
    deleteFailed: "Failed to remove wallet. Please try again.",
    deleteNotFound: "Wallet was already removed.",
    signInRequired: "Please sign in to manage your followed wallets.",
    discordSectionTitle: "Discord notifications",
    discordLabel: "Discord Webhook URL",
    discordPlaceholder: "https://discord.com/api/webhooks/...",
    discordSaveButton: "Save",
    discordSaved: "Discord webhook URL saved.",
    discordSaveError: "Failed to save Discord URL. Please try again.",
    emailSectionTitle: "Email notifications",
    emailToggleLabel: "Email me alerts",
    emailRegisteredHint: "Registered email: {{email}}",
    emailNoRegistered:
      "No registered email on file. Add an override email below.",
    emailOverrideLabel: "Override email (optional)",
    emailOverridePlaceholder: "Leave empty to use your registered email",
    emailSaveButton: "Save",
    emailSaved: "Email settings saved.",
    emailSaveError: "Failed to save email settings. Please try again.",
    emailNoDestination:
      "Enable email alerts with either a registered email or an override address.",
    ruleModalTitle: "Create new alert",
    ruleModalLabel: "Alerts",
    ruleStep1Indicator: "(1) Trading events — (2) Delivery",
    ruleStep2Indicator: "(1) Trading events — (2) Delivery",
    ruleTraderLabel: "Trader (wallet address)",
    ruleActionLabel: "Action type",
    ruleActionSwap: "Swap",
    ruleActionTransfer: "Transfer",
    ruleActionAll: "Any activity",
    ruleVolFrom: "Volume from",
    ruleVolTo: "Volume to",
    ruleVolUnit: "Volume unit",
    ruleUnitUsd: "USD (server converts SOL via WEBHOOK_SOL_PRICE_USD)",
    ruleUnitSol: "SOL (on-chain)",
    ruleTriggerLegend: "Trigger",
    ruleTriggerOnce: "Only once",
    ruleTriggerAlways: "Always",
    ruleExpiry: "Expires",
    ruleUseDefault: "Use default Discord & email settings",
    ruleToggleOff: "Off",
    ruleToggleOn: "On",
    ruleDiscordOverride: "Discord webhook (override)",
    ruleEmailOverride: "Email (override)",
    ruleNameLabel: "Alert name",
    rulePreviewLabel: "Message (auto)",
    ruleBack: "Back",
    ruleCancel: "Cancel",
    ruleNext: "Next",
    ruleSave: "Save",
    ruleCreateOpen: "Create new alert",
    ruleTableTitle: "Advanced alert rules",
    ruleTableSubtitle:
      "Helius streams events once; the server applies your predicates (observer + filter) before Discord or email.",
    ruleTableEmpty: "No active alert rules.",
    ruleTableName: "Name",
    ruleTableWallet: "Wallet",
    ruleTableAction: "Action",
    ruleTableVolume: "Volume",
    ruleTableTrigger: "Trigger",
    ruleTableExpires: "Expires",
    ruleDeleteSuccess: "Rule removed and Helius synced.",
    rulePreviewBody: "Wallet {{wallet}} on Solana has {{verb}} with {{range}}.",
    rulePreviewVerbSwap: "a swap",
    rulePreviewVerbTransfer: "a transfer",
    rulePreviewVerbAny: "activity",
    rulePreviewRangeBoth:
      "value greater than {{min}}{{sym}} and less than {{max}}{{sym}}",
    rulePreviewRangeMin: "value greater than {{min}}{{sym}}",
    rulePreviewWalletPlaceholder: "(wallet address)",
    ruleErrorWallet: "Enter a valid Solana wallet address.",
    ruleErrorMinVol: "Minimum volume must be a positive number.",
    ruleErrorMaxVol:
      "Maximum volume must be empty or greater than or equal to minimum.",
    ruleErrorExpiry: "Choose a future expiry date.",
    ruleErrorDelivery:
      "Provide a Discord webhook URL and/or a valid email override.",
    ruleSaveError: "Could not save this alert rule.",
    ruleLoading: "Loading alert rules…",
    ruleCreateSuccess: "Alert rule saved and address list sent to Helius.",
  },
  lang: {
    vi: "Vietnam - Tiếng Việt (Vietnamese)",
    en: "United States - English (English)",
  },
  // Validation errors
  validation: {
    required: "This field is required",
    identifierRequired: "Username or email is required",
    identifierInvalid:
      "Please enter a valid email or username (minimum 3 characters)",
    emailRequired: "Email is required",
    invalidEmail: "Please enter a valid email address",
    usernameRequired: "Username is required",
    usernameTooShort: "Username must be at least 3 characters",
    usernameTooLong: "Username must be at most 20 characters",
    usernameInvalidChars:
      "Username can only contain letters, numbers, and underscores",
    passwordRequired: "Password is required",
    passwordTooShort: "Password must be at least {{min}} characters",
    passwordComplexity:
      "Password must contain at least one uppercase letter, one lowercase letter, and one number",
    confirmPasswordRequired: "Please confirm your password",
    passwordsDoNotMatch: "Passwords do not match",
    invalidCredentials: "Invalid username or password",
    accountExists: "An account with this email already exists",
    networkError: "Network error. Please try again.",
    registrationFailed: "Registration failed. Please try again.",
  },
  // Showcase page
  showcase: {
    title: "Yoca Component Showcase",
    subtitle: "Authentication & Navigation UI Components",
    signInSection: "Sign In Component",
    signUpSection: "Sign Up Component",
    walletSection: "Wallet Connection",
    googleAuthSection: "Google OAuth",
    navigationSection: "Navigation Header",
    placeholderContent: "This is placeholder content for demonstration.",
  },
  // Charts
  charts: {
    // Common
    loading: "Loading chart data...",
    refreshing: "Refreshing...",
    retry: "Try Again",
    export: "Export",
    fullscreen: "Fullscreen",
    miniPlayer: "Mini Player",
    exitFullscreen: "Exit Fullscreen",

    // Viewing modes
    enterFullscreenMode: "Enter fullscreen mode",
    openMiniPlayer: "Open mini player",
    chartViewingModes: "Chart viewing modes",
    fullscreenView: "Fullscreen View",
    exitFullscreenEsc: "Exit fullscreen (ESC)",
    closeMiniPlayer: "Close mini-player",
    closeMiniPlayerEsc: "Close mini-player (ESC)",
    dragToMove: "Drag to move",
    maximize: "Maximize",
    minimize: "Minimize",

    // Timezone
    selectTimezone: "Select timezone",
    timezone: "Timezone",
    timezoneOptions: "Timezone options",
    searchTimezones: "Search timezones...",
    noTimezonesFound: "No timezones found",
    localTime: "Local Time",
    utc: "UTC",

    // Loading states
    loadingChartData: "Loading {{title}} chart data",
    refreshingChartData: "Refreshing {{title}} chart data",
    chartLoadedSuccessfully: "{{title}} chart loaded successfully",
    errorLoadingChart: "Error loading {{title}} chart",
    noDataForChart: "No data available for {{title}} chart",

    // Empty state
    noDataTitle: "No Data Available",
    noDataMessage: "There is no data to display for the selected filters.",
    resetFilters: "Reset Filters",
    adjustFilters: "Try adjusting your filters or date range",
    noWalletsTitle: "No Wallets Selected",
    noData: "No data available",

    // TreeMap
    treemapNoData: "No data",

    // Error state
    errorTitle: "Unable to Load Chart",
    errorMessage: "An error occurred while loading the chart data.",
    technicalDetails: "Technical Details",
    networkError: "Network error. Please check your connection.",
    serverError: "Server error. Please try again later.",

    // Export
    exportChart: "Export chart",
    exportFormatOptions: "Export format options",
    exportPNG: "Export as PNG",
    exportSVG: "Export as SVG",
    exportCSV: "Export as CSV",
    exportPDF: "Export as PDF",
    pngFormat: "PNG",
    svgFormat: "SVG",
    csvFormat: "CSV",
    pdfFormat: "PDF",
    retinaBadge: "Image",
    vectorBadge: "Vector",
    dataBadge: "Data",
    pdfBadge: "PDF",
    exportSuccess: "Chart exported successfully",
    exportFailed: "Export failed. Please try again.",

    // Filters
    timePeriod: "Time Period",
    last7Days: "Last 7 Days",
    last30Days: "Last 30 Days",
    last60Days: "Last 60 Days",
    last90Days: "Last 90 Days",
    lastYear: "Last Year",
    allTime: "All Time",
    customRange: "Custom Range",
    tokens: "Tokens",
    allTokens: "All Tokens",
    transactionType: "Transaction Type",
    allTypes: "All Types",
    trades: "Trades",
    transfers: "Transfers",
    deposits: "Deposits",
    withdrawals: "Withdrawals",
    wallets: "Wallets",

    // Chart titles
    balanceTrend: "Balance Trend",
    assetDistribution: "Assets Distribution",
    profitLoss: "Profit & Loss",
    exchangeComparison: "Exchange Comparison",
    counterpartyActivity: "Counterparty Activity",
    volumeBenchmark: "Volume Benchmark",
    transactionDistribution: "Transaction Distribution",
    holdingDurations: "Holding Durations",
    aggregatedAssetDistribution: "Aggregated Asset Distribution",

    // Chart specific
    balanceChart: {
      title: "Balance History",
      totalBalance: "Total Balance",
      change: "Change",
      date: "Date",
      balance: "Balance",
      selectTokenLabel: "Select token",
      selectModeTokenLabel: "Select mode/token",
      add: "Add",
      switch: "Switch",
      all: "All",
      window7d: "7D",
      window30d: "30D",
      notAvailable: "N/A",
      noDataDelta: "--",
      removeTag: "Remove tag",
      atLeastOneTagRequired: "At least one tag is required",
    },
    walletSingleBalanceChart: {
      title: "Wallet Balance Trend",
      notAvailable: "N/A",
      window: {
        label: "Window",
        days7: "7D",
        days30: "30D",
      },
      walletTable: {
        title: "Wallet Selector",
        wallet: "Wallet",
        netWorth: "Net Worth",
        balanceChange24h: "24h Change",
      },
      ariaLabels: {
        windowToggle: "Balance chart window toggle",
      },
    },
    assetDistributionChart: {
      title: "Assets Distribution",
      totalValue: "Total Value",
      asset: "Assets",
      value: "Value",
      percentage: "Percentage",
      assetPrice: "Current Price",
      noWalletsMessage:
        "Please select at least one wallet to view asset distribution.",
      others: "Others",
      filters: {
        top: "Top",
        topN: "Top N",
        minPct: "Min %",
        all: "All",
        allPercent: "All %",
        top5: "Top 5",
        top10: "Top 10",
        minPct1: ">1%",
        minPct5: ">5%",
        minPct10: ">10%",
      },
      ariaLabels: {
        topNFilter: "Top N filter",
        minPctFilter: "Min % filter",
      },
      filtersMenu: "Filters",
      legend: {
        clickToHide: "Click to hide {name}",
        clickToShow: "Click to show {name}",
      },
      export: {
        name: "Assets Distribution",
      },
    },
    aggregatedAssetDistributionChart: {
      title: "Aggregated Asset Distribution",
      totalValue: "Total Value",
      value: "Value",
      percentage: "Percentage",
      noWalletsMessage:
        "Please select at least one wallet to view aggregated asset distribution.",
      others: "Others",
      mode: {
        label: "Mode",
        single: "Single Wallet",
        aggregate: "Multiple Aggregated",
      },
      walletTable: {
        title: "Wallet Selector",
        wallet: "Wallet",
        walletName: "Wallet Name",
        walletAddress: "Wallet Address",
        netWorth: "Net Worth",
        uniqueTokenCount: "Unique Tokens",
        isSelected: "Is Selected",
        selectedCount: "{count} wallets selected",
        selection: "Selection",
        unknownWallet: "Unknown Wallet",
      },
      filters: {
        top: "Top",
        topN: "Top N",
        minValue: "Min %",
        all: "All",
        allPercent: "All %",
        top5: "Top 5",
        top10: "Top 10",
        minPct1: ">1%",
        minPct5: ">5%",
        minPct10: ">10%",
      },
      ariaLabels: {
        modeToggle: "Asset distribution mode toggle",
        topNFilter: "Top N filter",
        minPctFilter: "Min % filter",
        walletSelector: "Select wallet {wallet}",
      },
      export: {
        name: "Aggregated Asset Distribution",
      },
    },
    pnlChart: {
      title: "Profit & Loss",
      dailyPnL: "Daily P&L",
      cumulativePnL: "Cumulative P&L",
      profit: "Profit",
      loss: "Loss",
      date: "Date",
      totalProfit: "Total Profit",
      totalLoss: "Total Loss",
      netPnL: "Net P&L",
      aggregation: "Aggregation",
      daily: "Daily",
      weekly: "Weekly",
      monthly: "Monthly",
      both: "Daily + Cumulative P&L",
    },
    exchangeComparisonChart: {
      title: "Exchange Activity Comparison",
      exchange: "Exchange",
      deposits: "Deposits",
      withdrawals: "Withdrawals",
      count: "Transaction Count",
      volume: "Volume (USD)",
      metric: "Metric",
      transactionCount: "Transaction Count",
      volumeUSD: "Volume (USD)",
    },
    counterpartyActivityChart: {
      title: "Counterparty Activity Analysis",
      counterparty: "Counterparty",
      transactionCount: "Transaction Count",
      totalVolume: "Total Volume",
      limit: "Show Top",
      top10: "Top 10",
      top20: "Top 20",
      top50: "Top 50",
    },
    volumeBenchmarkChart: {
      title: "Trading Volume Comparison",
      volume: "Volume",
      date: "Date",
      wallet: "Wallet",
      chartType: "Chart Type",
      line: "Line",
      bar: "Bar",
      showLabels: "Show Labels",
    },
    transactionDistributionChart: {
      title: "Transaction Activity Analysis",
      transactionCounts: "Transaction Counts",
      uniqueTokens: "Unique Tokens Traded",
      date: "Date",
      count: "Count",
      tokens: "Tokens",
      chartMode: "Chart Mode",
      stacked: "Stacked",
      grouped: "Grouped",
    },
    holdingDurationsChart: {
      title: "Token Holding Durations",
      token: "Token",
      duration: "Duration",
      days: "Days",
      weeks: "Weeks",
      months: "Months",
      timeUnit: "Time Unit",
      topN: "Show Top",
      wallet: "Wallet",
    },
    totalTradingVolumeChart: {
      title: "Total Trading Volume Ranking",
    },
    tradingVolumePerTransactionChart: {
      title: "Trading Volume Per Transaction",
      volume: "Volume (USD)",
    },
    tradingVolumeDistributionChart: {
      title: "Trading Volume Distribution",
      volume: "Volume",
      percentage: "Percentage",
      totalVolume: "Total Volume",
      noWalletsTitle: "No Wallets Selected",
      noWalletsMessage:
        "Please select at least one wallet to view trading volume distribution.",
      buy: "Buy",
      sell: "Sell",
    },
    tokenPriceChart: {
      price: "{{tokenSymbol}} Price",
      volume: "{{tokenSymbol}} Volume",
      marketCap: "{{tokenSymbol}} Market Cap",
    },
    stablecoinRatioChart: {
      title: "Stablecoin Ratio",
    },
    rollingAnnualReturn: {
      title: "Rolling Annual Return",
      rollingReturn: "Rolling Return",
      cumulativeReturn: "Cumulative Return",
      month: "Month",
      quarter: "Quarter",
      year: "Year",
      custom: "Custom",
      days: "Days",
    },
    priceHistoryChart: {
      title: "Price History",
    },
    marketHeatmap: {
      title: "Market Heatmap",
    },
    winrateChart: {
      title: "Winrate Analysis",
    },
    drawdownChart: {
      title: "Drawdown Analysis",
      visibility: {
        active: "Active",
        hidden: "Hidden",
      },
      stats: {
        maxDrawdown: "Max Drawdown",
        daysSinceMaxDD: "Days Since Max DD",
        currentDrawdown: "Current Drawdown",
        maxDDDate: "Max DD Date",
        days: "days",
      },
    },
    averageRollingAnnualReturn: {
      title: "Average Rolling Annual Return",
      returnPercent: "Return",
      month: "Month",
      quarter: "Quarter",
      year: "Year",
      custom: "Custom",
      days: "Days",
    },
  },
  // Chat / AI Wallet Assistant
  chat: {
    headerTitle: "YOCA AI",
    inputPlaceholder: "Ask about this wallet...",
    loadingLabel: "Analyzing...",
    errorMessage: "Sorry, I encountered an error: {{error}}. Please try again.",
    promptMenuTitle: "Choose a prompt",
    quickQuestionsTitle: "Quick Questions",
    sendButtonTitle: "Send",
    promptMenuBtn: "Prompt menu",
    fabTitle: "Open AI Chat",
    seriesLabel: "Series {{count}}",
    tldr: "TLDR",
    warnings: "Warnings",
    evidence: "Evidence",
    confidence: "Confidence",
    showAll: "Show all ({{count}})",
    showLess: "Show less",
    inputCounter: "{{current}}/{{max}}",
    inputOverLimit: "Question must be {{max}} characters or fewer.",
    clickToAsk: "Click to ask: {{query}}",
    tableNullValue: "-",
    newChat: "New session",
    signInRequired: "Sign in Required",
    signInRequiredDesc: "Please sign in to use the AI chat assistant. Your chat history will be saved across sessions.",
    sessions: "Sessions",
    noSessions: "No sessions yet",
    deleteSession: "Delete session",
    copy: "Copy",
    copied: "Copied!",
    tellMeMore: "Tell me more about",
    copySection: "Copy section",
    sources: "Sources",
    fabLabel: "AI",
    serverError: "Server error: {{status}}. Please try again.",
    leftSidebar: "Left sidebar",
    rightSidebar: "Right sidebar",
    fullscreenMode: "Fullscreen",
    minimize: "Minimize",
    close: "Close",
    sourcePill: "sources",
    openSource: "Open",
    prompt: {
      overview: { label: "Overview", query: "Give a portfolio overview of this wallet including total balance, 24h change, and trading volume." },
      pnl: { label: "PnL Summary", query: "What is the profit and loss for this wallet? Show per-token breakdown with realized PnL and win rate." },
      trades: { label: "Recent Trades", query: "Show the recent swap transactions for this wallet with token details and USD values." },
      tokens: { label: "Top Tokens", query: "What are the current token holdings of this wallet by USD value?" },
      balance: { label: "Balance Trend", query: "Show the balance history chart for this wallet over the last 30 days." },
      portfolioChange: { label: "Portfolio Change", query: "Compare this wallet's current portfolio to a 7 days ago. Have holdings changed significantly?" },
      tokenPrices: { label: "Token Prices", query: "Check the current prices and market data for 5 most significant tokens held by this wallet." },
      compareOverview: { label: "Compare Portfolios", query: "Compare the portfolios of these wallets — which has the best total value and 24h change?" },
      comparePnl: { label: "PnL Comparison", query: "Compare PnL across these wallets — which has the highest realized profit and win rate?" },
      commonHoldings: { label: "Common Holdings", query: "Which tokens are commonly held across these wallets and what are the overlaps?" },
      topPerformer: { label: "Top Performer", query: "Which wallet has the best ROI and trading performance across all metrics?" },
      riskComparison: { label: "Risk Comparison", query: "Compare diversification and risk profiles across these wallets." },
    },
  },
  token: {
    overviewSectionTitle: "Overview",
    historicalPriceSectionTitle: "Historical Price",
    overviewChart: {
      price: "Price",
      marketCap: "Market Cap",
      noData: "No chart data available",
      noCoingeckoId: "token may not have a CoinGecko ID",
    },
    range24h: "24h Range",
    marketCap: "Market Cap",
    fullyDilutedValuation: "Fully Diluted Valuation",
    tradingVolume24h: "24 Hour Trading Vol",
    circulatingSupply: "Circulating Supply",
    totalSupply: "Total Supply",
    maxSupply: "Max Supply",
    info: "Info",
    website: "Website",
    explorers: "Explorers",
    community: "Community",
    allTimeHigh: "All-Time High",
    allTimeLow: "All-Time Low",
    marketsTitle: "{{name}} Markets",
    marketsDescription:
      "Top decentralized exchange pools for trading {{name}}.",
    topHoldersTitle: "{{name}} Top Holders",
    topHoldersDescription: "Top 10 token holders for {{name}}.",
    trendingCoins: "Trending Coins",
    header: {
      copy: "Copy Address",
      twitter: "X (Twitter)",
      searchX: "Search on X",
      discord: "Join Discord",
      coingecko: "View on CoinGecko",
    },
    chart: {
      loadingPool: "Loading chart...",
    },
    poolSelector: {
      selectPool: "Select Pool",
    },
    tabs: {
      overview: "Overview",
      markets: "Markets",
      news: "News",
      trending: "Trending",
      historicalData: "Historical Data",
    },
    news: {
      title: "News & Updates",
      cached: "Cached",
      cachedTooltip: "Cached from recent fetch",
      fetch: "Fetch news",
      fetchTooltip: "Fetch news for this token",
      refresh: "Refresh news",
      refreshTooltip: "Refresh the latest news for this token",
      loading: "Loading news...",
      error: "Unable to load news right now.",
      errorPrefix: "Error loading news:",
      empty: "No recent news found for {{name}}.",
      tryRefresh: "Try Refreshing",
      showing: "Showing",
      of: "of",
      loadMore: "Load More",
      previousPage: "Previous news page",
      nextPage: "Next news page",
      expand: "Expand",
      collapse: "Collapse",
      snippetsTitle: "Extra snippets",
      contextTitle: "Token context",
      priceChartTitle: "Price",
      marketCapChartTitle: "Market cap",
      noSnippets: "No extra snippets available.",
      noContext: "No cached token context available.",
      loadingContext: "Loading context...",
      tokenContextLabel: "Context for {{symbol}}",
      posted: "Article posted",
      sourceAlt: "News source favicon",
      sourceFallback: "News",
      openArticle: "Open article",
    },
    marketsTable: {
      rank: "Rank",
      exchange: "Exchange",
      pair: "Pair",
      price: "Price",
      change24h: "24h Change",
      volume24h: "24h Volume",
      liquidity: "Liquidity",
      txns24h: "Txns 24h",
    },
    marketStats: {
      priceUsd: "PRICE USD",
      priceBaseQuote: "PRICE BASE/QUOTE",
      liquidity: "LIQUIDITY",
      marketCap: "MARKET CAP",
      marketCapTip: "Market Capitalization",
      fdv: "FDV",
      fdvTip: "Fully Diluted Valuation",
      change5m: "5M",
      change1h: "1H",
      change6h: "6H",
      change24h: "24H",
      change24hFull: "24H CHANGE",
      vol24h: "24H VOL",
      vol24hTip: "24-hour Volume",
      buy: "BUY",
      sell: "SELL",
      net: "NET",
      txns24h: "24H TXNS",
      txns24hTip: "24-hour Transactions",
      traders24h: "24H TRADERS",
      top10Holders: "TOP 10 HOLDERS",
      holders: "HOLDERS",
      circSupply: "CIRC SUPPLY",
      totalSupply: "TOTAL SUPPLY",
      markets: "MARKETS",
    },
    recentTransactions: {
      transactions: "Transactions",
      bubblemaps: "Bubblemaps",
      time: "Time",
      type: "Type",
      price: "Price",
      priceUsd: "Price USD",
      amount: "Amount",
      value: "Value",
      from: "From",
      tx: "TX",
      buy: "BUY",
      sell: "SELL",
      loading: "Loading trades...",
      empty: "No recent transactions",
      noAddress: "No token address for bubblemaps",
    },
    topHolders: {
      rank: "Rank",
      address: "Address",
      percent: "Percentage",
      noData: "No holders data found for this token.",
    },
    historicalData: {
      title: "{{name}} Price History",
      date: "Date",
      marketCap: "Market Cap",
      volume: "Volume",
      close: "Close",
      showMore: "Show More",
      error:
        "Failed to fetch historical data. This token may not be listed on CoinGecko.",
    },
    insightTabs: {
      about: "Stats",
      holders: "Holders",
      noDescription: "No description available.",
      distributionTitle: "Holder Distribution",
      distributionDescription:
        "Breakdown of {{symbol}} token ownership among top holders.",
      top10: "Top 10",
      rank1120: "11–20",
      rank2140: "21–40",
      rank1130: "11–30",
      rank3150: "31–50",
      others: "Others",
      supplyBillion: "{{count}} billion {{symbol}}",
      supplyMillion: "{{count}} million {{symbol}}",
      supplyThousand: "{{count}} thousand {{symbol}}",
      volumeQ: "What is the daily trading volume of {{name}} ({{symbol}})?",
      volumeA:
        "The 24h trading volume of {{name}} ({{symbol}}) is {{volume}}, representing a {{change}} change versus the previous day.",
      athAtlQ:
        "What is the highest and lowest price for {{name}} ({{symbol}})?",
      athAtlA:
        "{{name}} ({{symbol}}) reached an all-time high of {{ath}} and an all-time low of {{atl}}. It is currently trading {{athPct}} from its peak and {{atlPct}} above its lowest recorded price.",
      marketCapQ: "What is the market cap of {{name}} ({{symbol}})?",
      marketCapA:
        "Market capitalization of {{name}} ({{symbol}}) is {{marketCap}}, ranked #{{rank}} by market cap today. Market cap is measured by multiplying the token price with the circulating supply — {{supply}} tokens are tradable on the market today.",
      fdvQ: "What is the fully diluted valuation of {{name}} ({{symbol}})?",
      fdvA: "The fully diluted valuation (FDV) of {{name}} ({{symbol}}) is {{fdv}}. This is a statistical representation of the maximum market cap, assuming all {{maxSupply}} tokens are in circulation today. Depending on the emission schedule, it may take years before FDV is fully realized.",
    },
    globalPrices: {
      title: "Global {{name}} Prices",
      description: "{{name}} price in major global currencies.",
      showMore: "Show More",
    },
  },
  tooltips: {
    marketCap:
      "Current Price x Circulating Supply. Refers to the total market value of a cryptocurrency's circulating supply. It is similar to the stock market's measurement of multiplying price per share by shares readily available in the market (not held & locked by insiders, governments).",
    fullyDilutedValuation:
      "The market capitalization of a cryptocurrency if all possible coins were in circulation. It is calculated by multiplying the current price by the maximum supply of the cryptocurrency.",
    tradingVolume24h:
      "Total trading volume of the token in the last 24 hours across all exchanges. It is a measure of how actively the token is being traded and can indicate its liquidity and market interest.",
    circulatingSupply:
      "The total number of coins or tokens that are currently available and circulating in the market. It is used to calculate the market capitalization of a cryptocurrency.",
    totalSupply:
      "The total number of coins or tokens that exist for a cryptocurrency, including those that are not yet circulating. It is used to calculate the maximum potential market capitalization of a cryptocurrency.",
    maxSupply:
      "The maximum number of coins or tokens that will ever exist for a cryptocurrency. It is used to calculate the fully diluted valuation of a cryptocurrency.",
  },
  profileSettings: {
    identity: "Identity",
    displayName: "Display name",
    email: "Email",
    saveIdentity: "Save identity",
    savingIdentity: "Saving identity",
    identityUpdateFailed: "Identity update failed",
    identityUpdated: "Identity updated",
    loginMethods: "Login methods",
    loginMethodPasswordEmail: "Password / Email",
    loginMethodPasswordNotSet: "Not set",
    loginMethodGoogleOAuth: "Google Mail OAuth",
    loginMethodSolanaWallet: "Solana Wallet",
    statusConnected: "Connected",
    statusNotConnected: "Not connected",
    changePassword: "Change password",
    addPassword: "Add password",
    currentPassword: "Current password",
    newPassword: "New password",
    confirmPassword: "Confirm password",
    passwordMatchError: "New password and confirmation do not match",
    passwordValidationEmailRequired: "Email is required to set password login",
    passwordValidationEmailInvalid: "Please enter a valid email address",
    passwordValidationCurrentPasswordRequired:
      "Current password is required to change password",
    passwordValidationNewPasswordRequired: "New password is required",
    passwordValidationMinLength: "Password must be at least 8 characters",
    passwordValidationUppercase:
      "Password must include at least one uppercase letter",
    passwordValidationLowercase:
      "Password must include at least one lowercase letter",
    passwordValidationNumber: "Password must include at least one number",
    passwordUpdateFailed: "Password update failed",
    passwordChanged: "Password changed",
    passwordAdded: "Password added",
    updatingPassword: "Updating password",
    savePassword: "Save password",
    dangerZone: "Danger zone",
    dangerZoneDescription:
      "Delete account removes profile and all linked auth/wallet data.",
    deleteAccount: "Delete account",
    deleteAccountWarning:
      "This action is permanent. Type DELETE MY ACCOUNT to confirm.",
    deleteAccountConfirmationText: "Confirmation text",
    deleteAccountConfirmButton: "Confirm delete",
    accountDeleteConfirmError: "Confirmation text mismatch",
    accountDeleteFailed: "Account deletion failed",
  },
  profileTabs: {
    activity: {
      title: "Activity",
      unavailableTitle: "Activity unavailable",
      unavailableDescription: "Unable to load activity data right now.",
      swapsTableTitle: "Swaps",
      transfersTableTitle: "Transfers",
      tableHeaders: {
        swaps: {
          wallet: "Wallet",
          time: "Time",
          pair: "Pair",
          exchange: "Exchange",
          totalValue: "Total value",
        },
      },
      unknownExchange: "Unknown",
    },
    alerts: {
      title: "Alerts",
      unavailableTitle: "Alerts unavailable",
      unavailableDescription:
        "No alert rules or notifications are available right now.",
      tableTitle: "Alert list",
      tableHeaders: {
        token: "Token",
        type: "Type",
        condition: "Condition",
        status: "Status",
        updated: "Updated",
        actions: "Actions",
      },
      createAlertTitle: "Create alert",
      editAlertTitle: "Edit {{token}} alert",
      createButton: "Create alert",
      editButton: "Edit",
      deleteButton: "Delete",
    },
    dashboard: {
      title: "Dashboard",
      unavailableTitle: "Dashboard unavailable",
      unavailableDescription:
        "No dashboard metrics are available for this account.",
      kpiStripTitle: "KPI strip",
      concentrationTableTitle: "Wallet concentration",
      concentrationHeaders: {
        wallet: "Wallet",
        value: "Value",
        share: "Share",
      },
      riskPanelTitle: "Risk panel",
      anomaliesTitle: "Recent anomalies",
    },
    portfolio: {
      title: "Portfolio",
      unavailableTitle: "No linked wallets",
      unavailableDescription:
        "Link at least one wallet to view portfolio and charts.",
      overviewCardTitle: "Overview",
      accountTierLabel: "Account Tier",
      linkWalletButton: "Link wallet",
      linkedWalletsLabel: "Linked wallets",
      linkedWalletsList: "Linked wallets list",
      label: "Label",
      address: "Address",
      totalValue: "Total Value",
      auth: "Auth",
      actions: "Actions",
      authWallet: "Auth wallet",
      authWalletLabel: "Auth wallet",
      linkedWalletLabel: "Linked wallet",
      compare: "Compare",
      authWalletCannotBeUnlinked: "Auth wallet cannot be unlinked",
      unlinkWallet: "Unlink wallet",
    },
    wallet: {
      title: "Wallets",
      unavailableTitle: "Wallet data unavailable",
      unavailableDescription: "Unable to load wallet data right now.",
      noLinkedWalletsTitle: "No linked wallets",
      noLinkedWalletsDescription:
        "Link at least one wallet to view portfolio and charts.",
      portfolioTableTitle: "Portfolio table",
      balanceChartTitle: "Balance",
      drawdownChartTitle: "Drawdown",
      section: {
        performance: "Wallet performance",
        activity: "Flow and activity",
        risk: "Risk mix",
      },
    },
    watchlist: {
      title: "Watchlist",
      walletSubtab: "Wallet watchlist",
      tokenSubtab: "Token watchlist",
      walletTableTitle: "Watched wallets",
      tokenTableTitle: "Watched tokens",
      walletAddress: "Wallet address",
      walletIdentity: "Identity",
      emptyWalletTitle: "No wallets in watchlist",
      emptyWalletDescription: "Add wallets to watchlist to track them here.",
      emptyTokenTitle: "No tokens in watchlist",
      emptyTokenDescription:
        "Add tokens to watchlist to track market movement.",
    },
    unavailableState: {
      defaultTitle: "Data unavailable",
      defaultDescription: "No profile data is available right now.",
    },
  },
  errorPages: {
    unauthorized: {
      error401: "401 Error",
      accessDenied: "Access Denied",
      description: "You need to log in before accessing this page.",
      protectedPath: "Protected path: {{$path}}",
      login: "Login",
      backToHome: "Back to Home",
    },
    notFound: {
      error404: "404 Error",
      title: "We're sorry!",
      description:
        "The page you requested does not exist or may have moved to another location.",
      backToHome: "Back to Home",
      goToMarket: "Go to Market",
    },
  },
  ERROR,
} as const;

// English as base translation
export const defineTranslation =
  defineTranslationWithBase<typeof translation>();
