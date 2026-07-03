"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import type { Business } from "@/lib/businesses";
import { QuickAddModal } from "./quick-add-modal";

export function QuickAddTrigger({
  defaultBusiness,
}: {
  defaultBusiness?: Business;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        className="button button-primary"
        onClick={() => setIsOpen(true)}
        style={{ display: "flex", alignItems: "center", gap: "6px" }}
      >
        <Sparkles size={16} />
        Quick Add
      </button>

      {isOpen && (
        <QuickAddModal
          defaultBusiness={defaultBusiness}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
