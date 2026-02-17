"use client"

import { useState } from "react"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function Home() {
  const [user, setUser] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setLoading(true)

    // 这里其实还是当 email 用
    const { data, error } = await supabase.auth.signInWithPassword({
      email: user,
      password,
    })

    setLoading(false)

    if (error) {
      alert("Login failed: " + error.message)
      return
    }

    alert("Login success ✅")
    console.log(data.user)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-10 rounded-xl shadow-lg w-[420px]">
        <h1 className="text-2xl font-bold mb-6 text-center">
          S9 Account Login
        </h1>

        <input
          type="text"
          placeholder="User"
          className="w-full mb-4 p-3 border rounded-lg"
          value={user}
          onChange={(e) => setUser(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full mb-6 p-3 border rounded-lg"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          className="w-full bg-black text-white p-3 rounded-lg"
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? "Loading..." : "Login"}
        </button>
      </div>
    </div>
  )
}