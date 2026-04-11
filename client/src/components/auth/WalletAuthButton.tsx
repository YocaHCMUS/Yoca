import client from "@/api/main";
import { WalletActionButton } from "./WalletActionButton";

type WalletAuthButtonProps = {
  disabled: boolean;
  onSuccess: (userId: string) => void;
  onError: (error: string) => void;
};

export function WalletAuthButton({
  disabled,
  onSuccess,
  onError,
}: WalletAuthButtonProps) {
  return (
    <WalletActionButton<string>
      disabled={disabled}
      onError={onError}
      onSuccess={onSuccess}
      action={async ({ publicKey, signMessage, closeModal, onSuccess: resolveSuccess, onError: resolveError }) => {
        const nonceRes = await client.api.users.auth.solana.nounce.$post({
          json: {
            pubKey: publicKey,
          },
        });

        if (nonceRes.ok) {
          const { signMessage: message } = await nonceRes.json();
          const signMessageBytes = new TextEncoder().encode(message);
          const signatureBytes = await signMessage(signMessageBytes);
          const signatureBase64 = Buffer.from(signatureBytes).toString("base64");

          const resp = await client.api.users.auth.solana.verify.$post({
            json: {
              pubKey: publicKey,
              signature: signatureBase64,
            },
          });

          if (resp.ok) {
            const res = await resp.json();
            closeModal();
            resolveSuccess(res.userId);
          } else {
            resolveError("Wallet verification failed");
          }
        } else {
          resolveError("Wallet nonce request failed");
        }
      }}
      style={{
        inlineSize: "100%",
        maxInlineSize: "100%",
      }}
    />
  );
}
