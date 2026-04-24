'use client';

import { useEffect } from "react";

export function PwaRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    let disposed = false;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });

        if (!disposed) {
          await registration.update();
        }
      } catch (error) {
        console.error("Failed to register service worker", error);
      }
    };

    if (document.readyState === "complete") {
      void register();

      return () => {
        disposed = true;
      };
    }

    const onLoad = () => {
      void register();
    };

    window.addEventListener("load", onLoad);

    return () => {
      disposed = true;
      window.removeEventListener("load", onLoad);
    };
  }, []);

  return null;
}
