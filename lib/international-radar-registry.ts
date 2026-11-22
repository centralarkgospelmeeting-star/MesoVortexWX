export type RadarSourceStatus = 'verified' | 'planned' | 'unavailable';

export interface InternationalRadarSource {
  country: string;
  agency: string;
  source: string;
  format: string;
  status: RadarSourceStatus;
  notes: string;
}

// DATA HONESTY: only mark verified when a real endpoint has been tested and permitted.
export const INTERNATIONAL_RADAR_SOURCES: InternationalRadarSource[] = [
  { country: 'United States', agency: 'NOAA/NWS', source: 'IEM NEXRAD/TDWR/MRMS tiles', format: 'XYZ raster', status: 'verified', notes: 'Currently integrated.' },
  { country: 'Canada', agency: 'ECCC/MSC GeoMet', source: 'https://geo.weather.gc.ca/geomet', format: 'WMS/GetCapabilities verified', status: 'verified', notes: 'Real WMS endpoint verified (RADAR_1KM_RRAI). Tile/WMS adapter integration pending.' },
  { country: 'United Kingdom', agency: 'Met Office', source: 'DataHub/official feed', format: 'TBD', status: 'planned', notes: 'License/terms verification required.' },
  { country: 'Australia', agency: 'BOM', source: 'BOM Radar', format: 'TBD', status: 'planned', notes: 'Official source/terms verification required.' },
  { country: 'Japan', agency: 'JMA', source: 'JMA radar', format: 'TBD', status: 'planned', notes: 'Official source/terms verification required.' },
  { country: 'Germany', agency: 'DWD', source: 'DWD Open Data', format: 'TBD', status: 'planned', notes: 'Official source/terms verification required.' },
  { country: 'France', agency: 'Météo-France', source: 'Official feed', format: 'TBD', status: 'planned', notes: 'License/terms verification required.' },
  { country: 'Netherlands', agency: 'KNMI', source: 'KNMI Open Data', format: 'HDF5/WMS', status: 'planned', notes: 'Official source/terms verification required.' },
  { country: 'Finland', agency: 'FMI', source: 'FMI Open Data', format: 'WMS', status: 'planned', notes: 'Official source/terms verification required.' },
  { country: 'Norway', agency: 'MET Norway', source: 'api.met.no/thredds', format: 'TBD', status: 'planned', notes: 'Official source/terms verification required.' },
  { country: 'Spain', agency: 'AEMET', source: 'AEMET OpenData', format: 'TBD', status: 'planned', notes: 'License/terms verification required.' },
  { country: 'Brazil', agency: 'INMET/REDEMET', source: 'Official feed', format: 'TBD', status: 'planned', notes: 'Official source/terms verification required.' },
  { country: 'Mexico', agency: 'SMN/CONAGUA', source: 'Official feed', format: 'TBD', status: 'planned', notes: 'Official source/terms verification required.' },
  { country: 'South Korea', agency: 'KMA', source: 'Official feed', format: 'TBD', status: 'planned', notes: 'Official source/terms verification required.' },
  { country: 'Taiwan', agency: 'CWA', source: 'Official feed', format: 'TBD', status: 'planned', notes: 'Official source/terms verification required.' },
  { country: 'India', agency: 'IMD', source: 'Official feed', format: 'TBD', status: 'planned', notes: 'Official source/terms verification required.' },
  { country: 'South Africa', agency: 'SAWS', source: 'Official feed', format: 'TBD', status: 'planned', notes: 'Official source/terms verification required.' },
  { country: 'New Zealand', agency: 'MetService', source: 'Official feed', format: 'TBD', status: 'planned', notes: 'License/terms verification required.' },
  { country: 'Argentina', agency: 'SMN', source: 'Official feed', format: 'TBD', status: 'planned', notes: 'Official source/terms verification required.' },
  { country: 'Colombia', agency: 'IDEAM', source: 'Official feed', format: 'TBD', status: 'planned', notes: 'Official source/terms verification required.' },
  { country: 'Philippines', agency: 'PAGASA', source: 'Official feed', format: 'TBD', status: 'planned', notes: 'Official source/terms verification required.' },
  { country: 'Singapore', agency: 'MSS/NEA', source: 'Official feed', format: 'TBD', status: 'planned', notes: 'Official source/terms verification required.' },
  { country: 'Poland', agency: 'IMGW-PIB', source: 'Official feed', format: 'TBD', status: 'planned', notes: 'Official source/terms verification required.' },
  { country: 'Italy', agency: 'DPC/Arpae', source: 'Official feed', format: 'TBD', status: 'planned', notes: 'Official source/terms verification required.' },
];
