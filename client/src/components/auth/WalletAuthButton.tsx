import client from "@/api/main";
import { useLocalization } from "@/contexts/LocalizationContext";
import { Button, ComposedModal, ModalBody } from "@carbon/react";
import { Wallet } from "@carbon/react/icons";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  useWalletModal,
  WalletMultiButton,
} from "@solana/wallet-adapter-react-ui";
import { useEffect, useRef } from "react";
import { ModalStateManager } from "../ModelStateManager";
import styles from "./WalletAuthButton.module.scss";

type WalletAuthButtonProps = {
  disabled: boolean;
  onSuccess: () => void;
  onError: (error: string) => void;
};

type WalletContentProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  walletModalVisible: boolean;
  setWalletModalVisibility: (visible: boolean) => void;
};

function WalletModalContent({
  open,
  setOpen,
  walletModalVisible,
  setWalletModalVisibility,
}: WalletContentProps) {
  useEffect(() => {
    if (!walletModalVisible) {
      setOpen(false);
    }
  }, [walletModalVisible, setOpen]);

  return (
    <ComposedModal
      open={open}
      onClose={() => {
        setOpen(false);
        setWalletModalVisibility(false);
      }}
      className={styles.walletModalContainer}
    >
      <ModalBody id="wallet-modal-container" style={{ height: "100vh" }} />
    </ComposedModal>
  );
}

export function WalletAuthButton({
  disabled,
  onSuccess,
  onError,
}: WalletAuthButtonProps) {
  const { tr, fmt } = useLocalization();
  const { publicKey, signMessage, connected, connecting, wallet } = useWallet();
  const { visible: walletModalVisible, setVisible: setWalletModalVisibility } =
    useWalletModal();
  const walletConnectBtnRef = useRef<HTMLDivElement>(null);

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
          onSuccess();
        } else {
          onError("Verification failed");
        }
      } else {
        onError("Failed to get nonce");
      }
    } catch (err) {
      console.error("Wallet verification error:", err);
      onError(err instanceof Error ? err.message : "Unknown error");
    }
  }

  async function onBtnClick() {
    if (!connected) {
      triggerWalletMultiBtn();
    }
    await verifyWallet();
  }

  return (
    <>
      <ModalStateManager
        renderLauncher={({ open, setOpen }) => (
          <Button
            kind="tertiary"
            renderIcon={Wallet}
            disabled={disabled || open || connecting}
            onClick={() => {
              onBtnClick();
              setOpen(true);
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
        )}
      >
        {({ open, setOpen }) => (
          <WalletModalContent
            open={open}
            setOpen={setOpen}
            walletModalVisible={walletModalVisible}
            setWalletModalVisibility={setWalletModalVisibility}
          />
        )}
      </ModalStateManager>

      <div ref={walletConnectBtnRef}>
        <WalletMultiButton style={{ display: "none" }} />
      </div>
    </>
  );
}
