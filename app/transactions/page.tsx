"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type TxRow = {
  id: string;
  user_id: string;
  record_no: number | null;
  date: string; // YYYY-MM-DD
  prosy: string;
  currency: string;
  type: "RM" | "U";
  amount: number;
  rate: number | null;
  myr: number | null;
  usdt: number | null;
  created_at: string;
};

type CalcRule = {
  curr: string;
  rm_method: "M" | "D" | null;
  u_method: "M" | "D" | null;
};

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function numOrNull(v: string) {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t.replaceAll(",", ""));
  return Number.isFinite(n) ? n : null;
}

function fmt(n: number | null | undefined) {
  if (n === null || n === undefined) return "-";
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString(undefined, { maximumFractionDigits: 8 });
}

export default function TransactionsPage() {
  const router = useRouter();

  // auth + base data
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [rows, setRows] = useState<TxRow[]>([]);
  const [rules, setRules] = useState<Record<string, CalcRule>>({});
  const [prosyOptions, setProsyOptions] = useState<string[]>([]);
  const [currencyOptions, setCurrencyOptions] = useState<string[]>([]);

  // input (一个出一个入)
  const [txDate, setTxDate] = useState<string>(todayISO());
  const [fromProsy, setFromProsy] = useState("");
  const [toProsy, setToProsy] = useState("");
  const [currency, setCurrency] = useState("");
  const [amountStr, setAmountStr] = useState("");

  const [outType, setOutType] = useState<"RM" | "U">("RM");
  const [inType, setInType] = useState<"RM" | "U">("RM");
  const [outRateStr, setOutRateStr] = useState("");
  const [inRateStr, setInRateStr] = useState("");

  const [submitting, setSubmitting] = useState(false);

  // filters
  const [fCurrency, setFCurrency] = useState<string>("全部");
  const [fType, setFType] = useState<string>("全部");
  const [fProsy, setFProsy] = useState<string>("");
  const [fRecordNo, setFRecordNo] = useState<string>("");
  const [fDateFrom, setFDateFrom] = useState<string>("");
  const [fDateTo, setFDateTo] = useState<string>("");

  const [pageSize, setPageSize] = useState<number>(30);
  const [page, setPage] = useState<number>(1);

  // load all once
  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setErrorMsg("");

      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) {
        router.push("/login");
        return;
      }

      // 1) options: prosy_list / currency_list
      const [pRes, cRes, rRes] = await Promise.all([
        supabase.from("prosy_list").select("code").eq("is_active", true).order("code", { ascending: true }),
        supabase.from("currency_list").select("code").eq("is_active", true).order("code", { ascending: true }),
        supabase.from("calc_rules").select("curr,rm_method,u_method"),
      ]);

      if (!pRes.error && pRes.data) setProsyOptions(pRes.data.map((x: any) => x.code));
      if (!cRes.error && cRes.data) setCurrencyOptions(cRes.data.map((x: any) => x.code));

      if (!rRes.error && rRes.data) {
        const map: Record<string, CalcRule> = {};
        for (const rr of rRes.data as any[]) map[rr.curr] = rr;
        setRules(map);
      }

      // default currency pick
      if (!currency && cRes.data?.length) setCurrency(cRes.data[0].code);

      // 2) rows
      const { data, error } = await supabase
        .from("transactions")
        .select("id,user_id,record_no,date,prosy,currency,type,amount,rate,myr,usdt,created_at")
        .eq("user_id", user.id)
        .order("record_no", { ascending: false })
        .limit(2000);

      if (error) {
        setErrorMsg(error.message);
        setRows([]);
      } else {
        setRows((data as TxRow[]) || []);
      }

      setLoading(false);
    };

    run();
  }, [router]); // eslint-disable-line react-hooks/exhaustive-deps

  // calc engine (对齐你的 Excel 思路)
  function calcMYR(curr: string, type: "RM" | "U", amount: number, rate: number | null) {
    if (!curr) return null;
    if (type !== "RM") return null;

    // MYR 直接 = amount
    if (curr === "MYR") return amount;

    const rule = rules[curr];
    if (!rule?.rm_method) return null;

    // 无汇率就不算（保持空）
    if (rate === null || !Number.isFinite(rate) || rate === 0) return null;

    if (rule.rm_method === "M") return amount * rate;
    if (rule.rm_method === "D") return amount / rate;
    return null;
  }

  function calcUSDT(curr: string, type: "RM" | "U", amount: number, rate: number | null) {
    if (!curr) return null;

    // ✅ 你的 Excel 特例：currency=USDT 且 type=RM => USDT = amount
    if (curr === "USDT" && type === "RM") return amount;

    // U 且 currency=USDT => USDT = amount
    if (type === "U" && curr === "USDT") return amount;

    // 只有 type=U 才走 u_method（跟你表一致）
    if (type !== "U") return null;

    const rule = rules[curr];
    if (!rule?.u_method) return null;

    if (rate === null || !Number.isFinite(rate) || rate === 0) return null;

    if (rule.u_method === "M") return amount * rate;
    if (rule.u_method === "D") return amount / rate;
    return null;
  }

  // derived: profit + usdt stats
  const today = todayISO();
  const totalProfit = useMemo(() => rows.reduce((s, r) => s + (r.myr ?? 0), 0), [rows]);
  const todayProfit = useMemo(
    () => rows.filter((r) => r.date === today).reduce((s, r) => s + (r.myr ?? 0), 0),
    [rows, today]
  );
  const usdtCountAndSum = useMemo(() => {
    const only = rows.filter((r) => r.usdt !== null && Number.isFinite(r.usdt as number));
    const sum = only.reduce((s, r) => s + (r.usdt ?? 0), 0);
    return { count: only.length, sum };
  }, [rows]);

  // filtering + paging
  const filteredRows = useMemo(() => {
    let list = [...rows];

    if (fCurrency !== "全部") list = list.filter((r) => r.currency === fCurrency);
    if (fType !== "全部") list = list.filter((r) => r.type === fType);

    const p = fProsy.trim().toUpperCase();
    if (p) list = list.filter((r) => r.prosy.toUpperCase().includes(p));

    const rec = fRecordNo.trim();
    if (rec) {
      const n = Number(rec);
      if (Number.isFinite(n)) list = list.filter((r) => (r.record_no ?? -1) === n);
    }

    if (fDateFrom) list = list.filter((r) => r.date >= fDateFrom);
    if (fDateTo) list = list.filter((r) => r.date <= fDateTo);

    // 默认按 record_no desc
    list.sort((a, b) => (b.record_no ?? 0) - (a.record_no ?? 0));
    return list;
  }, [rows, fCurrency, fType, fProsy, fRecordNo, fDateFrom, fDateTo]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const pageRows = useMemo(() => {
    const p = Math.min(Math.max(1, page), totalPages);
    const start = (p - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [fCurrency, fType, fProsy, fRecordNo, fDateFrom, fDateTo, pageSize]);

  // actions
  const refresh = async () => {
    setErrorMsg("");
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) {
      router.push("/login");
      return;
    }

    const { data, error } = await supabase
      .from("transactions")
      .select("id,user_id,record_no,date,prosy,currency,type,amount,rate,myr,usdt,created_at")
      .eq("user_id", user.id)
      .order("record_no", { ascending: false })
      .limit(2000);

    if (error) setErrorMsg(error.message);
    else setRows((data as TxRow[]) || []);
  };

  const addOneInOneOut = async () => {
    setErrorMsg("");

    const fp = fromProsy.trim().toUpperCase();
    const tp = toProsy.trim().toUpperCase();
    const curr = currency.trim().toUpperCase();
    const amount = numOrNull(amountStr);

    if (!fp) return setErrorMsg("请填写 From(出) 的 PROSY");
    if (!tp) return setErrorMsg("必须填写 To(入)（一个出一个入）");
    if (!curr) return setErrorMsg("请选择货币");
    if (amount === null) return setErrorMsg("金额必须是数字");

    const outRate = numOrNull(outRateStr);
    const inRate = numOrNull(inRateStr);

    // 出 = 负数
    const outAmount = -Math.abs(amount);
    const inAmount = Math.abs(amount);

    const outMYR = calcMYR(curr, outType, outAmount, outRate);
    const outUSDT = calcUSDT(curr, outType, outAmount, outRate);

    const inMYR = calcMYR(curr, inType, inAmount, inRate);
    const inUSDT = calcUSDT(curr, inType, inAmount, inRate);

    setSubmitting(true);

    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) {
        router.push("/login");
        return;
      }

      // 一次插入两行
      const payload = [
        {
          user_id: user.id,
          date: txDate,
          prosy: fp,
          currency: curr,
          type: outType,
          amount: outAmount,
          rate: outRate,
          myr: outMYR,
          usdt: outUSDT,
        },
        {
          user_id: user.id,
          date: txDate,
          prosy: tp,
          currency: curr,
          type: inType,
          amount: inAmount,
          rate: inRate,
          myr: inMYR,
          usdt: inUSDT,
        },
      ];

      const { error } = await supabase.from("transactions").insert(payload);
      if (error) {
        setErrorMsg(error.message);
        return;
      }

      // ✅ 不清空 rows，直接 refresh
      await refresh();

      // 只清空必要输入，避免你说的“追加后变空白”
      setFromProsy("");
      setToProsy("");
      setAmountStr("");
      setOutRateStr("");
      setInRateStr("");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setErrorMsg("");
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) return setErrorMsg(error.message);

    // 本地移除更快
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // UI
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <div className="sticky top-0 z-10 bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="font-bold text-lg">S9acc</div>
            <nav className="flex items-center gap-4 text-sm">
              <button className="hover:underline" onClick={() => router.push("/app")}>仪表盘</button>
              <button className="font-semibold underline underline-offset-4" onClick={() => router.push("/transactions")}>交易</button>
              <button className="hover:underline" onClick={() => router.push("/crypto")}>加密货币</button>
              <button className="hover:underline" onClick={() => router.push("/settings")}>设置</button>
            </nav>
          </div>

          <button onClick={logout} className="border px-4 py-2 rounded-lg hover:bg-gray-100">
            退出登录
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">交易记录</h1>

        {/* Summary */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="px-4 py-2 bg-white border rounded-xl">
            总利润（暂用 MYR 合计）： <span className="font-semibold">{fmt(totalProfit)}</span>
          </div>
          <div className="px-4 py-2 bg-white border rounded-xl">
            今天利润（暂用 今日 MYR 合计）： <span className="font-semibold">{fmt(todayProfit)}</span>
          </div>
          <div className="px-4 py-2 bg-white border rounded-xl">
            USDT 数量： <span className="font-semibold">{usdtCountAndSum.count}</span> 笔 ｜ USDT 合计：{" "}
            <span className="font-semibold">{fmt(usdtCountAndSum.sum)}</span>
          </div>
        </div>

        {/* Input panel (Excel-like layout) */}
        <div className="bg-white border rounded-2xl p-5 mb-6">
          <div className="grid grid-cols-12 gap-3 items-end">
            {/* 日期 */}
            <div className="col-span-3">
              <label className="text-sm text-gray-600">日期</label>
              <input
                value={txDate}
                onChange={(e) => setTxDate(e.target.value)}
                type="date"
                className="mt-1 w-full border rounded-lg px-3 py-2"
              />
            </div>

            {/* From / To */}
            <div className="col-span-3">
              <label className="text-sm text-gray-600">From（出）</label>
              <input
                list="prosy_list"
                value={fromProsy}
                onChange={(e) => setFromProsy(e.target.value)}
                placeholder="例如 S147"
                className="mt-1 w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div className="col-span-3">
              <label className="text-sm text-gray-600">To（入）</label>
              <input
                list="prosy_list"
                value={toProsy}
                onChange={(e) => setToProsy(e.target.value)}
                placeholder="例如 S150"
                className="mt-1 w-full border rounded-lg px-3 py-2"
              />
            </div>

            {/* 货币 */}
            <div className="col-span-3">
              <label className="text-sm text-gray-600">货币</label>
              <input
                list="currency_list"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                placeholder="例如 MYR / THB / USDT"
                className="mt-1 w-full border rounded-lg px-3 py-2"
              />
            </div>

            {/* 金额 */}
            <div className="col-span-4">
              <label className="text-sm text-gray-600">金额（一个出一个入）</label>
              <input
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="例如 5000"
                className="mt-1 w-full border rounded-lg px-3 py-2"
              />
            </div>

            {/* 出类型 */}
            <div className="col-span-2">
              <label className="text-sm text-gray-600">出的类型</label>
              <select
                value={outType}
                onChange={(e) => setOutType(e.target.value as any)}
                className="mt-1 w-full border rounded-lg px-3 py-2"
              >
                <option value="RM">RM</option>
                <option value="U">U</option>
              </select>
            </div>

            {/* 出汇率 */}
            <div className="col-span-3">
              <label className="text-sm text-gray-600">出的汇率（可空）</label>
              <input
                value={outRateStr}
                onChange={(e) => setOutRateStr(e.target.value)}
                placeholder="例如 31.6"
                className="mt-1 w-full border rounded-lg px-3 py-2"
              />
            </div>

            {/* 入类型 */}
            <div className="col-span-2">
              <label className="text-sm text-gray-600">入的类型</label>
              <select
                value={inType}
                onChange={(e) => setInType(e.target.value as any)}
                className="mt-1 w-full border rounded-lg px-3 py-2"
              >
                <option value="RM">RM</option>
                <option value="U">U</option>
              </select>
            </div>

            {/* 入汇率 */}
            <div className="col-span-3">
              <label className="text-sm text-gray-600">入的汇率（可空）</label>
              <input
                value={inRateStr}
                onChange={(e) => setInRateStr(e.target.value)}
                placeholder="例如 31.6"
                className="mt-1 w-full border rounded-lg px-3 py-2"
              />
            </div>

            {/* buttons */}
            <div className="col-span-12 flex gap-3 pt-2">
              <button
                onClick={addOneInOneOut}
                disabled={submitting}
                className="px-5 py-3 rounded-xl bg-black text-white hover:opacity-90 disabled:opacity-50"
              >
                + 添加一笔（自动一进一出）
              </button>
              <button onClick={refresh} className="px-5 py-3 rounded-xl border hover:bg-gray-50">
                刷新
              </button>
            </div>
          </div>

          {/* datalists */}
          <datalist id="prosy_list">
            {prosyOptions.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
          <datalist id="currency_list">
            {currencyOptions.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>

          {errorMsg && <div className="mt-3 text-red-600">提示：{errorMsg}</div>}
        </div>

        {/* Filter panel */}
        <div className="bg-white border rounded-2xl p-5 mb-6">
          <div className="font-semibold mb-3 flex items-center gap-2">
            <span>筛选</span>
          </div>

          <div className="grid grid-cols-12 gap-3 items-end">
            <div className="col-span-2">
              <label className="text-sm text-gray-600">货币</label>
              <select
                value={fCurrency}
                onChange={(e) => setFCurrency(e.target.value)}
                className="mt-1 w-full border rounded-lg px-3 py-2"
              >
                <option>全部</option>
                {currencyOptions.map((x) => (
                  <option key={x} value={x}>{x}</option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="text-sm text-gray-600">类型</label>
              <select
                value={fType}
                onChange={(e) => setFType(e.target.value)}
                className="mt-1 w-full border rounded-lg px-3 py-2"
              >
                <option>全部</option>
                <option>RM</option>
                <option>U</option>
              </select>
            </div>

            <div className="col-span-3">
              <label className="text-sm text-gray-600">PROSY</label>
              <input
                value={fProsy}
                onChange={(e) => setFProsy(e.target.value)}
                placeholder="搜索代号"
                className="mt-1 w-full border rounded-lg px-3 py-2"
              />
            </div>

            <div className="col-span-2">
              <label className="text-sm text-gray-600">记录ID</label>
              <input
                value={fRecordNo}
                onChange={(e) => setFRecordNo(e.target.value)}
                placeholder="例如 18"
                className="mt-1 w-full border rounded-lg px-3 py-2"
              />
            </div>

            <div className="col-span-3 flex gap-2">
              <div className="w-1/2">
                <label className="text-sm text-gray-600">日期从</label>
                <input
                  type="date"
                  value={fDateFrom}
                  onChange={(e) => setFDateFrom(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div className="w-1/2">
                <label className="text-sm text-gray-600">日期到</label>
                <input
                  type="date"
                  value={fDateTo}
                  onChange={(e) => setFDateTo(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>

            <div className="col-span-3">
              <label className="text-sm text-gray-600">每页项目数</label>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="mt-1 w-full border rounded-lg px-3 py-2"
              >
                {[10, 20, 30, 50, 100].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            <div className="col-span-9 flex items-end justify-end gap-2">
              <div className="text-sm text-gray-600">
                共 <span className="font-semibold text-gray-900">{filteredRows.length}</span> 笔
              </div>
              <button
                onClick={() => {
                  setFCurrency("全部");
                  setFType("全部");
                  setFProsy("");
                  setFRecordNo("");
                  setFDateFrom("");
                  setFDateTo("");
                }}
                className="px-4 py-2 rounded-lg border hover:bg-gray-50"
              >
                清空筛选
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b flex items-center justify-between">
            <div className="font-semibold">交易列表</div>

            {/* paging */}
            <div className="flex items-center gap-2 text-sm">
              <button
                className="px-3 py-1 rounded-lg border hover:bg-gray-50 disabled:opacity-50"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                上一页
              </button>
              <div>
                第 <span className="font-semibold">{Math.min(page, totalPages)}</span> / {totalPages} 页
              </div>
              <button
                className="px-3 py-1 rounded-lg border hover:bg-gray-50 disabled:opacity-50"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                下一页
              </button>
            </div>
          </div>

          {loading && <div className="p-6">加载中...</div>}

          {!loading && !errorMsg && rows.length === 0 && (
            <div className="p-6">暂无数据（你可以先 Insert 几笔）</div>
          )}

          {!loading && rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-gray-50">
                  <tr className="text-left border-b">
                    <th className="py-3 px-4">记录ID</th>
                    <th className="px-4">日期</th>
                    <th className="px-4">PROSY</th>
                    <th className="px-4">货币</th>
                    <th className="px-4">类型</th>
                    <th className="px-4 text-right">金额</th>
                    <th className="px-4 text-right">汇率</th>
                    <th className="px-4 text-right">MYR</th>
                    <th className="px-4 text-right">USDT</th>
                    <th className="px-4 text-center">操作</th>
                  </tr>
                </thead>

                <tbody>
                  {pageRows.map((r) => {
                    const neg = r.amount < 0;
                    return (
                      <tr key={r.id} className="border-b">
                        <td className="py-3 px-4">{r.record_no ?? "-"}</td>
                        <td className="px-4">{r.date}</td>
                        <td className="px-4">{r.prosy}</td>
                        <td className="px-4">{r.currency}</td>
                        <td className="px-4">{r.type}</td>

                        <td className={"px-4 text-right " + (neg ? "text-red-500 font-semibold" : "")}>
                          {fmt(r.amount)}
                        </td>

                        {/* rate 空白就显示 -（不会显示 0） */}
                        <td className="px-4 text-right">{fmt(r.rate)}</td>

                        <td className={"px-4 text-right " + ((r.myr ?? 0) < 0 ? "text-red-500" : "")}>
                          {fmt(r.myr)}
                        </td>

                        <td className={"px-4 text-right " + ((r.usdt ?? 0) < 0 ? "text-red-500" : "")}>
                          {fmt(r.usdt)}
                        </td>

                        <td className="px-4 text-center">
                          <button
                            onClick={() => handleDelete(r.id)}
                            className="group inline-flex items-center justify-center p-2 rounded-xl bg-red-50 hover:bg-red-100 transition"
                            title="删除"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="w-5 h-5 text-red-500 group-hover:text-red-600 transition"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 7h12M9 7v10m6-10v10M4 7h16l-1 14H5L4 7z"
                              />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-6">
          <button onClick={() => router.push("/app")} className="border px-4 py-2 rounded-lg hover:bg-gray-100">
            返回
          </button>
        </div>
      </div>
    </div>
  );
}