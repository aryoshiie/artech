// src/app/download/page.tsx — Halaman download simpel dengan tombol besar
// Public (tidak butuh login)
'use client';
import { useState } from "react";
import { Download, FileArchive, CheckCircle2, Copy, ExternalLink } from "lucide-react";

export default function DownloadPage() {
  const [copied, setCopied] = useState(false);

  function copyUrl() {
    const url = window.location.origin + "/artech-deploy.zip";
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const fileSize = "149 KB";
  const fileCount = "144 file";

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse at top, #1d1740 0%, #05060d 60%)",
      color: "#eae8f5",
      fontFamily: "Manrope, sans-serif",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Unbounded:wght@400;600;800&family=JetBrains+Mono:wght@400;500&display=swap');
        .font-display{ font-family:'Unbounded', sans-serif; }
        .font-mono{ font-family:'JetBrains Mono', monospace; }
        @keyframes pulse-glow{ 0%,100%{ box-shadow: 0 0 2vmin rgba(94,234,212,0.3); } 50%{ box-shadow: 0 0 4vmin rgba(94,234,212,0.6); } }
      `}</style>
      <div style={{
        maxWidth: 560,
        width: "100%",
        background: "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015))",
        border: "1px solid rgba(255,255,255,0.09)",
        borderRadius: 18,
        padding: 32,
        backdropFilter: "blur(16px)",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: "linear-gradient(135deg, #5eead4, #3f7fd1)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 2vmin rgba(94,234,212,0.4)",
          }}>
            <FileArchive size={28} color="#05060d" />
          </div>
          <div>
            <h1 className="font-display" style={{ fontSize: 24, margin: 0 }}>ARTECH Source Code</h1>
            <p className="font-mono" style={{ fontSize: 11, color: "#8683a1", margin: "4px 0 0" }}>
              {fileCount} • {fileSize} • ZIP archive • Siap deploy ke Vercel
            </p>
          </div>
        </div>

        {/* Tombol Download UTAMA — sangat jelas */}
        <a
          href="/artech-deploy.zip"
          download="artech-deploy.zip"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            width: "100%",
            padding: "20px 24px",
            borderRadius: 14,
            background: "linear-gradient(135deg, #5eead4, #3f7fd1)",
            color: "#05060d",
            textDecoration: "none",
            fontWeight: 800,
            fontSize: 17,
            marginBottom: 16,
            border: "none",
            cursor: "pointer",
            fontFamily: "Unbounded, sans-serif",
            animation: "pulse-glow 3s ease-in-out infinite",
            transition: "transform .2s ease, filter .2s ease",
            boxShadow: "0 4px 20px rgba(94,234,212,0.3)",
          }}
          onMouseOver={(e) => { e.currentTarget.style.transform = "scale(1.02)"; e.currentTarget.style.filter = "brightness(1.1)"; }}
          onMouseOut={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.filter = "brightness(1)"; }}
        >
          <Download size={24} strokeWidth={2.5} />
          DOWNLOAD SEKARANG
        </a>

        <p className="font-mono" style={{ fontSize: 11, color: "#8683a1", textAlign: "center", marginBottom: 20 }}>
          ↓ Klik tombol di atas untuk download file artech-deploy.zip
        </p>

        {/* URL alternatif + copy */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 10,
          padding: "10px 12px",
          marginBottom: 24,
        }}>
          <span className="font-mono" style={{ fontSize: 10, color: "#8683a1" }}>URL:</span>
          <code className="font-mono" style={{ flex: 1, fontSize: 11, color: "#5eead4", wordBreak: "break-all" }}>
            {typeof window !== "undefined" ? window.location.origin + "/artech-deploy.zip" : "/artech-deploy.zip"}
          </code>
          <button
            onClick={copyUrl}
            style={{
              background: "rgba(94,234,212,0.1)",
              border: "1px solid rgba(94,234,212,0.3)",
              borderRadius: 6,
              padding: "6px 8px",
              cursor: "pointer",
              color: "#5eead4",
              display: "flex",
            }}
            aria-label="Copy URL"
          >
            {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
          </button>
        </div>

        {/* Instruksi deploy */}
        <div style={{
          background: "rgba(94,234,212,0.05)",
          border: "1px solid rgba(94,234,212,0.15)",
          borderRadius: 10,
          padding: 16,
        }}>
          <p className="font-display" style={{ fontSize: 13, color: "#5eead4", margin: "0 0 10px", letterSpacing: ".05em" }}>
            📋 LANGKAH DEPLOY KE VERCEL
          </p>
          <ol className="font-mono" style={{ fontSize: 12, color: "#eae8f5", lineHeight: 2, margin: 0, paddingLeft: 18 }}>
            <li>Download zip di atas (klik tombol besar hijau)</li>
            <li>Extract file zip di komputer Anda</li>
            <li>Buka <a href="https://vercel.com/new" target="_blank" rel="noopener" style={{ color: "#5eead4" }}>vercel.com/new <ExternalLink size={10} style={{ display: "inline" }} /></a></li>
            <li>Drag & drop folder hasil extract ke Vercel</li>
            <li>Set Environment Variables (lihat README di dalam zip)</li>
            <li>Klik <b style={{ color: "#eae8f5" }}>Deploy</b> — tunggu 2-3 menit</li>
            <li>Setup database: <code style={{ background: "rgba(94,234,212,0.1)", padding: "1px 4px", borderRadius: 3, color: "#5eead4", fontSize: 10 }}>bun run db:push && bun run db:seed</code></li>
            <li>Buka URL Vercel → setup owner → login → selesai!</li>
          </ol>
        </div>

        <p className="font-mono" style={{ fontSize: 10, color: "#8683a1", textAlign: "center", marginTop: 16, lineHeight: 1.6 }}>
          ⚠️ Setelah deploy, reset password Supabase (karena terekspos di chat sebelumnya)
        </p>

        <div style={{ textAlign: "center", marginTop: 16, display: "flex", gap: 12, justifyContent: "center" }}>
          <a href="/" style={{ color: "#8683a1", fontSize: 11, textDecoration: "none", fontFamily: "JetBrains Mono, monospace" }}>
            ← Galaxy
          </a>
          <a href="/login" style={{ color: "#8683a1", fontSize: 11, textDecoration: "none", fontFamily: "JetBrains Mono, monospace" }}>
            Login →
          </a>
        </div>
      </div>
    </div>
  );
}
