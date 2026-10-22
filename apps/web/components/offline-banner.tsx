"use client";

import { useEffect, useState } from "react";

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("offline", sync);
    window.addEventListener("online", sync);
    return () => {
      window.removeEventListener("offline", sync);
      window.removeEventListener("online", sync);
    };
  }, []);

  if (!offline) return null;

  return (
    <div role="status" className="bg-open-wash px-8 py-3 text-[16px] leading-6 text-open-text">
      <div className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-4">
        <p>You are offline. This page could not refresh.</p>
        <button
          type="button"
          className="rounded-[8px] bg-open-text px-3 py-1 text-open-wash"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    </div>
  );
}
