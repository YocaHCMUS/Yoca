import { useEffect, useState } from "react";
import { Header } from "../../components/navigation";
import Tble from "../../components/Tble.tsx";
import { formatNumber } from "../../util/format.ts";
import { useTranslation } from "react-i18next";

interface WalletProps {
    address : string
}

export default function WalletPage(props : WalletProps) {
  const { t } = useTranslation();
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const address = props.address;

  const headers = [
    {
      key: "token",
      header: "Token",
    },
    {
      key: "balance",
      header: "Balance",
    },
    {
      key: "valueUsd",
      header: "Value",
    },
  ];

  useEffect(() => {(async () => {
      try {
        const response = await fetch(`/api/v0/balances/${address}`);
        const data = await response.json();
        const balances = data.map((
          balance: { symbol: string; balance: string; valueUsd: string },
          index: number,
        ) => ({
          id: index,
          token: balance.symbol,
          balance: formatNumber(Number(balance.balance)),
          valueUsd: formatNumber(Number(balance.valueUsd)),
        }));

        setTransfers(balances);
      } catch (error) {
        console.error("Failed to fetch transfers:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [address]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--cds-background)" }}>
      <Header />
      <main style={{ padding: "2rem", maxWidth: "1584px", margin: "0 auto" }}>
        <h1 style={{ marginBottom: "1.5rem" }}>
          {t("nav.wallet", "Wallet")}
        </h1>
        <Tble loading={loading} rows={transfers} headers={headers} />
      </main>
    </div>
  );
}
