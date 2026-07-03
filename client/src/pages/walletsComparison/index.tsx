import { SearchBox } from "@/components/charts/shared/ChartControls/SearchBox";
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
import { useWatchlist } from "@/contexts/WatchlistContext";
import { IconButton } from "@carbon/react";
import {
  AiGenerate,
  ChartLine,
  Copy,
  Launch,
  Star,
  StarFilled,
  TrashCan,
  User,
  Wallet,
} from "@carbon/icons-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { useNavigate, useSearchParams } from "react-router";
import { RightSidebar } from "@/pages/wallet/RightSidebar";
import styles from "./index.module.scss";

const MAX_COMPARISON_WALLETS = 4;

function formatWalletAddress(address: string): string {
  if (address.length <= 14) {
    return address;
  }

  return `${address.slice(0, 6)}...${address.slice(-6)}`;
}

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
  maxWallets: number;
  onWalletAddressChange: (value: string) => void;
  onWalletKeyPress: (event: KeyboardEvent<HTMLInputElement>) => void;
  onRemoveWallet: (address: string) => void;
}

interface WalletComparisonMainContentProps {
  activeTab: number;
  visitedTabs: ReadonlySet<number>;
  comparisonTabs: ReactNode[];
  onTabChange: (index: number) => void;
}

