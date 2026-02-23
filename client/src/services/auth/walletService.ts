/**
 * Wallet Service
 * Detects and connects Solana wallets in browser (Phantom, Solflare)
 * Authentication flow: request nonce -> sign message -> verify signature.
 */

import type {
  WalletInfo,
  WalletType,
  BlockchainType,
  WalletConnection,
  AuthResponse,
} from '../../types/auth';
import client from '@/api/main';

/**
 * Mock delay to simulate wallet operations (ms)
 */
const MOCK_DELAY = 800;

interface SolanaBrowserProvider {
  isPhantom?: boolean;
  isSolflare?: boolean;
  publicKey?: {
    toBase58?: () => string;
  };
  connect?: () => Promise<{ publicKey?: { toBase58?: () => string } } | void>;
  signMessage?: (message: Uint8Array) => Promise<Uint8Array | { signature: Uint8Array }>;
}

interface EthereumBrowserProvider {
  isMetaMask?: boolean;
  isPhantom?: boolean;
  providers?: EthereumBrowserProvider[];
  request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

const toBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
};

const getProviderFromWalletType = (walletType: WalletType): SolanaBrowserProvider | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const providerWindow = window as typeof window & {
    solana?: SolanaBrowserProvider;
    solflare?: SolanaBrowserProvider;
  };

  switch (walletType) {
    case 'phantom': {
      const provider = providerWindow.solana;
      return provider?.isPhantom ? provider : null;
    }
    case 'solflare': {
      const provider = providerWindow.solflare ?? providerWindow.solana;
      return provider?.isSolflare ? provider : null;
    }
    default:
      return null;
  }
};

const getEthereumProviderFromWalletType = (
  walletType: WalletType,
): EthereumBrowserProvider | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const providerWindow = window as typeof window & {
    ethereum?: EthereumBrowserProvider;
  };

  if (walletType !== 'metamask') {
    return null;
  }

  const injectedProvider = providerWindow.ethereum;
  if (!injectedProvider) {
    return null;
  }

  const availableProviders: EthereumBrowserProvider[] = Array.isArray(injectedProvider.providers)
    ? injectedProvider.providers
    : [injectedProvider];

  const metamaskProvider = availableProviders.find(
    (provider: EthereumBrowserProvider) =>
      provider?.isMetaMask && !provider?.isPhantom,
  );

  return metamaskProvider ?? null;
};

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
  blockchain: BlockchainType = 'solana'
): Promise<WalletInfo[]> => {
  await delay(200);

  const catalog = WALLET_CATALOG[blockchain] || [];
  const phantomProvider = getProviderFromWalletType('phantom');
  const solflareProvider = getProviderFromWalletType('solflare');
  const metamaskProvider = getEthereumProviderFromWalletType('metamask');

  return catalog.map((wallet) => ({
    ...wallet,
    detected: wallet.type === 'phantom'
      ? Boolean(phantomProvider)
      : wallet.type === 'solflare'
        ? Boolean(solflareProvider)
        : wallet.type === 'metamask'
          ? Boolean(metamaskProvider)
        : wallet.detected,
  }));
};

