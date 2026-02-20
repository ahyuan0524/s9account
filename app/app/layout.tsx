// app/app/layout.tsx
import type { ReactNode } from "react"
import Link from "next/link"

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="s9-app">
      {/* 顶部玻璃 Header（只保留这一条，不要页面里面再写第二条 Header） */}
      <header className="s9-header">
        <div className="s9-headerInner">
          <div className="s9-brand">
            <div className="s9-badge">S9</div>
            <div className="s9-brandText">S9 汇</div>
          </div>

          <nav className="s9-nav">
            <Link className="s9-navItem" href="/app">
              仪表盘
            </Link>
            <Link className="s9-navItem" href="/app/orders">
              订单录入
            </Link>
            <Link className="s9-navItem" href="/app/transactions">
              交易记录
            </Link>
            <Link className="s9-navItem" href="/app/crypto">
              加密货币
            </Link>
            <Link className="s9-navItem" href="/app/profit">
              利润
            </Link>
            <Link className="s9-navItem" href="/app/reports">
              报告
            </Link>
            <Link className="s9-navItem" href="/app/settings">
              设置
            </Link>
          </nav>
        </div>
      </header>

      {/* 主体区域 */}
      <main className="s9-main">
        <div className="s9-container">{children}</div>
      </main>
    </div>
  )
}