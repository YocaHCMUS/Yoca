import "dayjs/locale/vi";
import { defineTranslation } from "./en";
import { getUsdToVndRate } from "./util/exchange-service";
import { defineDateTimeFormat, defineNumberFormat } from "./util/util-format";

export const langCode = "vi-VN";

export const format = {
  num: defineNumberFormat(
    langCode,
    {
      decimalResolution: {
        resolveCurrency(value: number): number {
          const abs = Math.abs(value);
          if (abs >= 100) return 0;
          if (abs >= 1) return 2;
          return 4;
        },
        resolveDecimal(value: number): number {
          const abs = Math.abs(value);
          if (abs >= 100) return 0;
          if (abs >= 1) return 2;
          return 4;
        },
        resolvePercent(value: number): number {
          return 2;
        },
      },
      currencyConfig: {
        currencyCode: () => "VND",
        currencyDisplay: () => "narrowSymbol",
      },
      readableCompactCurrency: {
        format(value: number, opts: Intl.NumberFormatOptions): string {
          const abs = Math.abs(value);
          const sign = value < 0 ? "-" : "";

          if (abs >= 1e12) {
            return `${sign}${(abs / 1e12).toLocaleString("vi-VN", opts)} nghìn tỷ đồng`;
          }
          if (abs >= 1e9) {
            return `${sign}${(abs / 1e9).toLocaleString("vi-VN", opts)} tỷ đồng`;
          }
          if (abs >= 1e6) {
            return `${sign}${(abs / 1e6).toLocaleString("vi-VN", opts)} triệu đồng`;
          }
          if (abs >= 1e3) {
            return `${sign}${(abs / 1e3).toLocaleString("vi-VN", opts)} nghìn đồng`;
          }
          return `${value.toLocaleString("vi-VN", { maximumFractionDigits: 0 })} đồng`;
        },
      },
    },
    getUsdToVndRate,
  ),
  datetime: defineDateTimeFormat(langCode, {
    datePattern: "DD/MM/YYYY",
    timePattern: "HH:mm",
    dateTimePattern: "D MMM YYYY HH:mm",
    utcDateTimePattern: "D MMM YYYY HH:mm [UTC]",
  }),
};

