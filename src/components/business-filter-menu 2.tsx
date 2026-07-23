"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import {
  businesses,
  businessFilterParam,
  businessLabelList,
  businessLabels,
  type Business,
} from "@/lib/businesses";
import styles from "./business-filter-menu.module.css";

type BusinessPreset = {
  label: string;
  selection: Business[];
};

const schedulePresets: BusinessPreset[] = [
  { label: "All branches", selection: [...businesses] },
  { label: "Tents", selection: ["TENTS"] },
  { label: "Soiree", selection: ["SOIREE"] },
  { label: "Place Setters", selection: ["PLACE_SETTERS"] },
  { label: "Tents + Soiree", selection: ["TENTS", "SOIREE"] },
  { label: "Tents + Place Setters", selection: ["TENTS", "PLACE_SETTERS"] },
  { label: "Soiree + Place Setters", selection: ["SOIREE", "PLACE_SETTERS"] },
];

function selectionKey(selection: Business[]) {
  return [...selection].sort().join("|");
}

function buildHref({
  basePath,
  monthKey,
  selection,
}: {
  basePath: string;
  monthKey?: string;
  selection: Business[];
}) {
  const params = new URLSearchParams();
  if (monthKey) params.set("month", monthKey);
  const businessParam = businessFilterParam(selection);
  if (businessParam) params.set("businesses", businessParam);
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function BusinessFilterMenu({
  basePath,
  monthKey,
  selected,
}: {
  basePath: string;
  monthKey?: string;
  selected: Business[];
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDetailsElement>(null);
  const selectedKey = selectionKey(selected);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <details className={styles.menu} open={open} ref={menuRef}>
      <summary
        aria-label="Filter schedule by business"
        onClick={(event) => {
          event.preventDefault();
          setOpen((current) => !current);
        }}
      >
        <span>
          <small>Branches</small>
          <strong>{businessLabelList(selected)}</strong>
        </span>
        <ChevronDown aria-hidden="true" />
      </summary>
      <div className={styles.popover}>
        <p>Show schedule for</p>
        {schedulePresets.map((preset) => {
          const active = selectionKey(preset.selection) === selectedKey;
          return (
            <Link
              className={styles.option}
              data-active={active}
              href={buildHref({
                basePath,
                monthKey,
                selection: preset.selection,
              })}
              key={preset.label}
              onClick={() => setOpen(false)}
            >
              <span className={styles.swatches} aria-hidden="true">
                {preset.selection.map((business) => (
                  <i data-business={business.toLowerCase()} key={business} />
                ))}
              </span>
              <span>{preset.label}</span>
              {active ? <Check aria-hidden="true" /> : null}
            </Link>
          );
        })}
      </div>
      <div className={styles.legend} aria-label="Branch colors">
        {businesses.map((business) => (
          <span data-business={business.toLowerCase()} key={business}>
            {businessLabels[business]}
          </span>
        ))}
      </div>
    </details>
  );
}
