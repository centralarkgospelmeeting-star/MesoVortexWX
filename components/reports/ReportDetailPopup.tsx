'use client';

export type ReportDetail = {
  id: string;
  time: string | null;
  location: string;
  source: string;
  text: string;
  lat?: number;
  lon?: number;
};

/** Compact, readable report detail for LSR, spotter and mPING reports. */
export function ReportDetailPopup({ report, onClose }: { report: ReportDetail; onClose: () => void }) {
  return (
    <div
      data-report-detail="true"
      role="dialog"
      aria-label="Storm report details"
      className="fixed right-3 top-3 z-50 w-[min(20rem,calc(100vw-1.5rem))] rounded-xl border border-slate-700 bg-[#0b1220] p-3 text-slate-100 shadow-xl"
    >
      <div className="flex items-center justify-between border-b border-slate-700 pb-2">
        <div className="text-[11px] font-black uppercase tracking-wider text-sky-300">Storm report</div>
        <button type="button" onClick={onClose} className="rounded px-1.5 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close report detail">✕</button>
      </div>
      <div className="mt-2 space-y-1.5 text-[11px] leading-snug">
        <div className="flex justify-between gap-2"><span className="text-slate-400">Time</span><span className="text-right text-slate-100">{report.time || 'DATA UNAVAILABLE'}</span></div>
        <div className="flex justify-between gap-2"><span className="text-slate-400">Location</span><span className="text-right text-slate-100">{report.location || 'DATA UNAVAILABLE'}</span></div>
        <div className="flex justify-between gap-2"><span className="text-slate-400">Source</span><span className="text-right text-slate-100">{report.source || 'DATA UNAVAILABLE'}</span></div>
        <div className="border-t border-slate-800 pt-2">
          <div className="text-slate-400">Report text</div>
          <div className="whitespace-pre-wrap text-slate-100">{report.text || 'DATA UNAVAILABLE'}</div>
        </div>
      </div>
    </div>
  );
}
