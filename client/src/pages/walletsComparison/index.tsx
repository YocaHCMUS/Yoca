import { TabContainer } from "@/components/tabContainer/tabContainer";
import { DayActivityPopup } from "@/components/wallet/DayActivityPopup/DayActivityPopup";
import { GeneralTab } from "@/components/wallet/WalletComparison/GeneralTab";
import { HoldingTab } from "@/components/wallet/WalletComparison/HoldingTab";
import { RiskTab } from "@/components/wallet/WalletComparison/RiskTab";
import {
  WalletChat,
  ChatContextProvider,
} from "@/components/wallet/WalletChat";
import { PageWrapper } from "@/components/wrapper";
import { useLocalization } from "@/contexts/LocalizationContext";
import { applyRobotoRegularPdfFont } from "@/util/pdf-fonts";
import { Button, Search, Stack } from "@carbon/react";
import {
  ChartLine,
  Close,
  Download,
  SearchAdvanced,
  Wallet,
  User,
  Launch,
  AiGenerate,
} from "@carbon/react/icons";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { RightSidebar } from "@/pages/wallet/RightSidebar";
import styles from "./index.module.scss";

const TAB_EXPORT_FILENAME_SEGMENTS = [
  "General",
  "Holdings",
  "Profit_Risk_Management",
] as const;

const TAB_TRANSLATION_KEYS = [
  "walletComparison.general",
  "walletComparison.holdings",
  "walletComparison.profitRiskManagement",
] as const;

const PDF_EXPORT_SECTION_CLASS = "pdf-export-section";
const PDF_EXPORT_TOP_MARGIN_MM = 10;
const PDF_EXPORT_SECTION_GAP_MM = 10;
const PDF_EXPORT_SCALE = 2;

function isEditableShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return (
    target.isContentEditable ||
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select"
  );
}

interface WalletComparisonSidebarProps {
  walletAddress: string;
  selectedWallets: string[];
  onWalletAddressChange: (value: string) => void;
  onWalletKeyPress: (event: React.KeyboardEvent) => void;
  onRemoveWallet: (address: string) => void;
  onExport: () => void;
  isExporting: boolean;
}

interface WalletComparisonMainContentProps {
  activeTab: number;
  visitedTabs: ReadonlySet<number>;
  comparisonTabs: React.ReactNode[];
  onTabChange: (index: number) => void;
}

function WalletComparisonSidebar({
  walletAddress,
  selectedWallets,
  onWalletAddressChange,
  onWalletKeyPress,
  onRemoveWallet,
  onExport,
  isExporting,
}: WalletComparisonSidebarProps) {
  const { tr } = useLocalization();

  return (
    <div className={styles.sidebarContainer}>
      <div className={styles.sidebarHeaderRow}>
        <h3 className={styles.sidebarTitle}>
          {selectedWallets.length === 1
            ? tr("walletComparison.activeWallet")
            : tr("walletComparison.selectedWallets")}
        </h3>
        <Button
          kind="ghost"
          size="sm"
          renderIcon={Download}
          onClick={onExport}
          disabled={isExporting || selectedWallets.length === 0}
        >
          {isExporting
            ? tr("walletComparison.generatingPdf")
            : tr("walletComparison.exportPdf")}
        </Button>
      </div>
      <Search
        id="wallet-search"
        labelText={tr("walletComparison.addWalletAddress")}
        placeholder={tr("walletComparison.enterWalletAddress")}
        value={walletAddress}
        onChange={(e) => onWalletAddressChange(e.target.value)}
        onKeyDown={onWalletKeyPress}
        renderIcon={SearchAdvanced}
      />

      <Stack gap={4} className={styles.walletList}>
        {selectedWallets.length === 0 ? (
          <p className={styles.emptyState}>
            {tr("walletComparison.noWalletsSelected")}
          </p>
        ) : (
          selectedWallets.map((wallet) => (
            <div key={wallet} className={styles.walletTagContainer}>
              <Button
                className={styles.walletTag}
                renderIcon={Close}
                onClick={() => onRemoveWallet(wallet)}
                kind="tertiary"
              >
                <span className={styles.buttonTag}>{wallet}</span>
              </Button>
              <Button
                kind="ghost"
                size="sm"
                hasIconOnly
                renderIcon={Launch}
                iconDescription={tr("walletComparison.viewDeepDive")}
                tooltipPosition="left"
                onClick={() => window.open(`/wallets/${wallet}`, "_blank")}
                className={styles.deepDiveButton}
              />
            </div>
          ))
        )}
      </Stack>
    </div>
  );
}