export const translation = defineTranslation({
  misc: {
    badRequest: "Yêu cầu không hợp lệ",
  },
  // Common
  common: {
    cancel: "Hủy",
    confirm: "Xác nhận",
    submit: "Gửi",
    loading: "Đang tải...",
    error: "Lỗi",
    success: "Thành công",
    or: "hoặc",
    and: "và",
  },
  // Authentication
  auth: {
    or: "Hoặc tiếp tục với",
    signIn: "Đăng nhập",
    signUp: "Đăng ký",
    signOut: "Đăng xuất",
    email: "Email",
    displayName: "Tên hiển thị",
    password: "Mật khẩu",
    confirmPassword: "Xác nhận mật khẩu",
    continueWithPassword: "Tiếp tục",
    continueWithGoogle: "Tiếp tục với Google",
    continueWithWallet: "Tiếp tục với ví điện tử",
    connectingWithWallet: "Đang kết nối ...",
    continueWithSelectedWallet: "Tiếp tục với ví {{walletName}}",
    continueWithConnectedWallet:
      "Tiếp tục với ví {{connectedWalletName}} - {{connectedWalletAddress}}",
    signUpSuggestion: "Bạn chưa có tài khoản? {{$createAccount}}",
    createAccount: "Tạo tài khoản mới",
    retypePassword: "Nhập lại mật khẩu",
    forgotPassword: "Quên mật khẩu?",
    dontHaveAccount: "Tôi chưa có tài khoản",
    wantAccount: "Muốn có tài khoản?",
    signUpWithGoogle: "Đăng ký với Google",
    signUpWithWallet: "Đăng ký với ví hiện có",
    termsAndPrivacy:
      "Bằng việc đăng ký, bạn đồng ý với {{$terms}} và {{$privacy}} của chúng tôi",
    termsPrefix: "Bằng việc đăng ký, bạn đồng ý với",
    termsOfService: "Điều khoản dịch vụ",
    privacyPolicy: "Chính sách bảo mật",
    terms: "Điều khoản dịch vụ",
    privacy: "Chính sách bảo mật",
    googleAuthFailed: "Xác thực Google thất bại. Vui lòng thử lại.",
    googleAuthCancelled: "Xác thực Google đã bị hủy.",
  },
  // Wallet
  wallet: {
    connectWallet: "Kết nối ví",
    selectWallet: "Chọn một ví",
    detected: "Đã phát hiện",
    notDetected: "Không phát hiện ví",
    installWallet: "Vui lòng cài đặt tiện ích ví Solana",
    blockchain: "Blockchain",
    connecting: "Đang kết nối...",
    connectionFailed: "Kết nối thất bại",
    retry: "Thử lại",
    popularWallets: "Ví Solana phổ biến",
    connectToSignIn: "Kết nối ví để đăng nhập",
    connectToSignUp: "Kết nối ví để đăng ký",
    web3Auth: "Xác thực Web3",
    selectBlockchain: "Chọn Blockchain",
    solana: "Solana",
    ethereum: "Ethereum",
    bitcoin: "Bitcoin",
    detectingWallets: "Đang phát hiện ví...",
    scanningWallets: "Đang quét ví {{blockchain}} đã cài đặt...",
    detectedWallets: "Ví đã phát hiện",
    otherWallets: "Ví khác",
    noWalletsDetected: "Không phát hiện ví",
    noWalletsFound: "Không tìm thấy ví {{blockchain}}",
    installWalletPrompt:
      "Vui lòng cài đặt tiện ích ví để tiếp tục. Nhấp vào ví bên dưới để truy cập trang cài đặt.",
    install: "Cài đặt →",
    termsAgreement:
      "Bằng việc kết nối ví, bạn đồng ý với Điều khoản dịch vụ và Chính sách bảo mật của chúng tôi.",
    detectionFailed: "Không thể phát hiện ví. Vui lòng thử lại.",
    // Wallet Overview
    shareWallet: "Chia sẻ ví này",
    compareWallet: "So sánh ví này",
    createAlert: "Tạo cảnh báo cho ví này",
    bookmarked: "Đã lưu",
    bookmarkWallet: "Lưu ví này",
    totalAssetValue: "Tổng giá trị tài sản",
    tradingVolume: "Khối lượng giao dịch",
    totalPnL: "Tổng lãi/lỗ",
    tokensTraded: "Token đã giao dịch",
    tokensHolding: "Token đang nắm giữ",
    filter24h: "Ngày",
    filter7d: "Tuần",
    filter30d: "Tháng",
    filter90d: "Quý",
    filter365d: "Năm",
    filterCustom: "Tùy chỉnh",
    filterCustomDateUnit: " Ngày",
  },
  // Wallet Page
  walletPage: {
    addressNotFound: "Không tìm thấy địa chỉ",
    activity: "Hoạt động",
    asset: "Tài sản",
    topExchange: "Sàn giao dịch hàng đầu",
    topCounterparties: "Đối tác hàng đầu",
    balanceHistory: "Lịch sử số dư",
    tokenBalanceHistory: "Lịch sử số dư Token",
    profitLoss: "Lãi & Lỗ",
    transfer: "Chuyển khoản",
    swap: "Hoán đổi",
    inflow: "Tiền vào",
    outflow: "Tiền ra",
    counterparties: "Đối tác",
    portfolio: "Danh mục đầu tư",
    signature: "Định danh giao dịch",
    buyer: "Người mua",
    seller: "Người bán",
    type: "Loại",
    token: "Token",
    amount: "Số lượng",
    price: "Giá",
    total: "Tổng",
    time: "Thời gian",
    status: "Trạng thái",
    holding: "Đang nắm giữ",
    value: "Giá trị",
    change24h: "Thay đổi (24h)",
  },
  // Market Page
  marketPage: {
    topTokens: "Các token hàng đầu",
    topTokensDescription: "Top 50 token theo vốn hóa",
    trendingTokens: "Token đang thịnh hành",
    trendingTokensDescription: "Top 10 token đang thịnh hành",
    profitableTraders: "Các ví đang có lời",
    profitableTradersDescription: "Top 20 trader theo vốn hóa",
    topGainers: "Top lãi nhất",
    topGainersDesc: "Danh sách các nhà giao dịch có lợi nhuận cao nhất trong khoảng thời gian này.",
    topLosers: "Top lỗ nhất",
    topLosersDesc: "Danh sách các nhà giao dịch có lợi nhuận thấp nhất (lỗ nhiều nhất) trong khoảng thời gian này.",
    recentTrades: "Giao dịch gần đây",
    recentTradesDesc: "Các giao dịch hoán đổi token gần nhất trên các sàn phi tập trung.",
    marketHeatmapDescription: "Bản đồ nhiệt các token theo vốn hóa",
    marketCap: "Vốn hóa",
    volume24h: "Khối lượng 24h",
    change24h: "Thay đổi 24h",
    price: "Giá",
    token: "Token",
    trader: "Trader",
    profits: "Lợi nhuận",
    volume: "Khối lượng",
    trades: "Giao dịch",
    time: "Thời gian",
    value: "Giá trị",
    amount: "Số lượng",
    transaction: "Giao dịch",
    openInSolscan: "Mở trong Solscan",
    addToWatchlist: "Thêm vào danh sách theo dõi",
    removeFromWatchlist: "Xóa khỏi danh sách theo dõi",
    marketMap: "Bản đồ thị trường",
    clearWatchlist: "Xóa danh sách",
    sortBy: "Sắp xếp theo",
    more: "xem thêm",
    watchlistEmptyTitle: "Danh sách theo dõi đang trống",
    watchlistEmptySubtitle: "Bắt đầu gắn sao các token ở tab 'Tất cả' để theo dõi tại đây!",
  },
  // Wallet Comparison Page
  walletComparison: {
    selectedWallets: "Ví đã chọn",
    addWalletAddress: "Thêm địa chỉ ví",
    enterWalletAddress: "Nhập địa chỉ ví...",
    noWalletsSelected: "Chưa chọn ví nào. Thêm địa chỉ ví để so sánh.",
    general: "Tổng quan",
    holdings: "Tài sản nắm giữ",
    profitRiskManagement: "Quản lý lợi nhuận & rủi ro",
  },
  // Navigation
  nav: {
    market: "Thị trường",
    alerts: "Cảnh báo",
    dashboard: "Bảng điều khiển",
    profile: "Hồ sơ",
    settings: "Cài đặt",
    theme: "Giao diện",
    language: "Ngôn ngữ",
    account: "Tài khoản",
    search: "Tìm kiếm",
    switchToLightTheme: "Chuyển sang Chủ đề Sáng",
    switchToDarkTheme: "Chuyển sang Chủ đề Tối",
    searchPlaceholder: "Tìm token theo tên hoặc địa chỉ…",
    searchHint: "Nhập để tìm kiếm token",
    searchLoading: "Đang tìm kiếm…",
    searchNoResults: "Không tìm thấy token nào",
    searchTokens: "Token",
    searchPools: "Pools",
    searchNavigate: "để di chuyển",
    searchSelect: "để chọn",
    searchClose: "để đóng",
    searchStats: "Thống kê",
    searchRank: "Thứ hạng",
    searchMarketCap: "Vốn hóa",
    searchVolume: "Khối lượng 24h",
    searchPrice: "Giá",
    searchLast7Days: "7 ngày qua",
  },
  lang: {
    vi: "Vietnam - Tiếng Việt (Vietnamese)",
    en: "Mỹ - English (English)",
  },
  // Validation errors
  validation: {
    required: "Trường này là bắt buộc",
    identifierRequired: "Tên người dùng hoặc email là bắt buộc",
    identifierInvalid:
      "Vui lòng nhập email hoặc tên người dùng hợp lệ (tối thiểu 3 ký tự)",
    emailRequired: "Email là bắt buộc",
    invalidEmail: "Vui lòng nhập địa chỉ email hợp lệ",
    usernameRequired: "Tên người dùng là bắt buộc",
    usernameTooShort: "Tên người dùng phải có ít nhất 3 ký tự",
    usernameTooLong: "Tên người dùng không được quá 20 ký tự",
    usernameInvalidChars:
      "Tên người dùng chỉ được chứa chữ cái, số và dấu gạch dưới",
    passwordRequired: "Mật khẩu là bắt buộc",
    passwordTooShort: "Mật khẩu phải có ít nhất {{min}} ký tự",
    passwordComplexity:
      "Mật khẩu phải chứa ít nhất một chữ hoa, một chữ thường và một số",
    confirmPasswordRequired: "Vui lòng xác nhận mật khẩu",
    passwordsDoNotMatch: "Mật khẩu không khớp",
    invalidCredentials: "Tên người dùng hoặc mật khẩu không hợp lệ",
    accountExists: "Tài khoản với email này đã tồn tại",
    networkError: "Lỗi mạng. Vui lòng thử lại.",
    registrationFailed: "Đăng ký thất bại. Vui lòng thử lại.",
  },
  // Showcase page
  showcase: {
    title: "Bộ sưu tập component Yoca",
    subtitle: "Xác thực & Điều hướng UI",
    signInSection: "Component đăng nhập",
    signUpSection: "Component đăng ký",
    walletSection: "Kết nối ví",
    googleAuthSection: "Xác thực Google",
    navigationSection: "Thanh điều hướng",
    placeholderContent: "Đây là nội dung mẫu để minh họa.",
  },
  // Charts
  charts: {
    // Common
    loading: "Đang tải dữ liệu biểu đồ...",
    refreshing: "Đang làm mới...",
    retry: "Thử lại",
    export: "Xuất",
    fullscreen: "Toàn màn hình",
    miniPlayer: "Trình phát nhỏ",
    exitFullscreen: "Thoát toàn màn hình",

    // Viewing modes
    enterFullscreenMode: "Vào chế độ toàn màn hình",
    openMiniPlayer: "Mở trình phát nhỏ",
    chartViewingModes: "Chế độ xem biểu đồ",
    fullscreenView: "Chế độ toàn màn hình",
    exitFullscreenEsc: "Thoát toàn màn hình (ESC)",
    closeMiniPlayer: "Đóng trình phát nhỏ",
    closeMiniPlayerEsc: "Đóng trình phát nhỏ (ESC)",
    dragToMove: "Kéo để di chuyển",
    maximize: "Phóng to",
    minimize: "Thu nhỏ",

    // Timezone
    selectTimezone: "Chọn múi giờ",
    timezone: "Múi giờ",
    timezoneOptions: "Tùy chọn múi giờ",
    searchTimezones: "Tìm kiếm múi giờ...",
    noTimezonesFound: "Không tìm thấy múi giờ",
    localTime: "Giờ địa phương",
    utc: "UTC",

    // Loading states
    loadingChartData: "Đang tải dữ liệu biểu đồ {{title}}",
    refreshingChartData: "Đang làm mới dữ liệu biểu đồ {{title}}",
    chartLoadedSuccessfully: "Biểu đồ {{title}} đã tải thành công",
    errorLoadingChart: "Lỗi khi tải biểu đồ {{title}}",
    noDataForChart: "Không có dữ liệu cho biểu đồ {{title}}",

    // Empty state
    noDataTitle: "Không có dữ liệu",
    noDataMessage: "Không có dữ liệu để hiển thị cho bộ lọc đã chọn.",
    resetFilters: "Đặt lại bộ lọc",
    adjustFilters: "Thử điều chỉnh bộ lọc hoặc khoảng thời gian",
    noWalletsTitle: "Chưa chọn ví",
    noData: "Không có dữ liệu",

    // TreeMap
    treemapNoData: "Không có dữ liệu",

    // Error state
    errorTitle: "Không thể tải biểu đồ",
    errorMessage: "Đã xảy ra lỗi khi tải dữ liệu biểu đồ.",
    technicalDetails: "Chi tiết kỹ thuật",
    networkError: "Lỗi mạng. Vui lòng kiểm tra kết nối.",
    serverError: "Lỗi máy chủ. Vui lòng thử lại sau.",

    // Export
    exportChart: "Xuất biểu đồ",
    exportFormatOptions: "Tùy chọn định dạng xuất",
    exportPNG: "Xuất dưới dạng PNG",
    exportSVG: "Xuất dưới dạng SVG",
    exportCSV: "Xuất dưới dạng CSV",
    pngFormat: "PNG",
    svgFormat: "SVG",
    csvFormat: "CSV",
    retinaBadge: "Ảnh",
    vectorBadge: "Vector",
    dataBadge: "Dữ liệu",
    exportSuccess: "Xuất biểu đồ thành công",
    exportFailed: "Xuất thất bại. Vui lòng thử lại.",

    // Filters
    timePeriod: "Khoảng thời gian",
    last7Days: "7 ngày qua",
    last30Days: "30 ngày qua",
    last60Days: "60 ngày qua",
    last90Days: "90 ngày qua",
    lastYear: "Năm qua",
    allTime: "Toàn bộ thời gian",
    customRange: "Tùy chỉnh",
    tokens: "Token",
    allTokens: "Tất cả Token",
    transactionType: "Loại giao dịch",
    allTypes: "Tất cả loại",
    trades: "Giao dịch",
    transfers: "Chuyển khoản",
    deposits: "Nạp tiền",
    withdrawals: "Rút tiền",
    wallets: "Ví",

    // Chart titles
    balanceTrend: "Xu hướng số dư",
    assetDistribution: "Phân bổ tài sản",
    profitLoss: "Lãi & Lỗ",
    exchangeComparison: "So sánh sàn giao dịch",
    counterpartyActivity: "Hoạt động đối tác",
    volumeBenchmark: "Đánh giá khối lượng",
    transactionDistribution: "Phân bổ giao dịch",
    holdingDurations: "Thời gian nắm giữ",

    // Chart specific
    balanceChart: {
      title: "Xu hướng số dư",
      totalBalance: "Tổng số dư",
      change: "Thay đổi",
      date: "Ngày",
      balance: "Số dư",
    },
    assetDistributionChart: {
      title: "Phân bổ tài sản",
      totalValue: "Tổng giá trị",
      asset: "Tài sản",
      value: "Giá trị",
      percentage: "Phần trăm",
      noWalletsMessage: "Vui lòng chọn ít nhất một ví để xem phân bổ tài sản.",
    },
    pnlChart: {
      title: "Lãi & Lỗ",
      dailyPnL: "Lãi/Lỗ hàng ngày",
      cumulativePnL: "Lãi/Lỗ tích lũy",
      profit: "Lãi",
      loss: "Lỗ",
      date: "Ngày",
      totalProfit: "Tổng lãi",
      totalLoss: "Tổng lỗ",
      netPnL: "Lãi/Lỗ ròng",
      aggregation: "Tổng hợp",
      daily: "Hàng ngày",
      weekly: "Hàng tuần",
      monthly: "Hàng tháng",
      both: "Cả hai",
    },
    exchangeComparisonChart: {
      title: "So sánh hoạt động sàn giao dịch",
      exchange: "Sàn giao dịch",
      deposits: "Nạp tiền",
      withdrawals: "Rút tiền",
      count: "Số giao dịch",
      volume: "Khối lượng (USD)",
      metric: "Chỉ số",
      transactionCount: "Số giao dịch",
      volumeUSD: "Khối lượng (USD)",
    },
    counterpartyActivityChart: {
      title: "Phân tích hoạt động đối tác",
      counterparty: "Đối tác",
      transactionCount: "Số giao dịch",
      totalVolume: "Tổng khối lượng",
      limit: "Hiển thị top",
      top10: "Top 10",
      top20: "Top 20",
      top50: "Top 50",
    },
    volumeBenchmarkChart: {
      title: "So sánh khối lượng giao dịch",
      volume: "Khối lượng",
      date: "Ngày",
      wallet: "Ví",
      chartType: "Loại biểu đồ",
      line: "Đường",
      bar: "Cột",
      showLabels: "Hiển thị nhãn",
    },
    transactionDistributionChart: {
      title: "Phân tích hoạt động giao dịch",
      transactionCounts: "Số lượng giao dịch",
      uniqueTokens: "Số loại Token được giao dịch",
      date: "Ngày",
      count: "Số lượng",
      tokens: "Token",
      chartMode: "Chế độ biểu đồ",
      stacked: "Xếp chồng",
      grouped: "Nhóm",
    },
    holdingDurationsChart: {
      title: "Thời gian nắm giữ token",
      token: "Token",
      duration: "Thời gian",
      days: "Ngày",
      weeks: "Tuần",
      months: "Tháng",
      timeUnit: "Đơn vị thời gian",
      topN: "Hiển thị top",
      wallet: "Ví",
    },
    totalTradingVolumeChart: {
      title: "Xếp hạng tổng khối lượng giao dịch",
    },
    tradingVolumePerTransactionChart: {
      title: "Khối lượng giao dịch trên mỗi giao dịch",
      volume: "Khối lượng (USD)",
    },
    tradingVolumeDistributionChart: {
      title: "Phân bổ khối lượng giao dịch",
      volume: "Khối lượng",
      percentage: "Phần trăm",
      totalVolume: "Tổng khối lượng",
      noWalletsTitle: "Chưa chọn ví",
      noWalletsMessage:
        "Vui lòng chọn ít nhất một ví để xem phân bổ khối lượng giao dịch.",
    },
    tokenPriceChart: {
      price: "Giá {{tokenSymbol}}",
      volume: "Khối lượng {{tokenSymbol}}",
      marketCap: "Vốn hóa thị trường {{tokenSymbol}}",
    },
    stablecoinRatioChart: {
      title: "Tỷ lệ Stablecoin",
    },
    rollingAnnualReturn: {
      title: "Lợi nhuận hàng năm lăn",
      rollingReturn: "Lợi nhuận lăn",
      cumulativeReturn: "Lợi nhuận tích lũy",
      month: "Tháng",
      quarter: "Quý",
      year: "Năm",
      custom: "Tùy chỉnh",
      days: "Ngày",
    },
    priceHistoryChart: {
      title: "Lịch sử giá",
    },
    marketHeatmap: {
      title: "Bản đồ nhiệt thị trường",
    },
    winrateChart: {
      title: "Phân tích tỷ lệ thắng",
    },
    drawdownChart: {
      title: "Phân tích sụt giảm",
    },
    averageRollingAnnualReturn: {
      title: "Lợi nhuận hàng năm lăn trung bình",
      returnPercent: "Lợi nhuận",
      month: "Tháng",
      quarter: "Quý",
      year: "Năm",
      custom: "Tùy chỉnh",
      days: "Ngày",
    },
  },
  ERROR: {
    EMAIL_ALREADY_EXISTED: "Email đã tồn tại",
    EMAIL_OR_PASSWORD_WAS_INCORRECT: "Email hoặc mật khẩu không đúng",
    FAILED_TO_FETCH_REQUESTED_DATA: "Không thể lấy dữ liệu yêu cầu",
    GOOGLE_VERIFICATION_FAILED: "Xác thực Google thất bại. Vui lòng thử lại.",
    WALLET_VERIFICATION_FAILED: "Xác thực ví thất bại. Vui lòng thử lại.",
    WALLET_NONCE_FAILED: "Không thể khởi tạo xác thực ví. Vui lòng thử lại.",
    INTERNAL_SERVER_ERR: "Có sự cố với máy chủ. Vui lòng thử lại sau.",
    GENERAL_UNKNOWN_ERR: "Lỗi chưa xác định.",
    NETWORK_ERR: "Lỗi đường truyền. Vui lòng thử lại sau.",
    VALIDATION_ERR:
      "Dữ liệu gửi lên không hợp lệ. Vui lòng kiểm tra và thử lại.",
    INVALID_TOKEN_PAYLOAD: "Dữ liệu token không hợp lệ.",
    HOURLY_CHART_HOURLY_EXCEEDED_90_DAYS:
      "Dữ liệu biểu đồ hàng giờ không thể vượt quá 90 ngày. Vui lòng chọn khoảng thời gian ngắn hơn.",
    DAILY_CHART_DAILY_EXCEEDED_365_DAYS:
      "Dữ liệu biểu đồ hàng ngày không thể vượt quá 365 ngày. Vui lòng chọn khoảng thời gian ngắn hơn.",
  },
  token: {
    overviewSectionTitle: "Tổng quan",
    historicalPriceSectionTitle: "Lịch sử giá",
    overviewChart: {
      price: "Giá",
      marketCap: "Vốn hóa thị trường",
      noData: "Không có dữ liệu biểu đồ",
      noCoingeckoId: "token có thể không có ID CoinGecko",
    },
    range24h: "Khoảng giá 24h",
    marketCap: "Vốn hóa thị trường",
    fullyDilutedValuation: "Định giá pha loãng",
    tradingVolume24h: "Lượng giao dịch 24 giờ",
    circulatingSupply: "Nguồn cung lưu hành",
    totalSupply: "Tổng cung",
    maxSupply: "Nguồn cung tối đa",
    info: "Thông tin",
    website: "Trang web",
    explorers: "Trình khám phá",
    community: "Cộng đồng",
    allTimeHigh: "Giá cao nhất mọi thời đại",
    allTimeLow: "Giá thấp nhất mọi thời đại",
    marketsTitle: "Thị trường {{name}}",
    marketsDescription:
      "Các sàn giao dịch phi tập trung hàng đầu giao dịch {{name}}.",
    topHoldersTitle: "Top 10 người nắm giữ {{name}}",
    topHoldersDescription: "Top 10 người nắm giữ token {{name}}.",
    trendingCoins: "Tiền điện tử thịnh hành",
    header: {
      copy: "Sao chép địa chỉ",
      twitter: "X (Twitter)",
      searchX: "Tìm trên X",
      discord: "Tham gia Discord",
      coingecko: "Xem trên CoinGecko",
    },
    chart: {
      loadingPool: "Đang tải biểu đồ...",
    },
    poolSelector: {
      selectPool: "Chọn Pool",
    },
    tabs: {
      overview: "Tổng quan",
      markets: "Thị trường",
      trending: "Thịnh hành",
      historicalData: "Dữ liệu lịch sử",
    },
    marketsTable: {
      rank: "#",
      exchange: "Sàn giao dịch",
      pair: "Cặp",
      price: "Giá",
      change24h: "Thay đổi",
      volume24h: "Lượng giao dịch",
      liquidity: "Thanh khoản",
      txns24h: "Số giao dịch",
    },
    marketStats: {
      priceUsd: "GIÁ USD",
      priceBaseQuote: "GIÁ BASE/QUOTE",
      liquidity: "THANH KHOẢN",
      marketCap: "VỐN HÓA TT",
      marketCapTip: "Vốn hóa thị trường",
      fdv: "ĐGPL",
      fdvTip: "Định giá pha loãng hoàn toàn",
      change5m: "5P",
      change1h: "1H",
      change6h: "6H",
      change24h: "24H",
      change24hFull: "TĐ 24H",
      vol24h: "Lượng GD 24H",
      vol24hTip: "Lượng giao dịch 24 giờ",
      buy: "MUA",
      sell: "BÁN",
      net: "RÒNG",
      txns24h: "SỐ GD 24H",
      txns24hTip: "Số giao dịch 24 giờ",
      traders24h: "SỐ NGƯỜI GIAO DỊCH 24H",
      top10Holders: "TOP 10 NGƯỜI NẮM GIỮ",
      holders: "NGƯỜI NẮM GIỮ",
      circSupply: "CUNG LƯU HÀNH",
      totalSupply: "TỔNG CUNG",
      markets: "THỊ TRƯỜNG",
    },
    recentTransactions: {
      transactions: "Giao dịch",
      bubblemaps: "Bubblemaps",
      time: "Thời gian",
      type: "Loại",
      price: "Giá",
      priceUsd: "Giá USD",
      amount: "Số lượng",
      value: "Giá trị",
      from: "Từ",
      tx: "TX",
      buy: "MUA",
      sell: "BÁN",
      loading: "Đang tải...",
      empty: "Không có giao dịch gần đây",
      noAddress: "Không có địa chỉ token",
    },
    topHolders: {
      rank: "#",
      address: "Địa chỉ",
      percent: "%",
      noData: "Không tìm thấy dữ liệu người nắm giữ.",
    },
    historicalData: {
      title: "Lịch sử giá {{name}}",
      date: "Ngày",
      marketCap: "Vốn hóa",
      volume: "Khối lượng",
      close: "Giá đóng cửa",
      showMore: "Xem thêm",
      error:
        "Không thể tải dữ liệu lịch sử. Token này có thể chưa được niêm yết trên CoinGecko.",
    },
    insightTabs: {
      about: "Thống kê",
      holders: "Người nắm giữ",
      noDescription: "Không có mô tả.",
      distributionTitle: "Phân bổ người nắm giữ",
      distributionDescription:
        "Phân bổ quyền sở hữu token {{symbol}} theo nhóm người nắm giữ hàng đầu.",
      top10: "Top 10",
      rank1120: "11–20",
      rank2140: "21–40",
      rank1130: "11–30",
      rank3150: "31–50",
      others: "Khác",
      volumeQ:
        "Khối lượng giao dịch hàng ngày của {{name}} ({{symbol}}) là bao nhiêu?",
      volumeA:
        "Khối lượng giao dịch 24h của {{name}} ({{symbol}}) là {{volume}}, biến động {{change}} so với ngày hôm trước.",
      athAtlQ:
        "Giá cao nhất và thấp nhất mọi thời đại của {{name}} ({{symbol}}) là bao nhiêu?",
      athAtlA:
        "{{name}} ({{symbol}}) đạt đỉnh cao mọi thời đại là {{ath}} và đáy thấp nhất là {{atl}}. Hiện đang giao dịch {{athPct}} so với đỉnh và {{atlPct}} trên mức thấp nhất đã ghi nhận.",
      marketCapQ: "Vốn hóa thị trường của {{name}} ({{symbol}}) là bao nhiêu?",
      marketCapA:
        "Vốn hóa thị trường của {{name}} ({{symbol}}) là {{marketCap}}, xếp hạng #{{rank}} theo vốn hóa hôm nay. Vốn hóa được tính bằng giá token nhân với nguồn cung lưu hành — {{supply}} token đang lưu thông trên thị trường.",
      fdvQ: "Định giá pha loãng hoàn toàn của {{name}} ({{symbol}}) là bao nhiêu?",
      fdvA: "Định giá pha loãng hoàn toàn (FDV) của {{name}} ({{symbol}}) là {{fdv}}. Đây là biểu diễn thống kê của vốn hóa tối đa, giả định toàn bộ {{maxSupply}} token đang lưu thông hôm nay. Tùy theo lịch phát hành, FDV có thể mất nhiều năm để được thực hiện đầy đủ.",
      supplyBillion: "{{count}} tỷ {{symbol}}",
      supplyMillion: "{{count}} triệu {{symbol}}",
      supplyThousand: "{{count}} nghìn {{symbol}}",
    },
    globalPrices: {
      title: "Giá {{name}} toàn cầu",
      description: "Giá {{name}} theo các đơn vị tiền tệ lớn trên thế giới.",
      showMore: "Xem thêm",
    },
  },
  tooltips: {
    marketCap:
      "Giá hiện tại x Số lượng lưu hành. Đây là tổng giá trị thị trường của nguồn cung lưu hành của một loại tiền điện tử. Nó tương tự như cách đo lường của thị trường chứng khoán khi nhân giá mỗi cổ phiếu với số cổ phiếu có sẵn trên thị trường (không bao gồm cổ phiếu do người trong cuộc, chính phủ nắm giữ và khóa lại).",
    fullyDilutedValuation:
      "Vốn hóa thị trường của một loại tiền điện tử nếu tất cả các đồng tiền có thể được lưu hành đều có mặt trên thị trường. Nó được tính bằng cách nhân giá hiện tại với tổng cung tối đa của loại tiền điện tử đó.",
    tradingVolume24h:
      "Tổng khối lượng giao dịch của token trong 24 giờ qua trên tất cả các sàn giao dịch. Đây là một thước đo về mức độ hoạt động của token và có thể cho thấy tính thanh khoản và sự quan tâm của thị trường đối với token đó.",
    circulatingSupply:
      "Tổng số đồng tiền hoặc token hiện có và đang lưu hành trên thị trường. Nó được sử dụng để tính toán vốn hóa thị trường của một loại tiền điện tử.",
    totalSupply:
      "Tổng số đồng tiền hoặc token tồn tại cho một loại tiền điện tử, bao gồm cả những đồng chưa lưu hành. Nó được sử dụng để tính toán vốn hóa thị trường tối đa tiềm năng của một loại tiền điện tử.",
    maxSupply:
      "Số lượng tối đa đồng tiền hoặc token sẽ tồn tại cho một loại tiền điện tử. Nó được sử dụng để tính toán giá trị định giá đầy đủ của một loại tiền điện tử.",
  },
});
