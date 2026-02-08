/**
 * Wallet Service
 * Detects and connects wallets (MetaMask on Ethereum, Phantom on Solana, etc.)
 * For MetaMask, performs real `eth_requestAccounts` and delegates auth to backend.
 */

import type {
  WalletInfo,
  WalletType,
  BlockchainType,
  WalletConnection,
  AuthResponse,
} from '../../types/auth';

// API base URL (keep consistent with authService)
const API_URL = (() => {
  const domain = import.meta.env.CLIENT_API_DOMAIN as string | undefined;
  if (domain && domain.length > 0) {
    return `${domain.replace(/\/+$/, '')}/api`;
  }
  if (import.meta.env.DEV) {
    return '/api';
  }
  return 'http://localhost:4000/api';
})();

/**
 * Mock delay to simulate wallet operations (ms)
 */
const MOCK_DELAY = 800;

/**
 * Wallet metadata per chain
 */
const WALLET_CATALOG: Record<BlockchainType, WalletInfo[]> = {
  solana: [
    {
      name: 'Phantom',
      type: 'phantom',
      icon: '/icons/Phantom-Icon_Square.svg',
      detected: false,
      installUrl: 'https://phantom.app/',
      blockchain: ['solana'],
    },
    {
      name: 'Solflare',
      type: 'solflare',
      icon: '/icons/Solflare_id5j73wBTF_1.svg',
      detected: false,
      installUrl: 'https://solflare.com/',
      blockchain: ['solana'],
    },
    {
      name: 'Ledger',
      type: 'ledger',
      icon: '/icons/Ledger_idnDvP24qI_0.svg',
      detected: false,
      installUrl: 'https://www.ledger.com/',
      blockchain: ['solana', 'ethereum', 'bitcoin'],
    },
    {
      name: 'Trezor',
      type: 'trezor',
      icon: '/icons/Trezor_Logo_0.svg',
      detected: false,
      installUrl: 'https://trezor.io/',
      blockchain: ['solana', 'ethereum', 'bitcoin'],
    },
  ],
  ethereum: [
    {
      name: 'MetaMask',
      type: 'metamask',
      icon: '/icons/metamask.svg',
      detected: false,
      installUrl: 'https://metamask.io/download/',
      blockchain: ['ethereum'],
    },
    {
      name: 'Ledger',
      type: 'ledger',
      icon: '/icons/Ledger_idnDvP24qI_0.svg',
      detected: false,
      installUrl: 'https://www.ledger.com/',
      blockchain: ['solana', 'ethereum', 'bitcoin'],
    },
    {
      name: 'Trezor',
      type: 'trezor',
      icon: '/icons/Trezor_Logo_0.svg',
      detected: false,
      installUrl: 'https://trezor.io/',
      blockchain: ['solana', 'ethereum', 'bitcoin'],
    },
  ],
  bitcoin: [
    {
      name: 'Ledger',
      type: 'ledger',
      icon: '/icons/Ledger_idnDvP24qI_0.svg',
      detected: false,
      installUrl: 'https://www.ledger.com/',
      blockchain: ['solana', 'ethereum', 'bitcoin'],
    },
    {
      name: 'Trezor',
      type: 'trezor',
      icon: '/icons/Trezor_Logo_0.svg',
      detected: false,
      installUrl: 'https://trezor.io/',
      blockchain: ['solana', 'ethereum', 'bitcoin'],
    },
  ],
};

/**
 * Mock connected wallets database
 */
const connectedWallets: WalletConnection[] = [];

/**
 * Simulates API delay
 */
const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Detect installed wallets in the browser
 * @returns List of wallet info with detection status
 */
export const detectWallets = async (
  blockchain: BlockchainType = 'ethereum'
): Promise<WalletInfo[]> => {
  await delay(200);

  const catalog = WALLET_CATALOG[blockchain] || [];
  const isMetaMaskPresent = typeof window !== 'undefined' && (window as any).ethereum && (window as any).ethereum.isMetaMask;

  return catalog.map((wallet) => ({
    ...wallet,
    detected:
      wallet.type === 'metamask'
        ? Boolean(isMetaMaskPresent)
        : wallet.detected,
  }));
};