function WalletComparisonSidebar({
  walletAddress,
  selectedWallets,
  maxWallets,
  onWalletAddressChange,
  onWalletKeyPress,
  onRemoveWallet,
}: WalletComparisonSidebarProps) {
  const { tr } = useLocalization();
  const navigate = useNavigate();
  const { walletWatchlist, walletPending, toggleWallet } = useWatchlist();
  const isFull = selectedWallets.length >= maxWallets;

  const handleCopyWallet = useCallback((address: string) => {
    void navigator.clipboard.writeText(address);
  }, []);

  const handleToggleWallet = useCallback(
    (address: string) => {
      void toggleWallet(address).catch((error: unknown) => {
        console.error("Failed to update wallet watchlist:", error);
      });
    },
    [toggleWallet],
  );

  return (
    <div className={styles.sidebarContainer}>
      <div className={styles.sidebarHeaderRow}>
        <div className={styles.sidebarHeadingBlock}>
          <h3 className={styles.sidebarTitle}>
            {selectedWallets.length === 1
              ? tr("walletComparison.activeWallet")
              : tr("walletComparison.selectedWallets")}
          </h3>
          <span className={styles.walletCount}>
            {tr("walletComparison.walletCount", {
              count: selectedWallets.length,
              max: maxWallets,
            })}
          </span>
        </div>
      </div>

      <SearchBox
        value={walletAddress}
        onChange={onWalletAddressChange}
        onKeyDown={onWalletKeyPress}
        placeholder={
          isFull
            ? tr("walletComparison.comparisonListFull")
            : tr("walletComparison.enterWalletAddress")
        }
        ariaLabel={tr("walletComparison.addWalletAddress")}
        disabled={isFull}
      />

      <div className={styles.walletList}>
        {selectedWallets.length === 0 ? (
          <p className={styles.emptyState}>
            {tr("walletComparison.noWalletsSelected")}
          </p>
        ) : (
          selectedWallets.map((wallet) => {
            const isFollowed = walletWatchlist.includes(wallet);
            const isPending = Boolean(walletPending[wallet]);

            return (
              <div key={wallet} className={styles.walletCard} title={wallet}>
                <div className={styles.walletCardMain}>
                  <span
                    className={styles.walletFollowIndicator}
                    data-followed={isFollowed}
                    aria-hidden="true"
                  >
                    {isFollowed ? <StarFilled size={14} /> : <Star size={14} />}
                  </span>
                  <span className={styles.walletCardAddress}>
                    {formatWalletAddress(wallet)}
                  </span>
                </div>

                <div className={styles.walletCardActions}>
                  <IconButton
                    size="sm"
                    kind="ghost"
                    label={tr("walletComparison.copyAddress")}
                    align="left"
                    onClick={() => handleCopyWallet(wallet)}
                    className={styles.walletActionButton}
                  >
                    <Copy size={16} />
                  </IconButton>
                  <IconButton
                    size="sm"
                    kind="ghost"
                    label={
                      isFollowed
                        ? tr("walletComparison.unfollowWallet")
                        : tr("walletComparison.followWallet")
                    }
                    align="left"
                    disabled={isPending}
                    onClick={() => handleToggleWallet(wallet)}
                    className={styles.walletActionButton}
                  >
                    {isFollowed ? <StarFilled size={16} /> : <Star size={16} />}
                  </IconButton>
                  <IconButton
                    size="sm"
                    kind="ghost"
                    label={tr("walletComparison.removeWallet")}
                    align="left"
                    onClick={() => onRemoveWallet(wallet)}
                    className={`${styles.walletActionButton} ${styles.walletActionDanger}`}
                  >
                    <TrashCan size={16} />
                  </IconButton>
                  <IconButton
                    size="sm"
                    kind="ghost"
                    label={tr("walletComparison.openWalletPage")}
                    align="left"
                    onClick={() => navigate(`/wallets/${wallet}`)}
                    className={styles.walletActionButton}
                  >
                    <Launch size={16} />
                  </IconButton>
                </div>
              </div>
            );
          })
        )}
      </div>
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
  const [aiPopupQuestionIds, setAiPopupQuestionIds] = useState<
    string[] | undefined
  >(undefined);

  const handleDayClick = (_walletAddress: string, timestamp: number) => {
    setDayPopupTimestamp(timestamp);
    setDayPopupOpen(true);
  };

  const handleAiAction = useCallback(
    (
      e: ReactMouseEvent<HTMLElement>,
      label: string,
      questionIds?: string[],
    ) => {
      setAiPopupAnchor(e.currentTarget);
      setAiPopupLabel(label);
      setAiPopupQuestionIds(questionIds);
      setAiPopupOpen(true);
    },
    [],
  );

  const addComparisonWallet = useCallback((address: string) => {
    const normalizedAddress = address.trim();
    if (!normalizedAddress) {
      return false;
    }

    let added = false;
    setSelectedWallets((previousWallets) => {
      if (
        previousWallets.includes(normalizedAddress) ||
        previousWallets.length >= MAX_COMPARISON_WALLETS
      ) {
        return previousWallets;
      }

      added = true;
      return [...previousWallets, normalizedAddress];
    });

    return added;
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

  useEffect(() => {
    const param = searchParams.get("wallets");
    if (!param) return;

    const addresses = param
      .split(",")
      .map((address) => address.trim())
      .filter(Boolean)
      .filter((address, index, allAddresses) => allAddresses.indexOf(address) === index)
      .slice(0, MAX_COMPARISON_WALLETS);

    if (addresses.length > 0) {
      setSelectedWallets(addresses);
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

  const handleAddWallet = useCallback(() => {
    if (addComparisonWallet(walletAddress)) {
      setWalletAddress("");
    }
  }, [addComparisonWallet, walletAddress]);

  const handleRemoveWallet = useCallback((address: string) => {
    setSelectedWallets((previousWallets) =>
      previousWallets.filter((wallet) => wallet !== address),
    );
  }, []);

  const handleKeyPress = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleAddWallet();
      }
    },
    [handleAddWallet],
  );

  return (
    <PageWrapper noMarketTickers wideContent>
      <div
        className={`${styles.pageLayout}${isRightSidebarOpen ? ` ${styles.rightSidebarExpanded}` : ""
          }`}
      >
        <ChatContextProvider
          addresses={selectedWallets}
          contextType="wallet-comparison"
          lang={lang}
        >
          <aside className={styles.leftSidebar}>
            <div className={styles.walletSection}>
              <WalletComparisonSidebar
                walletAddress={walletAddress}
                selectedWallets={selectedWallets}
                maxWallets={MAX_COMPARISON_WALLETS}
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

          {!isChatOpen && (
            <button
              type="button"
              className={styles.chatLauncher}
              onClick={() => setIsChatOpen(true)}
              title={tr("chat.launcherShortcutTitle")}
              aria-label={tr("chat.launcherShortcutTitle")}
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
            comparisonWallets={selectedWallets}
            maxComparisonWallets={MAX_COMPARISON_WALLETS}
            onAddComparisonWallet={addComparisonWallet}
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
                ? PREDEFINED_QUESTIONS.filter((q) =>
                  aiPopupQuestionIds.includes(q.id),
                )
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
