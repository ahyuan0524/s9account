// supabase/functions/scan-crypto/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Chain = "USDT_TRC20" | "USDT_BEP20";

const USDT_BSC_CONTRACT = "0x55d398326f99059fF775485246999027B3197955"; // USDT on BSC (BEP20)

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function mustEnv(name: string) {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function normAddr(a: string) {
  return (a || "").trim();
}

function isTrc20Address(a: string) {
  // TRON base58 usually starts with T and length 34
  return /^T[a-zA-Z0-9]{33}$/.test(a.trim());
}
function isBep20Address(a: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(a.trim());
}

// ---------- TRC20 (TronGrid) ----------
async function fetchTrc20Transfers(address: string, sinceMs: number, tronGridKey?: string) {
  // TronGrid TRC20 transfer endpoint (USDT contract on TRON)
  // NOTE: TronGrid API is sometimes finicky; this is a practical implementation.
  const url =
    `https://api.trongrid.io/v1/accounts/${encodeURIComponent(address)}/transactions/trc20` +
    `?only_confirmed=true&limit=200&contract_address=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`; // USDT TRC20 contract

  const headers: Record<string, string> = {};
  if (tronGridKey) headers["TRON-PRO-API-KEY"] = tronGridKey;

  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`TronGrid error: ${r.status} ${await r.text()}`);
  const j = await r.json();

  const data = (j?.data ?? []) as any[];
  // TronGrid returns newest first; filter by timestamp
  return data
    .map((x) => ({
      tx_hash: x.transaction_id as string,
      from: x.from as string,
      to: x.to as string,
      value: Number(x.value) / 1e6, // USDT has 6 decimals on TRON
      symbol: x.token_info?.symbol ?? "USDT",
      ts_ms: Number(x.block_timestamp),
      raw: x,
    }))
    .filter((x) => x.ts_ms >= sinceMs);
}

async function fetchTrc20Balance(address: string, tronGridKey?: string) {
  const url = `https://api.trongrid.io/v1/accounts/${encodeURIComponent(address)}/tokens?limit=200`;
  const headers: Record<string, string> = {};
  if (tronGridKey) headers["TRON-PRO-API-KEY"] = tronGridKey;

  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`TronGrid tokens error: ${r.status} ${await r.text()}`);
  const j = await r.json();
  const tokens = (j?.data?.[0]?.trc20 ?? []) as Record<string, string>[];

  // tokens is array of objects {contractAddr: balanceStr}
  // USDT contract: TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t
  const usdtContract = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
  let balStr = "0";
  for (const obj of tokens) {
    if (obj[usdtContract] != null) {
      balStr = obj[usdtContract];
      break;
    }
  }
  const bal = Number(balStr); // already human on TronGrid tokens endpoint
  return Number.isFinite(bal) ? bal : 0;
}

// ---------- BEP20 (BscScan) ----------
async function fetchBep20Transfers(address: string, sinceSec: number, bscKey: string) {
  // BscScan token transfer history
  const url =
    `https://api.bscscan.com/api?module=account&action=tokentx` +
    `&contractaddress=${USDT_BSC_CONTRACT}` +
    `&address=${encodeURIComponent(address)}` +
    `&startblock=0&endblock=999999999&sort=desc&apikey=${encodeURIComponent(bscKey)}`;

  const r = await fetch(url);
  if (!r.ok) throw new Error(`BscScan error: ${r.status} ${await r.text()}`);
  const j = await r.json();

  if (j?.status !== "1" && j?.message !== "No transactions found") {
    throw new Error(`BscScan response: ${JSON.stringify(j).slice(0, 300)}`);
  }

  const list = (j?.result ?? []) as any[];
  return list
    .map((x) => ({
      tx_hash: x.hash as string,
      from: x.from as string,
      to: x.to as string,
      value: Number(x.value) / 1e18, // USDT on BSC uses 18 decimals (BEP20)
      symbol: x.tokenSymbol ?? "USDT",
      ts_sec: Number(x.timeStamp),
      raw: x,
    }))
    .filter((x) => x.ts_sec >= sinceSec);
}

