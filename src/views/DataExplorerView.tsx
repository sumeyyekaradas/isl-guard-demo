import React, { useState, useMemo } from 'react';
import {
  Database,
  FileSpreadsheet,
  FileCode,
  Upload,
  Download,
  Search,
  Filter,
  CheckCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Copy,
} from 'lucide-react';
import { RawWellRecord, JsonFieldConfig } from '../types/islData';

interface DataExplorerViewProps {
  records: RawWellRecord[];
  jsonConfig: JsonFieldConfig | null;
  onCustomCSVUpload: (records: RawWellRecord[], filename: string) => void;
  onCustomJSONUpload: (config: JsonFieldConfig, filename: string) => void;
  currentDatasetName: string;
}

export const DataExplorerView: React.FC<DataExplorerViewProps> = ({
  records,
  jsonConfig,
  onCustomCSVUpload,
  onCustomJSONUpload,
  currentDatasetName,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'csv' | 'json' | 'upload'>('csv');

  // CSV filtering state
  const [scenarioFilter, setScenarioFilter] = useState<string>('ALL');
  const [wellFilter, setWellFilter] = useState<string>('ALL');
  const [onlyMissing, setOnlyMissing] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const pageSize = 50;

  // Upload feedback state
  const [uploadStatus, setUploadStatus] = useState<{ type: 'idle' | 'success' | 'error'; message: string }>({
    type: 'idle',
    message: '',
  });
  const [copiedJson, setCopiedJson] = useState<boolean>(false);

  // Extract scenario list
  const scenarios = useMemo(() => {
    const set = new Set<string>();
    for (const r of records) {
      if (r.senaryo_adi) set.add(r.senaryo_adi);
    }
    return Array.from(set);
  }, [records]);

  // Extract wells list
  const wells = useMemo(() => {
    const set = new Set<string>();
    for (const r of records) {
      if (r.kuyu_id) set.add(r.kuyu_id);
    }
    return Array.from(set);
  }, [records]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (scenarioFilter !== 'ALL' && r.senaryo_adi !== scenarioFilter) return false;
      if (wellFilter !== 'ALL' && r.kuyu_id !== wellFilter) return false;
      if (onlyMissing && r.sensor_durumu !== 'EKSIK_VERI') return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesWell = r.kuyu_id.toLowerCase().includes(term);
        const matchesScenario = r.senaryo_adi.toLowerCase().includes(term);
        const matchesType = r.tip.toLowerCase().includes(term);
        if (!matchesWell && !matchesScenario && !matchesType) return false;
      }
      return true;
    });
  }, [records, scenarioFilter, wellFilter, onlyMissing, searchTerm]);

  // Total missing count
  const missingCount = useMemo(() => {
    return records.filter((r) => r.sensor_durumu === 'EKSIK_VERI').length;
  }, [records]);

  // Pagination slice
  const totalPages = Math.ceil(filteredRecords.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, page]);

  // CSV Download handler
  const handleDownloadFilteredCSV = () => {
    const headers = [
      'zaman_gun',
      'kuyu_id',
      'tip',
      'x',
      'y',
      'debi',
      'basinc',
      'pH',
      'sulfat_mgL',
      'iletkenlik_uScm',
      'senaryo_id',
      'senaryo_adi',
      'gercek_sizinti_debisi',
      'sensor_durumu',
    ];

    const lines = [headers.join(',')];
    for (const r of filteredRecords) {
      lines.push(
        [
          r.zaman_gun.toFixed(2),
          r.kuyu_id,
          r.tip,
          r.x,
          r.y,
          r.debi,
          r.basinç !== null ? r.basinç : '',
          r.pH !== null ? r.pH : '',
          r.sulfat_mgL !== null ? r.sulfat_mgL : '',
          r.iletkenlik_uScm !== null ? r.iletkenlik_uScm : '',
          r.senaryo_id,
          `"${r.senaryo_adi}"`,
          r.gercek_sizinti_debisi,
          r.sensor_durumu,
        ].join(',')
      );
    }

    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `isl_guard_filtered_dataset_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // File Upload Handlers
  const handleCSVFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.trim().split('\n');
        if (lines.length <= 1) {
          throw new Error('CSV file is empty or missing data rows.');
        }

        const header = lines[0].toLowerCase();
        if (!header.includes('zaman_gun') || !header.includes('kuyu_id')) {
          throw new Error('Invalid ISL CSV format: Missing required columns (zaman_gun, kuyu_id, debi, etc.).');
        }

        const parsed: RawWellRecord[] = [];
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(',');
          if (parts.length >= 12) {
            parsed.push({
              zaman_gun: parseFloat(parts[0]),
              kuyu_id: parts[1].trim(),
              tip: parts[2].trim() as any,
              x: parseFloat(parts[3]) || 0,
              y: parseFloat(parts[4]) || 0,
              debi: parseFloat(parts[5]) || 0,
              basinç: parts[6] === '' || parts[6] === 'null' ? null : parseFloat(parts[6]),
              pH: parts[7] === '' || parts[7] === 'null' ? null : parseFloat(parts[7]),
              sulfat_mgL: parts[8] === '' || parts[8] === 'null' ? null : parseFloat(parts[8]),
              iletkenlik_uScm: parts[9] === '' || parts[9] === 'null' ? null : parseFloat(parts[9]),
              senaryo_id: parseInt(parts[10], 10) || 1,
              senaryo_adi: parts[11]?.trim() || 'Custom Scenario',
              gercek_sizinti_debisi: parts[12] ? parseFloat(parts[12]) : 0,
              sensor_durumu: (parts[13]?.trim() as any) || 'NORMAL',
            });
          }
        }

        onCustomCSVUpload(parsed, file.name);
        setUploadStatus({
          type: 'success',
          message: `Successfully loaded & processed ${parsed.length.toLocaleString()} rows from "${file.name}".`,
        });
      } catch (err: any) {
        setUploadStatus({
          type: 'error',
          message: `CSV Parse Error: ${err.message}`,
        });
      }
    };
    reader.readAsText(file);
  };

  const handleJSONFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const json = JSON.parse(text);
        if (!json.wells || !Array.isArray(json.wells)) {
          throw new Error('Invalid JSON configuration: Missing "wells" array.');
        }

        onCustomJSONUpload(json, file.name);
        setUploadStatus({
          type: 'success',
          message: `Successfully loaded field layout from "${file.name}" with ${json.wells.length} wells.`,
        });
      } catch (err: any) {
        setUploadStatus({
          type: 'error',
          message: `JSON Parse Error: ${err.message}`,
        });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-100 flex items-center gap-2">
            <Database className="w-6 h-6 text-cyan-400" />
            Field Data Explorer & Ingestion Pipeline
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Directly inspecting <code className="text-cyan-400 font-mono">{currentDatasetName}</code> and{' '}
            <code className="text-cyan-400 font-mono">saha_verileri_lite.json</code> with live search, pagination, and file upload capabilities.
          </p>
        </div>

        {/* Global Statistics */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
            <span className="text-slate-500">Total Rows: </span>
            <span className="text-slate-100 font-bold">{records.length.toLocaleString()}</span>
          </div>
          <div className="bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
            <span className="text-slate-500">Missing Data: </span>
            <span className="text-amber-400 font-bold">{missingCount}</span>
          </div>
        </div>
      </div>

      {/* Sub-Tab Navigation */}
      <div className="flex gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveSubTab('csv')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeSubTab === 'csv'
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Operational CSV Records ({records.length.toLocaleString()})
        </button>

        <button
          onClick={() => setActiveSubTab('json')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeSubTab === 'json'
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <FileCode className="w-4 h-4" />
          Field Config JSON (saha_verileri_lite.json)
        </button>

        <button
          onClick={() => setActiveSubTab('upload')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeSubTab === 'upload'
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Upload className="w-4 h-4" />
          Custom Dataset Ingestion (Upload)
        </button>
      </div>

      {/* 1. CSV TABLE TAB */}
      {activeSubTab === 'csv' && (
        <div className="space-y-4">
          {/* Controls Bar: Search, Filters & Download */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
              {/* Search input */}
              <div className="relative flex-1 min-w-[180px]">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search well ID, type, scenario..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-hidden focus:border-cyan-500"
                />
              </div>

              {/* Scenario dropdown */}
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Filter className="w-3.5 h-3.5 text-cyan-400" />
                <select
                  value={scenarioFilter}
                  onChange={(e) => {
                    setScenarioFilter(e.target.value);
                    setPage(1);
                  }}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-200 text-xs focus:outline-hidden"
                >
                  <option value="ALL">All Scenarios</option>
                  {scenarios.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* Well dropdown */}
              <div className="text-xs text-slate-400">
                <select
                  value={wellFilter}
                  onChange={(e) => {
                    setWellFilter(e.target.value);
                    setPage(1);
                  }}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-200 text-xs focus:outline-hidden"
                >
                  <option value="ALL">All Wells</option>
                  {wells.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </div>

              {/* Only missing toggle */}
              <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={onlyMissing}
                  onChange={(e) => {
                    setOnlyMissing(e.target.checked);
                    setPage(1);
                  }}
                  className="accent-amber-400 rounded"
                />
                <span className={onlyMissing ? 'text-amber-400 font-bold' : ''}>
                  Only Missing Data (EKSIK_VERI)
                </span>
              </label>
            </div>

            {/* Export Button */}
            <button
              onClick={handleDownloadFilteredCSV}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs transition-colors shadow-md shadow-cyan-600/20"
            >
              <Download className="w-4 h-4" />
              Download Filtered CSV ({filteredRecords.length.toLocaleString()})
            </button>
          </div>

          {/* Table Container */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-xs text-left text-slate-300">
                <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3">Day</th>
                    <th className="py-2.5 px-3">Well ID</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Flow (m³/h)</th>
                    <th className="py-2.5 px-3">Pressure</th>
                    <th className="py-2.5 px-3">pH</th>
                    <th className="py-2.5 px-3">Sulfate (mg/L)</th>
                    <th className="py-2.5 px-3">Cond. (µS/cm)</th>
                    <th className="py-2.5 px-3">Scenario</th>
                    <th className="py-2.5 px-3">Leak Rate</th>
                    <th className="py-2.5 px-3">Status Flag</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono">
                  {paginatedRows.length > 0 ? (
                    paginatedRows.map((r, i) => {
                      const isMissing = r.sensor_durumu === 'EKSIK_VERI';
                      return (
                        <tr
                          key={i}
                          className={`hover:bg-slate-800/40 ${
                            isMissing ? 'bg-amber-950/20' : ''
                          }`}
                        >
                          <td className="py-2 px-3 font-sans text-slate-400">
                            {r.zaman_gun.toFixed(2)}
                          </td>
                          <td className="py-2 px-3 font-bold text-slate-100">{r.kuyu_id}</td>
                          <td className="py-2 px-3 font-sans text-slate-400">{r.tip}</td>
                          <td
                            className={`py-2 px-3 ${
                              r.debi > 0
                                ? 'text-cyan-400'
                                : r.debi < 0
                                ? 'text-emerald-400'
                                : 'text-slate-500'
                            }`}
                          >
                            {r.debi > 0 ? `+${r.debi.toFixed(1)}` : r.debi.toFixed(1)}
                          </td>
                          <td className="py-2 px-3">
                            {r.basinç !== null ? (
                              r.basinç.toFixed(2)
                            ) : (
                              <span className="text-amber-400 font-sans italic text-[11px]">
                                null
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            {r.pH !== null ? (
                              r.pH.toFixed(2)
                            ) : (
                              <span className="text-amber-400 font-sans italic text-[11px]">
                                null
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            {r.sulfat_mgL !== null ? (
                              r.sulfat_mgL.toFixed(1)
                            ) : (
                              <span className="text-amber-400 font-sans italic text-[11px]">
                                null
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            {r.iletkenlik_uScm !== null ? (
                              r.iletkenlik_uScm.toFixed(1)
                            ) : (
                              <span className="text-amber-400 font-sans italic text-[11px]">
                                null
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-sans text-slate-400 truncate max-w-[140px]">
                            {r.senaryo_adi}
                          </td>
                          <td className="py-2 px-3 text-rose-400">
                            {r.gercek_sizinti_debisi > 0
                              ? `${r.gercek_sizinti_debisi.toFixed(1)} m³/h`
                              : '-'}
                          </td>
                          <td className="py-2 px-3 font-sans">
                            {isMissing ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-400 border border-amber-800">
                                EKSIK_VERI
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-950 text-emerald-400">
                                NORMAL
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={11} className="py-8 text-center text-slate-500 font-sans">
                        No records match the active filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <div>
                Showing {(page - 1) * pageSize + 1} to{' '}
                {Math.min(page * pageSize, filteredRecords.length)} of{' '}
                {filteredRecords.length.toLocaleString()} matching records
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="p-1 rounded bg-slate-900 border border-slate-800 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-800 text-slate-300"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-mono text-cyan-400">
                  Page {page} of {totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  className="p-1 rounded bg-slate-900 border border-slate-800 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-800 text-slate-300"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. JSON FIELD CONFIG TAB */}
      {activeSubTab === 'json' && (
        <div className="space-y-4">
          {jsonConfig ? (
            <div className="space-y-4">
              {/* Summary Cards from JSON */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 shadow-lg">
                  <div className="text-xs text-slate-400">Configured Wells</div>
                  <div className="text-2xl font-bold font-mono text-cyan-400 mt-1">
                    {jsonConfig.wells.length}
                  </div>
                </div>
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 shadow-lg">
                  <div className="text-xs text-slate-400">Total Days</div>
                  <div className="text-2xl font-bold font-mono text-slate-100 mt-1">
                    {jsonConfig.summary_stats.total_days}
                  </div>
                </div>
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 shadow-lg">
                  <div className="text-xs text-slate-400">Total Records</div>
                  <div className="text-2xl font-bold font-mono text-slate-100 mt-1">
                    {jsonConfig.summary_stats.total_records.toLocaleString()}
                  </div>
                </div>
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 shadow-lg">
                  <div className="text-xs text-slate-400">Scenarios Defined</div>
                  <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
                    {jsonConfig.summary_stats.scenarios}
                  </div>
                </div>
              </div>

              {/* Formatted Code Inspector */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                  <span className="text-xs font-bold text-slate-300 font-mono">
                    saha_verileri_lite.json (Structured Inspector)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(jsonConfig, null, 2));
                      setCopiedJson(true);
                      setTimeout(() => setCopiedJson(false), 2000);
                    }}
                    className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copiedJson ? 'Copied to Clipboard' : 'Copy JSON'}
                  </button>
                </div>
                <pre className="p-4 bg-slate-950 rounded-xl text-slate-300 text-xs font-mono overflow-auto max-h-96 leading-relaxed border border-slate-800/80">
                  {JSON.stringify(jsonConfig, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 text-xs">
              No JSON configuration loaded. Please upload or verify <code className="text-cyan-400">saha_verileri_lite.json</code>.
            </div>
          )}
        </div>
      )}

      {/* 3. UPLOAD TAB */}
      {activeSubTab === 'upload' && (
        <div className="space-y-5">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Upload className="w-5 h-5 text-cyan-400" />
                Custom Dataset Ingestion (File Ingestion Pipeline)
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Upload your own CSV operational records or JSON field configurations. Files are parsed client-side and immediately update all dashboards, risk evaluations, and charts.
              </p>
            </div>

            {/* Status Feedback */}
            {uploadStatus.type !== 'idle' && (
              <div
                className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 ${
                  uploadStatus.type === 'success'
                    ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-300'
                    : 'bg-red-950/80 border border-red-800 text-red-300'
                }`}
              >
                {uploadStatus.type === 'success' ? (
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                )}
                <span>{uploadStatus.message}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
              {/* CSV Upload Box */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-200 mb-1 flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
                    Upload Operational CSV (.csv)
                  </h4>
                  <p className="text-xs text-slate-400 mb-4">
                    Must include standard headers: <code className="text-cyan-300 font-mono">zaman_gun, kuyu_id, tip, x, y, debi, basinç, pH, sulfat_mgL, senaryo_id, sensor_durumu</code>.
                  </p>
                </div>
                <div>
                  <label className="block w-full text-center px-4 py-3 border-2 border-dashed border-slate-700 hover:border-cyan-500 rounded-xl cursor-pointer transition-colors bg-slate-900/50">
                    <span className="text-xs font-semibold text-slate-300">
                      Select or drop CSV file here
                    </span>
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handleCSVFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* JSON Upload Box */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-200 mb-1 flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-cyan-400" />
                    Upload Field Geometry JSON (.json)
                  </h4>
                  <p className="text-xs text-slate-400 mb-4">
                    Must contain <code className="text-cyan-300 font-mono">&quot;wells&quot;</code> array with coordinates (x, y), type, and base pumping rates.
                  </p>
                </div>
                <div>
                  <label className="block w-full text-center px-4 py-3 border-2 border-dashed border-slate-700 hover:border-cyan-500 rounded-xl cursor-pointer transition-colors bg-slate-900/50">
                    <span className="text-xs font-semibold text-slate-300">
                      Select or drop JSON file here
                    </span>
                    <input
                      type="file"
                      accept=".json,application/json"
                      onChange={handleJSONFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
