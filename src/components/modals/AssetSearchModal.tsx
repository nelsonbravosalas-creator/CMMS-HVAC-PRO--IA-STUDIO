import React, { useState } from 'react';
import { 
  X, 
  Search, 
  Building2, 
  Tag, 
  Plus, 
  ChevronDown, 
  FileText, 
  ScanLine, 
  Users,
  History
} from 'lucide-react';
import { INFORMES_MOCK } from "../../data/reports";
import { EQUIPOS_DATA } from "../../data/assets";
import { SearchableSelect } from '../SearchableSelect';
import { useAppStore } from '../../store/useAppStore';

interface AssetSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (eq: any) => void;
  tag: string;
  setTag: (val: string) => void;
  cliente: string;
  setCliente: (val: string) => void;
  sucursal: string;
  setSucursal: (val: string) => void;
  descripcion: string;
  setDescripcion: (val: string) => void;
  clients: Record<string, string>;
  results: any[];
}

export function AssetSearchModal({ 
  isOpen, 
  onClose, 
  onSelect, 
  tag, setTag, 
  cliente, setCliente, 
  sucursal, setSucursal, 
  descripcion, setDescripcion,
  clients, 
  results 
}: AssetSearchModalProps) {
  const [activeTab, setActiveTab] = useState<'assets' | 'reports' | 'qr'>('assets');
  const today = new Date().toLocaleDateString('es-CL');
  const storeClients = useAppStore(state => state.clients);
  const storeBranches = useAppStore(state => state.branches);

  // If sucursal needs to be constrained to selected cliente
  const filteredBranches = sucursal && Object.keys(storeBranches || {}).length > 0 
    ? storeBranches 
    : storeBranches; 
  // We can just use storeBranches for now, filtering by cliente if needed.
  
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
       <div className="bg-white w-full h-full md:h-auto md:max-w-4xl md:rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-screen md:max-h-[90vh]">
          {/* Header */}
          <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
             <div>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Pantalla de Búsqueda</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Filtre por múltiples campos para localizar su activo</p>
             </div>
             <div className="flex items-center gap-3">
               <div className="hidden md:flex px-3 py-1.5 bg-blue-100 rounded-full items-center gap-2">
                 <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Fecha: {today}</span>
               </div>
               <button onClick={onClose} className="p-3 hover:bg-white rounded-2xl transition-all shadow-sm bg-white md:bg-transparent text-slate-400 hover:text-slate-900">
                  <X className="w-6 h-6" />
               </button>
             </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex p-2 bg-slate-100/50 border-b border-slate-100">
            <button 
              onClick={() => setActiveTab('assets')}
              className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'assets' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Activos
            </button>
            <button 
              onClick={() => setActiveTab('reports')}
              className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'reports' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Informes
            </button>
            <button 
              onClick={() => setActiveTab('qr')}
              className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'qr' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <div className="flex items-center justify-center gap-2">
                <ScanLine className="w-4 h-4" />
                Scanner QR
              </div>
            </button>
          </div>

          <div className="p-6 md:p-8 space-y-6 overflow-y-auto flex-1">
             {activeTab === 'assets' && (
               <>
                 <form 
                   onSubmit={(e) => {
                     e.preventDefault();
                   }}
                   className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                 >
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase text-slate-400">TAG Equipo</label>
                       <div className="relative">
                          <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                          <input 
                            type="text"
                            value={tag}
                            onChange={(e) => setTag(e.target.value)}
                            placeholder="Buscar TAG..."
                            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
                          />
                       </div>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase text-slate-400">Cliente</label>
                       <SearchableSelect
                         options={[
                           { value: "", label: "Todos los Clientes" },
                           ...Object.values(storeClients || {}).map((c: any) => ({
                             value: c.nombre,
                             label: c.nombre
                           }))
                         ]}
                         value={cliente}
                         onChange={(val) => {
                           setCliente(val);
                           setSucursal("");
                         }}
                         placeholder="Todos los Clientes"
                         icon={<Users className="w-4 h-4" />}
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase text-slate-400">Sucursal</label>
                       <SearchableSelect
                         options={[
                           { value: "", label: "Todas las Sucursales" },
                           ...Object.values(storeBranches || {})
                             .filter((b: any) => !cliente || (storeClients[b.cliente_id]?.nombre === cliente))
                             .map((b: any) => ({
                               value: b.nombre,
                               label: b.nombre,
                               subtitle: b.codigo
                             }))
                         ]}
                         value={sucursal}
                         onChange={(val) => setSucursal(val)}
                         placeholder="Todas las Sucursales"
                         icon={<Building2 className="w-4 h-4" />}
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase text-slate-400">Descripción del Equipo</label>
                       <div className="relative">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                          <input 
                            type="text"
                            value={descripcion}
                            onChange={(e) => setDescripcion(e.target.value)}
                            placeholder="Chiller, Split..."
                            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
                          />
                       </div>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase text-slate-400">Fecha Automática</label>
                       <div className="relative">
                          <History className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                          <input 
                            type="text"
                            value={today}
                            readOnly
                            className="w-full pl-11 pr-4 py-3 bg-slate-100 border border-slate-100 rounded-2xl text-xs font-bold outline-none cursor-default"
                          />
                       </div>
                    </div>
                    <div className="flex items-end">
                       <button 
                         type="submit"
                         className="w-full py-3 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-600/20 active:scale-95 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                       >
                          <Search className="w-4 h-4" />
                          Ejecutar Búsqueda
                       </button>
                    </div>
                 </form>

                 <div className="space-y-3 pt-6">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Resultados ({results.length})</label>
                    <div className="grid grid-cols-1 gap-2">
                       {results.map((eq: any) => (
                         <button 
                            key={eq.tag}
                            onClick={() => onSelect(eq)}
                            className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-3xl hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/5 transition-all group text-left"
                         >
                            <div className="flex items-center gap-4">
                               <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                                  <Tag className="w-6 h-6" />
                               </div>
                               <div>
                                  <div className="flex items-center gap-2">
                                     <h4 className="text-sm font-black text-slate-900 group-hover:text-blue-600 transition-colors uppercase">{eq.tag}</h4>
                                     <span className="text-[9px] font-black px-2 py-0.5 bg-slate-100 text-slate-400 rounded-full">{eq.tipo}</span>
                                  </div>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase line-clamp-1">{eq.nombre} - {eq.ubicacion}</p>
                               </div>
                            </div>
                            <ChevronDown className="w-5 h-5 text-slate-300 -rotate-90 group-hover:text-blue-500 transition-all opacity-40" />
                         </button>
                       ))}
                       {results.length === 0 && (
                         <div className="py-20 text-center space-y-4">
                            <Search className="w-12 h-12 text-slate-100 mx-auto" />
                            <p className="text-xs font-black text-slate-300 uppercase italic">No se encontraron activos</p>
                         </div>
                       )}
                    </div>
                 </div>
               </>
             )}

             {activeTab === 'reports' && (
               <div className="space-y-6">
                 <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Buscar Informes Recientes</label>
                   <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input 
                        type="text"
                        placeholder="N° Folio o Cliente..."
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/10"
                      />
                   </div>
                 </div>
                 <div className="grid grid-cols-1 gap-4">
                   {INFORMES_MOCK.slice(0, 5).map(inf => (
                      <div key={inf.id} className="p-4 bg-slate-50 border border-slate-100 rounded-3xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-500 shadow-sm transition-transform hover:scale-105">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <h5 className="text-[10px] font-black text-slate-900 uppercase">#{inf.id} - {inf.tipoServicio}</h5>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{inf.fecha} | {inf.sucursal}</p>
                          </div>
                        </div>
                        <button className="text-[9px] font-black text-blue-600 uppercase border-b border-blue-600 hover:text-blue-700 transition-colors">Ver</button>
                      </div>
                   ))}
                 </div>
               </div>
             )}

             {activeTab === 'qr' && (
               <div className="flex flex-col items-center justify-center py-20 space-y-6">
                 <div className="w-48 h-48 bg-slate-900 rounded-[40px] flex items-center justify-center shadow-2xl relative overflow-hidden group">
                   <div className="absolute inset-4 border-2 border-dashed border-white/20 rounded-[32px] group-hover:border-blue-500 transition-colors animate-pulse" />
                   <ScanLine className="w-20 h-20 text-white" />
                 </div>
                 <div className="text-center">
                   <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Scanner QR No Activo</h4>
                   <p className="text-[10px] font-bold text-slate-400 uppercase mt-2 max-w-[240px] leading-relaxed">Habilite el acceso a la cámara para vincular activos escaneando su código QR</p>
                 </div>
                 <button className="px-8 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-slate-900/20 active:scale-95 hover:bg-slate-800 transition-all">
                   Activar Cámara
                 </button>
               </div>
             )}
          </div>
       </div>
    </div>
  );
}
