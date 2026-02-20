"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function DebugPage() {
  const [uid, setUid] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUid(data.user?.id ?? "NOT_LOGGED_IN");
    })();
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h1>Debug</h1>
      <p>User ID: {uid}</p>
    </div>
  );
}