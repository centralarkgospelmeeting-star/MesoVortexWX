export type LiveCrossSectionSweep = {
  elevationDegrees: number;
  reflectivityDbz: Array<number | null>;
  beamHeightFtAboveRadar: Array<number | null>;
};

export type LiveCrossSectionResult = {
  site: string;
  siteName: string;
  scanTime: string;
  source: string;
  liveOnly: true;
  transectSampling: 'GREAT_CIRCLE_EQUAL_DISTANCE';
  heightReference: 'ABOVE_RADAR_LEVEL';
  beamModel: '4/3_EARTH_EFFECTIVE_RADIUS';
  lengthKm: number;
  columns: number;
  note: string;
  sweeps: LiveCrossSectionSweep[];
};

export type CrossSectionRequest = {
  site: string;
  start: { lon: number; lat: number };
  end: { lon: number; lat: number };
  columns?: number;
};
