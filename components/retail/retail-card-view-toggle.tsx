"use client";

import { AlignJustify, LayoutGrid } from "lucide-react";
import { useCallback, useSyncExternalStore } from "react";

export type RetailCardView = "compact" | "detailed";

type RetailCardViewListener = () => void;
type RetailCardViewEvent = CustomEvent<{ organization: string }>;

const memory = new Map<string, RetailCardView>();
const eventName = "bazarbaaz:retail-card-view-change";

function storageKey(organization: string) {
  return `bazarbaaz:retail-card-view:${organization}`;
}

function parseView(value: string | null): RetailCardView | undefined {
  return value === "compact" || value === "detailed" ? value : undefined;
}

function readView(organization: string): RetailCardView {
  const cached = memory.get(organization);
  if (cached) return cached;

  try {
    const stored = parseView(window.localStorage.getItem(storageKey(organization)));
    if (stored) {
      memory.set(organization, stored);
      return stored;
    }
  } catch {
    // Some browser privacy modes block localStorage; the in-memory default still works.
  }

  memory.set(organization, "compact");
  return "compact";
}

function subscribe(organization: string, listener: RetailCardViewListener) {
  const key = storageKey(organization);
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== key && event.key !== null) return;
    const value = event.key === null ? undefined : parseView(event.newValue);
    if (value) memory.set(organization, value);
    else memory.delete(organization);
    listener();
  };
  const handleSameTab = (event: Event) => {
    if ((event as RetailCardViewEvent).detail?.organization === organization) listener();
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(eventName, handleSameTab);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(eventName, handleSameTab);
  };
}

export function useRetailCardView(organization: string): readonly [RetailCardView, (view: RetailCardView) => void] {
  const normalizedOrganization = organization.trim();
  const subscribeToOrganization = useCallback(
    (listener: RetailCardViewListener) => subscribe(normalizedOrganization, listener),
    [normalizedOrganization],
  );
  const getSnapshot = useCallback(() => readView(normalizedOrganization), [normalizedOrganization]);
  const getServerSnapshot = useCallback((): RetailCardView => "compact", []);
  const view = useSyncExternalStore(subscribeToOrganization, getSnapshot, getServerSnapshot);
  const setView = useCallback((nextView: RetailCardView) => {
    memory.set(normalizedOrganization, nextView);
    try {
      window.localStorage.setItem(storageKey(normalizedOrganization), nextView);
    } catch {
      // Keep this browser session usable when persistent storage is unavailable.
    }
    window.dispatchEvent(new CustomEvent(eventName, { detail: { organization: normalizedOrganization } }));
  }, [normalizedOrganization]);

  return [view, setView] as const;
}

export function RetailCardViewToggle({
  value,
  onChange,
}: {
  value: RetailCardView;
  onChange: (view: RetailCardView) => void;
}) {
  const focus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
  const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm transition-colors";

  return (
    <div role="group" aria-label="نمایش کارت محصولات" className="inline-flex items-center gap-1 rounded-xl border border-border bg-muted p-1">
      <button
        type="button"
        aria-pressed={value === "compact"}
        onClick={() => onChange("compact")}
        className={`${button} ${focus} ${value === "compact" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
      >
        <LayoutGrid aria-hidden="true" className="size-4" />
        خلاصه
      </button>
      <button
        type="button"
        aria-pressed={value === "detailed"}
        onClick={() => onChange("detailed")}
        className={`${button} ${focus} ${value === "detailed" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
      >
        <AlignJustify aria-hidden="true" className="size-4" />
        با جزئیات
      </button>
    </div>
  );
}
