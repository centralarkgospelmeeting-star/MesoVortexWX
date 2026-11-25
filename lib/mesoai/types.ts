/**
 * Shared MesoAI contracts.
 *
 * These types deliberately mirror the architecture specification. The language
 * layer receives only structured observations and detections; it never receives
 * raw radar imagery and never asserts an operational claim.
 */

export type WeatherDomain =
  | 'RADAR'
  | 'COMPOSITE'
  | 'MRMS'
  | 'QPE'
  | 'SATELLITE'
  | 'MODEL'
  | 'OBSERVATION'
  | 'ALERT';

export type VerificationState = 'VERIFIED' | 'PARTIAL' | 'UNAVAILABLE';
export type DetectionConfidence = 'HIGH' | 'MODERATE' | 'LOW' | 'UNKNOWN';
export type AnalysisMode = 'storm' | 'product' | 'warning' | 'model';

export type WeatherObservation = {
  id: string;
  domain: WeatherDomain;
  source: string;
  productCode?: string | null;
  verification: VerificationState;
  observedAt: string | null;
  values: Record<string, number | string | boolean | null>;
  caveats: string[];
};

/** The only structure allowed to claim that a weather feature was detected. */
export type Detection = {
  id: string;
  kind: string;
  domain: WeatherDomain;
  sourceRef: string;
  observedAt: string;
  confidence: DetectionConfidence;
  evidence: string[];
  values: Record<string, number | string | boolean | null>;
  caveats: string[];
  operationalClaim: false;
};

export type AnalysisSite = {
  id: string;
  name: string;
  lat: number;
  lon: number;
};

export type ProductContext = {
  key: string;
  label: string;
  domain: string;
  available: boolean;
  reason?: string;
  warning?: string;
};

export type WarningContext = {
  event: string;
  headline: string;
  description: string;
  instruction: string;
  areaDesc: string;
  category: string;
  severity: string;
  sent: string | null;
};

export type ModelFieldContext = {
  id: string;
  label: string;
  value: number | string | null;
  unit?: string;
  status: string;
};

export type ModelContext = {
  id: string;
  label: string;
  provider: string;
  status: string;
  fields: ModelFieldContext[];
};

export type AnalysisRequest = {
  mode: AnalysisMode;
  site: AnalysisSite;
  generatedAt: string;
  product?: ProductContext | null;
  warning?: WarningContext | null;
  models?: ModelContext[];
  observations: WeatherObservation[];
};

export type AnalysisResult = {
  id: string;
  mode: AnalysisMode;
  headline: string;
  explanation: string;
  indicators: string[];
  caveats: string[];
  detections: Detection[];
  renderer: 'local' | 'qwen';
  sources: string[];
  generatedAt: string;
};

export type WatcherSummary = {
  id: string;
  headline: string;
  detail: string;
  confidence: DetectionConfidence;
  sources: string[];
  observedAt: string;
  caveats: string[];
  generatedAt: string;
};

export type FeedbackRating = 'helpful' | 'not_helpful' | 'inaccurate';

export type FeedbackRecord = {
  id: string;
  analysisId: string;
  mode: AnalysisMode;
  rating: FeedbackRating;
  note: string;
  createdAt: string;
};
