/** Compare editor values rather than JSON key insertion order or numeric input types. */
export function retailEditorSnapshot(state: Record<string, unknown>): string {
  function stable(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, stable(item)]));
    return value;
  }
  return JSON.stringify(stable({ ...state, basePrice: state.basePrice ? String(state.basePrice) : "" }));
}
