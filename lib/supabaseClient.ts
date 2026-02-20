// lib/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export type CryptoChain = "USDT_TRC20" | "USDT_BEP20";

export const CHAIN_OPTIONS: { label: string; value: CryptoChain }[] = [
  { label: "USDT (TRC20)", value: "USDT_TRC20" },
  { label: "USDT (BEP20)", value: "USDT_BEP20" },
];

export function isValidAddress(chain: CryptoChain, addr: string) {
  const v = addr.trim();
  if (chain === "USDT_BEP20") return /^0x[a-fA-F0-9]{40}$/.test(v);
  // TRC20 address (Base58Check) 简单校验：T开头 + 长度常见34
  if (chain === "USDT_TRC20") return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(v);
  return false;
}