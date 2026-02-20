import client from "@/api/main";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useEffect, useState } from "react";
import { SolanaProvider } from "./SolanaProvider";

function WalletAuth() {
  const { publicKey, signMessage, connected } = useWallet();
  const [status, setStatus] = useState("");

  useEffect(() => {
    const verifyWallet = async () => {
      if (connected && publicKey && signMessage) {
        const nounceResq = await client.api.users.auth.solana.nounce.$post({
          json: {
            pubKey: publicKey.toBase58(),
          },
        });

        if (nounceResq.ok) {
          const { signMessage: message } = await nounceResq.json();
          const signMessageBytes = new TextEncoder().encode(message);
          const signatureBytes = await signMessage(signMessageBytes);
          const signatureBase64 =
            Buffer.from(signatureBytes).toString("base64");

          const resp = await client.api.users.auth.solana.verify.$post({
            json: {
              pubKey: publicKey.toBase58(),
              signature: signatureBase64,
            },
          });
          if (resp.ok) {
            setStatus("Verified successfully");
          } else {
            setStatus("Verification failed");
          }
        } else {
          console.error("Failed to get nounce");
          setStatus("Faild to get nounce");
        }
      }
    };
    verifyWallet();
  }, [connected, publicKey, signMessage]);

  return (
    <div>
      <WalletMultiButton />
      <div style={{ display: "none" }}>{status}</div>
    </div>
  );
}

export function WalletAuthenButton() {
  return (
    <SolanaProvider>
      <WalletAuth />
    </SolanaProvider>
  );
}
