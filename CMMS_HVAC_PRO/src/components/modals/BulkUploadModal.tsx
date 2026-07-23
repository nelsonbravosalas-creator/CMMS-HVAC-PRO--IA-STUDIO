import React, { useState, useRef } from 'react';
import { 
  X, FileSpreadsheet, Upload, AlertCircle, Download, CheckCircle2
} from 'lucide-react';
import { db, LocalActivo } from '../../db/database';
import { useAppStore } from '../../store/useAppStore';
import { syncEngine } from '../../sync/syncEngine';

interface BulkUploadModalProps {
  onClose: () => void;
}

interface AssetRow {
  TAG: string;
  Nombre: string;
  Tipo: string;
  Marca: string;
  Modelo: string;
  Serie: string;
  Ubicacion: string;
  Area: string;
  Capacidad: string;
  Voltaje: string;
  Corriente: string;
  Refrigerante: string;
  Fecha_Instalacion: string;
  Vida_Util_Anios: number;
  Estado: string;
  Ultimo_Mantenimiento: string;
  Proximo_Mantenimiento: string;
  Horas_Operacion: number;
  Notas: string;
  Codigo_Sucursal: string;
}

const cleanString = (val: any): string => {
  if (val === null || val === undefined) return '';
  return String(val).trim();
};

const cleanNumber = (val: any, defaultVal = 0): number => {
  if (val === null || val === undefined || isNaN(Number(val))) return defaultVal;
  return Number(val);
};

const toCsv = (rows: Record<string, any>[]) => {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (value: any) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  return [headers.join(','), ...rows.map(row => headers.map(header => escape(row[header])).join(','))].join('\r\n');
};

const parseCsv = (text: string): Record<string, string>[] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i++;
      row.push(cell);
      if (row.some(value => value.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some(value => value.trim() !== '')) rows.push(row);
  const headers = rows.shift()?.map(header => header.trim()) || [];
  return rows.map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
};

