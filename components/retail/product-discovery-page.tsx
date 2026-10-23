import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ApiError } from "@/lib/api-guards";
import { getPublicCatalogFacets, listPublicCatalogCategories, listPublicCatalogProducts } from "@/lib/public-catalog/service.server";
import { publicCatalogListQuerySchema, type PublicCatalogProduct } from "@/lib/public-catalog/contracts";
import { getShopTenantSeoContext } from "@/lib/custom-domain-seo";
import { buildPublicMetadata } from "@/lib/seo";
import { ProductDiscovery } from "@/components/retail/product-discovery";

type SearchParams = Record<string, string | string[] | undefined>;
type PageProps = { locale: string; organization: string; searchParams: Promise<SearchParams> };
const getValue = (params: SearchParams, key: string) => Array.isArray(params[key]) ? params[key]?.[0] : params[key];
const getValues = (params: SearchParams, key: string) => Array.isArray(params[key]) ? params[key] as string[] : params[key] ? [params[key] as string] : [];

function serializeSearchParams(params: SearchParams) {
  return JSON.stringify(Object.entries(params).filter((entry): entry is [string, string | string[]] => entry[1] !== undefined).sort(([left], [right]) => left.localeCompare(right)));
}

const loadDiscoveryData = cache(async (locale: string, organizationSlug: string, serializedParams: string) => {
  if (locale !== "fa") notFound();
  const query = JSON.parse(serializedParams) as SearchParams;
  try {
    const [{ organization, categories }, facets] = await Promise.all([
      listPublicCatalogCategories(organizationSlug),
      getPublicCatalogFacets(organizationSlug),
    ]);
    const name = organization.branding?.displayName ?? organization.name;
    const identifier = organization.slug;
    const canonical = await getShopTenantSeoContext({ locale, slug: identifier, subPath: "/discover" });
    const storefront = await getShopTenantSeoContext({ locale, slug: identifier, subPath: "/" });
    const parsed = publicCatalogListQuerySchema.safeParse({
      ...Object.fromEntries(Object.entries(query).filter(([key]) => key !== "filter")),
      filter: getValues(query, "filter"),
      limit: 24,
      sort: getValue(query, "sort") || "newest",
    });
    const saved = getValue(query, "saved") === "1";
    const emptyPage = { products: [] as PublicCatalogProduct[], pagination: { page: 1, limit: 24, total: 0, totalPages: 0 } };
    const initial = saved || !parsed.success ? emptyPage : await listPublicCatalogProducts({
      organizationIdentifier: organizationSlug,
      page: parsed.data.page,
      limit: parsed.data.limit,
      q: parsed.data.q,
      category: parsed.data.category,
      brand: parsed.data.brand,
      minPrice: parsed.data.minPrice,
      maxPrice: parsed.data.maxPrice,
      available: parsed.data.available,
      filter: "filter" in parsed.data ? parsed.data.filter : undefined,
      sort: parsed.data.sort,
    });
    return {
      organization: { identifier, name, logo: organization.branding?.logoUrl ?? organization.logo },
      categories,
      facets,
      initial,
      canonical,
      storefront,
      query,
      indexable: Object.keys(query).length === 0,
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
});

async function getData(props: PageProps) {
  const query = await props.searchParams;
  return loadDiscoveryData(props.locale, props.organization, serializeSearchParams(query));
}

export async function discoveryMetadata(props: PageProps): Promise<Metadata> {
  const { organization, canonical, indexable } = await getData(props);
  return {
    ...buildPublicMetadata({ locale: props.locale, baseUrl: canonical.baseUrl, path: canonical.path,
      title: `جست‌وجوی محصولات | ${organization.name}`,
      description: `جست‌وجو و پیدا کردن محصولات فروشگاه ${organization.name}.`, alternatePath: canonical.alternatePath }),
    ...(!indexable ? { robots: { index: false, follow: true, googleBot: { index: false, follow: true } } } : {}),
  };
}

export async function ProductDiscoveryPage(props: PageProps) {
  const { organization, facets, initial, storefront, query } = await getData(props);
  return <ProductDiscovery organization={organization.identifier} storeName={organization.name}
    logo={organization.logo} storefrontPath={storefront.path} initialProducts={initial.products}
    initialPagination={initial.pagination} facets={facets} initialQuery={getValue(query, "q") ?? ""} />;
}
