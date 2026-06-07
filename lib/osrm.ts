export interface OsrmRoute {
  distance: number
  duration: number
  geometry: number[][]
}

export async function fetchOsrmRoute(
  fromLng: number,
  fromLat: number,
  toLng: number,
  toLat: number
): Promise<OsrmRoute | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`
    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) return null
    const data = await res.json()
    const route = data.routes?.[0]
    if (!route) return null
    return {
      distance: route.distance,
      duration: route.duration,
      geometry: route.geometry?.coordinates ?? [],
    }
  } catch {
    return null
  }
}
