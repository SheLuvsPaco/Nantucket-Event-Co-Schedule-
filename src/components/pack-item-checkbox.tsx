"use client";

import { useState } from "react";

export function PackItemCheckbox({
  eventId,
  eventInventoryId,
  initialPacked,
}: {
  eventId: string;
  eventInventoryId: string;
  initialPacked: boolean;
}) {
  const [packed, setPacked] = useState(initialPacked);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (loading) return;
    const nextPacked = !packed;
    setPacked(nextPacked);
    setLoading(true);

    try {
      const res = await fetch(`/api/events/${eventId}/pack`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventInventoryId, packed: nextPacked }),
      });
      if (!res.ok) {
        setPacked(!nextPacked);
      }
    } catch {
      setPacked(!nextPacked);
    } finally {
      setLoading(false);
    }
  }

  return (
    <input
      type="checkbox"
      checked={packed}
      onChange={toggle}
      disabled={loading}
      style={{
        width: "1.5rem",
        height: "1.5rem",
        cursor: "pointer",
        marginRight: "0.75rem",
        flexShrink: 0,
        accentColor: "var(--foreground, #000)",
      }}
    />
  );
}
