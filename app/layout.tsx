// app/layout.tsx
import type { ReactNode } from "react"
import "./globals.css"

export const metadata = {
  title: "S9 汇",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh">
      <body>{children}</body>
    </html>
  )
}