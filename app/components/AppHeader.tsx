// app/components/AppHeader.tsx
import Link from "next/link"

type NavItem = {
  href: string
  label: string
}

const NAV: NavItem[] = [
  { href: "/app", label: "仪表盘" },
  { href: "/app/orders", label: "订单录入" },
  { href: "/app/transactions", label: "交易记录" },
  { href: "/app/crypto", label: "加密货币" },
  { href: "/app/profit", label: "利润" },
  { href: "/app/reports", label: "报告" },
  { href: "/app/settings", label: "设置" },
]

export default function AppHeader() {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid #eef2f7",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        {/* 左侧：Logo + 品牌名 */}
        <Link
          href="/app"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            textDecoration: "none",
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: "#0f172a",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              letterSpacing: 0.5,
            }}
          >
            S9
          </div>
          <div style={{ lineHeight: 1.1 }}>
            <div style={{ fontWeight: 900, fontSize: 14, color: "#0f172a" }}>
              S9 汇
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              Enterprise Console
            </div>
          </div>
        </Link>

        {/* 右侧：主导航 */}
        <nav
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} style={navLinkStyle}>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}

const navLinkStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#0f172a",
  textDecoration: "none",
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid transparent",
}