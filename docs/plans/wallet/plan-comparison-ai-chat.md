# Comparison Page — AI Chat + RightSidebar

Status: **Implemented** (Jun 2026)

## Goal

Add AI chat capability to the wallet comparison page, plus integrate the wallet page's RightSidebar (watchlist/labels) — without the AI chat toggle button since chat is built directly into the comparison sidebar.

## Approach

**Option A** — Single-wallet chat with wallet selector dropdown. Reuses existing `WalletChat` component and backend `/api/chat` endpoint (no backend changes). The user picks which wallet the AI chats about via a dropdown.

## Layout Change

Carbon `<Grid>` replaced with flex layout matching the wallet page pattern:

```
.pageLayout (flex row, height: calc(100vh - 3.5rem))
├── .leftSidebar (340px, border-right)
│   ├── .walletSection (flex: 1, overflow-y: auto)
│   │   └── WalletComparisonSidebar (search + list + export)
│   ├── .chatToggleBtn (AI Chat — shown when chat closed)
│   └── .chatSection (flex: 1 — shown when chat open)
│       ├── .chatHeader (title + wallet selector + close)
│       └── .chatBody → WalletChat (variant="sidebar", position="left")
├── .mainContent (flex: 1, overflow-y: auto)
│   └── WalletComparisonMainContent (3 tabs)
└── RightSidebar (noChatToggle={true})
```

## Files Changed

| File | Change |
|---|---|
| `pages/wallet/RightSidebar.tsx` | Added `noChatToggle` prop — hides the AI Generate button in toolbar |
| `pages/walletsComparison/index.tsx` | Flex layout, `isChatOpen`/`chatWalletAddress` state, `WalletChat` + `RightSidebar` integration |
| `pages/walletsComparison/index.module.scss` | Flex layout classes (`.pageLayout`, `.leftSidebar`, `.mainContent`, `.chatSection`, etc.) |
| `config/localization/en.ts` | Added `walletComparison.aiChat: "AI Chat"` |
| `config/localization/vi.ts` | Added `walletComparison.aiChat: "AI Chat"` |

## UX Flow

1. Page loads with left sidebar (wallet search + tagged wallets list + export button)
2. Bottom of sidebar: "AI Chat" button with `AiGenerate` icon
3. Click → chat panel slides open within sidebar
4. Header shows wallet selector dropdown if multiple wallets selected
5. Chat works identically to single-wallet page
6. RightSidebar on the right edge shows watchlist/labels (no AI toggle)

## Verification

- Typecheck: `npm run typecheck` — passes clean
- Lint: `npm run lint` — no new errors
