/**
 * Mock Wallet Service
 * Simulates wallet detection and connection for Solana wallets
 */

import type {
  WalletInfo,
  WalletType,
  BlockchainType,
  WalletConnection,
  AuthResponse,
} from '../../types/auth';

/**
 * Mock delay to simulate wallet operations (ms)
 */
const MOCK_DELAY = 800;

/**
 * Available Solana wallets with metadata
 */
const SOLANA_WALLETS: WalletInfo[] = [
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
];

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
 * Detect installed Solana wallets in the browser
 * @returns List of wallet info with detection status
 */
export const detectWallets = async (
  blockchain: BlockchainType = 'solana'
): Promise<WalletInfo[]> => {
  await delay(500);

  // Mock detection logic
  // In a real implementation, this would check window.solana, window.phantom, etc.
  const wallets = SOLANA_WALLETS.filter((w) =>
    w.blockchain.includes(blockchain)
  ).map((wallet) => ({
    ...wallet,
    // Randomly mark some wallets as detected for demo purposes
    // In production, this would check actual browser extensions
    detected: Math.random() > 0.5,
  }));

  // Ensure at least one wallet is detected for testing
  if (wallets.length > 0 && !wallets.some((w) => w.detected)) {
    wallets[0].detected = true;
  }

  return wallets;
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
  await delay(MOCK_DELAY);

  // Simulate wallet not installed
  const wallets = await detectWallets(blockchain);
  const wallet = wallets.find((w) => w.type === walletType);

  if (!wallet) {
    return {
      success: false,
      error: `${walletType} wallet is not available`,
    };
  }

  if (!wallet.detected) {
    return {
      success: false,
      error: `${wallet.name} is not installed. Please install the extension and try again.`,
    };
  }

  // Simulate user rejection (10% chance for demo)
  if (Math.random() < 0.1) {
    return {
      success: false,
      error: 'Wallet connection was rejected by user',
    };
  }

  // Generate mock wallet address
  const mockAddress = generateMockWalletAddress(blockchain);

  // Create wallet connection
  const connection: WalletConnection = {
    address: mockAddress,
    blockchain,
    walletType,
    connected: true,
    connectedAt: new Date(),
  };

  // Add to connected wallets
  connectedWallets.push(connection);

  // Return success with mock user data
  return {
    success: true,
    user: {
      id: `wallet-user-${Date.now()}`,
      username: `user_${mockAddress.slice(0, 8)}`,
      email: `${mockAddress.slice(0, 8)}@wallet.user`,
      createdAt: new Date(),
      lastLogin: new Date(),
      wallets: [connection],
    },
    token: `mock-wallet-token-${mockAddress}-${Date.now()}`,
    message: `Successfully connected to ${wallet.name}`,
  };
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
  return SOLANA_WALLETS.find((w) => w.type === walletType);
};

/**
 * Get all available wallets for a blockchain
 * @param blockchain Blockchain type
 * @returns Array of wallet info
 */
export const getAvailableWallets = (
  blockchain: BlockchainType = 'solana'
): WalletInfo[] => {
  return SOLANA_WALLETS.filter((w) => w.blockchain.includes(blockchain));
};
