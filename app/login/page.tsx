"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [remember, setRemember] = useState(true);
  const [showPwd, setShowPwd] = useState(false);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("s9_login_email");
      const savedRemember = localStorage.getItem("s9_login_remember");
      if (savedRemember === "0") setRemember(false);
      if (saved) setEmail(saved);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("s9_login_remember", remember ? "1" : "0");
      if (remember) localStorage.setItem("s9_login_email", email);
      else localStorage.removeItem("s9_login_email");
    } catch {}
  }, [remember, email]);

  const canSubmit = useMemo(() => {
    return email.trim().length > 0 && password.length > 0 && !loading;
  }, [email, password, loading]);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setMsg(error.message || "登录失败");
        return;
      }

      window.location.href = "/app";
    } catch (err: any) {
      setMsg(err?.message || "登录失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      {/* 背景：暗金金融风 */}
      <div className="bg" />
      <div className="noise" />
      <div className="grid" />
      <div className="glow1" />
      <div className="glow2" />

      <div className="wrap">
        <div className="card">
          <div className="top">
            <div className="brand">
              <div className="logoBox">
                <img className="logo" src="/s9-logo.png" alt="S9 汇" />
              </div>
              <div>
                <div className="titleRow">
                  <div className="title">S9 汇</div>
                  <span className="badge">EXCHANGE</span>
                </div>
                <div className="subtitle">Secure Client Portal</div>
              </div>
            </div>

            <div className="rightMeta">
              <div className="metaLine">可信 · 稳定 · 快速结算</div>
              <div className="metaSmall">S9 Currency & Settlement</div>
            </div>
          </div>

          <div className="divider" />

          <form onSubmit={onLogin} className="form">
            <div className="field">
              <div className="label">邮箱 / 账号</div>
              <div className="inputWrap">
                <span className="icon">✉️</span>
                <input
                  className="input"
                  placeholder="name@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="field">
              <div className="label">密码</div>
              <div className="inputWrap">
                <span className="icon">🔒</span>
                <input
                  className="input"
                  placeholder="••••••••"
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="miniBtn"
                  onClick={() => setShowPwd((v) => !v)}
                >
                  {showPwd ? "隐藏" : "显示"}
                </button>
              </div>
            </div>

            <div className="row">
              <label className="check">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                <span>记住我</span>
              </label>

              <div className="status">{loading ? "登录中…" : ""}</div>
            </div>

            {msg ? <div className="error">{msg}</div> : null}

            <button className="btn" disabled={!canSubmit} type="submit">
              {loading ? "验证中…" : "登录"}
              <span className="btnArrow">→</span>
            </button>

            <div className="foot">
              <span className="dot" />
              <span>本系统仅供授权客户使用</span>
              <span className="dot" />
            </div>
          </form>
        </div>

        {/* 左侧金融信息块（高级感） */}
        <div className="side">
          <div className="sideTitle">专业汇率服务</div>
          <div className="sideText">
            · 多币种结算 · 资金流追踪 · 交易记录审计
            <br />
            · 安全登录 · 权限隔离 · 数据加密
          </div>

          <div className="chips">
            <div className="chip">USDT</div>
            <div className="chip">MYR</div>
            <div className="chip">THB</div>
            <div className="chip">RMB</div>
          </div>

          <div className="kline">
            <div className="bar b1" />
            <div className="bar b2" />
            <div className="bar b3" />
            <div className="bar b4" />
            <div className="bar b5" />
            <div className="bar b6" />
            <div className="bar b7" />
            <div className="bar b8" />
          </div>

          <div className="tiny">
            S9 汇 · Client Portal · v1
          </div>
        </div>
      </div>

      <style jsx>{`
        .page {
          min-height: 100vh;
          position: relative;
          overflow: hidden;
          color: #e9e9e9;
          padding: 28px;
        }

        /* 背景：暗色金融渐变 */
        .bg {
          position: absolute;
          inset: 0;
          background: radial-gradient(
              900px 520px at 18% 18%,
              rgba(255, 199, 0, 0.10),
              transparent 60%
            ),
            radial-gradient(
              900px 520px at 82% 30%,
              rgba(140, 70, 255, 0.12),
              transparent 60%
            ),
            radial-gradient(
              1000px 700px at 50% 120%,
              rgba(0, 160, 255, 0.10),
              transparent 55%
            ),
            linear-gradient(180deg, #0b0e13 0%, #07090d 60%, #06070a 100%);
        }

        /* 轻微噪点更高级 */
        .noise {
          position: absolute;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='.18'/%3E%3C/svg%3E");
          opacity: 0.25;
          mix-blend-mode: overlay;
          pointer-events: none;
        }

        /* 网格线 */
        .grid {
          position: absolute;
          inset: 0;
          background: linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
          background-size: 60px 60px;
          mask-image: radial-gradient(circle at 40% 30%, black 40%, transparent 70%);
          opacity: 0.22;
          pointer-events: none;
        }

        /* 金色光晕 */
        .glow1,
        .glow2 {
          position: absolute;
          width: 560px;
          height: 560px;
          border-radius: 999px;
          filter: blur(55px);
          opacity: 0.35;
          pointer-events: none;
        }
        .glow1 {
          left: -120px;
          top: -140px;
          background: radial-gradient(circle, rgba(255, 199, 0, 0.55), transparent 60%);
        }
        .glow2 {
          right: -160px;
          bottom: -180px;
          background: radial-gradient(circle, rgba(0, 160, 255, 0.38), transparent 60%);
        }

        .wrap {
          position: relative;
          z-index: 1;
          max-width: 1100px;
          margin: 0 auto;
          min-height: calc(100vh - 56px);
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: 22px;
          align-items: center;
        }

        @media (max-width: 980px) {
          .wrap {
            grid-template-columns: 1fr;
          }
          .side {
            order: -1;
          }
        }

        .card {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.10);
          border-radius: 18px;
          box-shadow: 0 30px 90px rgba(0, 0, 0, 0.55);
          backdrop-filter: blur(14px);
          padding: 22px;
        }

        .top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .logoBox {
          width: 54px;
          height: 54px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.14);
          display: grid;
          place-items: center;
          box-shadow: inset 0 0 0 1px rgba(255, 199, 0, 0.10);
        }

        .logo {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          object-fit: cover;
        }

        .titleRow {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .title {
          font-size: 22px;
          font-weight: 900;
          letter-spacing: 0.6px;
          color: #fff;
        }

        .badge {
          font-size: 11px;
          letter-spacing: 1.2px;
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(255, 199, 0, 0.12);
          border: 1px solid rgba(255, 199, 0, 0.22);
          color: rgba(255, 222, 120, 0.95);
        }

        .subtitle {
          margin-top: 2px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.65);
        }

        .rightMeta {
          text-align: right;
        }
        .metaLine {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.70);
        }
        .metaSmall {
          margin-top: 4px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.45);
        }

        .divider {
          height: 1px;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 199, 0, 0.35),
            rgba(255, 255, 255, 0.10),
            transparent
          );
          margin: 16px 0 10px;
        }

        .form {
          display: grid;
          gap: 12px;
          margin-top: 10px;
        }

        .field {
          display: grid;
          gap: 8px;
        }

        .label {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.70);
          letter-spacing: 0.3px;
        }

        .inputWrap {
          position: relative;
          display: flex;
          align-items: center;
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.10);
          border-radius: 14px;
          height: 46px;
          padding: 0 10px;
        }

        .icon {
          width: 34px;
          display: grid;
          place-items: center;
          opacity: 0.9;
          font-size: 14px;
        }

        .input {
          width: 100%;
          height: 100%;
          background: transparent;
          border: 0;
          outline: none;
          color: #fff;
          font-size: 14px;
          padding-right: 10px;
        }

        .input::placeholder {
          color: rgba(255, 255, 255, 0.35);
        }

        .inputWrap:focus-within {
          border-color: rgba(255, 199, 0, 0.45);
          box-shadow: 0 0 0 4px rgba(255, 199, 0, 0.10);
        }

        .miniBtn {
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(255, 255, 255, 0.06);
          color: rgba(255, 255, 255, 0.78);
          border-radius: 12px;
          height: 32px;
          padding: 0 10px;
          cursor: pointer;
          font-size: 12px;
        }
        .miniBtn:hover {
          background: rgba(255, 255, 255, 0.10);
        }

        .row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 2px;
        }

        .check {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.75);
          user-select: none;
        }

        .status {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.45);
        }

        .error {
          color: rgba(255, 180, 180, 0.95);
          background: rgba(176, 0, 32, 0.12);
          border: 1px solid rgba(176, 0, 32, 0.25);
          padding: 10px 12px;
          border-radius: 14px;
          font-size: 13px;
        }

        .btn {
          margin-top: 6px;
          height: 48px;
          border-radius: 14px;
          border: 1px solid rgba(255, 199, 0, 0.30);
          background: linear-gradient(90deg, rgba(255, 199, 0, 0.20), rgba(255, 255, 255, 0.08));
          color: rgba(255, 240, 200, 0.95);
          font-weight: 800;
          letter-spacing: 0.4px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          box-shadow: 0 18px 40px rgba(0, 0, 0, 0.35);
          transition: transform 0.12s ease, background 0.12s ease;
        }

        .btn:hover {
          transform: translateY(-1px);
          background: linear-gradient(90deg, rgba(255, 199, 0, 0.28), rgba(255, 255, 255, 0.10));
        }

        .btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        .btnArrow {
          font-size: 16px;
          opacity: 0.9;
        }

        .foot {
          margin-top: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.45);
        }

        .dot {
          width: 5px;
          height: 5px;
          border-radius: 99px;
          background: rgba(255, 199, 0, 0.55);
          box-shadow: 0 0 0 4px rgba(255, 199, 0, 0.10);
        }

        /* 右侧金融块 */
        .side {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.10);
          border-radius: 18px;
          padding: 22px;
          box-shadow: 0 30px 90px rgba(0, 0, 0, 0.35);
          backdrop-filter: blur(14px);
        }

        .sideTitle {
          font-size: 14px;
          font-weight: 900;
          letter-spacing: 0.6px;
          color: rgba(255, 222, 120, 0.95);
        }

        .sideText {
          margin-top: 10px;
          font-size: 13px;
          line-height: 1.7;
          color: rgba(255, 255, 255, 0.62);
        }

        .chips {
          margin-top: 14px;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .chip {
          padding: 8px 10px;
          border-radius: 999px;
          font-size: 12px;
          background: rgba(0, 0, 0, 0.22);
          border: 1px solid rgba(255, 255, 255, 0.10);
          color: rgba(255, 255, 255, 0.75);
        }

        .kline {
          margin-top: 16px;
          height: 90px;
          display: flex;
          align-items: flex-end;
          gap: 8px;
          padding: 10px;
          border-radius: 14px;
          background: rgba(0, 0, 0, 0.20);
          border: 1px solid rgba(255, 255, 255, 0.10);
        }

        .bar {
          width: 10%;
          border-radius: 10px 10px 6px 6px;
          background: linear-gradient(180deg, rgba(255, 199, 0, 0.65), rgba(255, 255, 255, 0.08));
          box-shadow: 0 10px 25px rgba(255, 199, 0, 0.08);
        }

        .b1 { height: 30%; opacity: .55; }
        .b2 { height: 55%; opacity: .75; }
        .b3 { height: 45%; opacity: .65; }
        .b4 { height: 78%; opacity: .9; }
        .b5 { height: 58%; opacity: .75; }
        .b6 { height: 66%; opacity: .8; }
        .b7 { height: 40%; opacity: .6; }
        .b8 { height: 72%; opacity: .88; }

        .tiny {
          margin-top: 12px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.38);
        }
      `}</style>
    </div>
  );
}