type InitialFetchDecision = {
  currentRequestKey: string;
  initialRequestKey: string;
  hasNavigated: boolean;
  saved: boolean;
  retryKey: number;
  favoriteRefreshKey: number;
  canReuseInitialProducts: boolean;
};

export function shouldSkipInitialCatalogFetch({
  currentRequestKey,
  initialRequestKey,
  hasNavigated,
  saved,
  retryKey,
  favoriteRefreshKey,
  canReuseInitialProducts,
}: InitialFetchDecision) {
  return canReuseInitialProducts
    && currentRequestKey === initialRequestKey
    && !hasNavigated
    && !saved
    && retryKey === 0
    && favoriteRefreshKey === 0;
}
