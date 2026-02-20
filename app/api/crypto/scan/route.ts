import { NextResponse } from "next/server";

const USDT_TRON_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const USDT_BSC_CONTRACT = "0x55d398326f99059ff775485246999027b3197955";

function bad(msg: string, code = 400) {
  return NextResponse.json({ error: msg }, { status: code });
}

function daysToMs(days: number) {
  return Math.max(1, Math.min(30, days)) * 24 * 60 * 60 * 1000;
}

// TRC20：TronGrid public（无key）抓 USDT TRC20 转账
async function scanTrc20(address: string, days: number) {
  const minTs = Date.now() - daysToMs(days);

  const url =
    `https://api.trongrid.io/v1/accounts/${encodeURIComponent(address)}/transactions/trc20` +
    `?only_confirmed=true&limit=50&min_timestamp=${minTs}` +
    `&contract_address=${USDT_TRON_CONTRACT}`;

  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error("TronGrid 扫描失败（无key可能会限速）");

  const j: any = await r.json();
  const rows = Array.isArray(j?.data) ? j.data : [];

  // 统一格式
  return rows.map((t: any) => {
    const val = Number(t?.value ?? 0);
    const dec = Number(t?.token_info?.decimals ?? 6);
    const amount = val / Math.pow(10, dec);

    return {
      chain: "USDT_TRC20",
      hash: t?.transaction_id,
      from: t?.from,
      to: t?.to,
      amount,
      ts: t?.block_timestamp
    };
  });
}

// BEP20：BscScan 无 key 可能能用（如果被挡，下一步我给你 RPC logs 版本）
async function scanBep20(address: string, days: number) {
  const sinceSec = Math.floor((Date.now() - daysToMs(days)) / 1000);

  const url =
    `https://api.bscscan.com/api?module=account&action=tokentx` +
    `&address=${encodeURIComponent(address)}` +
    `&contractaddress=${USDT_BSC_CONTRACT}` +
    `&page=1&offset=50&sort=desc`;

  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error("BscScan 扫描失败（无key可能会限速）");

  const j: any = await r.json();
  if (j?.status !== "1" || !Array.isArray(j?.result)) {
    throw new Error(j?.message || j?.result || "BscScan 返回异常（无key可能被限制）");
  }

  const rows = j.result.filter((x: any) => Number(x.timeStamp) >= sinceSec);

  return rows.map((t: any) => {
    const dec = Number(t?.tokenDecimal ?? 18);
    const amount = Number(t?.value ?? 0) / Math.pow(10, dec);
    return {
      chain: "USDT_BEP20",
      hash: t?.hash,
      from: t?.from,
      to: t?.to,
      amount,
      ts: Number(t?.timeStamp) * 1000
    };
  });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const days = Number(searchParams.get("days") || "3");

  // 这里先做“演示扫描”：扫你库里所有地址，需要你下一步把 supabase 读 wallets 接上
  // 目前先允许前端传入 address+chain 来扫（你马上就能看到效果）
  const chain = (searchParams.get("chain") || "").trim();
  const address = (searchParams.get("address") || "").trim();

  if (!chain || !address) {
    return bad("请传入 ?chain=USDT_TRC20|USDT_BEP20&address=...");
  }

  try {
    if (chain === "USDT_TRC20") {
      const tx = await scanTrc20(address, days);
      return NextResponse.json({ days, count: tx.length, transactions: tx });
    }
    if (chain === "USDT_BEP20") {
      const tx = await scanBep20(address, days);
      return NextResponse.json({ days, count: tx.length, transactions: tx });
    }
    return bad("不支持的 chain");
  } catch (e: any) {
    return bad(e?.message || "扫描失败", 500);
  }
}