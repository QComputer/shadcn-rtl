"use client";

import type { ChangeEvent } from "react";

export type StudioFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
  className?: string;
  type?: string;
  dir?: "ltr" | "rtl";
  rows?: number;
};

export function StudioField({ label, value, onChange, multiline = false, placeholder = "", className, type = "text", dir, rows = 4 }: StudioFieldProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value);
  return <label className={className}>
    <span>{label}</span>
    {multiline
      ? <textarea value={value} placeholder={placeholder} rows={rows} dir={dir} onChange={handleChange} />
      : <input type={type} value={value} placeholder={placeholder} dir={dir} onChange={handleChange} />}
  </label>;
}
