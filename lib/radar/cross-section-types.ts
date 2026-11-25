export type LiveCrossSectionSweep = {
  elevationDegrees: number;
  reflectivityDbz: Array<number | null>;
  beamHeightFtAglApprox: Array<number | null>;
};

export type LiveCrossSectionResult = {
  site: string;
  siteName: string;
  scanTime: string;
  source: string;
  liveOnly: true;
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
