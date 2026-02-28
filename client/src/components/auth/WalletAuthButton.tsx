import client from "@/api/main";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useSolanaContext } from "@/contexts/SolanaWalletContext";
import { Button } from "@carbon/react";
import { Wallet } from "@carbon/react/icons";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useRef, useState } from "react";

type WalletAuthButtonProps = {
  disabled: boolean;
  onSuccess: () => void;
  onError: (error: string) => void;
};

export function WalletAuthButton({
  disabled,
  onSuccess,
  onError,
}: WalletAuthButtonProps) {
  const { tr, fmt } = useLocalization();
  const { publicKey, signMessage, connected, connecting, wallet } = useWallet();
  const { isModalOpen, openModal, closeModal } = useSolanaContext();
  const walletConnectBtnRef = useRef<HTMLDivElement>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const triggerWalletMultiBtn = () => {
    const container = walletConnectBtnRef.current;
    if (!container) {
      return;
    }

    const btn = container.querySelector("button");
    if (btn instanceof HTMLElement) {
      btn.click();
    }
  };

  async function verifyWallet() {
    if (!publicKey || !signMessage) {
      return;
    }
    setIsVerifying(true);
    try {
      const nonceRes = await client.api.users.auth.solana.nounce.$post({
        json: {
          pubKey: publicKey.toBase58(),
        },
      });

      if (nonceRes.ok) {
        const { signMessage: message } = await nonceRes.json();
        const signMessageBytes = new TextEncoder().encode(message);
        const signatureBytes = await signMessage(signMessageBytes);
        const signatureBase64 = Buffer.from(signatureBytes).toString("base64");

        const resp = await client.api.users.auth.solana.verify.$post({
          json: {
            pubKey: publicKey.toBase58(),
            signature: signatureBase64,
          },
        });

        if (resp.ok) {
          closeModal();
          onSuccess();
        } else {
          onError(tr("ERROR.WALLET_VERIFICATION_FAILED"));
        }
      } else {
        onError(tr("ERROR.WALLET_NONCE_FAILED"));
      }
    } catch (err) {
      console.error("Wallet verification error:", err);
      onError(tr("ERROR.WALLET_VERIFICATION_FAILED"));
    } finally {
      setIsVerifying(false);
    }
  }

  async function onBtnClick() {
    if (!connected) {
      triggerWalletMultiBtn();
      openModal();
    }
    await verifyWallet();
  }

  return (
    <>
      <Button
        kind="tertiary"
        renderIcon={Wallet}
        disabled={disabled || isModalOpen || connecting || isVerifying}
        onClick={() => {
          onBtnClick();
        }}
        style={{
          inlineSize: "100%",
          maxInlineSize: "100%",
        }}
      >
        {wallet
          ? connected
            ? tr("auth.continueWithConnectedWallet", {
                connectedWalletAddress: publicKey?.toString() || "",
                connectedWalletName: wallet.adapter.name,
              })
            : connecting
              ? tr("auth.connectingWithWallet")
              : tr("auth.continueWithSelectedWallet", {
                  walletName: wallet.adapter.name,
                })
          : tr("auth.continueWithWallet")}
      </Button>

      <div ref={walletConnectBtnRef}>
        <WalletMultiButton style={{ display: "none" }} />
      </div>
    </>
  );
}
