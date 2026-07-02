import { useCallback, useEffect, useMemo, useState, type UIEvent } from "react";
import { useChatPrompts, type ChatPromptData, type CreatePromptInput, type PromptScope, type UpdatePromptInput } from "./useChatPrompts";
import { PREDEFINED_QUESTIONS } from "./WalletChatConstants";
import { ChatPromptDialog } from "./ChatPromptDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useLocalization } from "@/contexts/LocalizationContext";
import { PillTabs } from "@/components/common/PillTabs/PillTabs";
import { SearchBox } from "@/components/charts/shared/ChartControls";
import styles from "./WalletChat.module.scss";

type TabId = "mine" | "explore";
type ExploreSubTab = "popular" | "new" | "system";

interface Props {
  walletAddress?: string;
  onSelect: (query: string, promptId?: string) => void;
  onClose: () => void;
}

const PROMPT_PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;
const SCROLL_LOAD_THRESHOLD_PX = 72;

export function ChatPromptMenu({ walletAddress, onSelect, onClose }: Props) {
  const { tr } = useLocalization();
  const { user } = useAuth();
  const {
    prompts,
    page,
    hasMore,
    isLoading,
    isFetchingMore,
    error,
    fetchPrompts,
    createPrompt,
    updatePrompt,
    deletePrompt,
    forkPrompt,
  } = useChatPrompts();

  const [activeTab, setActiveTab] = useState<TabId>(user ? "mine" : "explore");
  const [exploreSubTab, setExploreSubTab] = useState<ExploreSubTab>("popular");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | "fork" | "view" | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<ChatPromptData | null>(null);
  const [forkingPrompt, setForkingPrompt] = useState<ChatPromptData | null>(null);
  const [viewingPrompt, setViewingPrompt] = useState<ChatPromptData | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [searchQuery]);

  const activePromptScope: PromptScope | null = activeTab === "mine"
    ? "mine"
    : exploreSubTab === "system"
      ? null
      : exploreSubTab;

  const activePromptSort: "usage" | "recent" = activePromptScope === "popular" ? "usage" : "recent";

  useEffect(() => {
    if (!activePromptScope) return;
    fetchPrompts({
      scope: activePromptScope,
      sort: activePromptSort,
      search: debouncedSearchQuery,
      page: 1,
      limit: PROMPT_PAGE_SIZE,
      walletAddress,
    });
  }, [activePromptScope, activePromptSort, debouncedSearchQuery, walletAddress, fetchPrompts]);

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    setSearchQuery("");
    setDebouncedSearchQuery("");
  };

  const handleExploreSubTabChange = (sub: ExploreSubTab) => {
    setExploreSubTab(sub);
    setSearchQuery("");
    setDebouncedSearchQuery("");
  };

  const fetchNextPage = useCallback(() => {
    if (!activePromptScope || isLoading || isFetchingMore || !hasMore) return;
    fetchPrompts({
      scope: activePromptScope,
      sort: activePromptSort,
      search: debouncedSearchQuery,
      page: page + 1,
      limit: PROMPT_PAGE_SIZE,
      walletAddress,
      append: true,
    });
  }, [activePromptScope, activePromptSort, debouncedSearchQuery, fetchPrompts, hasMore, isFetchingMore, isLoading, page, walletAddress]);

  const handlePromptMenuScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (remaining <= SCROLL_LOAD_THRESHOLD_PX) {
      fetchNextPage();
    }
  }, [fetchNextPage]);

  const handleSelectPrompt = useCallback((query: string, promptId?: string) => {
    onSelect(query, promptId);
    onClose();
  }, [onSelect, onClose]);

  const resolveLabel = useCallback((q: typeof PREDEFINED_QUESTIONS[number]): string => {
    return q.labelKey ? tr(q.labelKey as "chat.prompt.overview.label") : q.label;
  }, [tr]);

  const resolveQuery = useCallback((q: typeof PREDEFINED_QUESTIONS[number]): string => {
    return q.queryKey ? tr(q.queryKey as "chat.prompt.overview.query") : q.query;
  }, [tr]);

  const filterText = searchQuery.toLowerCase().trim();

  const filteredSystemPrompts = useMemo(() => {
    if (!filterText) return PREDEFINED_QUESTIONS;
    return PREDEFINED_QUESTIONS.filter((q) => {
      const label = resolveLabel(q).toLowerCase();
      const query = resolveQuery(q).toLowerCase();
      return label.includes(filterText) || query.includes(filterText);
    });
  }, [filterText, resolveLabel, resolveQuery]);

  const handleCreate = useCallback(async (input: CreatePromptInput | UpdatePromptInput) => {
    const result = await createPrompt(input as CreatePromptInput);
    return result !== null;
  }, [createPrompt]);

  const handleEdit = useCallback(async (input: CreatePromptInput | UpdatePromptInput) => {
    if (!editingPrompt) return false;
    const result = await updatePrompt(editingPrompt.id, input);
    return result !== null;
  }, [editingPrompt, updatePrompt]);

  const handleFork = useCallback(async (input: CreatePromptInput | UpdatePromptInput) => {
    if (!forkingPrompt) return false;
    const result = await forkPrompt(forkingPrompt.id, input as { label?: string; isPublic?: boolean });
    return result !== null;
  }, [forkingPrompt, forkPrompt]);

  const handleDelete = useCallback(async (promptId: string) => {
    await deletePrompt(promptId);
  }, [deletePrompt]);

  const openEdit = (prompt: ChatPromptData) => {
    setEditingPrompt(prompt);
    setDialogMode("edit");
  };

  const openFork = (prompt: ChatPromptData) => {
    setForkingPrompt(prompt);
    setDialogMode("fork");
  };

  const openView = (prompt: ChatPromptData) => {
    setViewingPrompt(prompt);
    setDialogMode("view");
  };

  const closeDialog = () => {
    setDialogMode(null);
    setEditingPrompt(null);
    setForkingPrompt(null);
    setViewingPrompt(null);
  };

  const renderPromptItem = (prompt: ChatPromptData) => {
    const isOwner = user?.userId === prompt.userId;

    return (
      <button
        key={prompt.id}
        className={styles.promptItem}
        onClick={() => handleSelectPrompt(prompt.query, prompt.id)}
      >
        <div className={styles.promptItemLabel}>{prompt.label}</div>
        <div className={styles.promptItemQuery}>{prompt.query}</div>
        <div className={styles.promptItemMeta}>
          <span>{tr("chat.prompt.uses", { count: prompt.usageCount })}</span>
          {prompt.isPublic && <span>{tr("chat.prompt.publicBadge")}</span>}
          {prompt.walletAddress && <span>{tr("chat.prompt.scopedBadge")}</span>}
        </div>
        <div className={styles.promptItemActions}>
          <button
            className={styles.promptItemAction}
            onClick={(e) => { e.stopPropagation(); openView(prompt); }}
          >
            {tr("chat.prompt.view")}
          </button>
          {user && !isOwner && (
            <button
              className={styles.promptItemAction}
              onClick={(e) => { e.stopPropagation(); openFork(prompt); }}
            >
              {tr("chat.prompt.fork")}
            </button>
          )}
          {isOwner && (
            <>
              <button
                className={styles.promptItemAction}
                onClick={(e) => { e.stopPropagation(); openEdit(prompt); }}
              >
                {tr("chat.prompt.edit")}
              </button>
              <button
                className={styles.promptItemAction}
                onClick={(e) => { e.stopPropagation(); handleDelete(prompt.id); }}
              >
                {tr("chat.prompt.del")}
              </button>
            </>
          )}
        </div>
      </button>
    );
  };

  const renderSystemPromptItem = (q: typeof PREDEFINED_QUESTIONS[number]) => (
    <button
      key={q.id}
      className={styles.promptItem}
      onClick={() => handleSelectPrompt(resolveQuery(q))}
    >
      <div className={styles.promptItemLabel}>{resolveLabel(q)}</div>
      <div className={styles.promptItemQuery}>{resolveQuery(q)}</div>
    </button>
  );

  const renderSearchInput = () => (
    <SearchBox
      value={searchQuery}
      onChange={setSearchQuery}
      placeholder={tr("chat.prompt.searchPlaceholder")}
      ariaLabel={tr("chat.prompt.searchPlaceholder")}
    />
  );

  const renderApiPromptList = (emptyText: string) => {
    if (isLoading) {
      return <div className={styles.promptLoading}>{tr("chat.prompt.loading")}</div>;
    }

    if (error) {
      return <div className={styles.promptEmpty}>{error}</div>;
    }

    if (prompts.length === 0) {
      return <div className={styles.promptEmpty}>{emptyText}</div>;
    }

    return (
      <div className={styles.promptMenuList}>
        {prompts.map(renderPromptItem)}
        {isFetchingMore && (
          <div className={styles.promptLoading}>{tr("chat.prompt.loadingMore")}</div>
        )}
      </div>
    );
  };

  const renderMineContent = () => (
    <>
      <div className={styles.promptMenuHeader}>
        <div className={styles.promptMenuTitle}>{tr("chat.prompt.tabMine")}</div>
        {user && (
          <button className={styles.promptCreateBtn} onClick={() => setDialogMode("create")}>
            {tr("chat.prompt.createBtn")}
          </button>
        )}
      </div>

      {renderApiPromptList(tr("chat.prompt.emptyMine"))}
    </>
  );

  const renderExploreContent = () => (
    <>
      <div className={styles.promptMenuHeader}>
        <div className={styles.promptMenuTitle}>{tr("chat.prompt.tabExplore")}</div>
      </div>

      <PillTabs
        className={styles.promptPillTabs}
        size="sm"
        value={exploreSubTab}
        onChange={(value) => handleExploreSubTabChange(value as ExploreSubTab)}
        options={[
          { value: "popular", label: tr("chat.prompt.exploreSubtabPopular") },
          { value: "new", label: tr("chat.prompt.exploreSubtabNew") },
          { value: "system", label: tr("chat.prompt.exploreSubtabSystem") },
        ]}
      />

      {exploreSubTab === "system" ? (
        <div className={styles.promptMenuList}>
          {filteredSystemPrompts.map(renderSystemPromptItem)}
        </div>
      ) : renderApiPromptList(tr("chat.prompt.empty"))}
    </>
  );

  return (
    <div className={styles.promptMenuOverlay} onScroll={handlePromptMenuScroll}>
      <PillTabs
        className={styles.promptTabs}
        size="sm"
        value={activeTab}
        onChange={(value) => handleTabChange(value as TabId)}
        options={[
          ...(user ? [{ value: "mine", label: tr("chat.prompt.tabMine") }] : []),
          { value: "explore", label: tr("chat.prompt.tabExplore") },
        ]}
      />

      {renderSearchInput()}

      {activeTab === "mine" && renderMineContent()}
      {activeTab === "explore" && renderExploreContent()}

      {dialogMode === "create" && (
        <ChatPromptDialog
          mode="create"
          onSubmit={handleCreate}
          onClose={closeDialog}
        />
      )}

      {dialogMode === "edit" && editingPrompt && (
        <ChatPromptDialog
          mode="edit"
          initial={editingPrompt}
          onSubmit={handleEdit}
          onClose={closeDialog}
        />
      )}

      {dialogMode === "fork" && forkingPrompt && (
        <ChatPromptDialog
          mode="fork"
          forkedFrom={forkingPrompt}
          onSubmit={handleFork}
          onClose={closeDialog}
        />
      )}

      {dialogMode === "view" && viewingPrompt && (
        <ChatPromptDialog
          mode="view"
          initial={viewingPrompt}
          onClose={closeDialog}
        />
      )}
    </div>
  );
}
