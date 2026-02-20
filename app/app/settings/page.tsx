"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type RowItem = {
  id: number
  code: string
  created_at?: string
}

export default function SettingsPage() {
  // 顶部筛选器搜索（全局）
  const [globalSearch, setGlobalSearch] = useState("")

  // 三块数据
  const [prosy, setProsy] = useState<RowItem[]>([])
  const [currency, setCurrency] = useState<RowItem[]>([])
  const [types, setTypes] = useState<RowItem[]>([])

  // 新增输入
  const [newProsy, setNewProsy] = useState("")
  const [newCurrency, setNewCurrency] = useState("")
  const [newType, setNewType] = useState("")

  // 每块自己的搜索框
  const [searchProsy, setSearchProsy] = useState("")
  const [searchCurrency, setSearchCurrency] = useState("")
  const [searchType, setSearchType] = useState("")

  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string>("")

  function showToast(msg: string) {
    setToast(msg)
    window.setTimeout(() => setToast(""), 2500)
  }

  async function loadData() {
    setLoading(true)

    // ✅ 重点：order ascending true -> 新增会在最下方
    const { data: p, error: pe } = await supabase
      .from("prosy_list")
      .select("id, code, created_at")
      .order("id", { ascending: true })

    const { data: c, error: ce } = await supabase
      .from("currency_list")
      .select("id, code, created_at")
      .order("id", { ascending: true })

    const { data: t, error: te } = await supabase
      .from("type_list")
      .select("id, code, created_at")
      .order("id", { ascending: true })

    if (pe) showToast(`Prosy 读取失败：${pe.message}`)
    if (ce) showToast(`货币读取失败：${ce.message}`)
    if (te) showToast(`类型读取失败：${te.message}`)

    setProsy((p as RowItem[]) || [])
    setCurrency((c as RowItem[]) || [])
    setTypes((t as RowItem[]) || [])

    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  async function addItem(table: "prosy_list" | "currency_list" | "type_list", value: string, clear: (v: string) => void) {
    const v = value.trim()
    if (!v) return showToast("请输入内容")

    // 防止重复（大小写不敏感）
    const exists = await supabase
      .from(table)
      .select("id")
      .ilike("code", v)
      .maybeSingle()

    if (exists.data?.id) return showToast("已存在，不能重复新增")

    const { error } = await supabase.from(table).insert({ code: v })
    if (error) return showToast(`新增失败：${error.message}`)

    clear("")
    showToast("新增成功")
    await loadData()

    // 新增后滚动到最下方：稍等 DOM 更新
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-scroll="${table}"]`) as HTMLDivElement | null
      if (el) el.scrollTop = el.scrollHeight
    })
  }

  async function deleteItem(table: "prosy_list" | "currency_list" | "type_list", id: number) {
    const ok = confirm("确定要删除吗？")
    if (!ok) return

    const { error } = await supabase.from(table).delete().eq("id", id)
    if (error) return showToast(`删除失败：${error.message}`)

    showToast("删除成功")
    await loadData()
  }

  // 全局过滤（同时对三块生效）
  const globalFilter = (s: string) => {
    const q = globalSearch.trim().toLowerCase()
    if (!q) return true
    return s.toLowerCase().includes(q)
  }

  const filteredProsy = useMemo(() => {
    const q = searchProsy.trim().toLowerCase()
    return prosy.filter((x) => globalFilter(x.code) && (!q || x.code.toLowerCase().includes(q)))
  }, [prosy, searchProsy, globalSearch])

  const filteredCurrency = useMemo(() => {
    const q = searchCurrency.trim().toLowerCase()
    return currency.filter((x) => globalFilter(x.code) && (!q || x.code.toLowerCase().includes(q)))
  }, [currency, searchCurrency, globalSearch])

  const filteredTypes = useMemo(() => {
    const q = searchType.trim().toLowerCase()
    return types.filter((x) => globalFilter(x.code) && (!q || x.code.toLowerCase().includes(q)))
  }, [types, searchType, globalSearch])

  return (
    <div style={styles.page}>
      {/* 顶部 Header */}
      <div style={styles.headerRow}>
        <div>
          <div style={styles.kicker}>S9 汇 · 企业系统</div>
          <h1 style={styles.h1}>企业设置中心</h1>
          <div style={styles.sub}>管理 Prosy 客户代号、货币、类型（企业共享模式）</div>
        </div>

        <button style={styles.refreshBtn} onClick={loadData}>
          刷新
        </button>
      </div>

      {/* 顶部筛选器（你图那种） */}
      <div style={styles.filterCard}>
        <div style={styles.filterTitleRow}>
          <span style={styles.filterIcon}>⏷</span>
          <div style={styles.filterTitle}>筛选器</div>
        </div>

        <div style={styles.label}>搜索</div>
        <input
          value={globalSearch}
          onChange={(e) => setGlobalSearch(e.target.value)}
          placeholder="搜索代号 / 货币 / 类型…"
          style={styles.bigSearch}
        />

        <div style={{ marginTop: 14 }}>
          <button
            style={styles.applyBtn}
            onClick={() => showToast(globalSearch ? `已应用筛选：${globalSearch}` : "已清空筛选")}
          >
            🔎 应用筛选
          </button>
        </div>
      </div>

      {/* 内容区 */}
      <div style={styles.grid}>
        <Section
          title="Prosy 客户代号"
          placeholder="例如：PBB / A3054 / S1531"
          value={newProsy}
          onChange={setNewProsy}
          onAdd={() => addItem("prosy_list", newProsy, setNewProsy)}
          search={searchProsy}
          onSearch={setSearchProsy}
          items={filteredProsy}
          onDelete={(id) => deleteItem("prosy_list", id)}
          table="prosy_list"
          loading={loading}
        />

        <Section
          title="货币列表"
          placeholder="例如：MYR / USDT / THB"
          value={newCurrency}
          onChange={setNewCurrency}
          onAdd={() => addItem("currency_list", newCurrency, setNewCurrency)}
          search={searchCurrency}
          onSearch={setSearchCurrency}
          items={filteredCurrency}
          onDelete={(id) => deleteItem("currency_list", id)}
          table="currency_list"
          loading={loading}
        />

        <Section
          title="类型种类"
          placeholder="例如：RM / U / IN / OUT"
          value={newType}
          onChange={setNewType}
          onAdd={() => addItem("type_list", newType, setNewType)}
          search={searchType}
          onSearch={setSearchType}
          items={filteredTypes}
          onDelete={(id) => deleteItem("type_list", id)}
          table="type_list"
          loading={loading}
        />
      </div>

      {!!toast && <div style={styles.toast}>{toast}</div>}
    </div>
  )
}

function Section(props: {
  title: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  onAdd: () => void
  search: string
  onSearch: (v: string) => void
  items: RowItem[]
  onDelete: (id: number) => void
  table: "prosy_list" | "currency_list" | "type_list"
  loading: boolean
}) {
  return (
    <div style={styles.card}>
      <div style={styles.cardHead}>
        <div>
          <div style={styles.cardTitle}>{props.title}</div>
          <div style={styles.cardHint}>企业共享 · 统一配置</div>
        </div>
      </div>

      {/* 新增 */}
      <div style={styles.addRow}>
        <input
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          placeholder={props.placeholder}
          style={styles.input}
        />
        <button style={styles.primaryBtn} onClick={props.onAdd}>
          新增
        </button>
      </div>

      {/* 搜索 */}
      <div style={styles.searchRow}>
        <input
          value={props.search}
          onChange={(e) => props.onSearch(e.target.value)}
          placeholder="搜索…"
          style={styles.searchInput}
        />
      </div>

      {/* 列表 */}
      <div style={styles.list} data-scroll={props.table}>
        {props.loading ? (
          <div style={styles.empty}>加载中…</div>
        ) : props.items.length === 0 ? (
          <div style={styles.empty}>暂无数据</div>
        ) : (
          props.items.map((item) => (
            <div key={item.id} style={styles.row}>
              <div style={styles.rowLeft}>
                <div style={styles.badge}>{item.code}</div>
              </div>
              <button style={styles.dangerBtn} onClick={() => props.onDelete(item.id)}>
                删除
              </button>
            </div>
          ))
        )}
      </div>

      {/* 小提示：新增在最下方 */}
      <div style={styles.footerNote}>提示：新增会追加到列表最下方</div>
    </div>
  )
}

const styles: Record<string, any> = {
  page: {
    minHeight: "100vh",
    background: "#ffffff",
    padding: "34px 34px 80px",
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial',
    color: "#0f172a",
  },

  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 16,
    maxWidth: 1200,
    margin: "0 auto 18px",
  },
  kicker: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 6,
  },
  h1: {
    margin: 0,
    fontSize: 28,
    letterSpacing: "-0.02em",
  },
  sub: {
    marginTop: 6,
    fontSize: 13,
    color: "#64748b",
  },
  refreshBtn: {
    background: "#0f172a",
    color: "#fff",
    border: "none",
    padding: "10px 14px",
    borderRadius: 10,
    cursor: "pointer",
    fontSize: 13,
  },

  filterCard: {
    maxWidth: 1200,
    margin: "0 auto 24px",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 18,
    background: "#ffffff",
    boxShadow: "0 6px 16px rgba(15,23,42,0.06)",
  },
  filterTitleRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 10 },
  filterIcon: { fontSize: 18, color: "#0f172a" },
  filterTitle: { fontWeight: 700, fontSize: 16 },
  label: { fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 8 },
  bigSearch: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    outline: "none",
    fontSize: 14,
    boxShadow: "0 2px 10px rgba(15,23,42,0.06)",
  },
  applyBtn: {
    background: "#111827",
    color: "#fff",
    border: "none",
    padding: "10px 14px",
    borderRadius: 12,
    cursor: "pointer",
    fontSize: 13,
  },

  grid: {
    maxWidth: 1200,
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 18,
  },

  card: {
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    background: "#fff",
    padding: 16,
    boxShadow: "0 10px 22px rgba(15,23,42,0.06)",
    minHeight: 520,
    display: "flex",
    flexDirection: "column",
  },
  cardHead: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: 18, fontWeight: 800, letterSpacing: "-0.01em" },
  cardHint: { fontSize: 12, color: "#64748b", marginTop: 4 },

  addRow: { display: "flex", gap: 10, marginTop: 14 },
  input: {
    flex: 1,
    padding: "10px 12px",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    fontSize: 14,
    outline: "none",
    background: "#fff",
  },
  primaryBtn: {
    background: "linear-gradient(135deg, #2563eb, #06b6d4)",
    color: "#fff",
    border: "none",
    padding: "10px 14px",
    borderRadius: 12,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 700,
  },

  searchRow: { marginTop: 10 },
  searchInput: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    fontSize: 13,
    outline: "none",
    background: "#f8fafc",
  },

  list: {
    marginTop: 12,
    borderRadius: 14,
    border: "1px solid #eef2f7",
    background: "#ffffff",
    padding: 10,
    flex: 1,
    overflow: "auto",
    maxHeight: 320,
  },
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: "10px 10px",
    borderRadius: 12,
    border: "1px solid #f1f5f9",
    background: "#fbfdff",
    marginBottom: 8,
  },
  rowLeft: { display: "flex", alignItems: "center", gap: 10 },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#0f172a",
    color: "#fff",
    fontWeight: 800,
    letterSpacing: "0.02em",
    fontSize: 13,
  },
  dangerBtn: {
    background: "#ef4444",
    color: "#fff",
    border: "none",
    padding: "8px 12px",
    borderRadius: 10,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
  },

  empty: { color: "#94a3b8", fontSize: 13, padding: 10 },

  footerNote: {
    marginTop: 10,
    fontSize: 12,
    color: "#94a3b8",
  },

  toast: {
    position: "fixed",
    right: 20,
    bottom: 20,
    background: "#0f172a",
    color: "#fff",
    padding: "10px 12px",
    borderRadius: 12,
    boxShadow: "0 12px 30px rgba(0,0,0,0.15)",
    fontSize: 13,
  },
}