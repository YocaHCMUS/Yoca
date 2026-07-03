import { TabContainer } from "@/components/tabContainer/tabContainer";
import { DayActivityPopup } from "@/components/wallet/DayActivityPopup/DayActivityPopup";
import { GeneralTab } from "@/components/wallet/WalletComparison/GeneralTab";
import { HoldingTab } from "@/components/wallet/WalletComparison/HoldingTab";
import { RiskTab } from "@/components/wallet/WalletComparison/RiskTab";
import {
  WalletChat,
  ChatContextProvider,
  QuickAiPopup,
} from "@/components/wallet/WalletChat";
import { PREDEFINED_QUESTIONS } from "@/components/wallet/WalletChat/WalletChatConstants";
import { PageWrapper } from "@/components/wrapper";
import { useLocalization } from "@/contexts/LocalizationContext";
import { Button, Search, Stack } from "@carbon/react";
import {
  ChartLine,
  Close,
  SearchAdvanced,
  Wallet,
  User,
  Launch,
  AiGenerate,
} from "@carbon/react/icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { RightSidebar } from "@/pages/wallet/RightSidebar";
import styles from "./index.module.scss";


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

  const [aiPopupOpen, setAiPopupOpen] = useState(false);
  const [aiPopupAnchor, setAiPopupAnchor] = useState<HTMLElement | null>(null);
  const [aiPopupLabel, setAiPopupLabel] = useState("");
  const [aiPopupQuestionIds, setAiPopupQuestionIds] = useState<string[] | undefined>(undefined);

  const handleDayClick = (walletAddress: string, timestamp: number) => {
    setDayPopupTimestamp(timestamp);
    setDayPopupOpen(true);
  };

  const handleAiAction = useCallback((e: React.MouseEvent<HTMLElement>, label: string, questionIds?: string[]) => {
    setAiPopupAnchor(e.currentTarget);
    setAiPopupLabel(label);
    setAiPopupQuestionIds(questionIds);
    setAiPopupOpen(true);
  }, []);

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
            onAiAction={handleAiAction}
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
            onAiAction={handleAiAction}
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
            onAiAction={handleAiAction}
          />
        </div>
      </div>,
    ],
    [selectedWallets, activeTab, exportContainerClassName, handleAiAction],
  );

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

          <QuickAiPopup
            open={aiPopupOpen}
            onClose={() => setAiPopupOpen(false)}
            anchorElement={aiPopupAnchor}
            addresses={selectedWallets}
            contextType="wallet-comparison"
            lang={lang}
            componentLabel={aiPopupLabel}
            predefinedQuestions={
              aiPopupQuestionIds
                ? PREDEFINED_QUESTIONS.filter((q) => aiPopupQuestionIds.includes(q.id))
                : undefined
            }
            onOpenChat={() => setIsChatOpen(true)}
          />

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