const connectSolanaWallet = async (
  walletType: WalletType,
): Promise<AuthResponse> => {
  const provider = getProviderFromWalletType(walletType);
  if (!provider) {
    return { success: false, error: 'Ví chưa được cài đặt hoặc không được hỗ trợ' };
  }

  if (!provider.connect || !provider.signMessage) {
    return { success: false, error: 'Ví không hỗ trợ đăng nhập bằng chữ ký' };
  }

  const connectedResult = await provider.connect();
  const connectedPubKey =
    provider.publicKey?.toBase58?.() ?? connectedResult?.publicKey?.toBase58?.();

  if (!connectedPubKey) {
    return { success: false, error: 'Không lấy được địa chỉ ví' };
  }

  const nonceResponse = await client.api.users.auth.solana.nounce.$post({
    json: {
      pubKey: connectedPubKey,
    },
  });

  if (!nonceResponse.ok) {
    return { success: false, error: 'Không lấy được thông điệp xác thực' };
  }

  const { signMessage } = await nonceResponse.json();
  const signMessageBytes = new TextEncoder().encode(signMessage);
  const signed = await provider.signMessage(signMessageBytes);
  const signatureBytes = signed instanceof Uint8Array ? signed : signed.signature;

  const verifyResponse = await client.api.users.auth.solana.verify.$post({
    json: {
      pubKey: connectedPubKey,
      signature: toBase64(signatureBytes),
    },
  });

  if (!verifyResponse.ok) {
    return { success: false, error: 'Xác thực chữ ký ví thất bại' };
  }

  const verifyData = await verifyResponse.json();
  const connection: WalletConnection = {
    address: connectedPubKey,
    blockchain: 'solana',
    walletType,
    connected: true,
    connectedAt: new Date(),
  };
  connectedWallets.push(connection);

  return {
    success: true,
    user: {
      id: verifyData.userId,
    } as AuthResponse['user'],
    token: verifyData.token,
    message: verifyData.message,
  };
};

const connectEthereumWallet = async (
  walletType: WalletType,
): Promise<AuthResponse> => {
  const provider = getEthereumProviderFromWalletType(walletType);
  if (!provider?.request) {
    return { success: false, error: 'MetaMask chưa được cài đặt hoặc không được hỗ trợ' };
  }

  const accounts = (await provider.request({
    method: 'eth_requestAccounts',
  })) as string[];

  const selectedAddress = accounts?.[0]?.toLowerCase();
  if (!selectedAddress) {
    return { success: false, error: 'Không lấy được địa chỉ MetaMask' };
  }

  const nonceResponse = await client.api.users.auth.ethereum.nounce.$post({
    json: {
      address: selectedAddress,
    },
  });

  if (!nonceResponse.ok) {
    return { success: false, error: 'Không lấy được thông điệp xác thực' };
  }

  const { signMessage } = await nonceResponse.json();
  const signature = (await provider.request({
    method: 'personal_sign',
    params: [signMessage, selectedAddress],
  })) as string;

  if (!signature) {
    return { success: false, error: 'Không lấy được chữ ký từ MetaMask' };
  }

  const verifyResponse = await client.api.users.auth.ethereum.verify.$post({
    json: {
      address: selectedAddress,
      signature,
    },
  });

  if (!verifyResponse.ok) {
    return { success: false, error: 'Xác thực chữ ký MetaMask thất bại' };
  }

  const verifyData = await verifyResponse.json();
  const connection: WalletConnection = {
    address: selectedAddress,
    blockchain: 'ethereum',
    walletType,
    connected: true,
    connectedAt: new Date(),
  };
  connectedWallets.push(connection);

  return {
    success: true,
    user: {
      id: verifyData.userId,
    } as AuthResponse['user'],
    token: verifyData.token,
    message: verifyData.message,
  };
};

/**
 * Connect to a Solana wallet
 * @param walletType Type of wallet to connect
 * @param blockchain Blockchain network
 * @returns Authentication response with wallet connection data
 */
export const connectWallet = async (
  walletType: WalletType,
  blockchain: BlockchainType = 'solana'
): Promise<AuthResponse> => {
  try {
    if (blockchain === 'solana') {
      return await connectSolanaWallet(walletType);
    }

    if (blockchain === 'ethereum') {
      return await connectEthereumWallet(walletType);
    }

    return { success: false, error: 'Blockchain chưa được hỗ trợ đăng nhập' };
  } catch (error: unknown) {
    const walletError = error as { code?: number; message?: string };
    if (walletError?.code === 4001) {
      return { success: false, error: 'Người dùng từ chối ký thông điệp' };
    }

    return {
      success: false,
      error: walletError?.message || 'Lỗi kết nối ví Solana',
    };
  }
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
