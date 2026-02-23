import { isAddress } from "@solana/kit";

export function isValidWalletAddress(address: string) {
  return isAddress(address);
}
