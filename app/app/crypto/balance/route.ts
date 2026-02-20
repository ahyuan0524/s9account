import { NextResponse } from "next/server";
import { ethers } from "ethers";

export const runtime = "nodejs"; // ✅ 必须：避免 Turbopack/Edge 导致不稳定

const DEFAULT_ADDRESS = "THfQHSSuPUoyVH1U14pwpYX5pqR3WUeHhm";

// BEP20 USDT contract on BSC
const BSC_USDT = "0x55d398326f99059fF775485246999027B3197955";
const BSC_RPC = "https://bsc-dataseed.binance.org/";

// -------- helpers --------
function isBep20Address(addr: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(addr);
}
function isTrc20Address(addr: string) {
  return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(addr);
}

async function getBep20UsdtBalance(address: string) {
  const provider = new ethers.JsonRpcProvider(BSC_RPC);
  const abi = ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"];
  const c = new ethers.Contract(BSC_USDT, abi, provider);
  const [bal, dec] = await Promise.all([c.balanceOf(address), c.decimals()]);
  return Number(ethers.formatUnits(bal, dec));
}

async function getTrc20UsdtBalance(address: string) {
  const url = `https://apilist.tronscan.org/api/account?address=${encodeURIComponent(address)}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      // ✅ 避免部分环境被拒绝/返回奇怪结构
      "accept": "application/json",
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari",
    },
  });
  if (!res.ok) throw new Error(`TRC20 http ${res.status}`);

  const data = await res.json();
  const list = Array.isArray(data?.trc20token_balances) ? data.trc20token_balances : [];
  const usdt = list.find((t: any) => String(t?.tokenAbbr || t?.token_abbr || "").toUpperCase() === "USDT");
  if (!usdt) return 0;

  const raw = usdt.balance ?? usdt?.tokenBalance ?? usdt?.token_balance ?? "0";
  const dec = Number(usdt.tokenDecimal ?? usdt?.token_decimal ?? 6);

  const rawNum = typeof raw === "string" ? Number(raw) : Number(raw ?? 0);
  const value = rawNum / Math.pow(10, dec);
  return Number.isFinite(value) ? value : 0;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const address = (searchParams.get("address") || DEFAULT_ADDRESS).trim();

    let usdt = 0;
    let network: "TRC20" | "BEP20" | "UNKNOWN" = "UNKNOWN";

    if (isTrc20Address(address)) {
      network = "TRC20";
      usdt = await getTrc20UsdtBalance(address);
    } else if (isBep20Address(address)) {
      network = "BEP20";
      usdt = await getBep20UsdtBalance(address);
    } else {
      return NextResponse.json({ ok: false, error: "地址格式不正确（仅支持 TRC20 或 BEP20）", address }, { status: 200 });
    }

    return NextResponse.json({ ok: true, address, network, usdt }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "balance fetch failed" }, { status: 200 });
  }
}