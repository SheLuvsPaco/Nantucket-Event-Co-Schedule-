"use client";

import { useEffect } from "react";

export function AutoPrint() {
  useEffect(() => {
    // slight delay to ensure all fonts and images are loaded before triggering print dialog
    const timeout = setTimeout(() => {
      window.print();
    }, 500);
    return () => clearTimeout(timeout);
  }, []);

  return null;
}
