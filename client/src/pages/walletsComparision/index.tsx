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

const TAB_EXPORT_HEADER_TITLES = [
  "General Overview",
  "Holdings",
  "Profit & Risk Management",
] as const;

const PDF_EXPORT_SECTION_CLASS = "pdf-export-section";
const PDF_EXPORT_TOP_MARGIN_MM = 10;
const PDF_EXPORT_SECTION_GAP_MM = 10;
const PDF_EXPORT_SCALE = 2;

export default function WalletsComparisionPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
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

  const exportContainerClassName = styles.exportCaptureContainer;

  const comparisonTabs = useMemo(
    () => [
      <div
        key="wc-general-wrapper"
        ref={activeTab === 0 ? exportRef : undefined}
        className={exportContainerClassName}
      >
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
    ],
  );

  const handleExportPDF = async () => {
    const exportTarget = exportRef.current;
    if (isExporting || !exportTarget) {
      return;
    }

    const activeSegment = TAB_EXPORT_FILENAME_SEGMENTS[activeTab] ?? `Tab_${activeTab}`;
    const activeHeaderTitle = TAB_EXPORT_HEADER_TITLES[activeTab] ?? `Tab ${activeTab + 1}`;
    const { width, height } = exportTarget.getBoundingClientRect();
    if (width <= 0 || height <= 0) {
      return;
    }

    const generatedDate = new Date().toLocaleDateString();
    setIsExporting(true);

    try {
      const tempHeader = document.createElement("div");
      tempHeader.style.position = "absolute";
      tempHeader.style.top = "-9999px";
      tempHeader.style.left = "-9999px";
      tempHeader.style.width = "800px";
      tempHeader.style.backgroundColor = "#ffffff";
      tempHeader.style.padding = "20px";
      tempHeader.style.border = "1px solid #d0d7de";
      tempHeader.style.borderRadius = "12px";
      tempHeader.style.boxSizing = "border-box";
      tempHeader.style.fontFamily = "Arial, sans-serif";
      tempHeader.style.color = "#0f172a";

      const headerWallets = selectedWallets.length > 0
        ? selectedWallets.map((address) => `<div style=\"line-height:1.45;word-break:break-all;\">${address}</div>`).join("")
        : "<div>N/A</div>";

      tempHeader.innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;">
          <div>
            <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;margin-bottom:6px;font-weight:600;">Wallet Comparison Report</div>
            <div style="font-size:24px;font-weight:700;line-height:1.2;">Wallet Comparison Report - ${activeHeaderTitle}</div>
          </div>
          <div style="min-width:180px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:#64748b;font-weight:600;">Generated Date</div>
            <div style="margin-top:4px;font-size:14px;font-weight:600;color:#0f172a;">${generatedDate}</div>
          </div>
        </div>
        <div style="margin-top:14px;font-size:14px;color:#334155;">Wallets Compared: ${selectedWallets.length}</div>
        <div style="margin-top:14px;padding-top:12px;border-top:1px solid #e2e8f0;">
          <div style="font-size:14px;font-weight:600;margin-bottom:8px;">Wallet Addresses:</div>
          <div style="font-size:13px;color:#475569;">${headerWallets}</div>
        </div>
      `;

      document.body.appendChild(tempHeader);
      let headerCanvas: HTMLCanvasElement;

      try {
        await new Promise((resolve) => setTimeout(resolve, 100));
        headerCanvas = await html2canvas(tempHeader, {
          scale: PDF_EXPORT_SCALE,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
        });
      } finally {
        tempHeader.remove();
      }

      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      let currentY = PDF_EXPORT_TOP_MARGIN_MM;

      const headerImgData = headerCanvas.toDataURL("image/png");
      const headerImgHeight = (headerCanvas.height * pdfWidth) / headerCanvas.width;
      pdf.addImage(headerImgData, "PNG", 0, currentY, pdfWidth, headerImgHeight);
      currentY += headerImgHeight + PDF_EXPORT_SECTION_GAP_MM;

      const sections = exportTarget.querySelectorAll<HTMLElement>(`.${PDF_EXPORT_SECTION_CLASS}`);

      if (sections.length === 0) {
        return;
      }

      for (const section of sections) {
        const sectionTitle = section.getAttribute("data-title")?.trim() ?? "";
        const titleHeight = sectionTitle ? 8 : 0;

        const htmlTitleElement = section.querySelector<HTMLElement>(".hide-on-print-title");
        const previousStyleAttribute = htmlTitleElement
          ? htmlTitleElement.getAttribute("style")
          : null;

        if (htmlTitleElement) {
          htmlTitleElement.style.setProperty("display", "none", "important");
        }

        let canvas: HTMLCanvasElement;
        try {
          canvas = await html2canvas(section, {
            scale: PDF_EXPORT_SCALE,
            useCORS: true,
            backgroundColor: "#ffffff",
            logging: false,
            onclone: (clonedDocument) => {
              clonedDocument
                .querySelectorAll<HTMLElement>(".recharts-accessibility-layer, .recharts-tooltip-wrapper")
                .forEach((element) => {
                  element.style.display = "none";
                });

              clonedDocument
                .querySelectorAll<HTMLElement>(".recharts-responsive-container")
                .forEach((element) => {
                  element.style.minWidth = "800px";
                });
            },
          });
        } finally {
          if (htmlTitleElement) {
            if (previousStyleAttribute === null) {
              htmlTitleElement.removeAttribute("style");
            } else {
              htmlTitleElement.setAttribute("style", previousStyleAttribute);
            }
          }
        }

        if (canvas.width <= 0 || canvas.height <= 0) {
          continue;
        }

        const imgData = canvas.toDataURL("image/png");
        const imgHeight = (canvas.height * pdfWidth) / canvas.width;
        const blockHeight = imgHeight + titleHeight;

        if (currentY + blockHeight > pageHeight - PDF_EXPORT_TOP_MARGIN_MM) {
          pdf.addPage();
          currentY = PDF_EXPORT_TOP_MARGIN_MM;
        }

        if (sectionTitle) {
          pdf.setFontSize(14);
          pdf.setFont("helvetica", "bold");
          pdf.text(sectionTitle, 14, currentY);
          currentY += titleHeight;
        }

        pdf.addImage(imgData, "PNG", 0, currentY, pdfWidth, imgHeight);
        currentY += imgHeight + 15;
      }

      pdf.save(`Wallet_Comparison_${activeSegment}.pdf`);
    } finally {
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
