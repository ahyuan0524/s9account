"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { createSupabaseBrowser } from "@/lib/supabaseBrowser"

type Chain = "USDT_TRC20" | "USDT_BEP20"

type WalletRow = {
  id: string
  user_id: string
  address: string
  chain: Chain
  balance: number
  created_at: string
}

function isBep20Address(addr: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(addr)
}

function isTrc20Address(addr: string) {
  return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(addr)
}

function chainLabel(chain: Chain) {
  return chain === "USDT_TRC20" ? "TRC20" : "BEP20"
}

async function fetchBalance(address: string, chain: Chain): Promise<number> {
  const res = await fetch("/api/crypto/balance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, chain }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error || "Balance error")
  return Number(json.balance || 0)
}

export default function CryptoPage() {
  const router = useRouter()

  const [supabase, setSupabase] = useState<any>(null)
  const [ready, setReady] = useState(false)

  const [address, setAddress] = useState("")
  const [chain, setChain] = useState<Chain>("USDT_TRC20")

  const [wallets, setWallets] = useState<WalletRow[]>([])
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<string>("")
  const [error, setError] = useState<string>("")

  const [q, setQ] = useState("")

  // 只在浏览器创建 supabase
  useEffect(() => {
    const client = createSupabaseBrowser()
    if (!client) return
    setSupabase(client)
    setReady(true)
  }, [])

  // 校验登录
  useEffect(() => {
    if (!ready || !supabase) return
    ;(async () => {
      const { data } = await supabase.auth.getUser()
      if (!data.user) router.replace("/login")
    })()
  }, [ready, supabase, router])

  async function loadWallets() {
    if (!supabase) return
    setError("")
    const { data, error } = await supabase
      .from("crypto_wallets")
      .select("*")
      .order("created_at", { ascending: true }) // 新增在最下方
    if (error) {
      setError(error.message)
      return
    }
    setWallets((data || []) as WalletRow[])
  }

  // 初始加载
  useEffect(() => {
    if (!ready || !supabase) return
    loadWallets()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, supabase])

  // 自动刷新余额：每 60 秒更新一次（写回 DB）
  useEffect(() => {
    if (!supabase) return
    let timer: any = null

    const run = async () => {
      if (wallets.length === 0) return
      try {
        // 逐个更新，简单稳定
        for (const w of wallets) {
          const b = await fetchBalance(w.address, w.chain)
          await supabase.from("crypto_wallets").update({ balance: b }).eq("id", w.id)
        }
        await loadWallets()
      } catch (e: any) {
        // 不打断用户操作，只显示一次提示
        setNotice(e?.message || "自动刷新失败")
        setTimeout(() => setNotice(""), 2500)
      }
    }

    timer = setInterval(run, 60_000)
    return () => clearInterval(timer)
    // wallets 变化也要跟着刷新 interval 内使用的数据
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, wallets])

  async function addWallet() {
    if (!supabase) return
    setError("")
    setNotice("")

    const addr = address.trim()
    if (!addr) {
      setError("请输入地址")
      return
    }

    // 防止链识别错误：按你选择的链强校验地址
    if (chain === "USDT_TRC20" && !isTrc20Address(addr)) {
      setError("TRC20 地址格式不正确（通常 T 开头）")
      return
    }
    if (chain === "USDT_BEP20" && !isBep20Address(addr)) {
      setError("BEP20 地址格式不正确（0x 开头 42 位）")
      return
    }

    setLoading(true)
    try {
      const { data: userRes } = await supabase.auth.getUser()
      const userId = userRes.user?.id
      if (!userId) {
        router.replace("/login")
        return
      }

      // 先查余额（自动）
      const b = await fetchBalance(addr, chain)

      // 插入数据库（多设备同步关键点）
      const { error: insErr } = await supabase.from("crypto_wallets").insert({
        user_id: userId,
        address: addr,
        chain,
        balance: b,
      })

      if (insErr) throw new Error(insErr.message)

      setAddress("")
      await loadWallets()
      setNotice("新增成功（已同步到云端）")
      setTimeout(() => setNotice(""), 2000)
    } catch (e: any) {
      setError(e?.message || "新增失败")
    } finally {
      setLoading(false)
    }
  }

  async function removeWallet(id: string) {
    if (!supabase) return
    setError("")
    setNotice("")
    const { error } = await supabase.from("crypto_wallets").delete().eq("id", id)
    if (error) {
      setError(error.message)
      return
    }
    await loadWallets()
  }

  async function refreshNow() {
    // 顶部右上角“刷新”：重新拉取列表 + 同步更新余额一次
    if (!supabase) return
    setLoading(true)
    setError("")
    setNotice("")
    try {
      await loadWallets()
      // 更新一次余额（仍然是自动动作，不给单行按钮）
      for (const w of wallets) {
        const b = await fetchBalance(w.address, w.chain)
        await supabase.from("crypto_wallets").update({ balance: b }).eq("id", w.id)
      }
      await loadWallets()
      setNotice("已刷新")
      setTimeout(() => setNotice(""), 1500)
    } catch (e: any) {
      setError(e?.message || "刷新失败")
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    const keyword = q.trim().toLowerCase()
    if (!keyword) return wallets
    return wallets.filter((w) => {
      return (
        w.address.toLowerCase().includes(keyword) ||
        w.chain.toLowerCase().includes(keyword)
      )
    })
  }, [wallets, q])

  if (!ready) return null

  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <div>
          <div style={styles.breadcrumb}>S9 汇 · 企业系统</div>
          <div style={styles.h1}>加密货币报告</div>
          <div style={styles.sub}>
            多设备同步保存地址（Mac / 手机登录都能看到）· 余额每 60 秒自动更新
          </div>
        </div>

        <button onClick={refreshNow} disabled={loading} style={styles.btnDark}>
          刷新
        </button>
      </div>

      <div style={styles.card}>
        <div style={styles.cardTitle}>新增地址</div>

        <div style={styles.row}>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="请输入地址（TRC20 或 BEP20）"
            style={styles.input}
          />

          <select
            value={chain}
            onChange={(e) => setChain(e.target.value as Chain)}
            style={styles.select}
          >
            <option value="USDT_TRC20">USDT (TRC20)</option>
            <option value="USDT_BEP20">USDT (BEP20)</option>
          </select>

          <button onClick={addWallet} disabled={loading} style={styles.btnPrimary}>
            {loading ? "处理中..." : "新增"}
          </button>
        </div>

        {(error || notice) && (
          <div style={{ ...styles.alert, ...(error ? styles.alertError : styles.alertOk) }}>
            {error || notice}
          </div>
        )}
      </div>

      <div style={{ ...styles.card, marginTop: 16 }}>
        <div style={styles.cardHeadRow}>
          <div>
            <div style={styles.cardTitle}>地址列表</div>
            <div style={styles.cardHint}>提示：新增会追加到列表最下方（按创建时间排序）</div>
          </div>

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索 地址 / 链…"
            style={{ ...styles.input, maxWidth: 320 }}
          />
        </div>

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, textAlign: "left" }}>地址</th>
                <th style={styles.th}>链</th>
                <th style={styles.th}>余额</th>
                <th style={styles.th}>操作</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((w) => (
                <tr key={w.id} style={styles.tr}>
                  <td style={styles.tdLeft}>
                    <div style={styles.addr}>{w.address}</div>
                    <div style={styles.time}>
                      {new Date(w.created_at).toLocaleString()}
                    </div>
                  </td>

                  <td style={styles.tdCenter}>
                    <span style={styles.pill}>{chainLabel(w.chain)}</span>
                  </td>

                  <td style={styles.tdCenter}>
                    <div style={styles.balance}>{Number(w.balance || 0).toFixed(2)} USDT</div>
                  </td>

                  <td style={styles.tdCenter}>
                    <button onClick={() => removeWallet(w.id)} style={styles.btnDanger}>
                      删除
                    </button>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: 18, color: "#6b7280" }}>
                    暂无数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#ffffff",
    padding: "28px 28px 50px",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji",
    color: "#0f172a",
  },
  topBar: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 18,
  },
  breadcrumb: {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 6,
  },
  h1: {
    fontSize: 42,
    letterSpacing: -0.8,
    fontWeight: 900,
    lineHeight: 1.05,
  },
  sub: {
    marginTop: 10,
    fontSize: 14,
    color: "#64748b",
  },
  card: {
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    padding: 18,
    boxShadow: "0 10px 28px rgba(2, 6, 23, 0.06)",
    background: "#fff",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 800,
    marginBottom: 12,
  },
  cardHint: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 4,
  },
  row: {
    display: "flex",
    gap: 12,
    alignItems: "center",
  },
  input: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    padding: "0 14px",
    outline: "none",
    background: "#ffffff",
    boxShadow: "0 2px 10px rgba(2,6,23,0.04)",
  },
  select: {
    height: 46,
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    padding: "0 12px",
    background: "#fff",
    outline: "none",
    minWidth: 170,
  },
  btnPrimary: {
    height: 46,
    borderRadius: 14,
    border: "none",
    padding: "0 18px",
    background: "#1d4ed8",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
    minWidth: 110,
    boxShadow: "0 10px 22px rgba(29,78,216,0.25)",
  },
  btnDark: {
    height: 44,
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    padding: "0 16px",
    background: "#0f172a",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
  },
  alert: {
    marginTop: 12,
    borderRadius: 14,
    padding: "10px 12px",
    fontSize: 13,
    border: "1px solid",
  },
  alertError: {
    background: "#fff1f2",
    borderColor: "#fecdd3",
    color: "#9f1239",
  },
  alertOk: {
    background: "#ecfeff",
    borderColor: "#a5f3fc",
    color: "#0e7490",
  },
  cardHeadRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  tableWrap: {
    border: "1px solid #eef2f7",
    borderRadius: 16,
    overflow: "hidden",
    background: "#fff",
  },
  table: {
    width: "100%",
    borderCollapse: "separate",
    borderSpacing: 0,
  },
  th: {
    background: "#f1f5f9",
    padding: "12px 14px",
    fontSize: 13,
    color: "#0f172a",
    textAlign: "center",
    borderBottom: "1px solid #e5e7eb",
  },
  tr: {
    borderTop: "1px solid #eef2f7",
  },
  tdLeft: {
    padding: "14px 14px",
    borderBottom: "1px solid #eef2f7",
  },
  tdCenter: {
    padding: "14px 14px",
    textAlign: "center",
    borderBottom: "1px solid #eef2f7",
    whiteSpace: "nowrap",
  },
  addr: {
    fontWeight: 800,
    fontSize: 14,
    wordBreak: "break-all",
  },
  time: {
    marginTop: 6,
    fontSize: 12,
    color: "#94a3b8",
  },
  pill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid #e5e7eb",
    background: "#0f172a",
    color: "#fff",
    fontSize: 12,
    fontWeight: 900,
    minWidth: 64,
  },
  balance: {
    fontWeight: 900,
    fontSize: 14,
  },
  btnDanger: {
    height: 34,
    borderRadius: 12,
    border: "none",
    padding: "0 14px",
    background: "#ef4444",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  },
}