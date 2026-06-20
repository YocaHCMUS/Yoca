import { useCallback, useEffect, useMemo, useState } from "react";
import { useChatPrompts, type ChatPromptData, type CreatePromptInput, type UpdatePromptInput } from "./useChatPrompts";
import { PREDEFINED_QUESTIONS } from "./WalletChatConstants";
import { ChatPromptDialog } from "./ChatPromptDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useLocalization } from "@/contexts/LocalizationContext";
import styles from "./WalletChat.module.scss";

type TabId = "mine" | "explore";
type ExploreSubTab = "community" | "system";

interface Props {
  walletAddress?: string;
  onSelect: (query: string, promptId?: string) => void;
  onClose: () => void;
}

export function ChatPromptMenu({ walletAddress, onSelect, onClose }: Props) {
  const { tr } = useLocalization();
  const { user } = useAuth();
  const {
    prompts,
    total,
    isLoading,
    error,
    fetchPrompts,
    createPrompt,
    updatePrompt,
    deletePrompt,
    forkPrompt,
  } = useChatPrompts();

  const [activeTab, setActiveTab] = useState<TabId>(user ? "mine" : "explore");
  const [exploreSubTab, setExploreSubTab] = useState<ExploreSubTab>("community");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAllPopular, setShowAllPopular] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | "fork" | "view" | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<ChatPromptData | null>(null);
  const [forkingPrompt, setForkingPrompt] = useState<ChatPromptData | null>(null);
  const [viewingPrompt, setViewingPrompt] = useState<ChatPromptData | null>(null);

  useEffect(() => {
    if (activeTab === "mine") {
      fetchPrompts({ scope: "mine", sort: "recent", walletAddress });
    } else if (activeTab === "explore" && exploreSubTab === "community") {
      fetchPrompts({ scope: "popular", sort: "usage", limit: showAllPopular ? 50 : 5, walletAddress });
    }
  }, [activeTab, exploreSubTab, showAllPopular, walletAddress, fetchPrompts]);

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    setSearchQuery("");
    setShowAllPopular(false);
  };

  const handleExploreSubTabChange = (sub: ExploreSubTab) => {
    setExploreSubTab(sub);
    setSearchQuery("");
    setShowAllPopular(false);
  };

  const handleSelectPrompt = useCallback((query: string, promptId?: string) => {
    onSelect(query, promptId);
    onClose();
  }, [onSelect, onClose]);

  const resolveLabel = (q: typeof PREDEFINED_QUESTIONS[number]): string => {
    return q.labelKey ? tr(q.labelKey as "chat.prompt.overview.label") : q.label;
  };

  const resolveQuery = (q: typeof PREDEFINED_QUESTIONS[number]): string => {
    return q.queryKey ? tr(q.queryKey as "chat.prompt.overview.query") : q.query;
  };

  const filterText = searchQuery.toLowerCase().trim();

  const filteredSystemPrompts = useMemo(() => {
    if (!filterText) return PREDEFINED_QUESTIONS;
    return PREDEFINED_QUESTIONS.filter((q) => {
      const label = resolveLabel(q).toLowerCase();
      const query = resolveQuery(q).toLowerCase();
      return label.includes(filterText) || query.includes(filterText);
    });
  }, [filterText]);

  const filteredApiPrompts = useMemo(() => {
    if (!filterText) return prompts;
    return prompts.filter((p) => {
      const label = p.label.toLowerCase();
      const query = p.query.toLowerCase();
      return label.includes(filterText) || query.includes(filterText);
    });
  }, [filterText, prompts]);

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

  const renderTab = (tab: TabId, label: string) => (
    <button
      className={`${styles.promptTab} ${activeTab === tab ? styles.promptTabActive : ""}`}
      onClick={() => handleTabChange(tab)}
    >
      {label}
    </button>
  );

  const renderPillTab = (sub: ExploreSubTab, label: string) => (
    <button
      className={`${styles.promptPillTab} ${exploreSubTab === sub ? styles.promptPillTabActive : ""}`}
      onClick={() => handleExploreSubTabChange(sub)}
    >
      {label}
    </button>
  );

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
    <input
      className={styles.promptSearchInput}
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      placeholder={tr("chat.prompt.searchPlaceholder")}
    />
  );

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

      {renderSearchInput()}

      {isLoading && (
        <div className={styles.promptLoading}>{tr("chat.prompt.loading")}</div>
      )}

      {!isLoading && error && (
        <div className={styles.promptEmpty}>{error}</div>
      )}

      {!isLoading && !error && filteredApiPrompts.length === 0 && (
        <div className={styles.promptEmpty}>
          {tr("chat.prompt.emptyMine")}
        </div>
      )}

      {!isLoading && !error && filteredApiPrompts.length > 0 && (
        <div className={styles.promptMenuList}>
          {filteredApiPrompts.map(renderPromptItem)}
        </div>
      )}
    </>
  );

  const renderExploreContent = () => (
    <>
      <div className={styles.promptMenuHeader}>
        <div className={styles.promptMenuTitle}>{tr("chat.prompt.tabExplore")}</div>
      </div>

      {renderSearchInput()}

      <div className={styles.promptPillTabs}>
        {renderPillTab("community", tr("chat.prompt.exploreSubtabCommunity"))}
        {renderPillTab("system", tr("chat.prompt.exploreSubtabSystem"))}
      </div>

      {exploreSubTab === "community" && (
        <>
          {isLoading && (
            <div className={styles.promptLoading}>{tr("chat.prompt.loading")}</div>
          )}

          {!isLoading && error && (
            <div className={styles.promptEmpty}>{error}</div>
          )}

          {!isLoading && !error && filteredApiPrompts.length === 0 && (
            <div className={styles.promptEmpty}>{tr("chat.prompt.empty")}</div>
          )}

          {!isLoading && !error && filteredApiPrompts.length > 0 && (
            <div className={styles.promptMenuList}>
              {filteredApiPrompts.map(renderPromptItem)}
              {!showAllPopular && total > 5 && (
                <button
                  className={styles.promptLoadMoreBtn}
                  onClick={() => setShowAllPopular(true)}
                >
                  {tr("chat.prompt.loadMore", { count: total })}
                </button>
              )}
            </div>
          )}
        </>
      )}

      {exploreSubTab === "system" && (
        <div className={styles.promptMenuList}>
          {filteredSystemPrompts.map(renderSystemPromptItem)}
        </div>
      )}
    </>
  );

  return (
    <div className={styles.promptMenuOverlay}>
      <div className={styles.promptTabs}>
        {user && renderTab("mine", tr("chat.prompt.tabMine"))}
        {renderTab("explore", tr("chat.prompt.tabExplore"))}
      </div>

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
