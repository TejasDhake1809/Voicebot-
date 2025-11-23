import React, { useState } from "react";
import { login } from "../services/api";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    setErr("");
    const res = await login(username, password);

    if (res?.token) {
      localStorage.setItem("token", res.token);
      localStorage.setItem("accountId", res.accountId || "");
      onLogin();
    } else {
      setErr(res?.error || "Login failed");
    }
  }

  return (
    <div className="bg-white p-6 rounded shadow w-full max-w-sm mx-auto">
      <h2 className="text-xl font-semibold mb-4 text-center">Login</h2>

      {err && <div className="mb-2 text-red-600">{err}</div>}

      <form onSubmit={handleLogin}>
        <input
          className="w-full mb-2 p-2 border rounded"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <input
          className="w-full mb-4 p-2 border rounded"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button className="w-full bg-blue-600 text-white py-2 rounded">
          Login
        </button>
      </form>
    </div>
  );
}
