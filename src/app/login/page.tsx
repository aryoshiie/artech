// src/app/login/page.tsx — Login dengan password atau Passkey (WebAuthn)
'use client';
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import {
  Loader2, Lock, User, AlertCircle, Fingerprint, KeyRound, ShieldCheck,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);
  const [setupComplete, setSetupComplete] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then((data) => {
        setSetupComplete(data.setupComplete);
        setLoggedIn(data.loggedIn);
        if (data.loggedIn) {
          router.push("/");
        } else if (!data.setupComplete) {
          router.push("/setup");
        }
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [router]);

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password) {
      setError("Username dan password wajib diisi");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login gagal");
      } else {
        router.push("/");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handlePasskeyLogin() {
    setError("");
    setPasskeyLoading(true);
    try {
      // Step 1: Get authentication options
      const optsRes = await fetch("/api/auth/passkey/login-options", { method: "POST" });
      if (!optsRes.ok) {
        const err = await optsRes.json();
        throw new Error(err.error || "Gagal memulai autentikasi passkey");
      }
      const optsData = await optsRes.json();
      const opts = optsData.options || optsData;

      // Step 2: Browser prompt biometric
      const asseResp = await startAuthentication({ optionsJSON: opts });

      // Step 3: Verify dengan server
      const verifyRes = await fetch("/api/auth/passkey/login-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: asseResp }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        throw new Error(verifyData.error || "Verifikasi passkey gagal");
      }
      router.push("/");
    } catch (e: any) {
      if (e.name === "AbortError" || e.message?.includes("cancelled")) {
        // User cancel — silent
      } else {
        setError(e.message || "Passkey login gagal");
      }
    } finally {
      setPasskeyLoading(false);
    }
  }

  if (checking) {
    return (
      <div style={wrapperStyle}>
        <Loader2 size={28} className="spin-icon" color="#5eead4" />
      </div>
    );
  }

  if (loggedIn || !setupComplete) {
    return (
      <div style={wrapperStyle}>
        <Loader2 size={28} className="spin-icon" color="#5eead4" />
      </div>
    );
  }

  return (
    <div style={wrapperStyle}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Unbounded:wght@400;600;800&family=JetBrains+Mono:wght@400;500&display=swap');
        .font-display{ font-family:'Unbounded', sans-serif; }
        .font-mono{ font-family:'JetBrains Mono', monospace; }
        @keyframes spin-icon{ from{transform:rotate(0);} to{transform:rotate(360deg);} }
        .spin-icon{ animation: spin-icon 1s linear infinite; }
      `}</style>
      <div style={cardStyle}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: "linear-gradient(135deg, #5eead4, #3f7fd1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
            <ShieldCheck size={28} color="#05060d" />
          </div>
          <h1 className="font-display" style={{ fontSize: 22, margin: 0 }}>ARTECH Login</h1>
          <p className="font-mono" style={{ fontSize: 11, color: "#8683a1", marginTop: 6 }}>
            Akses privat. Aktivitas tercatat.
          </p>
        </div>

        {/* Passkey login (primary CTA) */}
        <button
          onClick={handlePasskeyLogin}
          disabled={passkeyLoading}
          style={{
            width: "100%",
            padding: "14px 16px",
            borderRadius: 10,
            background: "linear-gradient(135deg, #5eead4, #3f7fd1)",
            color: "#05060d",
            border: "none",
            cursor: passkeyLoading ? "not-allowed" : "pointer",
            fontWeight: 700,
            fontSize: 13,
            fontFamily: "Unbounded, sans-serif",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginBottom: 16,
          }}
        >
          {passkeyLoading ? <Loader2 size={16} className="spin-icon" /> : <Fingerprint size={16} />}
          {passkeyLoading ? "Memverifikasi..." : "Login dengan Passkey"}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0" }}>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} />
          <span className="font-mono" style={{ fontSize: 10, color: "#8683a1" }}>ATAU</span>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} />
        </div>

        {error && (
          <div style={errorStyle}>
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <form onSubmit={handlePasswordLogin} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label className="font-mono" style={labelStyle}>Username</label>
            <div style={inputWrapperStyle}>
              <User size={14} color="#8683a1" />
              <input
                type="text"
                className="font-mono"
                style={inputStyle}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                autoComplete="username"
              />
            </div>
          </div>

          <div>
            <label className="font-mono" style={labelStyle}>Password</label>
            <div style={inputWrapperStyle}>
              <Lock size={14} color="#8683a1" />
              <input
                type="password"
                className="font-mono"
                style={inputStyle}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="password"
                autoComplete="current-password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "12px 16px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.06)",
              color: "#eae8f5",
              border: "1px solid rgba(255,255,255,0.15)",
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: 600,
              fontSize: 12,
              fontFamily: "Unbounded, sans-serif",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {loading ? <Loader2 size={14} className="spin-icon" /> : <KeyRound size={14} />}
            {loading ? "Memproses..." : "Login Password"}
          </button>
        </form>

        <p className="font-mono" style={{ fontSize: 10, color: "#8683a1", textAlign: "center", marginTop: 16, lineHeight: 1.6 }}>
          🔒 Akses ke halaman ini dilindungi. Setiap percobaan login dicatat dan owner akan dinotifikasi.
        </p>
      </div>
    </div>
  );
}

const wrapperStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "radial-gradient(ellipse at top, #1d1740 0%, #05060d 60%)",
  color: "#eae8f5",
  fontFamily: "Manrope, sans-serif",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
};

const cardStyle: React.CSSProperties = {
  maxWidth: 380,
  width: "100%",
  background: "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015))",
  border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: 18,
  padding: 28,
  backdropFilter: "blur(16px)",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#8683a1",
  display: "block",
  marginBottom: 6,
};

const inputWrapperStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10,
  padding: "10px 12px",
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  background: "transparent",
  border: "none",
  outline: "none",
  color: "#eae8f5",
  fontSize: 13,
};

const errorStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "10px 12px",
  background: "rgba(255,120,120,0.1)",
  border: "1px solid rgba(255,120,120,0.3)",
  borderRadius: 8,
  color: "#ff8080",
  fontSize: 12,
  fontFamily: "JetBrains Mono, monospace",
  marginBottom: 8,
};
