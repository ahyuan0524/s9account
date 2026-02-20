import { NextResponse } from "next/server";

const DEFAULT_TRON_ADDRESS = "THfQHSSuPUoyVH1U14pwpYX5pqR3WUeHhm";

function isTronAddress(addr: string) {
  return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(addr);
}

// TronScan account endpoint（你之前代码也是用这个系）
// 常见返回：{ trc20token_balances: [ { tokenAbbr:'USDT', balance:'12345', tokenDecimal:6 } ] }
async function getTrc20UsdtBalance(address: string): Promise<number> {
  const url = `https://apilist.tronscan.org/api/account?address=${encodeURIComponent(address)}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`TronScan query failed: ${res.status}`);

  const data: any = await res.json();

  const list: any[] = Array.isArray(data?.trc20token_balances) ? data.trc20token_balances : [];
  const usdt = list.find((x) => String(x?.tokenAbbr || "").toUpperCase() === "USDT");

  if (!usdt) return 0;

  // balance 有时是字符串整数（按 tokenDecimal），有时直接小数，统一处理
  const balRaw = usdt?.balance ?? usdt?.balance_str ?? usdt?.quantity ?? usdt?.amount;
  const decRaw = usdt?.tokenDecimal ?? usdt?.token_decimal ?? 6;

  const balNum = Number(balRaw);
  const decNum = Number(decRaw);

  if (!Number.isFinite(balNum)) return 0;

  // 如果是整数且有小数位，换算成真实 USDT
  // （很多时候 balance 是 “最小单位”，例如 12300000 表示 12.3）
  if (Number.isFinite(decNum) && decNum > 0 && balNum > 1000000) {
    return balNum / Math.pow(10, decNum);
  }

  return balNum;
}

async function handler(req: Request) {
  try {
    // 允许你未来扩展：传 address 时用传入，否则用默认
    let address = DEFAULT_TRON_ADDRESS;

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({} as any));
      if (body?.address && typeof body.address === "string") address = body.address.trim();
    } else {
      const { searchParams } = new URL(req.url);
      const q = searchParams.get("address");
      if (q) address = q.trim();
    }

    if (!isTronAddress(address)) {
      return NextResponse.json({ error: "Invalid TRON address", address }, { status: 400 });
    }

    const usdt = await getTrc20UsdtBalance(address);

    return NextResponse.json(
      { address, usdt },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Balance query failed" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function GET(req: Request) {
  return handler(req);
}

export async function POST(req: Request) {
  return handler(req);
}