"use client";

import { X } from "lucide-react";

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-30 flex justify-end bg-raft-ink/20" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-md flex-col border-l border-raft-line bg-raft-cream p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[18px] font-medium">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-raft-muted hover:bg-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto">{children}</div>
      </aside>
    </div>
  );
}
