// src/app/debug/page.tsx — Halaman debug untuk diagnose masalah DB & env vars
// Akses di /debug
'use client';
import { useState, useEffect } from "react";
import { CheckCircle2, AlertCircle, Loader2, RefreshCw, Database } from "lucide-react";

interface DebugInfo {
  timestamp: string;
  env: {
    DATABASE_URL: boolean;
    DIRECT_URL: boolean;
    SUPABASE_URL: boolean;
    SUPABASE_SERVICE_ROLE_KEY: boolean;
    N8N_BASE_URL: boolean;
  };
  db: {
    connected: boolean;
    error?: string;
    agentCount?: number;
    sampleAgent?: string;
  };
  settings: {
    loaded: boolean;
    error?: string;
    n8nBaseUrl?: string;
  };
  suggestions: string[];
}

export default function DebugPage() {
  const [info, setInfo] = useState<DebugInfo | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadDebug() {
    setLoading(true);
    try {
      const res = await fetch("/api/debug");
      const data = await res.json();
      setInfo(data);
    } catch (e: any) {
      setInfo({
        timestamp: new Date().toISOString(),
        env: { DATABASE_URL: false, DIRECT_URL: false, SUPABASE_URL: false, SUPABASE_SERVICE_ROLE_KEY: false, N8N_BASE_URL: false },
        db: { connected: false, error: `Fetch failed: ${e.message}` },
        settings: { loaded: false },
        suggestions: ["API /api/debug tidak bisa diakses. Pastikan deployment tidak crash."],
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadDebug(); }, []);

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse at top, #1d1740 0%, #05060d 60%)",
      color: "#eae8f5",
      fontFamily: "Manrope, sans-serif",
      padding: 24,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Unbounded:wght@400;600;800&family=JetBrains+Mono:wght@400;500&display=swap');
        .font-display{ font-family:'Unbounded', sans-serif; }
        .font-mono{ font-family:'JetBrains Mono', monospace; }
        @keyframes spin-icon{ from{transform:rotate(0);} to{transform:rotate(360deg);} }
        .spin-icon{ animation: spin-icon 1s linear infinite; }
      `}</style>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <Database size={28} color="#5eead4" />
          <div>
            <h1 className="font-display" style={{ fontSize: 24, margin: 0 }}>Debug Diagnostics</h1>
            <p className="font-mono" style={{ fontSize: 11, color: "#8683a1", margin: "4px 0 0" }}>
              Cek status database, env vars, dan koneksi
            </p>
          </div>
          <button
            onClick={loadDebug}
            disabled={loading}
            style={{
              marginLeft: "auto",
              background: "rgba(94,234,212,0.1)",
              border: "1px solid rgba(94,234,212,0.3)",
              borderRadius: 8,
              padding: "8px 12px",
              color: "#5eead4",
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontFamily: "JetBrains Mono, monospace",
              fontSize: 11,
            }}
          >
            {loading ? <Loader2 size={14} className="spin-icon" /> : <RefreshCw size={14} />}
            Refresh
          </button>
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Loader2 size={32} className="spin-icon" color="#5eead4" />
            <p className="font-mono" style={{ color: "#8683a1", marginTop: 12 }}>Memeriksa...</p>
          </div>
        )}

        {info && !loading && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 24 }}>
              <StatusCard title="Database" ok={info.db.connected} detail={info.db.connected ? `${info.db.agentCount} agent` : "Tidak terhubung"} error={info.db.error} />
              <StatusCard title="Environment" ok={Object.values(info.env).every(Boolean)} detail={`${Object.values(info.env).filter(Boolean).length}/${Object.values(info.env).length} vars set`} />
              <StatusCard title="Settings" ok={info.settings.loaded} detail={info.settings.loaded ? "Loaded" : "Belum dimuat"} error={info.settings.error} />
            </div>

            <Section title="Environment Variables">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {Object.entries(info.env).map(([key, val]) => (
                  <div key={key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" }}>
                    {val ? <CheckCircle2 size={14} color="#5eead4" /> : <AlertCircle size={14} color="#ff8080" />}
                    <code className="font-mono" style={{ fontSize: 12, color: "#eae8f5", flex: 1 }}>{key}</code>
                    <span className="font-mono" style={{ fontSize: 10, color: val ? "#5eead4" : "#ff8080" }}>
                      {val ? "SET" : "MISSING"}
                    </span>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Database Connection">
              {info.db.connected ? (
                <div style={{ padding: 12, background: "rgba(94,234,212,0.05)", borderRadius: 8, border: "1px solid rgba(94,234,212,0.2)" }}>
                  <p className="font-mono" style={{ fontSize: 12, color: "#5eead4", margin: 0 }}>
                    ✅ Terhubung — {info.db.agentCount} agent di database
                  </p>
                  {info.db.sampleAgent && (
                    <p className="font-mono" style={{ fontSize: 11, color: "#8683a1", margin: "6px 0 0" }}>
                      Sample: {info.db.sampleAgent}
                    </p>
                  )}
                </div>
              ) : (
                <div style={{ padding: 12, background: "rgba(255,120,120,0.05)", borderRadius: 8, border: "1px solid rgba(255,120,120,0.2)" }}>
                  <p className="font-mono" style={{ fontSize: 12, color: "#ff8080", margin: 0 }}>
                    ❌ Gagal terhubung
                  </p>
                  {info.db.error && (
                    <p className="font-mono" style={{ fontSize: 11, color: "#8683a1", margin: "6px 0 0", wordBreak: "break-word" }}>
                      {info.db.error}
                    </p>
                  )}
                </div>
              )}
            </Section>

            <Section title="Saran Perbaikan">
              <ol style={{ margin: 0, paddingLeft: 18 }}>
                {info.suggestions.map((s, i) => (
                  <li key={i} className="font-mono" style={{ fontSize: 12, color: "#eae8f5", marginBottom: 8, lineHeight: 1.6 }}>
                    {s}
                  </li>
                ))}
              </ol>
            </Section>

            <Section title="Aksi Cepat">
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <a href="/" style={{ padding: "8px 14px", background: "rgba(94,234,212,0.1)", border: "1px solid rgba(94,234,212,0.3)", borderRadius: 8, color: "#5eead4", textDecoration: "none", fontFamily: "JetBrains Mono, monospace", fontSize: 11 }}>
                  ← Kembali ke Galaxy
                </a>
                <a href="/download" style={{ padding: "8px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#eae8f5", textDecoration: "none", fontFamily: "JetBrains Mono, monospace", fontSize: 11 }}>
                  📦 Download Source
                </a>
              </div>
            </Section>

            <p className="font-mono" style={{ fontSize: 10, color: "#8683a1", textAlign: "center", marginTop: 24 }}>
              Timestamp: {info.timestamp}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function StatusCard({ title, ok, detail, error }: { title: string; ok: boolean; detail: string; error?: string }) {
  return (
    <div style={{
      padding: 14,
      background: ok ? "rgba(94,234,212,0.05)" : "rgba(255,120,120,0.05)",
      border: `1px solid ${ok ? "rgba(94,234,212,0.2)" : "rgba(255,120,120,0.2)"}`,
      borderRadius: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        {ok ? <CheckCircle2 size={16} color="#5eead4" /> : <AlertCircle size={16} color="#ff8080" />}
        <span className="font-display" style={{ fontSize: 13 }}>{title}</span>
      </div>
      <p className="font-mono" style={{ fontSize: 11, color: ok ? "#5eead4" : "#ff8080", margin: 0 }}>
        {detail}
      </p>
      {error && (
        <p className="font-mono" style={{ fontSize: 9, color: "#8683a1", margin: "4px 0 0", wordBreak: "break-word" }}>
          {error.slice(0, 100)}
        </p>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 className="font-display" style={{ fontSize: 13, color: "#8683a1", letterSpacing: ".05em", marginBottom: 10, textTransform: "uppercase" }}>
        {title}
      </h2>
      {children}
    </div>
  );
}
