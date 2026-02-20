import client from "@/api/main";
import { Button, ComposedModal, ModalBody } from "@carbon/react";
import { Wallet } from "@carbon/react/icons";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  useWalletModal,
  WalletMultiButton,
} from "@solana/wallet-adapter-react-ui";
import { useEffect, useRef, useState } from "react";
import { ModalStateManager } from "../ModelStateManager";
import styles from "./WalletAuthButton.module.scss";

type WalletAuthButtonProps = {
  onSuccess: () => void;
  onError: (error: Error) => void;
};

function WalletAuth({ onSuccess, onError }: WalletAuthButtonProps) {
  const { publicKey, signMessage, connected, connecting, wallet } = useWallet();
  const { visible: walletModalVisible, setVisible: setWalletModalVisibility } =
    useWalletModal();
  const walletConnectBtnRef = useRef<HTMLDivElement>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const hasVerifiedRef = useRef(false);

  const triggerWalletModal = () => {
    const container = walletConnectBtnRef.current;
    if (!container) return;

    const btn = container.querySelector("button");
    if (btn instanceof HTMLElement) {
      btn.click();
    }
  };

  useEffect(() => {
    if (!connected || !publicKey || !signMessage) return;
    if (hasVerifiedRef.current) return;

    const verify = async () => {
      setIsVerifying(true);
      hasVerifiedRef.current = true;

      try {
        const pubKey = publicKey.toBase58();

        const nonceRes = await client.api.users.auth.solana.nounce.$post({
          json: { pubKey: pubKey },
        });

        if (!nonceRes.ok) {
          throw new Error("Failed to retrieve nonce");
        }

        const { signMessage: message } = await nonceRes.json();
        const messageBytes = new TextEncoder().encode(message);
        const signatureBytes = await signMessage(messageBytes);
        const signatureBase64 = Buffer.from(signatureBytes).toString("base64");

        const verifyRes = await client.api.users.auth.solana.verify.$post({
          json: {
            pubKey: pubKey,
            signature: signatureBase64,
          },
        });

        if (!verifyRes.ok) {
          throw new Error("Wallet verification failed");
        }

        onSuccess();
      } catch (err) {
        onError(
          err instanceof Error ? err : new Error("Unknown verification error"),
        );
      } finally {
        setIsVerifying(false);
      }
    };

    verify();
  }, [connected, publicKey, signMessage, onSuccess, onError]);

  return (
    <>
      <ModalStateManager
        renderLauncher={({ open, setOpen }) => (
          <Button
            kind="tertiary"
            renderIcon={Wallet}
            disabled={open || connecting || isVerifying}
            onClick={() => {
              triggerWalletModal();
              setOpen(true);
            }}
            style={{
              inlineSize: "100%",
              maxInlineSize: "100%",
            }}
          >
            {connected && wallet
              ? wallet.adapter.name
              : connecting
                ? "Connecting..."
                : "Continue with an existing wallet"}
          </Button>
        )}
      >
        {({ open, setOpen }) => {
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
              <ModalBody
                id="wallet-modal-container"
                style={{ height: "100vh" }}
              />
            </ComposedModal>
          );
        }}
      </ModalStateManager>

      <div ref={walletConnectBtnRef} style={{ display: "none" }}>
        <WalletMultiButton />
      </div>
    </>
  );
}

export function WalletAuthenButton({
  onSuccess,
  onError,
}: WalletAuthButtonProps) {
  return <WalletAuth onSuccess={onSuccess} onError={onError} />;
}
