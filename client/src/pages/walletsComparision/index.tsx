import { TabContainer } from "@/components/tabContainer/tabContainer";
import { GeneralTab } from "@/components/wallet/WalletComparision/GeneralTab";
import { HoldingTab } from "@/components/wallet/WalletComparision/HoldingTab";
import { RiskTab } from "@/components/wallet/WalletComparision/RiskTab";
import { PageWrapper } from "@/components/wrapper";
import { useLocalization } from "@/contexts/LocalizationContext";
import { Button, Column, Grid, Search, Stack } from "@carbon/react";
import { ChartLine, Close, Download, SearchAdvanced, Wallet, User } from "@carbon/react/icons";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import styles from "./index.module.scss";

const TAB_EXPORT_FILENAME_SEGMENTS = [
  "General",
  "Holdings",
  "Profit_Risk_Management",
] as const;

const TAB_REPORT_TITLES = [
  "Wallet Comparison Report - General Overview",
  "Wallet Comparison Report - Holdings Overview",
  "Wallet Comparison Report - Profit & Risk Management",
] as const;

const PDF_EXPORT_SECTION_CLASS = "pdf-export-section";
const PDF_EXPORT_STYLE_ID = "wallet-comparison-pdf-export-style";
const PDF_EXPORT_STYLE_TEXT = `
.recharts-accessibility-layer, .recharts-tooltip-wrapper, .recharts-default-tooltip, svg title, svg desc {
  display: none !important;
  opacity: 0 !important;
  visibility: hidden !important;
}
`;
const PDF_EXPORT_TOP_MARGIN_MM = 10;
const PDF_EXPORT_SECTION_GAP_MM = 10;
const PDF_EXPORT_SCALE = 2;

