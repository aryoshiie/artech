"use client";

/**
 * RunTaskDialog — modal dialog for running an ad-hoc task through the
 * agent-core mini-service. Renders a textarea, a Run/Stop button, a live
 * elapsed-time counter, and a scrollable result pane.
 *
 * Routing:
 *   - POST /api/agent-core/run  (auth-protected proxy → agent-core /run-task)
 *
 * The dialog uses the same visual language as the rest of the artech
 * dashboard (glass-panel, modal-overlay, font-mono, etc.) so it inherits
 * the page's global <style> block. A small set of self-contained styles
 * is also injected via the embedded <style> tag so the dialog renders
 * correctly even before the page-level stylesheet is parsed.
 */

import React, { useEffect, useRef, useState } from "react";
import { X, Send, Loader2, Square, AlertCircle, CheckCircle2, Clock, Terminal } from "lucide-react";

export interface RunTaskDialogProps {
  agentId: string;
  agentName: string;
  agentColor: string;
  agentRole?: string;
  onClose: () => void;
  /** Optional: called after a successful run with the result text */
  onResult?: (result: string) => void;
}

type RunState = "idle" | "running" | "ok" | "error" | "aborted";

export function RunTaskDialog({
  agentId,
  agentName,
  agentColor,
  agentRole,
  onClose,
  onResult,
}: RunTaskDialogProps) {
  const [task, setTask] = useState("");
  const [state, setState] = useState<RunState>("idle");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll result pane to bottom when new content arrives.
  useEffect(() => {
    if (resultRef.current) {
      resultRef.current.scrollTop = resultRef.current.scrollHeight;
    }
  }, [result]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function startTimer() {
    setElapsed(0);
    const startedAt = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 250);
  }
  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function handleRun() {
    const trimmed = task.trim();
    if (!trimmed || state === "running") return;

    setResult("");
    setError("");
    setState("running");
    startTimer();

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch("/api/agent-core/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, task: trimmed }),
        signal: ctrl.signal,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setState("error");
        setError(
          data?.error ||
            `HTTP ${res.status} — Agent Core gagal menjalankan tugas. Pastikan mini-service berjalan: cd mini-services/agent-core && bun run dev`,
        );
        return;
      }

      if (data.ok) {
        setState("ok");
        setResult(data.result || "(Agent tidak mengembalikan teks)");
        onResult?.(data.result || "");
      } else {
        setState("error");
        setError(data.error || "Unknown error");
      }
    } catch (err: any) {
      if (err?.name === "AbortError") {
        setState("aborted");
        setError("⏹ Dihentikan oleh user.");
      } else {
        setState("error");
        const msg = err?.message || String(err);
        // Heuristic: detect connection refused / fetch failed → show actionable hint
        const looksLikeConnError =
          msg.toLowerCase().includes("fetch failed") ||
          msg.toLowerCase().includes("econnrefused") ||
          msg.toLowerCase().includes("network");
        setError(
          looksLikeConnError
            ? `Agent Core mini-service tidak berjalan. Jalankan: cd mini-services/agent-core && bun run dev\n\nDetail: ${msg}`
            : `Gagal memanggil Agent Core: ${msg}`,
        );
      }
    } finally {
      stopTimer();
      abortRef.current = null;
    }
  }

  function handleStop() {
    if (abortRef.current) {
      abortRef.current.abort();
    }
  }

  function handleClose() {
    if (state === "running") {
      handleStop();
    }
    onClose();
  }

  const running = state === "running";

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className="modal glass-panel run-task-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 560, maxWidth: "100%" }}
      >
        {/* Header */}
        <div className="drawer-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              className="roster-dot"
              style={{
                background: agentColor,
                boxShadow: `0 0 0.8vmin ${agentColor}`,
                width: 10,
                height: 10,
                borderRadius: "50%",
                flexShrink: 0,
              }}
            />
            <div>
              <div className="font-display" style={{ fontSize: 16 }}>
                Run Task · {agentName}
              </div>
              {agentRole && (
                <div className="font-mono" style={{ fontSize: 10, color: "#8683a1" }}>
                  {agentRole}
                </div>
              )}
            </div>
          </div>
          <button className="icon-btn" onClick={handleClose} aria-label="Tutup" disabled={running}>
            <X size={18} />
          </button>
        </div>

        {/* Status row */}
        <div className="run-task-status-row">
          <span
            className={`run-task-status-pill run-task-status-${state}`}
            style={{
              borderColor:
                state === "ok"
                  ? "#5eead4"
                  : state === "error"
                    ? "#ff8080"
                    : state === "aborted"
                      ? "#ffb454"
                      : state === "running"
                        ? agentColor
                        : "rgba(255,255,255,0.15)",
              color:
                state === "ok"
                  ? "#5eead4"
                  : state === "error"
                    ? "#ff8080"
                    : state === "aborted"
                      ? "#ffb454"
                      : state === "running"
                        ? agentColor
                        : "#8683a1",
            }}
          >
            {state === "ok" && <CheckCircle2 size={11} />}
            {state === "error" && <AlertCircle size={11} />}
            {state === "aborted" && <Square size={11} />}
            {state === "running" && <Loader2 size={11} className="spin-icon" />}
            {state === "idle" && <Terminal size={11} />}
            {state === "idle"
              ? "Siap"
              : state === "running"
                ? "Menjalankan..."
                : state === "ok"
                  ? "Selesai"
                  : state === "aborted"
                    ? "Dihentikan"
                    : "Error"}
          </span>
          {(running || elapsed > 0) && (
            <span className="font-mono run-task-elapsed" title="Elapsed time">
              <Clock size={10} /> {elapsed}s
            </span>
          )}
        </div>

        {/* Task textarea */}
        <label className="field-label font-mono">Task / Instruksi</label>
        <textarea
          className="text-input font-mono run-task-textarea"
          placeholder={`Tulis tugas untuk ${agentName}... Contoh: "List files di direktori saat ini" atau "Baca file README.md dan rangkum isinya"`}
          value={task}
          onChange={(e) => setTask(e.target.value)}
          rows={4}
          disabled={running}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              handleRun();
            }
          }}
          style={{ resize: "vertical", minHeight: 90, fontSize: 12 }}
        />
        <p className="field-hint font-mono" style={{ marginBottom: 8 }}>
          Tekan <code style={{ color: "#5eead4" }}>⌘/Ctrl + Enter</code> untuk run. Tugas dikirim ke
          agent-core mini-service yang menjalankan Hermes-style tool loop (LLM → tools → execute →
          loop).
        </p>

        {/* Action buttons */}
        <div className="modal-actions" style={{ marginTop: 4 }}>
          {!running ? (
            <button
              className="btn font-mono"
              onClick={handleRun}
              disabled={!task.trim()}
              style={{
                background: agentColor,
                color: "#1a1a2a",
                borderColor: agentColor,
                fontWeight: 600,
              }}
            >
              <Send size={13} /> Run Task
            </button>
          ) : (
            <button
              className="btn btn-danger font-mono"
              onClick={handleStop}
              title="Hentikan eksekusi"
            >
              <Square size={13} /> Stop
            </button>
          )}
          <button className="btn btn-ghost font-mono" onClick={handleClose} disabled={running}>
            Tutup
          </button>
        </div>

        {/* Result pane */}
        {(result || error || running) && (
          <div className="run-task-result-wrap" style={{ marginTop: 14 }}>
            <div className="font-mono run-task-result-label">
              {error ? "Error" : result ? "Hasil" : "Menunggu hasil..."}
            </div>
            <div
              ref={resultRef}
              className="run-task-result font-mono"
              style={{
                borderColor: error ? "rgba(255,128,128,0.3)" : "rgba(94,234,212,0.25)",
                background: error
                  ? "rgba(255,80,80,0.06)"
                  : "rgba(94,234,212,0.04)",
              }}
            >
              {running && !result && !error && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#8683a1" }}>
                  <Loader2 size={12} className="spin-icon" />
                  <span style={{ fontSize: 11 }}>Agent sedang berpikir...</span>
                </div>
              )}
              {error && (
                <pre
                  style={{
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    color: "#ff9c9c",
                    fontSize: 11,
                    lineHeight: 1.5,
                  }}
                >
                  {error}
                </pre>
              )}
              {!error && result && (
                <pre
                  style={{
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    color: "#eae8f5",
                    fontSize: 11.5,
                    lineHeight: 1.55,
                  }}
                >
                  {result}
                </pre>
              )}
            </div>
          </div>
        )}

        {/* Self-contained styles (only adds classes not already in page.tsx) */}
        <style>{`
          .run-task-dialog .drawer-header { margin-bottom: 10px; }
          .run-task-status-row {
            display: flex; align-items: center; gap: 10px;
            padding: 8px 0; margin-bottom: 4px;
            border-bottom: 1px solid rgba(255,255,255,0.06);
          }
          .run-task-status-pill {
            display: inline-flex; align-items: center; gap: 5px;
            padding: 4px 10px; border-radius: 999px;
            font-size: 10.5px; font-family: 'JetBrains Mono', monospace;
            border: 1px solid rgba(255,255,255,0.15);
            background: rgba(255,255,255,0.04);
            color: #8683a1;
          }
          .run-task-status-pill svg { flex-shrink: 0; }
          .run-task-elapsed {
            display: inline-flex; align-items: center; gap: 4px;
            font-size: 10.5px; color: #8683a1;
          }
          .run-task-textarea {
            line-height: 1.5; resize: vertical;
          }
          .run-task-result-wrap { display: flex; flex-direction: column; gap: 6px; }
          .run-task-result-label {
            font-size: 10.5px; color: #8683a1;
            text-transform: uppercase; letter-spacing: 0.06em;
          }
          .run-task-result {
            border: 1px solid rgba(94,234,212,0.25);
            background: rgba(94,234,212,0.04);
            border-radius: 10px; padding: 12px;
            max-height: 320px; overflow-y: auto;
            scrollbar-width: thin;
          }
          .run-task-result::-webkit-scrollbar { width: 6px; }
          .run-task-result::-webkit-scrollbar-thumb {
            background: rgba(255,255,255,0.12);
            border-radius: 6px;
          }
          .run-task-result pre {
            font-family: 'JetBrains Mono', monospace;
          }
          .spin-icon { animation: spin 1.2s linear infinite; }
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </div>
  );
}

export default RunTaskDialog;
