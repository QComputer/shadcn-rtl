const retailPriceFormatter = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 2 });
const bidiControls = /[\u061c\u200e\u200f]/g;

export function formatRetailPriceNumber(amount: number): string {
  return retailPriceFormatter.formatToParts(amount).map(part => {
    if (part.type === "group") return ",";
    if (part.type === "decimal") return ".";
    if (part.type === "literal") return part.value.replace(bidiControls, "");
    return part.value;
  }).join("");
}

export function formatRetailMoney(amount: number): string {
  return `${formatRetailPriceNumber(amount)} تومان`;
}
