"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const NAV = [
  { href: "/app", label: "仪表盘" },
  { href: "/app/orders", label: "订单录入" },
  { href: "/app/transactions", label: "交易记录" },
  { href: "/app/crypto", label: "加密货币" },
  { href: "/app/profit", label: "利润" },
  { href: "/app/reports", label: "报告" },
  { href: "/app/settings", label: "设置" },
]

export default function TopHeader() {
  const pathname = usePathname()

  return (
    <header className="s9-header">
      <div className="s9-headerInner">
        <div className="s9-brand">
          <div className="s9-brandIcon">S9</div>
          <div className="s9-brandText">S9 汇</div>
        </div>

        <nav className="s9-nav">
          {NAV.map((item) => {
            const active =
              pathname === item.href || pathname?.startsWith(item.href + "/")
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`s9-navItem ${active ? "isActive" : ""}`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}