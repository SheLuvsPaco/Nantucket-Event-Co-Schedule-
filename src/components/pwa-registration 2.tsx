"use client";

import { useEffect } from "react";

const UPDATE_INTERVAL_MS = 60 * 60 * 1000;

export function PwaRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          if (registration.active?.scriptURL.endsWith("/sw.js")) {
            void registration.unregister();
          }
        }
      });
      return;
    }

    let intervalId: number | undefined;
    let registration: ServiceWorkerRegistration | undefined;

    const updateServiceWorker = () => {
      if (document.visibilityState === "visible") {
        void registration?.update();
      }
    };

    const register = async () => {
      try {
        registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
        intervalId = window.setInterval(
          updateServiceWorker,
          UPDATE_INTERVAL_MS,
        );
        document.addEventListener("visibilitychange", updateServiceWorker);
      } catch (error) {
        console.error("Service worker registration failed:", error);
      }
    };

    if (document.readyState === "complete") {
      void register();
    } else {
      window.addEventListener("load", register, { once: true });
    }

    return () => {
      window.removeEventListener("load", register);
      document.removeEventListener("visibilitychange", updateServiceWorker);
      if (intervalId !== undefined) window.clearInterval(intervalId);
    };
  }, []);

  return null;
}
