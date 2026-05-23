import React, { useState, useEffect } from 'react';
import LoadingIndicator from '../LoadingIndicator';
import { 
  X, QrCode, Download, Save, Zap, AlertCircle, Info, Calculator
} from 'lucide-react';
import { EQUIPOS_DATA, Equipo } from '../../data/assets';
import { DataStore } from '../../services/dataStore';

interface CreateAssetModalProps {
  onClose: () => void;
  onSave?: (equipo: Equipo) => void;
}

export const CreateAssetModal: React.FC<CreateAssetModalProps> = ({ onClose, onSave }) => {
  const [tagData, setTagData] = useState({
    almacen: '21-STK',
    tipo: 'AC',
    correlativo: '001',
    nombreEquipo: 'Compresor de Aire Industrial'
  });
  const [baseUrl, setBaseUrl] = useState("https://nelsonbravosalas-creator.github.io/APP.-ACTIVOS/");
  
  const [voltaje, setVoltaje] = useState<number>(220);
  const [corriente, setCorriente] = useState<number>(10);
  const potencia = (voltaje * corriente) / 1000;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fullTag = `${tagData.almacen}.${tagData.tipo}.${tagData.correlativo.padStart(3, '0')}`;
    const newEquipo: Equipo = {
      tag: fullTag,
      nombre: tagData.nombreEquipo,
      tipo: tipoMap[tagData.tipo] || tagData.tipo,
      marca: 'N/A',
      modelo: 'N/A',
      serie: '',
      ubicacion: almacenMap[tagData.almacen] || tagData.almacen,
      area: almacenMap[tagData.almacen] || tagData.almacen,
      capacidad: potencia.toFixed(0),
      voltaje: voltaje.toString(),
      corriente: corriente.toString(),
      refrigerante: 'R-410A',
      fechaInstalacion: new Date().toISOString().split('T')[0],
      vidaUtil: 10,
      estado: 'operativo',
      ultimoMantenimiento: new Date().toISOString().split('T')[0],
      proximoMantenimiento: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      horasOperacion: 0,
      tecnicos: ['Nelson Bravo'],
      notas: 'Activo registrado desde el módulo de creación rápida.'
    };

    DataStore.addEquipo(newEquipo);
    onSave?.(newEquipo);
    onClose();
  };

  useEffect(() => {
    // Buscar el máximo correlativo actual para esta sucursal y tipo
    const matches = EQUIPOS_DATA.filter(eq => {
      const parts = eq.tag.split('.');
      return parts[0] === tagData.almacen && parts[1] === tagData.tipo;
    });

    if (matches.length > 0) {
      const correlatives = matches.map(m => parseInt(m.tag.split('.')[2] || '0', 10));
      const max = Math.max(...correlatives);
      const next = (max + 1).toString().padStart(3, '0');
      setTagData(prev => ({ ...prev, correlativo: next }));
    } else {
      setTagData(prev => ({ ...prev, correlativo: '001' }));
    }
  }, [tagData.almacen, tagData.tipo]);

  const almacenMap: Record<string, string> = { 
    '11-STK': 'Iquique', '12-STK': 'Antofagasta', '13-STK': 'Copiapó', 
    '21-STK': 'Santiago 14 de la Fama', '21-STK-SB': 'BME La Vara 3310',
    '23-STK': 'Viña del Mar', '24-STK': 'Rancagua', '31-STK': 'Concepción',
    '32-STK': 'Puerto Montt', 'Planta-STK': 'Planta Industrial'
  };

  const tipoMap: Record<string, string> = { 
    'AC': 'Aire acondicionado', 'VH': 'Vehículo', 'GE': 'Grupo electrógeno', 
    'EB': 'Equipo de Bodega', 'GO': 'Grúa horquilla / Elevadora', 'XX': 'Otros Activos'
  };

  const fullTag = `${tagData.almacen}.${tagData.tipo}.${tagData.correlativo.padStart(3, '0')}`;
  const qrUrl = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}tag=${encodeURIComponent(fullTag)}`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(qrUrl)}&bgcolor=ffffff&color=0f172a&margin=0`;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-5xl rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 grid grid-cols-1 md:grid-cols-12 h-fit max-h-[90vh]">
        
        {/* Left Panel: TAG & QR Rendering (Replicando el diseño pro del usuario) */}
        <div className="md:col-span-5 bg-slate-50 p-8 flex flex-col items-center gap-8 border-r border-slate-200">
           <div className="w-full space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest text-center">Previsualización de Etiqueta</h3>
              
              {/* Etiqueta Visual Pro */}
              <div id="printable-tag" className="w-full aspect-[150/80] bg-white rounded-xl shadow-xl border border-slate-300 flex overflow-hidden">
                  <div className="w-[40%] border-r border-slate-200 flex flex-col items-center justify-center p-4 bg-white">
                      <img src={qrImageUrl} className="w-full aspect-square mix-blend-multiply" alt="QR" />
                      <div className="mt-2 text-[6px] font-black uppercase tracking-tighter text-slate-400">Escaneo Directo CMMS</div>
                  </div>
                  <div className="w-[60%] p-5 flex flex-col justify-between">
                      <div className="flex justify-between items-start">
                          <div className="bg-black text-white px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter">NBYB SPA</div>
                          <div className="text-right text-[6px] font-bold text-slate-400 uppercase">Ref ID:<br/><span className="text-black font-mono tracking-tighter">V3.2026</span></div>
                      </div>
                      <div className="w-full overflow-hidden">
                          <p className="text-[7px] font-black text-slate-400 mb-0.5 uppercase tracking-widest">Tag Identificador</p>
                          <div className="text-xl font-mono font-black text-black leading-none tracking-tighter truncate">
                              {fullTag}
                          </div>
                      </div>
                      <div className="border-t border-slate-100 pt-3">
                          <p className="text-[7px] font-black text-slate-400 uppercase mb-0.5">Descripción</p>
                          <p className="text-[10px] font-bold truncate uppercase text-slate-800">{tagData.nombreEquipo}</p>
                      </div>
                  </div>
              </div>
           </div>

           <div className="w-full space-y-4">
              <div className="bg-slate-900 rounded-2xl p-4 space-y-2">
                 <label className="text-[9px] font-black uppercase text-slate-500">URL de Destino</label>
                 <input 
                    type="text" 
                    className="w-full bg-slate-800 border-none text-white text-[10px] font-mono p-2 rounded-lg outline-none focus:ring-1 focus:ring-blue-500"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                 />
              </div>

              <div className="flex gap-2">
                 <button className="flex-1 py-4 bg-white border border-slate-200 text-slate-900 text-[10px] font-black uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 hover:bg-slate-50 transition-all">
                    <Download className="w-4 h-4" /> Exportar
                 </button>
                 <button onClick={() => window.print()} className="flex-1 py-4 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 hover:bg-black transition-all">
                    <QrCode className="w-4 h-4" /> Imprimir
                 </button>
              </div>
              <p className="text-[9px] font-medium text-slate-400 italic text-center px-4">La etiqueta cumple con el estándar de codificación NBYB CMMS.</p>
           </div>
        </div>

        {/* Right Panel: Technical Form */}
        <div className="md:col-span-7 p-10 overflow-y-auto">
          <div className="flex justify-between items-center mb-8">
             <div>
                <h3 className="text-xl font-black text-slate-900 uppercase">Configuración de Activo</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Generación de TAG y registro técnico</p>
             </div>
             <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X className="w-5 h-5" /></button>
          </div>

          <form className="space-y-8" onSubmit={handleSubmit}>
             <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase text-slate-400">Sucursal / Almacén</label>
                   <select 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
                      value={tagData.almacen}
                      onChange={(e) => setTagData({...tagData, almacen: e.target.value})}
                   >
                      {Object.entries(almacenMap).map(([k, v]) => (
                        <option key={k} value={k}>{k} - {v}</option>
                      ))}
                   </select>
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase text-slate-400">Categoría de Equipo</label>
                   <select 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
                      value={tagData.tipo}
                      onChange={(e) => setTagData({...tagData, tipo: e.target.value})}
                   >
                      {Object.entries(tipoMap).map(([k, v]) => (
                        <option key={k} value={k}>{v} ({k})</option>
                      ))}
                   </select>
                </div>
             </div>

             <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                   <div className="flex justify-between items-center">
                     <label className="text-[10px] font-black uppercase text-slate-400">Correlativo</label>
                     <div className="flex items-center gap-1">
                        <LoadingIndicator size="xs" color="text-blue-500" />
                        <span className="text-[8px] font-black text-blue-500 uppercase">Auto-Sugerido</span>
                     </div>
                   </div>
                   <input 
                      type="text" 
                      maxLength={3}
                      className="w-full px-4 py-3 bg-blue-50/50 border border-blue-100 rounded-2xl text-sm font-black text-blue-900 outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
                      value={tagData.correlativo}
                      onChange={(e) => setTagData({...tagData, correlativo: e.target.value.replace(/\D/g, '').slice(0, 3)})}
                   />
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase text-slate-400">Nombre de Activo</label>
                   <input 
                      type="text" 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
                      value={tagData.nombreEquipo}
                      onChange={(e) => setTagData({...tagData, nombreEquipo: e.target.value})}
                   />
                </div>
             </div>

             <div className="space-y-4">
                <div className="flex items-center gap-2">
                   <Calculator className="w-4 h-4 text-blue-600" />
                   <h4 className="text-[10px] font-black uppercase text-slate-900 tracking-widest">Dimensionamiento Eléctrico</h4>
                </div>
                <div className="grid grid-cols-3 gap-4">
                   <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400">Voltaje (V)</label>
                      <input type="number" value={voltaje} onChange={(e) => setVoltaje(Number(e.target.value))} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none" />
                   </div>
                   <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400">Corriente (A)</label>
                      <input type="number" value={corriente} onChange={(e) => setCorriente(Number(e.target.value))} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none" />
                   </div>
                   <div className="p-3 bg-blue-50 border border-blue-100 rounded-2xl flex flex-col justify-center">
                      <span className="text-[8px] font-black text-blue-600 uppercase">Potencia Est.</span>
                      <span className="text-sm font-black text-blue-600">{potencia.toFixed(2)} kW</span>
                   </div>
                </div>
             </div>

             <div className="space-y-1 pt-4">
                <button 
                  type="submit" 
                  className="w-full py-5 bg-blue-600 text-white text-xs font-black uppercase tracking-widest rounded-[32px] shadow-2xl shadow-blue-600/30 active:scale-95 hover:bg-blue-700 hover:shadow-blue-600/40 transition-all flex items-center justify-center gap-3 group"
                >
                   <Save className="w-5 h-5 group-hover:scale-110 transition-transform" /> 
                   <span>Registrar Activo en Sistema</span>
                </button>
             </div>
          </form>
        </div>
      </div>
    </div>
  );
};
