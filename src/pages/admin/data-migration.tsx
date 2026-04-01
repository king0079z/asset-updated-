// @ts-nocheck
import React, { useState, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, AlertTriangle, CheckCircle, FileText, Download, Play, XCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

const TEMPLATES = [
  {
    name: 'Assets',
    columns: ['name', 'assetId', 'type', 'status', 'description', 'serialNumber', 'purchaseAmount', 'purchaseDate', 'location'],
  },
  {
    name: 'Tickets',
    columns: ['title', 'description', 'priority', 'category', 'status', 'assetId'],
  },
];

export default function DataMigrationPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('Assets');
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<{ success: number; errors: string[] } | null>(null);
  const [isDryRun, setIsDryRun] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = (templateName: string) => {
    const tpl = TEMPLATES.find(t => t.name === templateName);
    if (!tpl) return;
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([tpl.columns, tpl.columns.map(() => '')]);
    XLSX.utils.book_append_sheet(wb, ws, templateName);
    XLSX.writeFile(wb, `${templateName.toLowerCase()}_import_template.xlsx`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
      if (json.length > 0) {
        setPreviewHeaders(json[0].map(String));
        setPreviewData(json.slice(1, 6).map(row => {
          const obj: any = {};
          json[0].forEach((h: any, i: number) => { obj[h] = row[i] || ''; });
          return obj;
        }));
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const runImport = async () => {
    if (previewData.length === 0) return;
    setImporting(true);
    setResults(null);

    const endpoint = selectedTemplate === 'Assets' ? '/api/assets' : '/api/tickets';
    let success = 0;
    const errors: string[] = [];

    for (const row of previewData) {
      if (isDryRun) {
        success++;
        continue;
      }
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(row),
        });
        if (res.ok) success++;
        else {
          const err = await res.json().catch(() => ({}));
          errors.push(err.error || `Row failed: ${JSON.stringify(row).slice(0, 100)}`);
        }
      } catch (e: any) {
        errors.push(e.message);
      }
    }

    setImporting(false);
    setResults({ success, errors });
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
            <Upload className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Data Migration Wizard</h1>
            <p className="text-sm text-gray-500">Import assets and tickets from your existing system via Excel</p>
          </div>
        </div>

        {/* Template Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. Choose Data Type & Download Template</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {TEMPLATES.map(t => (
              <div key={t.name}
                className={`flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${selectedTemplate === t.name ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}
                onClick={() => setSelectedTemplate(t.name)}>
                <FileText className={`w-5 h-5 ${selectedTemplate === t.name ? 'text-indigo-600' : 'text-gray-400'}`} />
                <div>
                  <p className="font-semibold text-gray-900">{t.name}</p>
                  <p className="text-xs text-gray-500">{t.columns.length} fields</p>
                </div>
                <Button size="sm" variant="outline" className="ml-auto" onClick={(e) => { e.stopPropagation(); downloadTemplate(t.name); }}>
                  <Download className="w-3 h-3 mr-1" />Template
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Upload Your Data File</CardTitle>
            <CardDescription>Upload an Excel (.xlsx) or CSV file matching the template format</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-all"
              onClick={() => fileRef.current?.click()}>
              <Upload className="w-8 h-8 mx-auto mb-3 text-gray-400" />
              <p className="text-gray-600 font-medium">Click to upload or drag & drop</p>
              <p className="text-xs text-gray-400 mt-1">.xlsx, .xls, .csv supported</p>
              <input ref={fileRef} type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleFileChange} />
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        {previewData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">3. Preview (first 5 rows)</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    {previewHeaders.map(h => (
                      <th key={h} className="py-2 px-3 text-left text-gray-500 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((row, i) => (
                    <tr key={i} className="border-b hover:bg-gray-50">
                      {previewHeaders.map(h => (
                        <td key={h} className="py-2 px-3 text-gray-700">{String(row[h] || '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* Import Controls */}
        {previewData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">4. Run Import</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={isDryRun} onChange={e => setIsDryRun(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600" />
                <span className="text-sm font-medium text-gray-700">Dry Run (simulate import without saving data)</span>
              </label>
              {isDryRun && (
                <div className="flex items-center gap-2 text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  Dry run mode — no data will be written. Uncheck to import for real.
                </div>
              )}
              <Button onClick={runImport} disabled={importing} className="bg-indigo-600 hover:bg-indigo-700">
                <Play className="w-4 h-4 mr-2" />
                {importing ? 'Importing...' : isDryRun ? 'Run Dry Run' : `Import ${previewData.length} Records`}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {results && (
          <Card className={results.errors.length === 0 ? 'border-green-200' : 'border-red-200'}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                {results.errors.length === 0 ? <CheckCircle className="w-5 h-5 text-green-600" /> : <XCircle className="w-5 h-5 text-red-600" />}
                Import Results
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{results.success}</p>
                  <p className="text-xs text-gray-500">Successful</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-600">{results.errors.length}</p>
                  <p className="text-xs text-gray-500">Errors</p>
                </div>
              </div>
              {results.errors.map((err, i) => (
                <div key={i} className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{err}</div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
