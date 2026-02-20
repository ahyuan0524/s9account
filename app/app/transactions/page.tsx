"use client"

import React, { useEffect, useMemo, useState } from "react"
import { createSupabaseBrowser } from "@/lib/supabaseBrowser"

type TxRow = {
  id: string | number
  created_at: string
  date: string | null
  prosy_code: string | null
  currency_code: string | null
  type_code: string | null // RM / U
  amount: number | null
  rate: number | null
}

type Option = { code: string }

function fmtNumber(n: number, digits = 2) {
  const v = Number.isFinite(n) ? n : 0
  return v.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  })
}

function fmtDateYYYYMMDD(s?: string | null) {
  if (!s) return "-"
  return String(s).slice(0, 10)
}

/**
 * ✅ 你的规则：
 * - MYR 只显示 type=RM 的金额
 * - USDT 只显示 type=U 的金额
 * - 这里不做换算（避免跟 orders 规则不一致）
 */
function calcMYRUSDT(tx: TxRow) {
  const amount = tx.amount == null ? null : Number(tx.amount)
  const type = (tx.type_code ?? "").toUpperCase()

  let myr: number | null = null
  let usdt: number | null = null

  if (type === "RM") myr = amount
  if (type === "U") usdt = amount

  return { myr, usdt }
}

