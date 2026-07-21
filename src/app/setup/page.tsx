// src/app/setup/page.tsx — Setup owner pertama kali (hanya bisa sekali)
'use client';
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, User, AlertCircle, CheckCircle2, KeyRound } from "lucide-react";

export default function SetupPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);
  const [alreadySetup, setAlreadySetup] = useState(false);

  useEffect(() => {
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then((data) => {
        if (data.setupComplete) {
          setAlreadySetup(true);
          setTimeout(() => router.push("/login"), 2000);
        }
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password) {
      setError("Username dan password wajib diisi");
      return;
    }
    if (password.length < 6) {
      setError("Password minimal 6 karakter");
      return;
    }
    if (password !== confirm) {
      setError("Password tidak cocok");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal setup");
      } else {
        router.push("/login");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div style={wrapperStyle}>
        <Loader2 size={28} className="spin-icon" color="#5eead4" />
      </div>
    );
  }

  if (alreadySetup) {
    return (
      <div style={wrapperStyle}>
        <CheckCircle2 size={32} color="#5eead4" />
        <p style={textStyle}>Owner sudah di-setup. Mengarahkan ke login...</p>
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
            <KeyRound size={28} color="#05060d" />
          </div>
          <h1 className="font-display" style={{ fontSize: 22, margin: 0 }}>Setup Owner</h1>
          <p className="font-mono" style={{ fontSize: 11, color: "#8683a1", marginTop: 6 }}>
            Buat akun owner pertama untuk ARTECH. Hanya bisa dilakukan sekali.
          </p>
        </div>

        {error && (
          <div style={errorStyle}>
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
                placeholder="mis. owner"
                autoFocus
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
                placeholder="minimal 6 karakter"
                autoComplete="new-password"
              />
            </div>
          </div>

          <div>
            <label className="font-mono" style={labelStyle}>Konfirmasi Password</label>
            <div style={inputWrapperStyle}>
              <Lock size={14} color="#8683a1" />
              <input
                type="password"
                className="font-mono"
                style={inputStyle}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="ulangi password"
                autoComplete="new-password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "12px 16px",
              borderRadius: 10,
              background: "linear-gradient(135deg, #5eead4, #3f7fd1)",
              color: "#05060d",
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: 700,
              fontSize: 13,
              fontFamily: "Unbounded, sans-serif",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              marginTop: 6,
            }}
          >
            {loading ? <Loader2 size={14} className="spin-icon" /> : <CheckCircle2 size={14} />}
            {loading ? "Membuat..." : "Buat Owner"}
          </button>
        </form>

        <p className="font-mono" style={{ fontSize: 10, color: "#8683a1", textAlign: "center", marginTop: 16, lineHeight: 1.6 }}>
          Setelah setup, Anda bisa login dengan password atau mendaftarkan Passkey (biometric/Touch ID) untuk akses lebih cepat.
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
  flexDirection: "column",
  gap: 12,
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

const textStyle: React.CSSProperties = {
  color: "#8683a1",
  fontFamily: "JetBrains Mono, monospace",
  fontSize: 12,
};
