"use client";

import { useState } from "react";
import { api } from "./api";

export default function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("login", { method: "POST", body: { password } });
      window.location.href = "/admin";
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <form className="adm-login" onSubmit={submit}>
      <h1>Sign in to edit your site</h1>
      <label className="adm-field">
        <span className="adm-label">Admin password</span>
        <input className="adm-input" type="password" autoComplete="current-password" autoFocus required value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      {error && <p className="adm-notice is-bad" role="alert">{error}</p>}
      <button type="submit" className="adm-btn is-primary" disabled={busy || !password}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
