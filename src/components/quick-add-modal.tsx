"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X, Tent } from "lucide-react";

const loadingMessages = [
  "Reading your message...",
  "Extracting dates & times...",
  "Finding the right crew...",
  "Checking vehicles & inventory...",
  "Drafting the master plan...",
  "Finalizing events..."
];

export function QuickAddModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    if (!loading) return;

    const interval = setInterval(() => {
      setMessageIndex((i) => (i + 1 < loadingMessages.length ? i + 1 : i));
    }, 2500);
    return () => clearInterval(interval);
  }, [loading]);

  async function handleParse() {
    if (!text.trim()) return;
    setMessageIndex(0);
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/events/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to parse events");
      }

      setSuccessCount(data.createdCount);
      setText("");
      router.refresh();

      setTimeout(() => {
        onClose();
      }, 2000);

    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "The schedule could not be parsed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
      backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
      zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center"
    }}>
      <style>{`
        @keyframes bounce-tent {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-12px) scale(1.05); }
        }
        .tent-bounce {
          animation: bounce-tent 1.5s infinite ease-in-out;
        }
        @keyframes fade-in {
          0% { opacity: 0; transform: translateY(4px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .fade-in-text {
          animation: fade-in 0.4s ease-out;
        }
      `}</style>

      <div style={{
        backgroundColor: "var(--surface)", borderRadius: "12px", width: "100%", maxWidth: "600px",
        padding: "24px", display: "flex", flexDirection: "column", gap: "16px",
        boxShadow: "var(--shadow-md)", position: "relative",
        overflow: "hidden"
      }}>
        <button
          onClick={onClose}
          style={{ position: "absolute", top: "16px", right: "16px", background: "none", border: "none", cursor: "pointer", zIndex: 10 }}
        >
          <X size={20} />
        </button>

        <h2 style={{ fontSize: "18px", fontWeight: "600", display: "flex", alignItems: "center", gap: "8px", color: "var(--ink)" }}>
          <Sparkles size={20} color="var(--navy)" />
          AI Quick Add
        </h2>

        <p style={{ fontSize: "14px", color: "var(--ink-soft)" }}>
          Paste your unstructured schedule here (e.g., from WhatsApp). The AI will extract dates, times, crew, trucks, and items to automatically create your events.
        </p>

        {successCount !== null ? (
          <div style={{ padding: "16px", backgroundColor: "#e6f4ea", color: "#1e8e3e", borderRadius: "8px", fontWeight: "500", textAlign: "center" }}>
            Successfully created {successCount} events! Refreshing schedule...
          </div>
        ) : (
          <div style={{ position: "relative" }}>
            {/* Loading Overlay */}
            {loading && (
              <div style={{
                position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
                backgroundColor: "rgba(255, 255, 255, 0.8)",
                backdropFilter: "blur(2px)", zIndex: 5,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                borderRadius: "8px"
              }}>
                <div className="tent-bounce" style={{ color: "var(--navy)", marginBottom: "16px" }}>
                  <Tent size={48} strokeWidth={1.5} />
                </div>
                <div
                  key={messageIndex}
                  className="fade-in-text"
                  style={{ color: "var(--ink)", fontWeight: "500", fontSize: "15px", textAlign: "center" }}
                >
                  {loadingMessages[messageIndex]}
                </div>
              </div>
            )}

            <div style={{
              display: "flex", flexDirection: "column", gap: "16px",
              opacity: loading ? 0.3 : 1,
              pointerEvents: loading ? "none" : "auto",
              transition: "opacity 0.3s ease"
            }}>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="June 19th Friday&#10;Warehouse call 7AM:&#10;Depart for galley 715AM&#10;- 730AM-1030AM Install at Galley Beach..."
                style={{
                  width: "100%", minHeight: "250px", padding: "12px", borderRadius: "8px",
                  border: "1px solid var(--line)", backgroundColor: "var(--paper)",
                  color: "var(--ink)",
                  fontSize: "14px", fontFamily: "monospace", resize: "vertical"
                }}
              />

              {error && (
                <div style={{ color: "var(--red)", fontSize: "14px" }}>
                  {error}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  className="button button-primary"
                  onClick={handleParse}
                  disabled={loading || !text.trim()}
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <Sparkles size={16} />
                  Magic Create
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
