// Keep exports directly compatible with the merchant product write contracts.
export const MAX_RETAIL_ROWS = 500;
export const MAX_RETAIL_PRODUCTS = 10;
export const MAX_RETAIL_VARIANTS_PER_PRODUCT = 100;

export function retailExportBatches(products: Array<{ id: string; rows: number }>) {
  const batches: Array<Array<{ id: string; offset: number; rows: number }>> = [];
  let batch: Array<{ id: string; offset: number; rows: number }> = [];
  let count = 0;
  for (const product of products) {
    for (let offset = 0; offset < product.rows; offset += MAX_RETAIL_VARIANTS_PER_PRODUCT) {
      const rows = Math.min(MAX_RETAIL_VARIANTS_PER_PRODUCT, product.rows - offset);
      if (batch.length && (count + rows > MAX_RETAIL_ROWS || batch.length >= MAX_RETAIL_PRODUCTS || batch.some(p => p.id === product.id))) {
        batches.push(batch); batch = []; count = 0;
      }
      batch.push({ id: product.id, offset, rows }); count += rows;
    }
  }
  if (batch.length) batches.push(batch);
  return batches;
}