function WalletComparisonMainContent({
  activeTab,
  visitedTabs,
  comparisonTabs,
  onTabChange,
}: WalletComparisonMainContentProps) {
  const { tr } = useLocalization();

  return (
    <div className={styles.mainContentContainer}>
      <TabContainer
        activeTab={activeTab}
        variant="profile"
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
        preserveMountedPanels
        visitedTabIndices={visitedTabs}
        tabs={comparisonTabs}
        onTabChange={onTabChange}
      />
    </div>
  );
}

export default function WalletsComparisonPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  /** Tabs that have been opened at least once — panels stay mounted but pause fetching when inactive. */
  const [visitedTabs, setVisitedTabs] = useState<Set<number>>(
    () => new Set([0]),
  );
  const [walletAddress, setWalletAddress] = useState("");
  const [selectedWallets, setSelectedWallets] = useState<string[]>([]);
  const exportRef = useRef<HTMLDivElement>(null);
  const { tr, lang } = useLocalization();
  const [searchParams] = useSearchParams();

  const [dayPopupOpen, setDayPopupOpen] = useState(false);
  const [dayPopupTimestamp, setDayPopupTimestamp] = useState(0);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
  const [chatPosition, setChatPosition] = useState<
    "right" | "left" | "fullscreen"
  >("right");

  const handleDayClick = (walletAddress: string, timestamp: number) => {
    setDayPopupTimestamp(timestamp);
    setDayPopupOpen(true);
  };

  useEffect(() => {
    setVisitedTabs((prev) => new Set(prev).add(activeTab));
  }, [activeTab]);

  useEffect(() => {
    if (selectedWallets.length === 0) {
      setVisitedTabs(new Set([0]));
      setActiveTab(0);
    }
  }, [selectedWallets.length]);
  useEffect(() => {
    const handleChatShortcut = (event: globalThis.KeyboardEvent) => {
      if (
        event.repeat ||
        !event.shiftKey ||
        event.code !== "Slash" ||
        isEditableShortcutTarget(event.target)
      ) {
        return;
      }

      event.preventDefault();
      setIsChatOpen(true);
    };

    window.addEventListener("keydown", handleChatShortcut);
    return () => window.removeEventListener("keydown", handleChatShortcut);
  }, []);
  const hasInitializedRef = useRef(false);

  // Pre-populate from ?wallets=addr1,addr2 query param.
  // Depends on searchParams so that navigating here from a different wallet
  // (Back → Compare on a new wallet) correctly resets the list.
  useEffect(() => {
    const param = searchParams.get("wallets");
    if (!param) return;
    const addresses = param
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);
    if (addresses.length > 0) {
      setSelectedWallets(addresses);
      hasInitializedRef.current = true;
    }
  }, [searchParams]);

  const exportContainerClassName = styles.exportCaptureContainer;

  const comparisonTabs = useMemo(
    () => [
      <div
        key="wc-general-wrapper"
        ref={activeTab === 0 ? exportRef : undefined}
        className={exportContainerClassName}
      >
        <div style={{ position: "relative" }}>
          <GeneralTab
            key="wc-general"
            walletAddresses={selectedWallets}
            fetchEnabled={activeTab === 0}
          />
        </div>
      </div>,
      <div
        key="wc-holding-wrapper"
        ref={activeTab === 1 ? exportRef : undefined}
        className={exportContainerClassName}
      >
        <div style={{ position: "relative" }}>
          <HoldingTab
            key="wc-holding"
            walletAddresses={selectedWallets}
            fetchEnabled={activeTab === 1}
          />
        </div>
      </div>,
      <div
        key="wc-risk-wrapper"
        ref={activeTab === 2 ? exportRef : undefined}
        className={exportContainerClassName}
      >
        <div style={{ position: "relative" }}>
          <RiskTab
            key="wc-risk"
            walletAddresses={selectedWallets}
            fetchEnabled={activeTab === 2}
            onDayClick={handleDayClick}
          />
        </div>
      </div>,
    ],
    [selectedWallets, activeTab, exportContainerClassName],
  );

  const handleExportPDF = async (activeTabTranslationKey: string) => {
    const exportTarget = exportRef.current;
    if (isExporting || !exportTarget) {
      return;
    }

    const activeSegment =
      TAB_EXPORT_FILENAME_SEGMENTS[activeTab] ?? `Tab_${activeTab}`;
    const localizedTabName = String(
      tr(TAB_TRANSLATION_KEYS[activeTab] ?? "walletComparison.general"),
    );
    const activeHeaderTitle = activeTabTranslationKey.trim()
      ? String(tr(activeTabTranslationKey as never))
      : localizedTabName;
    const { width, height } = exportTarget.getBoundingClientRect();
    if (width <= 0 || height <= 0) {
      return;
    }

    const reportTitle =
      selectedWallets.length === 1
        ? String(tr("walletComparison.walletAnalysisReport"))
        : String(tr("walletComparison.pdfReportTitle"));
    const generatedDateLabel = String(tr("walletComparison.pdfGeneratedDate"));
    const walletsComparedLabel = String(
      tr("walletComparison.pdfWalletsCompared"),
    );
    const walletAddressesLabel = String(
      tr("walletComparison.pdfWalletAddresses"),
    );
    const generatedDate = new Intl.DateTimeFormat(lang, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
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
      tempHeader.style.fontFamily =
        "'DejaVu Sans', 'Arial Unicode MS', Arial, Tahoma, sans-serif";
      tempHeader.style.color = "#0f172a";

      const headerWallets =
        selectedWallets.length > 0
          ? selectedWallets
              .map(
                (address) =>
                  `<div style="line-height:1.45;word-break:break-all;">${address}</div>`,
              )
              .join("")
          : `<div>${String(tr("marketPage.na"))}</div>`;

      tempHeader.innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;">
          <div>
            <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;margin-bottom:6px;font-weight:600;">${reportTitle}</div>
            <div style="font-size:24px;font-weight:700;line-height:1.2;">${reportTitle} - ${activeHeaderTitle}</div>
          </div>
          <div style="min-width:180px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:#64748b;font-weight:600;">${generatedDateLabel}</div>
            <div style="margin-top:4px;font-size:14px;font-weight:600;color:#0f172a;">${generatedDate}</div>
          </div>
        </div>
        <div style="margin-top:14px;font-size:14px;color:#334155;">${walletsComparedLabel}: ${selectedWallets.length}</div>
        <div style="margin-top:14px;padding-top:12px;border-top:1px solid #e2e8f0;">
          <div style="font-size:14px;font-weight:600;margin-bottom:8px;">${walletAddressesLabel}:</div>
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
      await applyRobotoRegularPdfFont(pdf);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      let currentY = PDF_EXPORT_TOP_MARGIN_MM;

      const headerImgData = headerCanvas.toDataURL("image/png");
      const headerImgHeight =
        (headerCanvas.height * pdfWidth) / headerCanvas.width;
      pdf.addImage(
        headerImgData,
        "PNG",
        0,
        currentY,
        pdfWidth,
        headerImgHeight,
      );
      currentY += headerImgHeight + PDF_EXPORT_SECTION_GAP_MM;

      const sections = exportTarget.querySelectorAll<HTMLElement>(
        `.${PDF_EXPORT_SECTION_CLASS}`,
      );

      if (sections.length === 0) {
        return;
      }

      for (const section of sections) {
        const titleElement = section.querySelector<HTMLElement>(
          ".hide-on-print-title",
        );
        const sectionTitle = titleElement?.innerText.trim() ?? "";
        const previousStyleAttribute = titleElement
          ? titleElement.getAttribute("style")
          : null;

        if (titleElement) {
          titleElement.style.setProperty("display", "none", "important");
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
                .querySelectorAll<HTMLElement>(
                  ".recharts-accessibility-layer, .recharts-tooltip-wrapper",
                )
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
          if (titleElement) {
            if (previousStyleAttribute === null) {
              titleElement.removeAttribute("style");
            } else {
              titleElement.setAttribute("style", previousStyleAttribute);
            }
          }
        }

        if (canvas.width <= 0 || canvas.height <= 0) {
          continue;
        }

        const imgData = canvas.toDataURL("image/png");
        const imgHeight = (canvas.height * pdfWidth) / canvas.width;
        const titleHeight = sectionTitle ? 8 : 0;
        const blockHeight = imgHeight + titleHeight;

        if (currentY + blockHeight > pageHeight - PDF_EXPORT_TOP_MARGIN_MM) {
          pdf.addPage();
          currentY = PDF_EXPORT_TOP_MARGIN_MM;
        }

        if (sectionTitle) {
          pdf.setFontSize(14);
          pdf.setFont("Roboto", "normal");
          pdf.text(sectionTitle, 14, currentY);
          currentY += titleHeight;
        }

        pdf.addImage(imgData, "PNG", 0, currentY, pdfWidth, imgHeight);
        currentY += imgHeight + PDF_EXPORT_SECTION_GAP_MM;
      }

      pdf.save(`Wallet_Comparison_${activeSegment}_${lang.toLowerCase()}.pdf`);
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

  const handleSidebarExport = () => {
    const activeTabTranslationKey =
      TAB_TRANSLATION_KEYS[activeTab] ?? "walletComparison.general";
    void handleExportPDF(activeTabTranslationKey);
  };

  return (
    <PageWrapper noMarketTickers wideContent>
      <div className={`${styles.pageLayout}${isRightSidebarOpen ? ` ${styles.rightSidebarExpanded}` : ''}`}>
        <ChatContextProvider
          addresses={selectedWallets}
          contextType="wallet-comparison"
          lang={lang}
        >
          {/* Left Sidebar */}
          <aside className={styles.leftSidebar}>
            <div className={styles.walletSection}>
              <WalletComparisonSidebar
                walletAddress={walletAddress}
                selectedWallets={selectedWallets}
                onWalletAddressChange={setWalletAddress}
                onWalletKeyPress={handleKeyPress}
                onRemoveWallet={handleRemoveWallet}
                onExport={handleSidebarExport}
                isExporting={isExporting}
              />
            </div>
          </aside>

          <main className={styles.mainContent}>
            <WalletComparisonMainContent
              activeTab={activeTab}
              visitedTabs={visitedTabs}
              comparisonTabs={comparisonTabs}
              onTabChange={setActiveTab}
            />
          </main>

          {/* Modal chat panel (right/left dock + fullscreen) */}
          {!isChatOpen && (
            <button
              type="button"
              className={styles.chatLauncher}
              onClick={() => setIsChatOpen(true)}
              title="Shift + /"
            >
              <AiGenerate size={18} />
              <span>{tr("chat.launcherLabel")}</span>
              <kbd>Shift /</kbd>
            </button>
          )}

          <RightSidebar
            isChatOpen={isChatOpen}
            onChatToggle={() => setIsChatOpen((v) => !v)}
            onToggle={setIsRightSidebarOpen}
          />

          {isChatOpen && (
            <div className={styles.chatOverlay} data-position={chatPosition}>
              <div className={styles.chatPanel}>
                <WalletChat
                  variant="sidebar"
                  chatPosition={chatPosition}
                  onChatPositionChange={setChatPosition}
                  onRequestClose={() => setIsChatOpen(false)}
                />
              </div>
            </div>
          )}

        </ChatContextProvider>
      </div>

      <DayActivityPopup
        isOpen={dayPopupOpen}
        onClose={() => setDayPopupOpen(false)}
        wallets={selectedWallets}
        dayTimestamp={dayPopupTimestamp}
      />
    </PageWrapper>
  );
}

