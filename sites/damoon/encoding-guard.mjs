import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const textExtensions = new Set([".css", ".html", ".js", ".json", ".svg", ".txt"]);

// These signatures match common UTF-8-as-legacy-code-page corruption seen in
// Persian/Arabic strings, replacement characters, and damaged punctuation.
export const DAMOON_MOJIBAKE_PATTERN = /(?:╪[^\s]|┘[^\s]|Γ(?:Ç|ù|î|å)|┬(?:╖|⌐)|├ù|█[░▒▓│]|Ã[^\s]|Â[^\s]|�)/u;

export function assertCleanDamoonText(text, label = "Damoon text") {
  const match = DAMOON_MOJIBAKE_PATTERN.exec(text);
  if (match) {
    throw new Error(`${label} contains a known mojibake signature: ${JSON.stringify(match[0])}`);
  }
}

export async function assertCleanDamoonAssets(root) {
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(file);
      } else if (textExtensions.has(path.extname(entry.name).toLowerCase())) {
        assertCleanDamoonText(await readFile(file, "utf8"), path.relative(root, file));
      }
    }
  }
  await visit(root);
}
