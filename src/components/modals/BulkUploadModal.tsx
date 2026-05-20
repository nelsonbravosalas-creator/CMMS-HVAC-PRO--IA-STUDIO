import React, { useState } from 'react';
import { 
  X, FileSpreadsheet, Upload, AlertCircle, Download, CheckCircle2
} from 'lucide-react';

interface BulkUploadModalProps {
  onClose: () => void;
}

export const BulkUploadModal: React.FC<BulkUploadModalProps> = ({ onClose }) => {
  const [showErrors, setShowErrors] = useState(false);

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-t-3xl sm:rounded-[40px] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-200 flex flex-col h-[100dvh] sm:h-auto sm:max-h-[95vh]">
        <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
          <div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Carga Masiva de Activos</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Sincronización incremental vía Excel/CSV</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full"><X className="w-5 h-5" /></button>
        </div>
        
        <div className="p-8 space-y-8 overflow-y-auto flex-1 min-h-0">
          <div className="flex justify-between items-center bg-blue-50 border border-blue-100 p-4 rounded-2xl">
             <div className="flex items-center gap-4">
                <FileSpreadsheet className="w-10 h-10 text-blue-600" />
                <div>
                   <p className="text-xs font-black text-slate-900 uppercase">Plantilla Estándar</p>
                   <p className="text-[10px] font-bold text-slate-400 uppercase">Descargue el formato antes de subir</p>
                </div>
             </div>
             <button className="px-4 py-2 bg-blue-600 text-white text-[10px] font-black uppercase rounded-xl flex items-center gap-2">
                <Download className="w-4 h-4" /> Bajar Plantilla
             </button>
          </div>

          <div className="border-4 border-dashed border-slate-100 rounded-[40px] p-12 flex flex-col items-center justify-center gap-4 hover:border-blue-200 hover:bg-blue-50/30 transition-all cursor-pointer group">
             <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-3xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all">
                <Upload className="w-8 h-8" />
             </div>
             <div className="text-center">
                <p className="text-xs font-black text-slate-900 uppercase">Seleccionar o arrastrar archivo</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Soporta .XLSX, .CSV (Máx 5MB)</p>
             </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex justify-between items-center">
                <span className="text-[10px] font-black text-emerald-600 uppercase">Válidas</span>
                <span className="text-xl font-black text-emerald-600">0</span>
             </div>
             <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex justify-between items-center">
                <span className="text-[10px] font-black text-red-600 uppercase">Invalidas</span>
                <span className="text-xl font-black text-red-600">0</span>
             </div>
          </div>

          <div className="flex justify-between items-center">
             <button onClick={() => setShowErrors(!showErrors)} className="text-[10px] font-black uppercase text-slate-400 hover:text-slate-900 transition-colors">
                {showErrors ? 'Ocultar bitácora de errores' : 'Ver bitácora de errores'}
             </button>
             <button className="px-8 py-4 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-3xl opacity-50 cursor-not-allowed">
                Iniciar Importación
             </button>
          </div>

          {showErrors && (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 font-mono text-[10px] text-slate-500 animate-in slide-in-from-top-2">
               Esperando archivo para validación de filas...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
