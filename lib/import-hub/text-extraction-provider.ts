import { parseProductText, type ParsedTextProductDraft } from "@/lib/import-hub/text-product-extractor"

export type ProductTextExtractionProvider = {
  id: "local-rule-based"
  mode: "dry-run"
  extractProducts(input: { text?: string | null; maxLines?: number }): ParsedTextProductDraft[]
}

export const ruleBasedTextExtractionProvider: ProductTextExtractionProvider = {
  id: "local-rule-based",
  mode: "dry-run",
  extractProducts(input) {
    return parseProductText(input)
  },
}

export function getProductTextExtractionProvider(): ProductTextExtractionProvider {
  return ruleBasedTextExtractionProvider
}

export function externalTextExtractionEnabled() {
  return false
}
