import { RetailCardMedia } from "./retail-product-card";
import type { PublicCatalogProduct } from "@/lib/public-catalog/contracts";
import { appPath } from "@/lib/app-base-path";

type Props = { products: PublicCatalogProduct[]; storefrontPath: string };
const toman = (amount: number) => `${new Intl.NumberFormat("fa-IR").format(amount)} تومان`;

export function RelatedProducts({ products, storefrontPath }: Props) {
  const items = products.slice(0, 8);
  if (!items.length) return null;

  return <section dir="rtl" lang="fa" aria-labelledby="related-products-title" className="bg-background px-5 pb-16 pt-6 text-foreground lg:px-12">
    <div className="mx-auto max-w-[1440px] border-t border-border pt-8">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div><p className="text-xs font-medium text-muted-foreground">از همین فروشگاه</p><h2 id="related-products-title" className="mt-1 text-xl font-semibold tracking-tight">محصولات مرتبط</h2></div>
        <a href={appPath(storefrontPath)} className="text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground">همه محصولات</a>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-6">
        {items.map((product) => {
          const target = appPath(`${storefrontPath.replace(/\/$/, "")}/product/${encodeURIComponent(product.slug || product.id)}`);
          return <article key={product.id} className="group min-w-0 overflow-hidden rounded-2xl border border-border bg-card transition hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(41,37,36,0.08)] sm:rounded-3xl">
            <div className="relative aspect-[4/5] overflow-hidden bg-muted [&>div]:h-full [&>div]:aspect-auto">
              <RetailCardMedia product={product} href={target} pinned={false} />
            </div>
            <div className="min-w-0 p-3 sm:p-4"><p className="truncate text-[10px] text-muted-foreground sm:text-xs">{product.category.name}{product.brand ? ` · ${product.brand}` : ""}</p><a href={target} className="mt-1.5 line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:min-h-12 sm:text-base sm:leading-6">{product.name}</a><p className="mt-3 text-xs font-bold tabular-nums sm:text-sm">{toman(product.price.amount)}</p></div>
          </article>;
        })}
      </div>
    </div>
  </section>;
}
