
import React, { useState, useCallback } from 'react';
import { TaxRecord, ValidationSummary } from './types';
import { processTaxPDF } from './geminiService';
import TaxTable from './components/TaxTable';
import ValidationReport from './components/ValidationReport';

const App: React.FC = () => {
  const [records, setRecords] = useState<TaxRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsLoading(true);
    setError(null);
    const newRecords: TaxRecord[] = [];

    try {
      // Cast to File[] to ensure 'file' is properly typed as File/Blob
      const fileList = Array.from(files) as File[];
      for (const file of fileList) {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          };
        });
        reader.readAsDataURL(file);
        const base64 = await base64Promise;
        const result = await processTaxPDF(base64, file.type);
        newRecords.push(...result);
      }

      setRecords(prev => [...prev, ...newRecords]);
    } catch (err) {
      console.error(err);
      setError("Failed to process files. Please check your API key and file content.");
    } finally {
      setIsLoading(false);
      // Reset input
      event.target.value = '';
    }
  };

  const clearData = () => {
    setRecords([]);
    setError(null);
  };

  // Perform validation on current records
  const generateSummary = (): ValidationSummary => {
    const nops: string[] = records.map(r => r.nop);
    const duplicates: string[] = nops.filter((nop, index) => nops.indexOf(nop) !== index);
    
    const anomalies: string[] = [];
    records.forEach(r => {
      // Explicitly type the values and reduce arguments to avoid unknown operator errors
      const arrearsValues = Object.values(r.arrears) as (number | null)[];
      const calculatedTotal = arrearsValues.reduce((s: number, v: number | null) => {
        return s + (v !== null && v > 0 ? v : 0);
      }, 0);

      if (Math.abs(calculatedTotal - r.total) > 0.01) {
        anomalies.push(`Calculated total mismatch for ${r.nop}`);
      }
    });

    return {
      totalRecords: records.length,
      duplicates: Array.from(new Set(duplicates)),
      anomalies
    };
  };

  const summary = generateSummary();

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="bg-emerald-800 text-white py-6 px-6 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-white p-2 rounded-lg">
              <svg className="w-8 h-8 text-emerald-800" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold leading-tight">BAPENDA KABUPATEN KAMPAR</h1>
              <p className="text-emerald-100 text-sm">Sistem Verifikasi Piutang PBB-P2</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className={`cursor-pointer inline-flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-all shadow-sm ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}>
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Upload PDF
              <input type="file" multiple accept=".pdf,image/*" className="hidden" onChange={handleFileUpload} />
            </label>
            {records.length > 0 && (
              <button 
                onClick={clearData}
                className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg font-medium transition-all border border-slate-300"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 mt-8">
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl shadow-sm border border-slate-200 mb-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-800 mb-4"></div>
            <p className="text-slate-600 font-medium">Mengekstraksi data dari dokumen...</p>
            <p className="text-slate-400 text-sm mt-1">Ini mungkin memerlukan waktu beberapa detik.</p>
          </div>
        )}

        {records.length > 0 ? (
          <>
            <ValidationReport summary={summary} />
            
            <div className="mb-4 flex flex-wrap gap-4 text-xs font-medium">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-green-100 border border-green-200"></div>
                <span className="text-slate-600">Tahun sebelum piutang muncul</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-red-100 border border-red-200"></div>
                <span className="text-slate-600">Lunas / Nilai 0 (Kurang Bayar)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-white border border-slate-200"></div>
                <span className="text-slate-600">Piutang Berjalan</span>
              </div>
            </div>

            <TaxTable records={records} />
            
            <div className="mt-8 p-6 bg-slate-900 text-slate-300 rounded-xl">
              <h4 className="text-white font-semibold mb-3 flex items-center">
                <svg className="w-5 h-5 mr-2 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Catatan Penting
              </h4>
              <ul className="space-y-2 text-sm leading-relaxed">
                <li>• Data diekstraksi secara otomatis menggunakan AI berdasarkan kolom <strong>Kurang Bayar</strong>.</li>
                <li>• Kolom <strong>Total</strong> hanya menjumlahkan nilai piutang (&gt; 0).</li>
                <li>• Pastikan format NOP sesuai dengan dokumen fisik sebelum verifikasi akhir.</li>
                <li>• Warna Hijau menandakan tahun sebelum data piutang tercatat dimulai.</li>
              </ul>
            </div>
          </>
        ) : !isLoading && (
          <div className="flex flex-col items-center justify-center py-32 bg-slate-50 border-2 border-dashed border-slate-300 rounded-3xl">
            <svg className="w-20 h-20 text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-xl font-semibold text-slate-600">Belum ada data</h3>
            <p className="text-slate-400 mt-2">Silakan unggah dokumen PDF piutang PBB-P2 untuk memulai.</p>
          </div>
        )}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 py-3 px-6 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center text-xs text-slate-500">
          <p>© 2025 Bapenda Kabupaten Kampar - Verifikator Piutang Digital</p>
          <div className="flex gap-4">
            <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></span>Sistem Aktif</span>
            <span>V1.0.4-Stable</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
