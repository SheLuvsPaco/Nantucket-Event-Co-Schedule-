"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@/db/schema";

const ROLE_CHECK_INTERVAL_MS = 30_000;

export function RoleSync({ initialRole }: { initialRole: Role }) {
  const router = useRouter();
  const currentRole = useRef(initialRole);

  useEffect(() => {
    currentRole.current = initialRole;
  }, [initialRole]);

  useEffect(() => {
    let disposed = false;

    async function checkRole() {
      if (document.visibilityState !== "visible") return;

      try {
        const response = await fetch("/api/auth/session", {
          cache: "no-store",
        });
        if (response.status === 401) {
          router.push("/login");
          router.refresh();
          return;
        }
        if (!response.ok) return;

        const data = (await response.json()) as {
          user?: { role?: Role };
        };
        const nextRole = data.user?.role;
        if (!disposed && nextRole && nextRole !== currentRole.current) {
          currentRole.current = nextRole;
          router.refresh();
        }
      } catch {
        // The current screen remains usable while offline.
      }
    }

    const intervalId = window.setInterval(
      checkRole,
      ROLE_CHECK_INTERVAL_MS,
    );
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void checkRole();
    };
    const onFocus = () => void checkRole();

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onFocus);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
    };
  }, [router]);

  return null;
}
