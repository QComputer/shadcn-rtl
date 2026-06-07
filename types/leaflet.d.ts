declare module "leaflet" {
  const L: any;
  namespace L {
    export function map(el: any): any;
    export function tileLayer(url: string, opts?: any): any;
    export function marker(coords: [number, number], opts?: any): any;
    export function polyline(coords: [number, number][], opts?: any): any;
    export function icon(opts: any): any;
    export function latLng(lat: number, lng: number): any;
  }
  export default L;
}

declare module "leaflet/dist/leaflet.css" {
  const content: any;
  export default content;
}