async function fetchBep20Balance(address: string, bscKey: string) {
  // token balance endpoint
  const url =
    `https://api.bscscan.com/api?module=account&action=tokenbalance` +
    `&contractaddress=${USDT_BSC_CONTRACT}` +
    `&address=${encodeURIComponent(address)}` +
    `&tag=latest&apikey=${encodeURIComponent(bscKey)}`;

  const r = await fetch(url);
  if (!r.ok) throw new Error(`BscScan balance error: ${r.status} ${await r.text()}`);
  const j = await r.json();

  const raw = String(j?.result ?? "0");
  // tokenbalance returns raw integer
  const bal = Number(raw) / 1e18;
  return Number.isFinite(bal) ? bal : 0;
}

// ---------- Main ----------
Deno.serve(async (req) => {
  try {
    const SUPABASE_URL = mustEnv("SUPABASE_URL");
    const SERVICE_ROLE_KEY = mustEnv("SUPABASE_SERVICE_ROLE_KEY");

    const bscKey = Deno.env.get("BSCSCAN_API_KEY") ?? "";
    const tronKey = Deno.env.get("TRONGRID_API_KEY") ?? "";

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const now = Date.now();
    const sinceMs = now - 3 * 24 * 60 * 60 * 1000; // last 3 days
    const sinceSec = Math.floor(sinceMs / 1000);

    // 1) load wallets
    const { data: wallets, error: wErr } = await supabase
      .from("crypto_wallets")
      .select("id,user_id,address,chain,created_at")
      .in("chain", ["USDT_TRC20", "USDT_BEP20"]);

    if (wErr) throw wErr;

    let inserted = 0;
    let updatedBalances = 0;
    const errors: any[] = [];

    for (const w of wallets ?? []) {
      const walletId = w.id as string;
      const userId = w.user_id as string;
      const address = normAddr(w.address as string);
      const chain = w.chain as Chain;

      try {
        // Validate address matches chain
        if (chain === "USDT_TRC20" && !isTrc20Address(address)) continue;
        if (chain === "USDT_BEP20" && !isBep20Address(address)) continue;

        // 2) fetch transfers + balance
        if (chain === "USDT_TRC20") {
          const txs = await fetchTrc20Transfers(address, sinceMs, tronKey || undefined);
          const bal = await fetchTrc20Balance(address, tronKey || undefined);

          // upsert txs
          for (const t of txs) {
            const { error } = await supabase.from("crypto_transactions").upsert(
              {
                user_id: userId,
                wallet_id: walletId,
                chain,
                tx_hash: t.tx_hash,
                from_address: t.from,
                to_address: t.to,
                amount: t.value,
                token_symbol: t.symbol,
                block_time: new Date(t.ts_ms).toISOString(),
                raw: t.raw,
              },
              { onConflict: "user_id,chain,tx_hash" },
            );
            if (!error) inserted++;
          }

          // update wallet balance
          const { error: bErr } = await supabase
            .from("crypto_wallets")
            .update({ balance: bal, balance_updated_at: new Date().toISOString() })
            .eq("id", walletId);
          if (!bErr) updatedBalances++;
        }

        if (chain === "USDT_BEP20") {
          if (!bscKey) throw new Error("Missing BSCSCAN_API_KEY");
          const txs = await fetchBep20Transfers(address, sinceSec, bscKey);
          const bal = await fetchBep20Balance(address, bscKey);

          for (const t of txs) {
            const { error } = await supabase.from("crypto_transactions").upsert(
              {
                user_id: userId,
                wallet_id: walletId,
                chain,
                tx_hash: t.tx_hash,
                from_address: t.from,
                to_address: t.to,
                amount: t.value,
                token_symbol: t.symbol,
                block_time: new Date(t.ts_sec * 1000).toISOString(),
                raw: t.raw,
              },
              { onConflict: "user_id,chain,tx_hash" },
            );
            if (!error) inserted++;
          }

          const { error: bErr } = await supabase
            .from("crypto_wallets")
            .update({ balance: bal, balance_updated_at: new Date().toISOString() })
            .eq("id", walletId);
          if (!bErr) updatedBalances++;
        }
      } catch (e) {
        errors.push({ walletId, chain, address, error: String(e?.message ?? e) });
      }
    }

    // 3) cleanup: keep only last 3 days
    await supabase
      .from("crypto_transactions")
      .delete()
      .lt("block_time", new Date(sinceMs).toISOString());

    return json({
      ok: true,
      wallets: (wallets ?? []).length,
      inserted,
      updatedBalances,
      errors,
    });
  } catch (e) {
    return json({ ok: false, error: String(e?.message ?? e) }, 500);
  }
});