/**
 * Connect to a Solana wallet
 * @param walletType Type of wallet to connect
 * @param blockchain Blockchain network
 * @returns Authentication response with wallet connection data
 */
export const connectWallet = async (
  walletType: WalletType,
  blockchain: BlockchainType = 'ethereum'
): Promise<AuthResponse> => {
  // Only MetaMask for Ethereum in this implementation
  if (blockchain === 'ethereum' && walletType === 'metamask') {
    const wallets = await detectWallets('ethereum');
    const metamask = wallets.find((w) => w.type === 'metamask');
    if (!metamask || !metamask.detected) {
      return { success: false, error: 'Vui lòng cài đặt MetaMask' };
    }
    try {
      const accounts: string[] = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
      const address = accounts?.[0];
      if (!address) return { success: false, error: 'Không lấy được địa chỉ ví' };

      // Optional: request signature of a nonce here for stronger auth.

      const response = await fetch(`${API_URL}/users/wallet-auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, blockchain: 'ethereum', walletType: 'metamask' }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return { success: false, error: err.error || 'Xác thực ví thất bại' };
      }
      return await response.json();
    } catch (error: any) {
      if (error?.code === 4001) {
        return { success: false, error: 'Người dùng từ chối kết nối' };
      }
      return { success: false, error: 'Lỗi kết nối MetaMask' };
    }
  }

  // Fallback for other wallets: not implemented
  return { success: false, error: 'Ví này chưa được hỗ trợ' };
};

/**
 * Disconnect a wallet
 * @param address Wallet address to disconnect
 */
export const disconnectWallet = async (address: string): Promise<void> => {
  await delay(300);

  const index = connectedWallets.findIndex((w) => w.address === address);
  if (index > -1) {
    connectedWallets[index].connected = false;
    connectedWallets.splice(index, 1);
  }
};

/**
 * Get list of connected wallets
 * @returns Array of connected wallet connections
 */
export const getConnectedWallets = (): WalletConnection[] => {
  return [...connectedWallets];
};

/**
 * Check if a specific wallet type is installed
 * @param walletType Type of wallet to check
 * @returns True if wallet is detected
 */
export const isWalletInstalled = async (
  walletType: WalletType
): Promise<boolean> => {
  const wallets = await detectWallets();
  const wallet = wallets.find((w) => w.type === walletType);
  return wallet?.detected || false;
};

/**
 * Generate mock wallet address for different blockchains
 * @param blockchain Blockchain type
 * @returns Mock wallet address
 */
const generateMockWalletAddress = (blockchain: BlockchainType): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789';
  let address = '';

  switch (blockchain) {
    case 'solana':
      // Solana addresses are base58 encoded, typically 32-44 characters
      for (let i = 0; i < 44; i++) {
        address += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      break;
    case 'ethereum':
      // Ethereum addresses start with 0x and are 42 characters
      address = '0x';
      for (let i = 0; i < 40; i++) {
        address += Math.floor(Math.random() * 16).toString(16);
      }
      break;
    case 'bitcoin':
      // Bitcoin addresses vary, but typically 26-35 characters
      for (let i = 0; i < 34; i++) {
        address += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      break;
    default:
      address = 'unknown-address';
  }

  return address;
};

/**
 * Get wallet info by type
 * @param walletType Type of wallet
 * @returns Wallet information or undefined
 */
export const getWalletInfo = (walletType: WalletType): WalletInfo | undefined => {
  const allWallets: WalletInfo[] = [
    ...((WALLET_CATALOG.solana ?? []) as WalletInfo[]),
    ...((WALLET_CATALOG.ethereum ?? []) as WalletInfo[]),
    ...((WALLET_CATALOG.bitcoin ?? []) as WalletInfo[]),
  ];
  return allWallets.find((w: WalletInfo) => w.type === walletType);
};

/**
 * Get all available wallets for a blockchain
 * @param blockchain Blockchain type
 * @returns Array of wallet info
 */
export const getAvailableWallets = (
  blockchain: BlockchainType = 'ethereum'
): WalletInfo[] => {
  return (WALLET_CATALOG[blockchain] || []).slice();
};
