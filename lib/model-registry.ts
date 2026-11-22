export type ModelStatus = 'READY_NOW' | 'NEEDS_SOURCE' | 'RESTRICTED' | 'NOT_FEASIBLE';
export type ModelCategory = 'Global' | 'Regional' | 'Convective' | 'AI' | 'Ensemble' | 'Ocean' | 'Air Quality' | 'Seasonal';

export interface ModelFieldDef {
  id: string;
  label: string;
  unit?: string;
  status: ModelStatus;
  wmsLayer?: string; // verified WMS layer name when READY_NOW
  note?: string;
}

export interface ModelDef {
  id: string;
  name: string;
  provider: string;
  category: ModelCategory;
  status: ModelStatus;
  resolution?: string;
  updateFrequency?: string;
  forecastRange?: string;
  source: string;
  license: string;
  runTime?: string;
  forecastHour?: number;
  fields: ModelFieldDef[];
  notes?: string;
}

export const MODEL_CATALOG: ModelDef[] = [
  {
    id: 'gdps-geml',
    name: 'GDPS-GEML (Global Environmental eMuLator)',
    provider: 'ECCC / MSC GeoMet',
    category: 'Global',
    status: 'READY_NOW',
    resolution: '25km (GeoMet WMS)',
    updateFrequency: 'As published by MSC GeoMet',
    forecastRange: 'Model-dependent (GeoMet published timesteps)',
    source: 'https://geo.weather.gc.ca/geomet?service=WMS&request=GetCapabilities',
    license: 'ECCC Open Government Licence - Canada',
    fields: [
      { id: 'temp', label: 'Temperature (2m)', unit: '°C', status: 'READY_NOW', wmsLayer: 'GDPS-GEML_25km_AirTemp_2m', note: 'Verified MSC GeoMet WMS layer' },
      { id: 'dewpoint', label: 'Dewpoint', unit: '°C', status: 'NEEDS_SOURCE', note: 'No verified GDPS-GEML dewpoint WMS layer wired yet' },
      { id: 'wind', label: 'Wind (10m)', unit: 'kt/m s-1', status: 'READY_NOW', wmsLayer: 'GDPS-GEML_25km_Winds_10m', note: 'Verified MSC GeoMet WMS layer' },
      { id: 'cape', label: 'CAPE', unit: 'J/kg', status: 'NEEDS_SOURCE', note: 'No verified GDPS-GEML CAPE WMS layer wired yet' },
      { id: 'ref', label: 'Reflectivity', unit: 'dBZ', status: 'NEEDS_SOURCE', note: 'No verified GDPS-GEML reflectivity WMS layer wired yet' },
      { id: 'precip', label: 'Precipitation', unit: 'mm', status: 'NEEDS_SOURCE', note: 'No verified GDPS-GEML precipitation WMS layer wired yet' },
    ],
    notes: 'READY NOW limited to verified MSC GeoMet GDPS-GEML WMS fields. Not the same as GDPS deterministic; GDPS deterministic remains NEEDS SOURCE until verified tile/WMS pipeline is integrated.',
  },
  {
    id: 'gdps',
    name: 'GDPS (Global Deterministic Prediction System)',
    provider: 'ECCC / MSC',
    category: 'Global',
    status: 'NEEDS_SOURCE',
    resolution: '~15km',
    updateFrequency: 'Twice daily',
    forecastRange: 'Up to 240h',
    source: 'ECCC MSC / GeoMet (deterministic GDPS layers not yet verified/wired)',
    license: 'ECCC Open Government Licence - Canada',
    fields: [
      { id: 'temp', label: 'Temperature', unit: '°C', status: 'NEEDS_SOURCE', note: 'No verified deterministic GDPS WMS/tile layer wired yet' },
      { id: 'dewpoint', label: 'Dewpoint', unit: '°C', status: 'NEEDS_SOURCE', note: 'No verified deterministic GDPS WMS/tile layer wired yet' },
      { id: 'wind', label: 'Wind', unit: 'kt', status: 'NEEDS_SOURCE', note: 'No verified deterministic GDPS WMS/tile layer wired yet' },
      { id: 'cape', label: 'CAPE', unit: 'J/kg', status: 'NEEDS_SOURCE', note: 'No verified deterministic GDPS WMS/tile layer wired yet' },
      { id: 'ref', label: 'Reflectivity', unit: 'dBZ', status: 'NEEDS_SOURCE', note: 'No verified deterministic GDPS WMS/tile layer wired yet' },
      { id: 'precip', label: 'Precipitation', unit: 'mm', status: 'NEEDS_SOURCE', note: 'No verified deterministic GDPS WMS/tile layer wired yet' },
    ],
    notes: 'Requested model. Deterministic GDPS map layers not yet verified/wired; GDPS-GEML has limited READY NOW verified fields.',
  },
  {
    id: 'hrrr',
    name: 'HRRR (High-Resolution Rapid Refresh)',
    provider: 'NOAA/NCEP',
    category: 'Convective',
    status: 'NEEDS_SOURCE',
    resolution: '3km',
    updateFrequency: 'Hourly',
    forecastRange: '18h (48h select runs)',
    source: 'NOAA NOMADS / AWS Open Data (GRIB2)',
    license: 'NOAA public domain/open data',
    fields: [
      { id: 'temp', label: 'Temperature', unit: '°F', status: 'NEEDS_SOURCE', note: 'GRIB2 available; map tile/WMS pipeline not integrated' },
      { id: 'dewpoint', label: 'Dewpoint', unit: '°F', status: 'NEEDS_SOURCE', note: 'GRIB2 available; map tile/WMS pipeline not integrated' },
      { id: 'wind', label: 'Wind', unit: 'kt', status: 'NEEDS_SOURCE', note: 'GRIB2 available; map tile/WMS pipeline not integrated' },
      { id: 'cape', label: 'CAPE', unit: 'J/kg', status: 'NEEDS_SOURCE', note: 'GRIB2 available; map tile/WMS pipeline not integrated' },
      { id: 'ref', label: 'Reflectivity', unit: 'dBZ', status: 'NEEDS_SOURCE', note: 'GRIB2 available; map tile/WMS pipeline not integrated' },
      { id: 'precip', label: 'Precipitation', unit: 'in/mm', status: 'NEEDS_SOURCE', note: 'GRIB2 available; map tile/WMS pipeline not integrated' },
    ],
    notes: 'Real free data exists (NOMADS/AWS), but no verified map-tile rendering pipeline integrated yet.',
  },
  {
    id: 'rap',
    name: 'RAP (Rapid Refresh)',
    provider: 'NOAA/NCEP',
    category: 'Regional',
    status: 'NEEDS_SOURCE',
    resolution: '13km',
    updateFrequency: 'Hourly',
    forecastRange: '21h',
    source: 'NOAA NOMADS / AWS Open Data (GRIB2)',
    license: 'NOAA public domain/open data',
    fields: [
      { id: 'temp', label: 'Temperature', unit: '°F', status: 'NEEDS_SOURCE', note: 'GRIB2 available; map tile/WMS pipeline not integrated' },
      { id: 'dewpoint', label: 'Dewpoint', unit: '°F', status: 'NEEDS_SOURCE', note: 'GRIB2 available; map tile/WMS pipeline not integrated' },
      { id: 'wind', label: 'Wind', unit: 'kt', status: 'NEEDS_SOURCE', note: 'GRIB2 available; map tile/WMS pipeline not integrated' },
      { id: 'cape', label: 'CAPE', unit: 'J/kg', status: 'NEEDS_SOURCE', note: 'GRIB2 available; map tile/WMS pipeline not integrated' },
      { id: 'ref', label: 'Reflectivity', unit: 'dBZ', status: 'NEEDS_SOURCE', note: 'GRIB2 available; map tile/WMS pipeline not integrated' },
      { id: 'precip', label: 'Precipitation', unit: 'in/mm', status: 'NEEDS_SOURCE', note: 'GRIB2 available; map tile/WMS pipeline not integrated' },
    ],
  },
  {
    id: 'gfs',
    name: 'GFS (Global Forecast System)',
    provider: 'NOAA/NCEP',
    category: 'Global',
    status: 'NEEDS_SOURCE',
    resolution: '0.25°',
    updateFrequency: 'Every 6 hours',
    forecastRange: '384h',
    source: 'NOAA NOMADS / AWS Open Data (GRIB2)',
    license: 'NOAA public domain/open data',
    fields: [
      { id: 'temp', label: 'Temperature', unit: '°F', status: 'NEEDS_SOURCE', note: 'GRIB2 available; map tile/WMS pipeline not integrated' },
      { id: 'dewpoint', label: 'Dewpoint', unit: '°F', status: 'NEEDS_SOURCE', note: 'GRIB2 available; map tile/WMS pipeline not integrated' },
      { id: 'wind', label: 'Wind', unit: 'kt', status: 'NEEDS_SOURCE', note: 'GRIB2 available; map tile/WMS pipeline not integrated' },
      { id: 'cape', label: 'CAPE', unit: 'J/kg', status: 'NEEDS_SOURCE', note: 'GRIB2 available; map tile/WMS pipeline not integrated' },
      { id: 'ref', label: 'Reflectivity', unit: 'dBZ', status: 'NEEDS_SOURCE', note: 'Model-derived; map tile/WMS pipeline not integrated' },
      { id: 'precip', label: 'Precipitation', unit: 'in/mm', status: 'NEEDS_SOURCE', note: 'GRIB2 available; map tile/WMS pipeline not integrated' },
    ],
  },
  {
    id: 'rrfs',
    name: 'RRFS (Rapid Refresh Forecast System)',
    provider: 'NOAA/NCEP',
    category: 'Convective',
    status: 'NEEDS_SOURCE',
    resolution: '3km',
    updateFrequency: 'Hourly (evolving ops status)',
    forecastRange: '60h (varies)',
    source: 'NOAA NOMADS / AWS Open Data (GRIB2)',
    license: 'NOAA public domain/open data',
    fields: [
      { id: 'temp', label: 'Temperature', unit: '°F', status: 'NEEDS_SOURCE', note: 'GRIB2 available; map tile/WMS pipeline not integrated' },
      { id: 'dewpoint', label: 'Dewpoint', unit: '°F', status: 'NEEDS_SOURCE', note: 'GRIB2 available; map tile/WMS pipeline not integrated' },
      { id: 'wind', label: 'Wind', unit: 'kt', status: 'NEEDS_SOURCE', note: 'GRIB2 available; map tile/WMS pipeline not integrated' },
      { id: 'cape', label: 'CAPE', unit: 'J/kg', status: 'NEEDS_SOURCE', note: 'GRIB2 available; map tile/WMS pipeline not integrated' },
      { id: 'ref', label: 'Reflectivity', unit: 'dBZ', status: 'NEEDS_SOURCE', note: 'GRIB2 available; map tile/WMS pipeline not integrated' },
      { id: 'precip', label: 'Precipitation', unit: 'in/mm', status: 'NEEDS_SOURCE', note: 'GRIB2 available; map tile/WMS pipeline not integrated' },
    ],
    notes: 'Operational status/availability evolving; verify before promoting to READY NOW.',
  },
  {
    id: 'ecmwf',
    name: 'ECMWF IFS (HRES/Open Data)',
    provider: 'ECMWF',
    category: 'Global',
    status: 'RESTRICTED',
    resolution: '0.4° open data (limited); higher-res restricted',
    updateFrequency: 'Varies by product/license',
    forecastRange: 'Varies',
    source: 'ECMWF Open Data / Licensed APIs',
    license: 'Restricted/licensed for full-resolution operational feeds; open-data subset limited',
    fields: [
      { id: 'temp', label: 'Temperature', unit: '°C', status: 'RESTRICTED', note: 'Full operational access restricted; open-data subset not wired' },
      { id: 'dewpoint', label: 'Dewpoint', unit: '°C', status: 'RESTRICTED', note: 'Restricted/licensed' },
      { id: 'wind', label: 'Wind', unit: 'kt', status: 'RESTRICTED', note: 'Restricted/licensed' },
      { id: 'cape', label: 'CAPE', unit: 'J/kg', status: 'RESTRICTED', note: 'Restricted/licensed' },
      { id: 'ref', label: 'Reflectivity', unit: 'dBZ', status: 'RESTRICTED', note: 'Not a standard ECMWF public tile product in this app' },
      { id: 'precip', label: 'Precipitation', unit: 'mm', status: 'RESTRICTED', note: 'Restricted/licensed for full product' },
    ],
    notes: 'Do not add without verified license-compliant data source.',
  },
];

export function getModelById(id: string): ModelDef | undefined {
  return MODEL_CATALOG.find(m => m.id === id);
}
