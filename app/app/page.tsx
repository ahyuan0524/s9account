"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";

export default function AppHome() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowser(), []);

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      const { data, error } = await supabase.auth.getUser();
      const userEmail = data.user?.email;

      if (!userEmail || error) {
        router.replace("/login");
        return;
      }

      if (!alive) return;
      setEmail(userEmail);
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [router, supabase]);

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif" }}>Loading…</div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(1200px 600px at 20% 0%, rgba(59,130,246,.25), transparent 60%), radial-gradient(900px 500px at 90% 20%, rgba(16,185,129,.20), transparent 55%), linear-gradient(180deg, #0b1220 0%, #070b14 100%)",
        padding: "48px 18px",
        color: "#e5e7eb",
        fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 980,
          margin: "0 auto",
          display: "grid",
          gap: 18,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: 0.2 }}>S9 汇后台</div>
            <div style={{ marginTop: 6, color: "rgba(229,231,235,.75)" }}>已登录：{email}</div>
          </div>

          <button
            onClick={logout}
            style={{
              border: "1px solid rgba(255,255,255,.18)",
              background: "rgba(255,255,255,.06)",
              color: "#fff",
              padding: "10px 14px",
              borderRadius: 12,
              cursor: "pointer",
              backdropFilter: "blur(10px)",
            }}
          >
            退出登录
          </button>
        </div>

        <div
          style={{
            border: "1px solid rgba(255,255,255,.12)",
            background: "rgba(255,255,255,.06)",
            borderRadius: 16,
            padding: 18,
            backdropFilter: "blur(12px)",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 10 }}>提示</div>
          <div style={{ color: "rgba(229,231,235,.8)", lineHeight: 1.7 }}>
            左侧菜单是你的功能入口。你现在这个页面是“后台主页”。
            <br />
            如果你想把默认进入页改成“加密货币/余额”，我也可以帮你一键改好。
          </div>
        </div>
      </div>
    </div>
  );
}