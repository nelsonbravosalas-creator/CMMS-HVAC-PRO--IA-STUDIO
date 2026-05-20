import React, { useState, useRef } from 'react';
import { 
  X, FileSpreadsheet, Upload, AlertCircle, Download, CheckCircle2, ChevronRight
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { db, LocalInforme } from '../../db/database';
import { syncEngine } from '../../sync/syncEngine';

interface ReportBulkUploadModalProps {
  onClose: () => void;
}

interface ReportRow {
  ID_Informe: string;
  TAG_Equipo: string;
  Fecha: string;
  Estado: string;
  Tecnico: string;
  Tipo_Servicio: string;
  Descripcion: string;
}

export const ReportBulkUploadModal: React.FC<ReportBulkUploadModalProps> = ({ onClose }) => {
  const [showErrors, setShowErrors] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ReportRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleDownloadTemplate = () => {
    const templateData: ReportRow[] = [{
      ID_Informe: 'INF-001',
      TAG_Equipo: '21-STK.AC.001',
      Fecha: '2026-05-20',
      Estado: 'firmado',
      Tecnico: 'Nelson Bravo',
      Tipo_Servicio: 'Preventivo',
      Descripcion: 'Mantenimiento manual realizado'
    }];
    
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Informes");
    XLSX.writeFile(wb, "Plantilla_Carga_Masiva_Informes.xlsx");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    parseExcel(selectedFile);
  };

  const parseExcel = (file: File) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<ReportRow>(ws);
        
        // Validation rules
        const newErrors: string[] = [];
        data.forEach((row, index) => {
          if (!row.TAG_Equipo) newErrors.push(`Fila ${index + 2}: TAG_Equipo vacío.`);
          if (!row.Estado) newErrors.push(`Fila ${index + 2}: Estado vacío.`);
          if (!row.Fecha) newErrors.push(`Fila ${index + 2}: Fecha vacía.`);
        });
        
        setParsedData(data);
        setErrors(newErrors);
      } catch (err: any) {
        setErrors([`Error al analizar el archivo: ${err.message}`]);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleStartImport = async () => {
    if (parsedData.length === 0 || errors.length > 0) return;
    setIsProcessing(true);
    
    try {
      const reportsToInsert: LocalInforme[] = parsedData.map(row => {
        const uuid = crypto.randomUUID();
        return {
          uuid_sync: uuid,
          id: row.ID_Informe || `INF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          data: {
            equipo_tag: row.TAG_Equipo,
            estado: row.Estado,
            fecha: row.Fecha,
            tecnico: row.Tecnico,
            tipoServicio: row.Tipo_Servicio,
            descripcion: row.Descripcion
          },
          sync_status: 'pending_insert',
          updated_at: Date.now()
        };
      });

      // Guardar en Dexie
      await db.reports.bulkAdd(reportsToInsert);

      // Encolar operaciones
      const queueItems = reportsToInsert.map(report => ({
        table: 'reports',
        uuid_sync: report.uuid_sync,
        operation: 'insert' as const,
        data: report,
        timestamp: Date.now(),
        retry_count: 0
      }));

      await db.sync_queue.bulkAdd(queueItems);
      
      // Intentar sincronizar a la nube de inmediato respetando las reglas OFFLINE-FIRST
      syncEngine.triggerSync();
      
      alert(`✅ ${reportsToInsert.length} informes importados y encolados para sincronización.`);
      onClose();
    } catch (err: any) {
      alert(`Error en la importación: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const validCount = parsedData.length;
  const invalidCount = errors.length;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-t-3xl sm:rounded-[40px] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-200 flex flex-col h-[100dvh] sm:h-auto sm:max-h-[95vh]">
        <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
          <div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Carga Masiva de Informes</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Sincronización incremental vía Excel/CSV</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full"><X className="w-5 h-5" /></button>
        </div>
        
        <div className="p-8 space-y-8 overflow-y-auto flex-1 min-h-0">
          <div className="flex justify-between items-center bg-blue-50 border border-blue-100 p-4 rounded-2xl">
             <div className="flex items-center gap-4">
                <FileSpreadsheet className="w-10 h-10 text-blue-600" />
                <div>
                   <p className="text-xs font-black text-slate-900 uppercase">Plantilla Estándar Mapeada</p>
                   <p className="text-[10px] font-bold text-slate-400 uppercase">Descargue el formato antes de subir</p>
                </div>
             </div>
             <button onClick={handleDownloadTemplate} className="px-4 py-2 bg-blue-600 text-white text-[10px] font-black uppercase rounded-xl flex items-center gap-2">
                <Download className="w-4 h-4" /> Bajar Plantilla
             </button>
          </div>

          <div 
             onClick={() => fileInputRef.current?.click()}
             className="border-4 border-dashed border-slate-100 rounded-[40px] p-12 flex flex-col items-center justify-center gap-4 hover:border-blue-200 hover:bg-blue-50/30 transition-all cursor-pointer group"
          >
             <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload}
                className="hidden" 
                accept=".xlsx,.csv"
             />
             <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-3xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all">
                <Upload className="w-8 h-8" />
             </div>
             <div className="text-center">
                <p className="text-xs font-black text-slate-900 uppercase">{file ? file.name : 'Seleccionar o arrastrar archivo'}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Soporta .XLSX, .CSV (Máx 5MB)</p>
             </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex justify-between items-center">
                <span className="text-[10px] font-black text-emerald-600 uppercase">Válidas</span>
                <span className="text-xl font-black text-emerald-600">{validCount}</span>
             </div>
             <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex justify-between items-center">
                <span className="text-[10px] font-black text-red-600 uppercase">Inválidas</span>
                <span className="text-xl font-black text-red-600">{invalidCount}</span>
             </div>
          </div>

          <div className="flex justify-between items-center">
             <button onClick={() => setShowErrors(!showErrors)} className="text-[10px] font-black uppercase text-slate-400 hover:text-slate-900 transition-colors">
                {showErrors ? 'Ocultar bitácora de errores' : 'Ver bitácora de errores'}
             </button>
             <button 
                onClick={handleStartImport}
                disabled={isProcessing || parsedData.length === 0 || errors.length > 0}
                className={`px-8 py-4 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-3xl transition-all ${
                  (isProcessing || parsedData.length === 0 || errors.length > 0) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-800 active:scale-95 shadow-xl shadow-slate-900/20'
                }`}
             >
                {isProcessing ? 'Sincronizando...' : 'Iniciar Importación'}
             </button>
          </div>

          {showErrors && (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 font-mono text-[10px] text-slate-500 animate-in slide-in-from-top-2 flex flex-col gap-1 max-h-32 overflow-y-auto">
               {errors.length > 0 ? (
                 errors.map((err, i) => <p key={i} className="text-red-500">{err}</p>)
               ) : (
                 parsedData.length > 0 ? <p className="text-emerald-600">No se encontraron errores. Archivo listo para importar.</p> : <p>Esperando archivo para validación de filas...</p>
               )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
