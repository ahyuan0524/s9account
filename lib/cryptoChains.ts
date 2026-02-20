export type CryptoChain = "USDT_TRC20" | "USDT_BEP20";

export const CHAIN_OPTIONS: { value: CryptoChain; label: string }[] = [
  { value: "USDT_TRC20", label: "USDT (TRC20)" },
  { value: "USDT_BEP20", label: "USDT (BEP20)" },
];

export function isTRC20Address(addr: string) {
  // Tron base58 address starts with T and length usually 34
  return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(addr.trim());
}

export function isBEP20Address(addr: string) {
  // EVM address 0x...
  return /^0x[a-fA-F0-9]{40}$/.test(addr.trim());
}

export function isValidAddress(chain: CryptoChain, addr: string) {
  if (chain === "USDT_TRC20") return isTRC20Address(addr);
  if (chain === "USDT_BEP20") return isBEP20Address(addr);
  return false;
}