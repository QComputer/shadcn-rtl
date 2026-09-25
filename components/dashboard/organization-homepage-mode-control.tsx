"use client";

import { useState } from "react";

type HomepageMode = "PROFILE" | "SHOP" | "APPOINTMENT";

export function OrganizationHomepageModeControl({
  organizationId,
  initialMode,
  capabilities,
}: {
  organizationId: string;
  initialMode: HomepageMode;
  capabilities: string[];
}) {
  const [mode, setMode] = useState(initialMode);
  const [saving, setSaving] = useState(false);
  const canShop = capabilities.includes("SHOP");
  const canAppointment = capabilities.includes("APPOINTMENT");

  async function updateMode(nextMode: HomepageMode) {
    setMode(nextMode);
    setSaving(true);
    try {
      const response = await fetch(`/api/organizations/${organizationId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ homepageMode: nextMode }),
      });
      if (!response.ok) setMode(mode);
    } finally {
      setSaving(false);
    }
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span>Homepage</span>
      <select
        className="rounded-md border bg-background px-2 py-1"
        value={mode}
        disabled={saving}
        onChange={(event) => updateMode(event.target.value as HomepageMode)}
      >
        <option value="PROFILE">PROFILE</option>
        {canShop ? <option value="SHOP">SHOP</option> : null}
        {canAppointment ? <option value="APPOINTMENT">APPOINTMENT</option> : null}
      </select>
    </label>
  );
}
