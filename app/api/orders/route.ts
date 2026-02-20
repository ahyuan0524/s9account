import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key)
}

function normalizeDate(input: string) {
  // 支持 YYYY-MM-DD 或 YYYY/MM/DD
  if (!input) return ""
  const s = String(input).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(s)) return s.replaceAll("/", "-")
  return s
}

type LineInput = {
  prosy_code: string
  currency_code: string
  type_code: string
  amount: number
  rate?: number | null
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const trade_date = normalizeDate(body.trade_date)

    const fromLine: LineInput = body.from
    const toLine: LineInput = body.to

    if (!trade_date || !/^\d{4}-\d{2}-\d{2}$/.test(trade_date)) {
      return NextResponse.json({ error: "日期格式必须是 YYYY-MM-DD" }, { status: 400 })
    }

    if (!fromLine || !toLine) {
      return NextResponse.json({ error: "缺少 From/To 数据" }, { status: 400 })
    }

    const required = ["prosy_code", "currency_code", "type_code", "amount"] as const
    for (const k of required) {
      if (!fromLine[k]) return NextResponse.json({ error: `From 缺少 ${k}` }, { status: 400 })
      if (!toLine[k]) return NextResponse.json({ error: `To 缺少 ${k}` }, { status: 400 })
    }

    // 统一：前端只填“正数”，后端自动把 From 变负数、To 变正数
    const fromAmount = -Math.abs(Number(fromLine.amount))
    const toAmount = Math.abs(Number(toLine.amount))

    if (!isFinite(fromAmount) || !isFinite(toAmount) || fromAmount === 0 || toAmount === 0) {
      return NextResponse.json({ error: "金额必须是有效数字且不能为 0" }, { status: 400 })
    }

    const supabase = supabaseAdmin()

    // 创建订单（订单号=orders.id 自增）
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({ trade_date })
      .select("id")
      .single()

    if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 400 })

    const order_id = order.id

    const rows = [
      {
        order_id,
        trade_date,
        prosy_code: fromLine.prosy_code,
        currency_code: fromLine.currency_code,
        type_code: fromLine.type_code,
        amount: fromAmount,
        rate: fromLine.rate ?? null,
      },
      {
        order_id,
        trade_date,
        prosy_code: toLine.prosy_code,
        currency_code: toLine.currency_code,
        type_code: toLine.type_code,
        amount: toAmount,
        rate: toLine.rate ?? null,
      },
    ]

    const { error: txErr } = await supabase.from("transactions").insert(rows)
    if (txErr) return NextResponse.json({ error: txErr.message }, { status: 400 })

    return NextResponse.json({ ok: true, order_id })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 })
  }
}