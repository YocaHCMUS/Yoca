import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ComponentProps, ContextType } from "react";
import { QuickAiPopup } from "./QuickAiPopup";
import { ChatContext } from "../WalletChat/ChatContext";
import type { ChatMessageItem, PredefinedQuestion } from "../WalletChat/types";

const mockPost = vi.hoisted(() => vi.fn());

vi.mock("@/api/main", () => ({
  default: {
    api: {
      chat: {
        index: {
          $post: mockPost,
        },
      },
    },
  },
}));

vi.mock("@/contexts/LocalizationContext", () => ({
  useLocalization: () => ({
    tr: (key: string) => {
      const map: Record<string, string> = {
        "chat.signInRequired": "Sign in Required",
        "chat.inputPlaceholder": "Ask about this wallet...",
        "chat.greetingPrompt": "Try asking me:",
        "chat.loadingLabel": "Analyzing...",
        "chat.prompt.overview.label": "Overview",
        "chat.prompt.overview.query": "Give a portfolio overview",
        "chat.prompt.trades.label": "Recent Trades",
        "chat.prompt.trades.query": "Show recent trades",
      };
      return map[key] ?? key;
    },
  }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "test-user" }, isUserLoading: false }),
}));

vi.mock("../WalletChat/WalletChatMessage", () => ({
  WalletChatMessage: ({ message }: { message: { role: string; content: string } }) => (
    <div data-testid={`msg-${message.role}`}>{message.content}</div>
  ),
}));

const mockQuestions: PredefinedQuestion[] = [
  { id: "overview", label: "Overview", labelKey: "chat.prompt.overview.label", query: "Give a portfolio overview", queryKey: "chat.prompt.overview.query", contextTypes: ["wallet"] },
  { id: "trades", label: "Recent Trades", labelKey: "chat.prompt.trades.label", query: "Show recent trades", queryKey: "chat.prompt.trades.query", contextTypes: ["wallet"] },
];

const defaultRect = new DOMRect(100, 200, 32, 32);

function createAnchor(rect = defaultRect): HTMLElement {
  const anchor = document.createElement("button");
  anchor.getBoundingClientRect = () => rect;
  return anchor;
}

function renderPopup(overrides?: Partial<ComponentProps<typeof QuickAiPopup>>) {
  const injectQuickMessages = vi.fn();
  const onClose = vi.fn();
  const onOpenChat = vi.fn();

  const anchorElement = overrides?.anchorElement ?? createAnchor();
  const chatContextValue = {
    injectQuickMessages,
  } as unknown as NonNullable<ContextType<typeof ChatContext>>;
  const renderResult = render(
    <ChatContext.Provider value={chatContextValue}>
      <QuickAiPopup
        open={true}
        onClose={onClose}
        anchorElement={anchorElement}
        addresses={["test-addr"]}
        contextType="wallet"
        lang="en"
        componentLabel="Overview"
        predefinedQuestions={mockQuestions}
        onOpenChat={onOpenChat}
        {...overrides}
      />
    </ChatContext.Provider>,
  );

  return { injectQuickMessages, onClose, onOpenChat, renderResult };
}

describe("QuickAiPopup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 768 });
  });

  it("renders nothing when closed", () => {
    const { renderResult: { container } } = renderPopup({ open: false });
    expect(container.innerHTML).toBe("");
  });

  it("shows predefined questions in prompt mode", () => {
    renderPopup();
    expect(screen.getByText("Try asking me:")).toBeTruthy();
    expect(screen.getAllByText("Overview").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Recent Trades")).toBeTruthy();
  });

  it("sends query on predefined question click", async () => {
    mockPost.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ text: "Portfolio analysis result" }),
    });

    renderPopup();
    fireEvent.click(screen.getByText("Overview"));

    await waitFor(() => {
      expect(screen.getByText("Portfolio analysis result")).toBeTruthy();
    });

    expect(mockPost).toHaveBeenCalledWith({
      json: expect.objectContaining({
        query: "Give a portfolio overview",
        skipSessionSave: true,
        skipCache: true,
      }),
    });
  });

  it("shows Continue in Chat button after response and calls inject + callbacks", async () => {
    mockPost.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ text: "Analysis done" }),
    });

    const { injectQuickMessages, onClose, onOpenChat } = renderPopup();

    fireEvent.click(screen.getByText("Overview"));
    await waitFor(() => {
      expect(screen.getByText("Analysis done")).toBeTruthy();
    });

    const continueBtn = screen.getByText("Continue in Chat");
    expect(continueBtn).toBeTruthy();

    fireEvent.click(continueBtn);

    expect(injectQuickMessages).toHaveBeenCalledTimes(1);
    const injected = injectQuickMessages.mock.calls[0][0] as ChatMessageItem[];
    expect(injected).toHaveLength(2);
    expect(injected[0].role).toBe("user");
    expect(injected[1].role).toBe("assistant");
    expect(injected[1].content).toBe("Analysis done");
    expect(injected[0].content).toBe("Give a portfolio overview");
    expect(injected[0].context).toEqual({ contextType: "wallet", walletAddresses: ["test-addr"] });
    expect(injected[1].context).toEqual({ contextType: "wallet", walletAddresses: ["test-addr"] });

    expect(onOpenChat).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("clamps popup position within the viewport", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 320 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 260 });

    const anchorElement = createAnchor(new DOMRect(300, 230, 24, 24));
    renderPopup({ anchorElement });

    const header = screen.getByText((content) => content.includes("AI") && content.includes("Overview"));
    const popup = header.closest("div")?.parentElement as HTMLElement;
    expect(popup.style.visibility).toBe("visible");
    expect(Number(popup.style.left.replace("px", ""))).toBeGreaterThanOrEqual(8);
    expect(Number(popup.style.top.replace("px", ""))).toBeGreaterThanOrEqual(8);
  });

});