export default function TransactionsPage() {
  const supabase = useMemo(() => createSupabaseBrowser(true), [])

  const [prosyOptions, setProsyOptions] = useState<string[]>([])
  const [currencyOptions, setCurrencyOptions] = useState<string[]>([])
  const [typeOptions, setTypeOptions] = useState<string[]>([])

  const [fCurrency, setFCurrency] = useState<string>("ALL")
  const [fType, setFType] = useState<string>("ALL")
  const [fProsy, setFProsy] = useState<string>("ALL")
  const [fDate, setFDate] = useState<string>("")

  // ✅ 搜索序列号（#12）
  const [fSerial, setFSerial] = useState<string>("")
  const [targetSerial, setTargetSerial] = useState<number | null>(null)

  const [pageSize, setPageSize] = useState<number>(10)
  const [rows, setRows] = useState<TxRow[]>([])
  const [total, setTotal] = useState<number>(0)
  const [page, setPage] = useState<number>(1)

  const [loading, setLoading] = useState<boolean>(false)
  const [err, setErr] = useState<string>("")

  const inputStyle: React.CSSProperties = {
    height: 44,
    width: "100%",
    borderRadius: 12,
    border: "1px solid #E5E7EB",
    padding: "0 14px",
    outline: "none",
    background: "#fff",
    boxShadow: "0 1px 2px rgba(16,24,40,0.04)",
    fontSize: 14,
  }

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    paddingRight: 34,
    appearance: "auto",
  }

  async function loadSettingOptions() {
    setErr("")
    const [p, c, t] = await Promise.all([
      supabase.from("prosy_list").select("code").order("code", { ascending: true }),
      supabase.from("currency_list").select("code").order("code", { ascending: true }),
      supabase.from("type_list").select("code").order("code", { ascending: true }),
    ])

    if (p.error) return setErr(p.error.message)
    if (c.error) return setErr(c.error.message)
    if (t.error) return setErr(t.error.message)

    setProsyOptions(((p.data ?? []) as Option[]).map((x) => x.code))
    setCurrencyOptions(((c.data ?? []) as Option[]).map((x) => x.code))
    setTypeOptions(((t.data ?? []) as Option[]).map((x) => x.code))
  }

  function buildQuery() {
    let q = supabase
      .from("transactions")
      // ✅ 只选你表里确定存在的字段（避免再报 column does not exist）
      .select("id,created_at,date,prosy_code,currency_code,type_code,amount,rate", { count: "exact" })
      // ✅ 最新在上
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })

    if (fCurrency !== "ALL") q = q.eq("currency_code", fCurrency)
    if (fType !== "ALL") q = q.eq("type_code", fType)
    if (fProsy !== "ALL") q = q.eq("prosy_code", fProsy)
    if (fDate.trim()) q = q.eq("date", fDate.trim())

    return q
  }

  async function loadTransactions(nextPage?: number, highlightSerial?: number | null) {
    setLoading(true)
    setErr("")

    const p = nextPage ?? page
    const from = (p - 1) * pageSize
    const to = from + pageSize - 1

    const { data, error, count } = await buildQuery().range(from, to)

    if (error) {
      setErr(error.message)
      setRows([])
      setTotal(0)
      setLoading(false)
      return
    }

    setRows((data ?? []) as TxRow[])
    setTotal(count ?? 0)
    setLoading(false)

    setTargetSerial(highlightSerial ?? null)
  }

  async function onRefreshAll() {
    await loadSettingOptions()
    setPage(1)
    await loadTransactions(1, null)
  }

  async function onApply() {
    setPage(1)
    await loadTransactions(1, null)
  }

  function onReset() {
    setFCurrency("ALL")
    setFType("ALL")
    setFProsy("ALL")
    setFDate("")
    setFSerial("")
    setTargetSerial(null)
    setPageSize(10)
    setPage(1)
    loadTransactions(1, null)
  }

  async function onSearchSerial() {
    const raw = fSerial.trim().replace(/^#/, "")
    const n = Number(raw)
    if (!raw || Number.isNaN(n) || n <= 0) {
      alert("请输入序列号，例如：1 或 #1")
      return
    }

    const targetPage = Math.max(1, Math.ceil(n / pageSize))
    setPage(targetPage)
    await loadTransactions(targetPage, n)
  }

  async function deleteTx(id: TxRow["id"]) {
    const ok = confirm(`确定删除这笔交易吗？`)
    if (!ok) return

    const { error } = await supabase.from("transactions").delete().eq("id", id as any)
    if (error) {
      alert(error.message)
      return
    }

    const maxPage = Math.max(1, Math.ceil(Math.max(0, total - 1) / pageSize))
    const next = Math.min(page, maxPage)
    setPage(next)
    await loadTransactions(next, null)
  }

  useEffect(() => {
    ;(async () => {
      await loadSettingOptions()
      await loadTransactions(1, null)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#fff",
        color: "#0B1220",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "28px 18px 60px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <div style={{ fontSize: 14, color: "#6B7280", marginBottom: 6 }}>S9 汇 · 企业系统</div>
            <div style={{ fontSize: 44, fontWeight: 900, letterSpacing: -0.8, lineHeight: 1.05 }}>
              交易列表
            </div>
            <div style={{ fontSize: 16, color: "#64748B", marginTop: 10 }}>管理和监控所有交易</div>
          </div>

          <button
            onClick={onRefreshAll}
            style={{
              height: 44,
              padding: "0 18px",
              borderRadius: 999,
              border: "1px solid #E5E7EB",
              background: "#0B1220",
              color: "#fff",
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 10px 24px rgba(15,23,42,0.14)",
            }}
          >
            刷新
          </button>
        </div>

        {/* Filters */}
        <div
          style={{
            marginTop: 22,
            border: "1px solid #EEF2F7",
            background: "#fff",
            borderRadius: 18,
            boxShadow: "0 12px 30px rgba(15,23,42,0.06)",
            padding: 18,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ fontSize: 18, fontWeight: 900 }}>🔎 筛选</div>
            <div style={{ fontSize: 13, color: "#94A3B8" }}>下拉来自「设置」企业共享配置</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 14 }}>
            <div>
              <div style={{ fontSize: 13, color: "#111827", fontWeight: 800, marginBottom: 8 }}>货币</div>
              <select value={fCurrency} onChange={(e) => setFCurrency(e.target.value)} style={selectStyle}>
                <option value="ALL">全部</option>
                {currencyOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <div style={{ fontSize: 13, color: "#111827", fontWeight: 800, marginBottom: 8 }}>类型</div>
              <select value={fType} onChange={(e) => setFType(e.target.value)} style={selectStyle}>
                <option value="ALL">全部</option>
                {typeOptions.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <div style={{ fontSize: 13, color: "#111827", fontWeight: 800, marginBottom: 8 }}>PROSY</div>
              <select value={fProsy} onChange={(e) => setFProsy(e.target.value)} style={selectStyle}>
                <option value="ALL">全部</option>
                {prosyOptions.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div>
              <div style={{ fontSize: 13, color: "#111827", fontWeight: 800, marginBottom: 8 }}>序列号</div>
              <input
                value={fSerial}
                onChange={(e) => setFSerial(e.target.value)}
                placeholder="例如 #1 / 12"
                style={inputStyle}
                inputMode="numeric"
              />
            </div>

            <div>
              <div style={{ fontSize: 13, color: "#111827", fontWeight: 800, marginBottom: 8 }}>日期</div>
              <input value={fDate} onChange={(e) => setFDate(e.target.value)} type="date" style={inputStyle} />
            </div>

            <div>
              <div style={{ fontSize: 13, color: "#111827", fontWeight: 800, marginBottom: 8 }}>每页项目数</div>
              <select
                value={String(pageSize)}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setPageSize(v)
                  setPage(1)
                  setTimeout(() => loadTransactions(1, null), 0)
                }}
                style={selectStyle}
              >
                {[10, 20, 30, 50].map((n) => (
                  <option key={n} value={String(n)}>{n}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
            <button
              onClick={onApply}
              style={{
                height: 44,
                padding: "0 18px",
                borderRadius: 12,
                border: "1px solid #0B1220",
                background: "#0B1220",
                color: "#fff",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              应用筛选
            </button>

            <button
              onClick={onSearchSerial}
              style={{
                height: 44,
                padding: "0 18px",
                borderRadius: 12,
                border: "1px solid #E5E7EB",
                background: "#fff",
                color: "#0B1220",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              搜索序列号
            </button>

            <button
              onClick={onReset}
              style={{
                height: 44,
                padding: "0 18px",
                borderRadius: 12,
                border: "1px solid #E5E7EB",
                background: "#fff",
                color: "#0B1220",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              重置
            </button>
          </div>

          {err ? (
            <div
              style={{
                marginTop: 14,
                background: "#FEF2F2",
                border: "1px solid #FECACA",
                color: "#991B1B",
                padding: "10px 12px",
                borderRadius: 12,
                fontWeight: 800,
              }}
            >
              {err}
            </div>
          ) : null}
        </div>

        {/* Table */}
        <div
          style={{
            marginTop: 18,
            border: "1px solid #EEF2F7",
            background: "#fff",
            borderRadius: 18,
            boxShadow: "0 12px 30px rgba(15,23,42,0.06)",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "16px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 900 }}>交易记录</div>
            <div style={{ fontSize: 13, color: "#64748B", fontWeight: 800 }}>共 {total} 条</div>
          </div>

          <div style={{ borderTop: "1px solid #EEF2F7" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
              <thead>
                <tr style={{ background: "#F8FAFC" }}>
                  {["序列号", "日期", "PROSY", "货币", "类型", "金额", "汇率(3dp)", "MYR", "USDT", "操作"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "12px 14px",
                        fontSize: 13,
                        color: "#0F172A",
                        fontWeight: 900,
                        borderTop: "1px solid #EEF2F7",
                        borderBottom: "1px solid #EEF2F7",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} style={{ padding: 18, color: "#64748B", fontWeight: 800 }}>
                      加载中...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ padding: 18, color: "#64748B", fontWeight: 800 }}>
                      暂无数据
                    </td>
                  </tr>
                ) : (
                  rows.map((r, idx) => {
                    const serial = (page - 1) * pageSize + idx + 1
                    const { myr, usdt } = calcMYRUSDT(r)

                    const prosy = (r.prosy_code ?? "-").toUpperCase()
                    const currency = (r.currency_code ?? "-").toUpperCase()
                    const type = (r.type_code ?? "-").toUpperCase()
                    const showDate = r.date ?? (r.created_at ? fmtDateYYYYMMDD(r.created_at) : "-")

                    const isNegative = Number(r.amount ?? 0) < 0
                    const rowColor = isNegative ? "#DC2626" : "#0F172A"
                    const isTarget = targetSerial != null && serial === targetSerial

                    return (
                      <tr
                        key={String(r.id)}
                        style={{
                          borderBottom: "1px solid #EEF2F7",
                          background: isTarget ? "#FFF7ED" : "#fff",
                        }}
                      >
                        <td style={{ padding: "12px 14px", fontWeight: 900, color: rowColor }}>#{serial}</td>

                        <td style={{ padding: "12px 14px", fontWeight: 800, color: rowColor }}>
                          {showDate}
                        </td>

                        <td style={{ padding: "12px 14px", fontWeight: 900, color: rowColor }}>
                          {prosy}
                        </td>

                        <td style={{ padding: "12px 14px", fontWeight: 900, color: rowColor }}>
                          {currency}
                        </td>

                        <td style={{ padding: "12px 14px", fontWeight: 900, color: rowColor }}>
                          {type}
                        </td>

                        <td style={{ padding: "12px 14px", fontWeight: 900, color: rowColor }}>
                          {r.amount == null ? "-" : fmtNumber(Number(r.amount), 2)}
                        </td>

                        <td style={{ padding: "12px 14px", fontWeight: 900, color: rowColor }}>
                          {r.rate == null || r.rate === 0 ? "-" : fmtNumber(Number(r.rate), 3)}
                        </td>

                        <td style={{ padding: "12px 14px", fontWeight: 900, color: rowColor }}>
                          {myr == null ? "-" : fmtNumber(myr, 2)}
                        </td>

                        <td style={{ padding: "12px 14px", fontWeight: 900, color: rowColor }}>
                          {usdt == null ? "-" : fmtNumber(usdt, 2)}
                        </td>

                        <td style={{ padding: "12px 14px" }}>
                          <button
                            onClick={() => deleteTx(r.id)}
                            style={{
                              height: 34,
                              padding: "0 14px",
                              borderRadius: 12,
                              border: "1px solid #FCA5A5",
                              background: "#EF4444",
                              color: "#fff",
                              fontWeight: 900,
                              cursor: "pointer",
                              boxShadow: "0 8px 18px rgba(239,68,68,0.18)",
                            }}
                          >
                            删除
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: 10,
              padding: "14px 18px",
              borderTop: "1px solid #EEF2F7",
            }}
          >
            <button
              onClick={() => {
                const next = Math.max(1, page - 1)
                setPage(next)
                loadTransactions(next, null)
              }}
              disabled={page <= 1}
              style={{
                height: 40,
                padding: "0 14px",
                borderRadius: 12,
                border: "1px solid #E5E7EB",
                background: page <= 1 ? "#F8FAFC" : "#fff",
                color: "#0B1220",
                fontWeight: 900,
                cursor: page <= 1 ? "not-allowed" : "pointer",
              }}
            >
              上一页
            </button>

            <div style={{ fontSize: 13, color: "#64748B", fontWeight: 900 }}>
              第 {page}/{totalPages} 页
            </div>

            <button
              onClick={() => {
                const next = Math.min(totalPages, page + 1)
                setPage(next)
                loadTransactions(next, null)
              }}
              disabled={page >= totalPages}
              style={{
                height: 40,
                padding: "0 14px",
                borderRadius: 12,
                border: "1px solid #E5E7EB",
                background: page >= totalPages ? "#F8FAFC" : "#fff",
                color: "#0B1220",
                fontWeight: 900,
                cursor: page >= totalPages ? "not-allowed" : "pointer",
              }}
            >
              下一页
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}