export const BulkUploadModal: React.FC<BulkUploadModalProps> = ({ onClose }) => {
  const [showErrors, setShowErrors] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<AssetRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hydrateStore = useAppStore(state => state.hydrate);

  const handleDownloadTemplate = () => {
    const templateData: AssetRow[] = [
      {
        TAG: '21-STK.AC.001',
        Nombre: 'Aire Acondicionado Oficina Gerencia',
        Tipo: 'Aire acondicionado',
        Marca: 'Anwo',
        Modelo: 'Split Muro Inverter',
        Serie: 'SN-94729381',
        Ubicacion: 'Oficina Gerencia - Segundo Piso',
        Area: 'Administración',
        Capacidad: '18000 BTU',
        Voltaje: '220 V',
        Corriente: '8.5 A',
        Refrigerante: 'R410A',
        Fecha_Instalacion: '2025-01-10',
        Vida_Util_Anios: 10,
        Estado: 'operativo',
        Ultimo_Mantenimiento: '2026-03-01',
        Proximo_Mantenimiento: '2026-09-01',
        Horas_Operacion: 420,
        Notas: 'Instalado por Nelson Bravo. Unidad en óptimas condiciones.',
        Codigo_Sucursal: '21-STK'
      },
      {
        TAG: '21-STK.GE.002',
        Nombre: 'Grupo Electrógeno de Respaldo',
        Tipo: 'Grupo electrógeno',
        Marca: 'Caterpillar',
        Modelo: 'CAT-3516',
        Serie: 'SN-10293847',
        Ubicacion: 'Patio Trasero - Caseta Insonorizada',
        Area: 'Fuerza',
        Capacidad: '2000 kVA',
        Voltaje: '380 V',
        Corriente: '150 A',
        Refrigerante: 'N/A',
        Fecha_Instalacion: '2024-06-15',
        Vida_Util_Anios: 20,
        Estado: 'operativo',
        Ultimo_Mantenimiento: '2026-05-01',
        Proximo_Mantenimiento: '2026-06-01',
        Horas_Operacion: 125,
        Notas: 'Mantención mensual programada.',
        Codigo_Sucursal: '21-STK'
      }
    ];

    const blob = new Blob([toCsv(templateData)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'Plantilla_Carga_Masiva_Equipos.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    parseCsvFile(selectedFile);
  };

  const validateData = async (data: AssetRow[]) => {
    const newErrors: string[] = [];
    const seenTags = new Set<string>();

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const lineNum = i + 2;

      const tag = cleanString(row.TAG);
      if (!tag) {
        newErrors.push(`Fila ${lineNum}: El campo 'TAG' es obligatorio.`);
      } else {
        if (seenTags.has(tag)) {
            newErrors.push(`Fila ${lineNum}: El TAG '${tag}' está duplicado en el archivo CSV.`);
        } else {
          seenTags.add(tag);
          // Verificar en la db local si ya se encuentra registrado
          const existing = await db.assets.where('tag').equalsIgnoreCase(tag).first();
          if (existing && existing.deleted_at === undefined) {
            newErrors.push(`Fila ${lineNum}: El TAG '${tag}' ya se encuentra registrado en el sistema.`);
          }
        }
      }

      const nombre = cleanString(row.Nombre);
      if (!nombre) {
        newErrors.push(`Fila ${lineNum}: El campo 'Nombre' es obligatorio.`);
      }

      const tipo = cleanString(row.Tipo);
      if (!tipo) {
        newErrors.push(`Fila ${lineNum}: El campo 'Tipo' es obligatorio.`);
      }

      const estado = cleanString(row.Estado);
      if (!estado) {
        newErrors.push(`Fila ${lineNum}: El campo 'Estado' es obligatorio.`);
      } else {
        const estadoLower = estado.toLowerCase();
        if (!['operativo', 'falla', 'mantenimiento', 'baja'].includes(estadoLower)) {
          newErrors.push(`Fila ${lineNum}: Estado '${estado}' no es válido. Debe ser: operativo, falla, mantenimiento o baja.`);
        }
      }

      const codigoSucursal = cleanString(row.Codigo_Sucursal);
      if (!codigoSucursal) {
        newErrors.push(`Fila ${lineNum}: El campo 'Codigo_Sucursal' es obligatorio.`);
      } else {
        const branch = await db.branches.where('codigo').equalsIgnoreCase(codigoSucursal).first();
        if (!branch) {
          newErrors.push(`Fila ${lineNum}: No se encontró ninguna sucursal con el código de sucursal '${codigoSucursal}'.`);
        }
      }
    }

    setErrors(newErrors);
  };

  const parseCsvFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = String(evt.target?.result || '');
        const data = parseCsv(text) as unknown as AssetRow[];

        setParsedData(data);
        await validateData(data);
      } catch (err: any) {
        setErrors([`Error al analizar el archivo: ${err.message}`]);
      }
    };
    reader.readAsText(file);
  };

  const handleStartImport = async () => {
    if (parsedData.length === 0 || errors.length > 0) return;
    setIsProcessing(true);

    try {
      const activeClientId = localStorage.getItem("active_client") || "default";
      const assetsToInsert: LocalActivo[] = [];
      const queueItems: any[] = [];
      const now = Date.now();

      for (const row of parsedData) {
        const uuid = crypto.randomUUID();

        // Buscar correspondencia de sucursal_id
        const branch = await db.branches.where('codigo').equalsIgnoreCase(cleanString(row.Codigo_Sucursal)).first();
        const sucursalId = branch ? branch.uuid_sync : 'default-sucursal';

        const asset: LocalActivo = {
          uuid_sync: uuid,
          id: cleanString(row.TAG) || `PEND-${uuid}`,
          tag: cleanString(row.TAG),
          nombre: cleanString(row.Nombre),
          tipo: cleanString(row.Tipo),
          marca: cleanString(row.Marca),
          modelo: cleanString(row.Modelo),
          serie: cleanString(row.Serie),
          ubicacion: cleanString(row.Ubicacion),
          area: cleanString(row.Area),
          capacidad: cleanString(row.Capacidad),
          voltaje: cleanString(row.Voltaje),
          corriente: cleanString(row.Corriente),
          refrigerante: cleanString(row.Refrigerante),
          fecha_instalacion: cleanString(row.Fecha_Instalacion),
          vida_util: cleanNumber(row.Vida_Util_Anios, 10),
          estado: (cleanString(row.Estado).toLowerCase() || 'operativo') as any,
          ultimo_mantenimiento: cleanString(row.Ultimo_Mantenimiento),
          proximo_mantenimiento: cleanString(row.Proximo_Mantenimiento),
          horas_operacion: cleanNumber(row.Horas_Operacion, 0),
          tecnicos: [],
          notas: cleanString(row.Notas),
          cliente_id: activeClientId,
          sucursal_id: sucursalId,
          sync_status: 'pending_insert',
          updated_at: now
        };

        assetsToInsert.push(asset);

        queueItems.push({
          table: 'assets',
          uuid_sync: uuid,
          operation: 'insert' as const,
          data: asset,
          timestamp: now,
          retry_count: 0
        });
      }

      // Grabar equipos en Dexie de forma masiva
      await db.assets.bulkAdd(assetsToInsert);

      // Grabar tareas en la cola de sincronización
      await db.sync_queue.bulkAdd(queueItems);

      // Desencadenar la sincronización en background de inmediato
      syncEngine.triggerSync();

      // Recargar almacén de Zustand para que la UI se actualice
      await hydrateStore();

      alert(`✅ Se han cargado ${assetsToInsert.length} activos al inventario correctamente, programados para sincronización sync.`);
      onClose();
    } catch (err: any) {
      alert(`Error durante la carga masiva: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const validCount = parsedData.length - errors.length > 0 ? parsedData.length - errors.length : 0;
  const invalidCount = errors.length;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-t-3xl sm:rounded-[40px] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-200 flex flex-col h-[100dvh] sm:h-auto sm:max-h-[95vh]">
        <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
          <div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Carga Masiva de Activos</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Sincronización incremental vía CSV</p>
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
              <button 
                onClick={handleDownloadTemplate}
                className="px-4 py-2 bg-blue-600 text-white text-[10px] font-black uppercase rounded-xl flex items-center gap-2 hover:bg-blue-700 transition-all active:scale-95"
              >
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
                accept=".csv"
             />
             <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-3xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all">
                <Upload className="w-8 h-8" />
             </div>
             <div className="text-center">
                <p className="text-xs font-black text-slate-900 uppercase">
                  {file ? file.name : 'Seleccionar o arrastrar archivo'}
                </p>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Soporta .CSV (Máx 5MB)</p>
             </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex justify-between items-center">
                <span className="text-[10px] font-black text-emerald-600 uppercase">Válidas</span>
                <span className="text-xl font-black text-emerald-600">{file ? validCount : 0}</span>
             </div>
             <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex justify-between items-center">
                <span className="text-[10px] font-black text-red-600 uppercase">Inválidas</span>
                <span className="text-xl font-black text-red-600">{file ? invalidCount : 0}</span>
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
