import { useLocalization } from "@/contexts/LocalizationContext";
import { useSolanaContext } from "@/contexts/SolanaWalletContext";
import { Button, type ButtonBaseProps } from "@carbon/react";
import { Wallet } from "@carbon/react/icons";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useEffect, useRef, useState } from "react";

interface WalletActionPayload<TResult> {
  publicKey: string;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
  closeModal: () => void;
  walletName: string;
  onSuccess: (result: TResult) => void;
  onError: (error: string) => void;
}

type WalletActionButtonProps<TResult> = {
  disabled?: boolean;
  onError: (error: string) => void;
  onSuccess: (result: TResult) => void;
  action: (payload: WalletActionPayload<TResult>) => Promise<void>;
  label?: string;
  kind?: ButtonBaseProps["kind"];
  renderIcon?: ButtonBaseProps["renderIcon"];
  className?: string;
  style?: React.CSSProperties;
};

export function WalletActionButton<TResult>({
  disabled = false,
  onError,
  onSuccess,
  action,
  label,
  kind = "tertiary",
  renderIcon = Wallet,
  className,
  style,
}: WalletActionButtonProps<TResult>) {
  const { tr } = useLocalization();
  const { publicKey, signMessage, connected, connecting, wallet } = useWallet();
  const { isModalOpen, openModal, closeModal } = useSolanaContext();
  const walletConnectBtnRef = useRef<HTMLDivElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (connected && isModalOpen) {
      closeModal();
    }
  }, [connected, isModalOpen, closeModal]);

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

  async function onBtnClick() {
    if (!connected) {
      triggerWalletMultiBtn();
      console.log("model opened: ", isModalOpen);
      openModal();
      return;
    }

    if (!publicKey || !signMessage || !wallet) {
      onError(tr("ERROR.WALLET_VERIFICATION_FAILED"));
      return;
    }

    setIsProcessing(true);
    try {
      await action({
        publicKey: publicKey.toBase58(),
        signMessage,
        closeModal,
        walletName: wallet.adapter.name,
        onSuccess,
        onError,
      });
    } catch (error) {
      console.error("[WalletActionButton] action failed", error);
      onError(tr("ERROR.WALLET_VERIFICATION_FAILED"));
    } finally {
      setIsProcessing(false);
    }
  }

  const buttonLabel =
    label ??
    (wallet
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
      : tr("auth.continueWithWallet"));

  return (
    <>
      <Button
        kind={kind}
        renderIcon={renderIcon}
        disabled={disabled || isModalOpen || connecting || isProcessing}
        onClick={onBtnClick}
        className={className}
        style={style}
      >
        {buttonLabel}
      </Button>

      <div ref={walletConnectBtnRef}>
        <WalletMultiButton style={{ display: "none" }} />
      </div>
    </>
  );
}

export default WalletActionButton;
