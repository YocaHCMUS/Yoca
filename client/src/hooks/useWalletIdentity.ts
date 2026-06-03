import { getWalletLabel } from "@/components/profile/shared/walletLabels";
import { useWalletLabels } from "@/hooks/profile/useWalletLabels";
import { useEffect, useMemo, useState } from "react";

const KNOWN_WALLET_LABELS: Record<string, string> = {};

function truncateAddress(address: string): string {
  if (!address || address.length <= 12) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

async function resolveSOLDomain(address: string): Promise<string | null> {
  void address;
  return null;
}

export function useWalletIdentity(address: string): {
  label: string;
  isSolDomain: boolean;
  isLoading: boolean;
} {
  const { labels, isLoading: labelsLoading } = useWalletLabels();
  const [solDomain, setSolDomain] = useState<string | null>(null);
  const [solLoading, setSolLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      if (!address) {
        setSolDomain(null);
        return;
      }

      setSolLoading(true);
      try {
        const domain = await resolveSOLDomain(address);
        if (!cancelled) {
          setSolDomain(domain);
        }
      } finally {
        if (!cancelled) {
          setSolLoading(false);
        }
      }
    }

    resolve();

    return () => {
      cancelled = true;
    };
  }, [address]);

  const fallback = useMemo(() => truncateAddress(address), [address]);

  const label = useMemo(() => {
    if (solDomain) return solDomain;

    const savedLabel =
      getWalletLabel(labels, address) ??
      labels[address] ??
      labels[address.toLowerCase()];
    if (savedLabel) return savedLabel;

    return KNOWN_WALLET_LABELS[address] ?? fallback;
  }, [address, fallback, labels, solDomain]);

  return {
    label,
    isSolDomain: Boolean(solDomain),
    isLoading: solLoading || labelsLoading,
  };
}
