import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { Header } from "../../components/navigation";
import Tble from "../../components/Tble.tsx";
import { formatNumber } from "../../util/format.ts";
import { useTranslation } from "react-i18next";
import PageWrapper from "@/components/wrapper/PageWrapper.tsx";
import WalletOverview from "@/components/wallet/WalletOverview/WalletOverview.tsx";

export default function WalletPage() {
  const { t } = useTranslation();
  const { address } = useParams<{ address: string }>();
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch(`/api/v0/balances/${address}`);
        const data = await response.json();
        const balances = data.map(
          (
            balance: { symbol: string; balance: string; valueUsd: string },
            index: number,
          ) => ({
            id: index,
            token: balance.symbol,
            balance: formatNumber(Number(balance.balance)),
            valueUsd: formatNumber(Number(balance.valueUsd)),
          }),
        );

        setTransfers(balances);
      } catch (error) {
        console.error("Failed to fetch transfers:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [address]);

  if (!address) {
    return (
      <PageWrapper>
        <div>Address not found</div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <WalletOverview walletAddress={address}/>
      {/* <main style={{ padding: "2rem", maxWidth: "1584px", margin: "0 auto" }}>
        <h1 style={{ marginBottom: "1.5rem" }}>{t("nav.wallet", "Wallet")}</h1>
        <Tble loading={loading} rows={transfers} headers={headers} />
      </main> */}
    </PageWrapper>
  );
}
