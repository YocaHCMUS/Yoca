import { useLocalization } from "@/contexts/LocalizationContext";
import { useSolanaContext } from "@/contexts/SolanaWalletContext";
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
    className?: string;
};

export function WalletActionButton<TResult>({
    disabled = false,
    onError,
    onSuccess,
    action,
    label,
    className,
}: WalletActionButtonProps<TResult>) {
    const { tr } = useLocalization();
    const { publicKey, signMessage, connected, connecting, wallet } = useWallet();
    const { isModalOpen, openModal, closeModal } = useSolanaContext();
    const walletConnectBtnRef = useRef<HTMLDivElement>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    
    // Thêm state ghi nhớ ý định Sign sau khi Connect
    const [pendingAuth, setPendingAuth] = useState(false);

    // Xử lý đóng modal khi connect thành công
    useEffect(() => {
        if (connected && isModalOpen) {
            closeModal();
        }
    }, [connected, isModalOpen, closeModal]);

    // TỰ ĐỘNG GỌI HÀM KÝ KHI VÍ CONNECT THÀNH CÔNG
    useEffect(() => {
        if (connected && pendingAuth && publicKey && signMessage && wallet) {
            setPendingAuth(false);
            executeAction();
        }
    }, [connected, pendingAuth, publicKey, signMessage, wallet]);

    const triggerWalletMultiBtn = () => {
        const container = walletConnectBtnRef.current;
        if (!container) return;

        const btn = container.querySelector("button");
        if (btn instanceof HTMLElement) {
            btn.click();
        }
    };

    // Tách logic Sign ra một hàm riêng để tái sử dụng
    const executeAction = async () => {
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
    };

    async function onBtnClick() {
        if (!connected) {
            setPendingAuth(true); // Đánh dấu là người dùng muốn Đăng nhập/Ký
            triggerWalletMultiBtn(); // Mở popup connect của ví
            openModal();
            return;
        }

        // Nếu đã connect sẵn rồi thì chạy thẳng xuống executeAction
        executeAction();
    }

    const defaultLabel = wallet ? wallet.adapter.name : "Wallet";
    const buttonLabel = label ?? (connecting ? tr("auth.connectingWithWallet") : defaultLabel);

    return (
        <>
            <button
                type="button"
                disabled={disabled || isModalOpen || connecting || isProcessing}
                onClick={onBtnClick}
                className={className}
            >
                <Wallet size={20} />
                <span>{buttonLabel}</span>
            </button>

            <div ref={walletConnectBtnRef} style={{ display: "none" }}>
                <WalletMultiButton />
            </div>
        </>
    );
}

export default WalletActionButton;
