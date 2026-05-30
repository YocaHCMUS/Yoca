const STORAGE_KEY = "yoca.profile.walletLabels";

type WalletLabelMap = Record<string, string>;

function normalizeAddress(address: string): string {
  return address.trim().toLowerCase();
}

export function loadWalletLabels(): WalletLabelMap {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as WalletLabelMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveWalletLabels(map: WalletLabelMap): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent("wallet-labels-updated"));
  } catch {
    // Ignore storage errors silently.
  }
}

export function getWalletLabel(map: WalletLabelMap, address: string): string | null {
  const key = normalizeAddress(address);
  return map[key] ?? null;
}

export function setWalletLabel(
  map: WalletLabelMap,
  address: string,
  label: string,
): WalletLabelMap {
  const next = { ...map };
  const key = normalizeAddress(address);
  const trimmed = label.trim();

  if (!trimmed) {
    delete next[key];
  } else {
    next[key] = trimmed;
  }

  saveWalletLabels(next);
  return next;
}

export type { WalletLabelMap };