function truncateWalletAddress(address: string): string {
  if (address.length <= 14) {
    return address;
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function waitForPaintFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function ExportReportHeader({
  title,
  generatedDate,
  walletSummary,
  walletCount,
}: {
  title: string;
  generatedDate: string;
  walletSummary: string;
  walletCount: number;
}) {
  return (
    <div
      id="pdf-report-header"
      className={`${styles.exportReportHeader} ${PDF_EXPORT_SECTION_CLASS}`}
      style={{ display: "none" }}
    >
      <div className={styles.exportReportHeaderTopRow}>
        <div>
          <p className={styles.exportReportKicker}>Wallet Comparison Report</p>
          <h2 className={styles.exportReportTitle}>{title}</h2>
        </div>
        <div className={styles.exportReportStampBlock}>
          <span className={styles.exportReportStampLabel}>Generated</span>
          <span className={styles.exportReportStampValue}>{generatedDate || "N/A"}</span>
        </div>
      </div>
      <div className={styles.exportReportMeta}>
        <span>Wallets Compared: {walletCount}</span>
        <span className={styles.exportReportMetaDivider}>|</span>
        <span>Wallet Addresses: {walletSummary}</span>
      </div>
    </div>
  );
}

export default function WalletsComparisionPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [exportDate, setExportDate] = useState("");
  /** Tabs that have been opened at least once — panels stay mounted but pause fetching when inactive. */
  const [visitedTabs, setVisitedTabs] = useState<Set<number>>(() => new Set([0]));
  const [walletAddress, setWalletAddress] = useState("");
  const [selectedWallets, setSelectedWallets] = useState<string[]>([]);
  const exportRef = useRef<HTMLDivElement>(null);
  const { tr } = useLocalization();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    setVisitedTabs((prev) => new Set(prev).add(activeTab));
  }, [activeTab]);

  useEffect(() => {
    if (selectedWallets.length === 0) {
      setVisitedTabs(new Set([0]));
      setActiveTab(0);
    }
  }, [selectedWallets.length]);

  // Pre-populate from ?wallets=addr1,addr2 query param
  useEffect(() => {
    const param = searchParams.get("wallets");
    if (!param) return;
    const addresses = param
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);
    if (addresses.length > 0) {
      setSelectedWallets(addresses);
    }
  }, []); // run only once on mount

  const exportWalletAddressSummary = useMemo(() => {
    if (selectedWallets.length === 0) {
      return "N/A";
    }

    return selectedWallets.map((address) => truncateWalletAddress(address)).join(" | ");
  }, [selectedWallets]);

  const exportContainerClassName = `${styles.exportCaptureContainer} ${isExporting ? styles.exportCaptureContainerExporting : ""}`;

  const comparisonTabs = useMemo(
    () => [
      <div
        key="wc-general-wrapper"
        ref={activeTab === 0 ? exportRef : undefined}
        className={exportContainerClassName}
      >
        <ExportReportHeader
          title={TAB_REPORT_TITLES[0]}
          generatedDate={exportDate}
          walletSummary={exportWalletAddressSummary}
          walletCount={selectedWallets.length}
        />
        <GeneralTab
          key="wc-general"
          walletAddresses={selectedWallets}
          fetchEnabled={activeTab === 0}
        />
      </div>,
      <div
        key="wc-holding-wrapper"
        ref={activeTab === 1 ? exportRef : undefined}
        className={exportContainerClassName}
      >
        <ExportReportHeader
          title={TAB_REPORT_TITLES[1]}
          generatedDate={exportDate}
          walletSummary={exportWalletAddressSummary}
          walletCount={selectedWallets.length}
        />
        <HoldingTab
          key="wc-holding"
          walletAddresses={selectedWallets}
          fetchEnabled={activeTab === 1}
        />
      </div>,
      <div
        key="wc-risk-wrapper"
        ref={activeTab === 2 ? exportRef : undefined}
        className={exportContainerClassName}
      >
        <ExportReportHeader
          title={TAB_REPORT_TITLES[2]}
          generatedDate={exportDate}
          walletSummary={exportWalletAddressSummary}
          walletCount={selectedWallets.length}
        />
        <RiskTab
          key="wc-risk"
          walletAddresses={selectedWallets}
          fetchEnabled={activeTab === 2}
        />
      </div>,
    ],
    [
      selectedWallets,
      activeTab,
      exportContainerClassName,
      isExporting,
      exportDate,
      exportWalletAddressSummary,
    ],
  );

  const handleExportPDF = async () => {
    const exportTarget = exportRef.current;
    if (isExporting || !exportTarget) {
      return;
    }

    const activeSegment = TAB_EXPORT_FILENAME_SEGMENTS[activeTab] ?? `Tab_${activeTab}`;
    const { width, height } = exportTarget.getBoundingClientRect();
    if (width <= 0 || height <= 0) {
      return;
    }

    const generatedDate = new Date().toLocaleDateString();
    setExportDate(generatedDate);
    setIsExporting(true);

    const exportStyle = document.createElement("style");
    exportStyle.id = PDF_EXPORT_STYLE_ID;
    exportStyle.textContent = PDF_EXPORT_STYLE_TEXT;
    document.head.appendChild(exportStyle);

    const reportHeader = document.getElementById("pdf-report-header") as HTMLDivElement | null;
    const previousReportHeaderDisplay = reportHeader?.style.display ?? "";

    try {
      if (reportHeader) {
        reportHeader.style.display = "block";
      }

      await waitForPaintFrame();
      await waitForPaintFrame();

      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      let currentY = PDF_EXPORT_TOP_MARGIN_MM;

      const sections = document.querySelectorAll<HTMLElement>(`.${PDF_EXPORT_SECTION_CLASS}`);

      for (const section of sections) {
        if (section !== reportHeader && section.getClientRects().length === 0) {
          continue;
        }

        const canvas = await html2canvas(section, { scale: PDF_EXPORT_SCALE, useCORS: true });
        if (canvas.width <= 0 || canvas.height <= 0) {
          continue;
        }

        const imgData = canvas.toDataURL("image/png");
        const imgHeight = (canvas.height * pdfWidth) / canvas.width;

        if (currentY + imgHeight > pageHeight - PDF_EXPORT_TOP_MARGIN_MM) {
          pdf.addPage();
          currentY = PDF_EXPORT_TOP_MARGIN_MM;
        }

        pdf.addImage(imgData, "PNG", 0, currentY, pdfWidth, imgHeight);
        currentY += imgHeight + PDF_EXPORT_SECTION_GAP_MM;
      }

      pdf.save(`Wallet_Comparison_${activeSegment}.pdf`);
    } finally {
      if (reportHeader) {
        reportHeader.style.display = previousReportHeaderDisplay;
      }

      exportStyle.remove();
      setIsExporting(false);
    }
  };

  const handleAddWallet = () => {
    if (
      walletAddress.trim() &&
      !selectedWallets.includes(walletAddress.trim())
    ) {
      setSelectedWallets([...selectedWallets, walletAddress.trim()]);
      setWalletAddress("");
    }
  };

  const handleRemoveWallet = (address: string) => {
    setSelectedWallets(selectedWallets.filter((w) => w !== address));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAddWallet();
    }
  };

  return (
    <PageWrapper>
      <Grid className={styles.grid} fullWidth>
        {/* 3 columns - Wallet Selection Sidebar */}
        <Column lg={4} md={4} sm={4}>
          <div className={styles.sidebarContainer}>
            <h3 className={styles.sidebarTitle}>
              {tr("walletComparison.selectedWallets")}
            </h3>
            <Search
              id="wallet-search"
              labelText={tr("walletComparison.addWalletAddress")}
              placeholder={tr("walletComparison.enterWalletAddress")}
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              onKeyDown={handleKeyPress}
              renderIcon={SearchAdvanced}
            />

            {/* List of Selected Wallets */}
            <Stack gap={4} className={styles.walletList}>
              {selectedWallets.length === 0 ? (
                <p className={styles.emptyState}>
                  {tr("walletComparison.noWalletsSelected")}
                </p>
              ) : (
                selectedWallets.map((wallet) => (
                  <Button
                    className={styles.walletTag}
                    renderIcon={Close}
                    onClick={() => handleRemoveWallet(wallet)}
                    kind="tertiary"
                  >
                    <span className={styles.buttonTag}>
                      {wallet}
                    </span>
                  </Button>
                ))
              )}
            </Stack>
          </div>
        </Column>

        {/* 9 columns - Main Content Area */}
        <Column lg={12} md={12} sm={4}>
          <div className={styles.mainContentContainer}>
            <TabContainer
              activeTab={activeTab}
              names={[
                tr("walletComparison.general"),
                tr("walletComparison.holdings"),
                tr("walletComparison.profitRiskManagement"),
              ]}
              tabIcons={[
                <User key="wc-general-icon" size={16} />,
                <Wallet key="wc-holdings-icon" size={16} />,
                <ChartLine key="wc-risk-icon" size={16} />,
              ]}
              actions={
                <Button
                  kind="ghost"
                  size="sm"
                  renderIcon={Download}
                  onClick={handleExportPDF}
                  disabled={isExporting || selectedWallets.length === 0}
                >
                  {isExporting
                    ? tr("walletComparison.generatingPdf")
                    : tr("walletComparison.exportPdf")}
                </Button>
              }
              preserveMountedPanels
              visitedTabIndices={visitedTabs}
              tabs={comparisonTabs}
              onTabChange={(index) => setActiveTab(index)}
            />
          </div>
        </Column>
      </Grid>
      {/* <div className={styles.walletsComparisonPage}>
            </div> */}
    </PageWrapper>
  );
}
