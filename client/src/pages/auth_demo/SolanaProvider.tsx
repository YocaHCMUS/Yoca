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
import {
  type FC,
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

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

const SolanaProviderContent: FC<{ children: ReactNode }> = ({ children }) => {
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
      <ComposedModal open={isModalOpen} onClose={closeModal}>
        <ModalBody id="wallet-modal-container" style={{ height: "100vh" }} />
      </ComposedModal>
    </SolanaContext.Provider>
  );
};

export const SolanaProvider: FC<SolanaProviderProps> = ({ children }) => {
  const network = WalletAdapterNetwork.Devnet;
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
