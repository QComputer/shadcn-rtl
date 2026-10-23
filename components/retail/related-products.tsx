import Image from "next/image";
import type { PublicCatalogProduct } from "@/lib/public-catalog/contracts";
import { appPath } from "@/lib/app-base-path";

type Props = { products: PublicCatalogProduct[]; storefrontPath: string };
const toman = (amount: number) => `${new Intl.NumberFormat("fa-IR").format(amount)} تومان`;

export function RelatedProducts({ products, storefrontPath }: Props) {
  const items = products.slice(0, 8);
  if (!items.length) return null;

  return <section dir="rtl" lang="fa" aria-labelledby="related-products-title" className="bg-[#fcfbf8] px-5 pb-16 pt-6 text-stone-900 lg:px-12">
    <div className="mx-auto max-w-[1440px] border-t border-stone-200/80 pt-8">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div><p className="text-xs font-medium text-stone-500">از همین فروشگاه</p><h2 id="related-products-title" className="mt-1 text-xl font-semibold tracking-tight">محصولات مرتبط</h2></div>
        <a href={appPath(storefrontPath)} className="text-xs font-medium text-stone-600 underline underline-offset-4 hover:text-stone-900">همه محصولات</a>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-6">
        {items.map((product) => {
          const target = appPath(`${storefrontPath.replace(/\/$/, "")}/product/${encodeURIComponent(product.slug || product.id)}`);
          const image = product.media.card || product.media.gallery[0];
          return <article key={product.id} className="group min-w-0 overflow-hidden rounded-2xl border border-stone-200/80 bg-white transition hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(41,37,36,0.08)] sm:rounded-3xl">
            <a href={target} aria-label={`مشاهده ${product.name}`} className="relative block aspect-[4/5] overflow-hidden bg-stone-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-700">
              {image ? <Image src={image} alt={product.media.alt || product.name} fill unoptimized sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 220px" className="object-cover transition duration-500 motion-reduce:transition-none group-hover:scale-[1.025]" /> : <span className="grid h-full place-items-center px-3 text-center text-xs text-stone-500">تصویری ثبت نشده است</span>}
            </a>
            <div className="min-w-0 p-3 sm:p-4"><p className="truncate text-[10px] text-stone-500 sm:text-xs">{product.category.name}{product.brand ? ` · ${product.brand}` : ""}</p><a href={target} className="mt-1.5 line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:min-h-12 sm:text-base sm:leading-6">{product.name}</a><p className="mt-3 text-xs font-bold tabular-nums sm:text-sm">{toman(product.price.amount)}</p></div>
          </article>;
        })}
      </div>
    </div>
  </section>;
}
