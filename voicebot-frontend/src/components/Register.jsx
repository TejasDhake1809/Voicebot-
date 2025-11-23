import React, { useState } from "react";
import { registerFull } from "../services/api";

export default function Register({ onRegistered }) {
  const [name, setName] = useState("");
  const [username, setU] = useState("");
  const [password, setP] = useState("");
  const [balance, setBalance] = useState("");
  const [idFile, setIdFile] = useState(null);
  const [err, setErr] = useState("");

  async function handleRegister(e) {
    e.preventDefault();
    setErr("");

    const form = new FormData();
    form.append("name", name);
    form.append("username", username);
    form.append("password", password);
    form.append("balance", balance);
    if (idFile) form.append("idproof", idFile);

    const res = await registerFull(form);
    if (res?.token) {
      localStorage.setItem("token", res.token);
      localStorage.setItem("accountId", res.accountId);
      onRegistered();
    } else {
      setErr(res?.error || "Registration failed");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <form onSubmit={handleRegister} className="bg-white p-6 rounded shadow w-full max-w-sm">

        <h2 className="text-xl font-bold mb-4">Create Account</h2>

        {err && <p className="text-red-600 mb-2">{err}</p>}

        <input className="w-full border p-2 mb-2" placeholder="Full Name"
          value={name} onChange={e => setName(e.target.value)} />

        <input className="w-full border p-2 mb-2" placeholder="Username"
          value={username} onChange={e => setU(e.target.value)} />

        <input className="w-full border p-2 mb-2" placeholder="Password" type="password"
          value={password} onChange={e => setP(e.target.value)} />

        <input className="w-full border p-2 mb-4" placeholder="Initial Balance"
          value={balance} onChange={e => setBalance(e.target.value)} />

        <label className="block mb-2">
          <span className="text-sm">Upload ID Proof</span><br />
          <input type="file" onChange={(e) => setIdFile(e.target.files[0])} />
        </label>

        <button className="w-full bg-green-600 text-white py-2 rounded">
          Register
        </button>
      </form>
    </div>
  );
}
