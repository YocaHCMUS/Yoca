import client from "@/api/main";
import type { ApiErrCode } from "@/api/main";
import { useLocalization } from "@/contexts/LocalizationContext";
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
  const { tr } = useLocalization();

  const getWalletAuthErrorMessage = (errorCode: ApiErrCode) => {
    switch (errorCode) {
      case "WALLET_ALREADY_LINKED":
        return tr("ERROR.WALLET_ALREADY_LINKED");
      case "WALLET_NONCE_FAILED":
        return tr("ERROR.WALLET_NONCE_FAILED");
      case "WALLET_VERIFICATION_FAILED":
        return tr("ERROR.WALLET_VERIFICATION_FAILED");
      case "VALIDATION_ERR":
        return tr("ERROR.VALIDATION_ERR");
      case "INTERNAL_SERVER_ERR":
      default:
        return tr("ERROR.INTERNAL_SERVER_ERR");
    }
  };

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
          const { signMessage: message } = (await nonceRes.json()) as {
            signMessage: string;
          };
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
            const res = (await resp.json()) as { errorCode?: ApiErrCode };
            const errCode =
              res.errorCode ?? ("WALLET_VERIFICATION_FAILED" as ApiErrCode);
            resolveError(getWalletAuthErrorMessage(errCode));
          }
        } else {
          const res = (await nonceRes.json()) as { errorCode?: ApiErrCode };
          const errCode =
            res.errorCode ?? ("WALLET_NONCE_FAILED" as ApiErrCode);
          resolveError(getWalletAuthErrorMessage(errCode));
        }
      }}
      style={{
        inlineSize: "100%",
        maxInlineSize: "100%",
      }}
    />
  );
}
