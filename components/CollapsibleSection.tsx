"use client";

import { useState, type ReactNode } from "react";

interface CollapsibleSectionProps {
  title: string;
  badge?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function CollapsibleSection({
  title,
  badge,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-sm border border-line bg-surface">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="font-serif text-base text-ink">{title}</span>
          {badge && (
            <span className="rounded-sm bg-void px-1.5 py-0.5 font-mono text-xs text-ink-muted">
              {badge}
            </span>
          )}
        </div>
        <span
          className={`text-ink-muted transition-transform ${open ? "rotate-180" : ""}`}
        >
          &#9660;
        </span>
      </button>

      {open && <div className="border-t border-line p-4">{children}</div>}
    </div>
  );
}