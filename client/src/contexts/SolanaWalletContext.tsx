import { ModalStateManager } from "@/components/ModelStateManager";
import { ComposedModal, ModalBody } from "@carbon/react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import {
  WalletModalProvider,
  useWalletModal,
} from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";
import { getWalletAdapterNetwork } from "@/util/solanaNetwork";
import {
  type FC,
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import styles from "./WallerModal.module.scss";

interface SolanaProviderProps {
  children: ReactNode;
}

interface SolanaContextType {
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
}

const SolanaContext = createContext<SolanaContextType | undefined>(undefined);

export const useSolanaContext = () => {
  const context = useContext(SolanaContext);
  if (!context) {
    throw new Error("useSolanaContext must be used within SolanaProvider");
  }
  return context;
};

function SolanaProviderContent({ children }: { children: ReactNode }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { visible: walletModalVisible, setVisible: setWalletModalVisibility } =
    useWalletModal();

  useEffect(() => {
    if (!walletModalVisible) {
      setIsModalOpen(false);
    }
  }, [walletModalVisible]);

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => {
    setIsModalOpen(false);
    setWalletModalVisibility(false);
  };

  const contextValue = useMemo(
    () => ({
      isModalOpen,
      openModal,
      closeModal,
    }),
    [isModalOpen],
  );

  return (
    <SolanaContext.Provider value={contextValue}>
      {children}
      <ModalStateManager renderLauncher={() => <></>}>
        {() => (
          <ComposedModal
            open={isModalOpen}
            onClose={closeModal}
            className={styles.walletModalContainer}
          >
            <ModalBody
              id="wallet-modal-container"
              style={{ height: "100vh" }}
            />
          </ComposedModal>
        )}
      </ModalStateManager>
    </SolanaContext.Provider>
  );
}

export const SolanaProvider: FC<SolanaProviderProps> = ({ children }) => {
  /**
   * Derive the network from VITE_SOLANA_NETWORK with strict validation.
   * Falls back to Devnet if the env is misconfigured so the UI can still
   * mount and display the error through its own toast/alert system.
   */
  const network = useMemo((): WalletAdapterNetwork => {
    try {
      return getWalletAdapterNetwork();
    } catch (err) {
      console.error(
        "[SolanaProvider] Network configuration error — falling back to Devnet:\n",
        (err as Error).message
      );
      return WalletAdapterNetwork.Devnet;
    }
  }, []);
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);

  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    [],
  );

  localStorage.removeItem("walletName");

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider container="#wallet-modal-container">
          <SolanaProviderContent>{children}</SolanaProviderContent>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
