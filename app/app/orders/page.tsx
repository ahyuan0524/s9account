"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { HotTable, type HotTableClass } from "@handsontable/react"
import Handsontable from "handsontable";
import { registerAllModules } from "handsontable/registry";
import "handsontable/dist/handsontable.full.min.css";

import styles from "./orders.module.css";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";

// ✅ 注册所有模块（包含 date / dropdown / autocomplete 等）
registerAllModules();

type Method = "M" | "D" | "" | null;

type ItemMethodRow = {
  currency: string;
  rm_method: Method;
  u_method: Method;
};

type GridRow = {
  date: string; // YYYY-MM-DD
  prosy: string;
  currency: string;
  type: string; // RM / U ...
  amount: number | null;
  rate: number | null;
  myr: number | null;
  usdt: number | null;
};

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toNumber(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function floor2(n: number) {
  return Math.floor(n * 100) / 100;
}

function fmt2(n: number | null | undefined) {
  if (n === null || n === undefined || !Number.isFinite(n)) return "-";
  const v = floor2(n);
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** ✅ 标准化 key */
function normKey(v: any) {
  return String(v ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

/** ✅ 乘除规则（M=乘, D=除） */
function calcByMethod(amount: number, rate: number | null, method: Method): number | null {
  if (!method) return null;
  if (!Number.isFinite(amount)) return null;

  if (method === "M") {
    const r = rate === null ? 1 : rate;
    if (!Number.isFinite(r)) return null;
    return amount * r;
  }

  if (method === "D") {
    if (rate === null || !Number.isFinite(rate) || rate === 0) return null;
    return amount / rate;
  }

  return null;
}

function pickRowValue(row: any): string {
  if (!row || typeof row !== "object") return "";
  const candidates = ["value", "currency", "type", "prosy", "code", "name", "title", "label"];
  for (const k of candidates) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") {
      return String(row[k]).trim();
    }
  }
  const keys = Object.keys(row);
  if (keys.length > 0) return String(row[keys[0]] ?? "").trim();
  return "";
}

export default function OrdersPage() {
  const router = useRouter();

  /**
   * ✅ 关键修复：Vercel build 报 “supabase possibly null”
   * 让 TS 明确：这里一定会拿到 client
   * 如果你的 createSupabaseBrowser() 真的可能返回 null，请把 createSupabaseBrowser 修到永远返回 client。
   */
  const supabase = useMemo(() => createSupabaseBrowser()!, []);
  const hotRef = useRef<HotTableClass | null>(null);

  const [prosyList, setProsyList] = useState<string[]>([]);
  const [currencyList, setCurrencyList] = useState<string[]>([]);
  const [typeList, setTypeList] = useState<string[]>([]);
  const [itemMethods, setItemMethods] = useState<Record<string, ItemMethodRow>>({});

  const [walletAddr] = useState<string>("THfQHSSuPUoyVH1U14pwpYX5pqR3WUeHhm");
  const [walletUsdt, setWalletUsdt] = useState<number | null>(null);
  const [walletErr, setWalletErr] = useState<string>("");

  const [saving, setSaving] = useState(false);

  const [rows, setRows] = useState<GridRow[]>(() => {
    const d = todayISO();
    return [
      { date: d, prosy: "", currency: "", type: "RM", amount: null, rate: null, myr: null, usdt: null },
      { date: d, prosy: "", currency: "", type: "U", amount: null, rate: null, myr: null, usdt: null },
    ];
  });

  // =========================
  // 读取设置
  // =========================
  useEffect(() => {
    let alive = true;

    async function loadSettings() {
      // ✅ 保险（就算你上面用了 !，这里也不会坏）
      if (!supabase) return;

      const p = await supabase.from("prosy_list").select("*").order("id", { ascending: true });
      const c = await supabase.from("currency_list").select("*").order("id", { ascending: true });
      const t = await supabase.from("type_list").select("*").order("id", { ascending: true });
      const m = await supabase.from("item_methods").select("currency, rm_method, u_method");

      if (!alive) return;

      const pList = (p.data ?? []).map(pickRowValue).filter(Boolean);
      const cList = (c.data ?? []).map(pickRowValue).filter(Boolean);
      const tListRaw = (t.data ?? []).map(pickRowValue).filter(Boolean);

      const tSet = new Set(tListRaw.map((x) => normKey(x)));
      if (!tSet.has("RM")) tListRaw.push("RM");
      if (!tSet.has("U")) tListRaw.push("U");

      const uniqSort = (arr: string[]) => Array.from(new Set(arr)).sort((a, b) => a.localeCompare(b));

      setProsyList(uniqSort(pList));
      setCurrencyList(uniqSort(cList));
      setTypeList(uniqSort(tListRaw));

      const map: Record<string, ItemMethodRow> = {};
      (m.data ?? []).forEach((r: any) => {
        const key = normKey(r.currency);
        if (!key) return;

        map[key] = {
          currency: key,
          rm_method: (normKey(r.rm_method) as Method) || "",
          u_method: (normKey(r.u_method) as Method) || "",
        };
      });
      setItemMethods(map);
    }

    loadSettings();
    return () => {
      alive = false;
    };
  }, [supabase]);

  // =========================
  // 钱包余额
  // =========================
  useEffect(() => {
    let alive = true;

    async function loadWallet() {
      try {
        setWalletErr("");
        const res = await fetch("/api/crypto/balance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: walletAddr }),
          cache: "no-store",
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`HTTP ${res.status} ${text}`);
        }

        const data = await res.json();
        const usdt = Number(data?.usdt);

        if (!Number.isFinite(usdt)) throw new Error("返回数据没有 usdt");

        if (!alive) return;
        setWalletUsdt(usdt);
      } catch (e: any) {
        if (!alive) return;
        setWalletUsdt(null);
        setWalletErr(e?.message || "获取钱包余额失败");
      }
    }

    loadWallet();
    return () => {
      alive = false;
    };
  }, [walletAddr]);

  // =========================
  // ✅ 计算列：myr/usdt（按 item_methods 自动乘除）
  // =========================
  function recomputeAll(next: GridRow[]): GridRow[] {
    return next.map((r) => {
      const curKey = normKey(r.currency);
      const methodRow = curKey ? itemMethods[curKey] : undefined;

      const amount = toNumber(r.amount);
      const rate = toNumber(r.rate);

      let myr: number | null = null;
      let usdt: number | null = null;

      if (amount !== null && curKey) {
        const t = normKey(r.type);

        const rmMethod = (methodRow?.rm_method ?? "") as Method;
        const uMethod = (methodRow?.u_method ?? "") as Method;

        const useRmMethod: Method = rmMethod || "M";
        const useUMethod: Method = uMethod || "M";

        if (t === "RM") myr = calcByMethod(amount, rate, useRmMethod);
        if (t === "U") usdt = calcByMethod(amount, rate, useUMethod);
      }

      return { ...r, myr, usdt };
    });
  }

  useEffect(() => {
    setRows((prev) => recomputeAll([...prev]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemMethods]);

  // =========================
  // 两行一组同步
  // =========================
  function normalizePair(next: GridRow[], rowIndex: number, field: keyof GridRow): GridRow[] {
    const pairTop = rowIndex % 2 === 0 ? rowIndex : rowIndex - 1;
    const pairBottom = pairTop + 1;
    if (pairBottom >= next.length) return next;

    const top = { ...next[pairTop] };
    const bottom = { ...next[pairBottom] };

    if (field === "date") {
      if (rowIndex === pairBottom) top.date = bottom.date;
      bottom.date = top.date;
    }

    if (field === "currency") {
      if (rowIndex === pairBottom) top.currency = bottom.currency;
      bottom.currency = top.currency;
    }

    if (field === "amount") {
      const aTop = toNumber(top.amount);
      const aBottom = toNumber(bottom.amount);

      if (rowIndex === pairTop) {
        if (aTop !== null) {
          const abs = Math.abs(aTop);
          top.amount = abs;
          bottom.amount = -abs;
        }
      } else {
        if (aBottom !== null) {
          const abs = Math.abs(aBottom);
          top.amount = abs;
          bottom.amount = -abs;
        }
      }
    }

    next[pairTop] = top;
    next[pairBottom] = bottom;
    return next;
  }

  function addPair(afterRow: number) {
    const d = todayISO();
    const insertAt = Math.min(Math.max(afterRow + 1, 0), rows.length);

    const newRows: GridRow[] = [
      { date: d, prosy: "", currency: "", type: "RM", amount: null, rate: null, myr: null, usdt: null },
      { date: d, prosy: "", currency: "", type: "U", amount: null, rate: null, myr: null, usdt: null },
    ];

    const next = [...rows.slice(0, insertAt), ...newRows, ...rows.slice(insertAt)];
    setRows(recomputeAll(next));
  }

  // =========================
  // Handsontable columns
  // =========================
  const columns = useMemo(() => {
    const strictAutocomplete = (source: string[]) => ({
      type: "autocomplete" as const,
      source,
      strict: true,
      allowInvalid: false,
      filter: true,
      visibleRows: 50,
      trimDropdown: false,
    });

    const applyNegative = (td: HTMLElement, v: any) => {
      const n = toNumber(v);
      if (n !== null && n < 0) {
        td.classList.add(styles.negative);
        td.classList.add("neg");
      } else {
        td.classList.remove(styles.negative);
        td.classList.remove("neg");
      }
    };

    return [
      {
        data: "date",
        type: "date",
        dateFormat: "YYYY-MM-DD",
        correctFormat: true,
        allowInvalid: false,
        className: `${styles.cell} ${styles.center}`,
      },
      {
        data: "prosy",
        ...strictAutocomplete(prosyList),
        className: `${styles.cell} ${styles.center} ${styles.boldInput}`,
      },
      {
        data: "currency",
        ...strictAutocomplete(currencyList),
        className: `${styles.cell} ${styles.center} ${styles.boldInput}`,
      },
      {
        data: "type",
        ...strictAutocomplete(typeList),
        className: `${styles.cell} ${styles.center} ${styles.boldInput}`,
      },
      {
        data: "amount",
        type: "numeric",
        numericFormat: { pattern: "0,0.00" },
        className: `${styles.cell} ${styles.boldInput}`,
        renderer: function (instance: any, td: any, row: any, col: any, prop: any, value: any, cellProperties: any) {
          Handsontable.renderers.NumericRenderer.apply(this, [instance, td, row, col, prop, value, cellProperties]);
          applyNegative(td, value);
        },
      },
      {
        data: "rate",
        type: "numeric",
        numericFormat: { pattern: "0,0.000" },
        className: `${styles.cell}`,
      },
      {
        data: "myr",
        readOnly: true,
        type: "numeric",
        numericFormat: { pattern: "0,0.00" },
        className: `${styles.cell} ${styles.readonly}`,
        renderer: function (instance: any, td: any, row: any, col: any, prop: any, value: any, cellProperties: any) {
          Handsontable.renderers.NumericRenderer.apply(this, [instance, td, row, col, prop, value, cellProperties]);
          if (value === null || value === undefined || value === "") td.innerText = "-";
          applyNegative(td, value);
        },
      },
      {
        data: "usdt",
        readOnly: true,
        type: "numeric",
        numericFormat: { pattern: "0,0.00" },
        className: `${styles.cell} ${styles.readonly}`,
        renderer: function (instance: any, td: any, row: any, col: any, prop: any, value: any, cellProperties: any) {
          Handsontable.renderers.NumericRenderer.apply(this, [instance, td, row, col, prop, value, cellProperties]);
          if (value === null || value === undefined || value === "") td.innerText = "-";
          applyNegative(td, value);
        },
      },
    ];
  }, [prosyList, currencyList, typeList]);

  const colHeaders = useMemo(
    () => ["日期", "Prosy", "货币", "类型", "金额（上正下负）", "汇率（可空）", "MYR（RM才算）", "USDT（U才算）"],
    []
  );

  const totals = useMemo(() => {
    let totalMYR = 0;
    let todayMYR = 0;
    let totalUSDT = 0;

    const td = todayISO();

    for (const r of rows) {
      if (typeof r.myr === "number" && Number.isFinite(r.myr)) {
        totalMYR += r.myr;
        if (r.date === td) todayMYR += r.myr;
      }
      if (typeof r.usdt === "number" && Number.isFinite(r.usdt)) {
        totalUSDT += r.usdt;
      }
    }
    return { totalMYR, todayMYR, totalUSDT };
  }, [rows]);

  const reconcileBad = useMemo(() => {
    if (walletUsdt === null) return false;
    return Math.abs(totals.totalUSDT - walletUsdt) > 0.01;
  }, [totals.totalUSDT, walletUsdt]);

  function handleAfterChange(changes: any[] | null, source: string) {
    if (!changes || source === "loadData") return;

    let next = [...rows].map((r) => ({ ...r }));

    for (const [row, prop, _oldValue, newValue] of changes) {
      const key = prop as keyof GridRow;
      (next[row] as any)[key] = newValue;
      next = normalizePair(next, row, key);
    }

    next = recomputeAll(next);
    setRows(next);
  }

  function beforeKeyDown(e: any) {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();

    const hot = hotRef.current?.hotInstance;
    if (!hot) return;

    const sel = hot.getSelectedLast();
    const r = sel ? sel[0] : rows.length - 1;
    const top = r % 2 === 0 ? r : r - 1;

    addPair(top + 1);
  }
}

  /**
   * ✅ 保存：避免 prosy null（transactions 表 prosy NOT NULL）
   * ✅ 同时避免 “空行也插入”
   */
  async function onSave() {
    if (saving) return;
    if (!supabase) {
      alert("Supabase 未初始化（请确认 NEXT_PUBLIC_SUPABASE_URL / ANON_KEY 已配置）");
      return;
    }

    setSaving(true);

    try {
      const payload = rows
        .map((r, idx) => {
          const date = (r.date || "").trim();
          const prosy = (r.prosy || "").trim();
          const currency = (r.currency || "").trim();
          const type = normKey(r.type); // RM / U
          const amount = toNumber(r.amount);
          const rate = toNumber(r.rate);

          return {
            __idx: idx + 1, // 用于报错定位第几行
            date,
            prosy,
            currency,
            type,
            amount,
            rate,
            myr: typeof r.myr === "number" && Number.isFinite(r.myr) ? r.myr : null,
            usdt: typeof r.usdt === "number" && Number.isFinite(r.usdt) ? r.usdt : null,
          };
        })
        .filter((x) => x.date && x.prosy && x.currency && x.type && x.amount !== null);

      if (payload.length === 0) {
        alert("没有可保存的数据：请确保日期/Prosy/货币/类型/金额都有填写。");
        return;
      }

      const bad = payload.find((x) => !x.prosy);
      if (bad) {
        alert(`第 ${bad.__idx} 行 Prosy 为空，不能保存。`);
        return;
      }

      const u = await supabase.auth.getUser();
      const userId = u.data.user?.id ?? null;

      // ✅ 先按你现有表结构插入（prosy NOT NULL）
      const insertRows = payload.map((x) => ({
        user_id: userId,
        date: x.date,
        prosy: x.prosy,
        currency: x.currency,
        type: x.type,
        amount: x.amount,
        rate: x.rate,
        myr: x.myr,
        usdt: x.usdt,
      }));

      const res = await supabase.from("transactions").insert(insertRows);

      if (res.error) {
        alert(`保存失败：${res.error.message}`);
        return;
      }

      router.push("/app/transactions");
    } catch (e: any) {
      alert(`保存失败：${e?.message || "未知错误"}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <div className={styles.title}>订单录入</div>
          <div className={styles.subtitle}>
            Excel 系统模式：两行一组（上=From 正数，下=To 负数）｜Prosy/货币/类型：可输入联想，但必须是设置里的值｜复制粘贴｜拖拽填充
          </div>
        </div>

        <button className={styles.saveBtn} onClick={onSave} disabled={saving}>
          {saving ? "保存中..." : "保存"}
        </button>
      </div>

      <div className={styles.cards}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>总利润（MYR）</div>
          <div className={styles.cardValue}>{fmt2(totals.totalMYR)}</div>
          <div className={styles.cardHint}>从本页计算值汇总（MYR）</div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>今日利润（MYR）</div>
          <div className={styles.cardValue}>{fmt2(totals.todayMYR)}</div>
          <div className={styles.cardHint}>仅今日日期（MYR 计算值）</div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>USDT 总计（TX 汇总）</div>
          <div className={styles.cardValue}>{fmt2(totals.totalUSDT)}</div>
          <div className={styles.cardHint}>从本页计算值汇总（USDT，带符号）</div>
        </div>

        <div className={`${styles.card} ${reconcileBad ? styles.cardWarn : ""}`}>
          <div className={styles.cardTitle}>钱包 USDT</div>
          <div className={styles.cardValue}>{walletUsdt === null ? "-" : fmt2(walletUsdt)}</div>
          <div className={styles.cardHint}>地址：{walletAddr}</div>

          {walletErr ? (
            <div className={styles.warnBox}>⚠️ 获取钱包余额失败：{walletErr}</div>
          ) : reconcileBad ? (
            <div className={styles.warnBox}>
              ⚠️ USDT 对账预警：本页汇总（{fmt2(totals.totalUSDT)}）vs 钱包（{fmt2(walletUsdt)}) 不一致
            </div>
          ) : null}
        </div>
      </div>

      <div className={styles.tableWrap}>
        <HotTable
          ref={hotRef}
          data={rows}
          colHeaders={colHeaders}
          columns={columns as any}
          rowHeaders={false}
          stretchH="all"
          width="100%"
          height="auto"
          licenseKey="non-commercial-and-evaluation"
          contextMenu={true}
          manualColumnResize={true}
          manualRowResize={true}
          autoWrapRow={false}
          autoWrapCol={false}
          afterChange={handleAfterChange}
          beforeKeyDown={beforeKeyDown}
          dropdownMenu={true}
          filters={true}
          copyPaste={true}
        />
      </div>

      <div className={styles.footerTip}>
        提示：从 Excel 复制多行 → 直接粘贴到表格。金额：第一行自动正数，第二行自动负数且绝对值相同。MYR 只算 RM；USDT 只算 U；乘除规则来自 item_methods（rm_method/u_method）。（Ctrl+Enter 新增一组两行）
      </div>
    </div>
  );
}