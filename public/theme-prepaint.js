(() => {
  const root = document.documentElement;
  let theme = "dark";

  try {
    const saved = window.localStorage.getItem("shadcn-rtl-theme");
    if (["light", "dark", "warm-cream", "charcoal-gray", "system"].includes(saved)) {
      theme = saved;
    }
  } catch {
    // Storage may be disabled; keep the dark default.
  }

  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true;
  const resolved = theme === "system"
    ? (prefersDark ? "dark" : "light")
    : (theme === "light" || theme === "warm-cream" ? "light" : "dark");

  root.classList.remove("light", "dark", "warm-cream", "charcoal-gray");
  root.classList.add(resolved);
  root.setAttribute("data-theme", theme);
})();
