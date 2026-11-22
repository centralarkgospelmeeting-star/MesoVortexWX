import type { Map as MapLibreMap } from 'maplibre-gl';

type SyncEntry = {
  map: MapLibreMap;
  applying: boolean;
};

const groups = new Map<string, Set<SyncEntry>>();

/**
 * Synchronizes camera movement between every MapLibre map registered under the
 * same group id. Used by Expert Mode and Quad View.
 *
 * MapLibre's jumpTo fires `move` synchronously, so an `applying` flag per map is
 * enough to stop feedback loops. A value comparison is kept as a second guard
 * for float noise.
 */
export function registerSyncedMap(groupId: string, map: MapLibreMap): () => void {
  let group = groups.get(groupId);
  if (!group) {
    group = new Set<SyncEntry>();
    groups.set(groupId, group);
  }

  const entry: SyncEntry = { map, applying: false };
  group.add(entry);

  const onMove = () => {
    if (entry.applying) return;

    const center = map.getCenter();
    const zoom = map.getZoom();
    const bearing = map.getBearing();
    const pitch = map.getPitch();

    group!.forEach((other) => {
      if (other === entry || other.applying) return;

      const otherCenter = other.map.getCenter();
      const same =
        Math.abs(otherCenter.lng - center.lng) < 1e-9 &&
        Math.abs(otherCenter.lat - center.lat) < 1e-9 &&
        Math.abs(other.map.getZoom() - zoom) < 1e-9 &&
        Math.abs(other.map.getBearing() - bearing) < 1e-9 &&
        Math.abs(other.map.getPitch() - pitch) < 1e-9;
      if (same) return;

      other.applying = true;
      try {
        other.map.jumpTo({ center, zoom, bearing, pitch });
      } finally {
        other.applying = false;
      }
    });
  };

  map.on('move', onMove);

  return () => {
    map.off('move', onMove);
    group!.delete(entry);
    if (group!.size === 0) groups.delete(groupId);
  };
}
