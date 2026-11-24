export type LngLat = [number, number];

export function distanceMeters(a: LngLat, b: LngLat): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371008.8;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function polylineMeters(points: LngLat[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distanceMeters(points[i - 1], points[i]);
  return total;
}

// Spherical polygon area (m^2). Returns 0 for <3 points.
export function polygonAreaMeters2(points: LngLat[]): number {
  if (points.length < 3) return 0;
  const R = 6371008.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const [lon1, lat1] = points[i];
    const [lon2, lat2] = points[(i + 1) % points.length];
    total += toRad(lon2 - lon1) * (2 + Math.sin(toRad(lat1)) + Math.sin(toRad(lat2)));
  }
  return Math.abs((total * R * R) / 2);
}

export function formatDistance(meters: number): string {
  const miles = meters / 1609.344;
  const km = meters / 1000;
  return `${miles.toFixed(miles < 10 ? 2 : 1)} mi / ${km.toFixed(km < 10 ? 2 : 1)} km`;
}

export function formatArea(m2: number): string {
  const sqMi = m2 / 2589988.110336;
  const sqKm = m2 / 1_000_000;
  const acres = m2 / 4046.8564224;
  return `${sqMi.toFixed(sqMi < 10 ? 2 : 1)} sq mi / ${sqKm.toFixed(sqKm < 10 ? 2 : 1)} sq km / ${acres.toFixed(acres < 100 ? 1 : 0)} ac`;
}

export function pointInRing(point: LngLat, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersect = yi > point[1] !== yj > point[1] && point[0] < ((xj - xi) * (point[1] - yi)) / ((yj - yi) || 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function pointInGeometry(point: LngLat, geometry: any): boolean {
  if (!geometry) return false;
  if (geometry.type === 'Polygon') {
    const rings = geometry.coordinates || [];
    if (!rings.length) return false;
    if (!pointInRing(point, rings[0])) return false;
    for (let i = 1; i < rings.length; i++) if (pointInRing(point, rings[i])) return false;
    return true;
  }
  if (geometry.type === 'MultiPolygon') {
    return (geometry.coordinates || []).some((poly: any[]) => {
      if (!poly?.length) return false;
      if (!pointInRing(point, poly[0])) return false;
      for (let i = 1; i < poly.length; i++) if (pointInRing(point, poly[i])) return false;
      return true;
    });
  }
  return false;
}
