import React, { useState } from 'react';
import { 
  X, Camera, Trash2, Tag, AlertTriangle, User, MessageSquare, Save, Search, Building2, History
} from 'lucide-react';
import { AssetSearchModal } from './AssetSearchModal';
import { useAppStore } from '../../store/useAppStore';
import { ALMACEN_LABELS } from '../../data/branches';
import { useTickets } from '../../hooks/useTickets';

interface TicketFormProps {
  onClose: () => void;
  equipoTag?: string;
}

export const TicketForm: React.FC<TicketFormProps> = ({ onClose, equipoTag: initialTag }) => {
  const { createTicket } = useTickets();
  const assets = useAppStore(state => state.assets);
  const [showAssetSearch, setShowAssetSearch] = useState(false);
  const [tag, setTag] = useState(initialTag || "");
  const [equipoDesc, setEquipoDesc] = useState("");
  const [cliente, setCliente] = useState("");
  const [sucursal, setSucursal] = useState("");
  
  // Form fields
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [prioridad, setPrioridad] = useState("Media");
  const [asignadoA, setAsignadoA] = useState("Nelson Bravo (Tech Lead)");
  
  // Search Modal States
  const [searchQuery, setSearchQuery] = useState("");
  const [searchClient, setSearchClient] = useState("");
  const [searchSucursal, setSearchSucursal] = useState("");
  const [searchDescription, setSearchDescription] = useState("");

  const filteredEquipos = assets.filter(eq => {
    const matchTag = searchQuery ? eq.tag.toLowerCase().includes(searchQuery.toLowerCase()) : true;
    const matchDesc = searchDescription ? eq.nombre.toLowerCase().includes(searchDescription.toLowerCase()) : true;
    const eqSucursal = eq.tag.split('.')[0];
    const matchSucursal = searchSucursal ? eqSucursal === searchSucursal : true;
    return matchTag && matchDesc && matchSucursal;
  });

  const handleSelectAsset = (eq: any) => {
    setTag(eq.tag);
    setEquipoDesc(eq.nombre);
    setCliente("Empresa Mandante SPA"); // Simplified for demo
    const sucursalCode = eq.tag.split('.')[0];
    setSucursal(ALMACEN_LABELS[sucursalCode] || sucursalCode);
    setShowAssetSearch(false);
  };

  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      await createTicket({
        titulo: titulo || `FALLA REPORTADA EN ${tag}`,
        descripcion: descripcion || equipoDesc,
        prioridad: prioridad,
        estado: 'abierto',
        equipo_tag: tag,
        cliente_id: cliente,
        creado_por: 'Actual User',
        asignado_a: asignadoA,
        fecha_creacion: new Date().toISOString(),
      });
      
      onClose();
    } catch (e) {
      console.error("Ticket save error:", e);
      alert("Error al guardar el ticket.");
    } finally {
      setIsSaving(false);
    }
  };
  
  const today = new Date().toLocaleDateString('es-CL');

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[95vh]">
          {/* Header */}
          <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
            <div>
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Nuevo Ticket de Soporte</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Vincule un activo para mayor precisión en la trazabilidad</p>
            </div>
            <button onClick={onClose} className="p-3 hover:bg-slate-200 rounded-2xl transition-all text-slate-400 hover:text-slate-900"><X className="w-6 h-6" /></button>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto">
            {/* Asset Link Section */}
            <div className="bg-blue-50/30 p-6 rounded-[32px] border border-blue-100/50 space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black uppercase text-blue-600 tracking-widest">Activo Vinculado</label>
                <button 
                  type="button"
                  onClick={() => setShowAssetSearch(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all flex items-center gap-2"
                >
                  <Search className="w-3.5 h-3.5" /> Vincular Activo
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400">TAG Equipo</label>
                  <div className="relative">
                    <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    <input 
                      type="text" 
                      value={tag}
                      readOnly
                      placeholder="TAG INCIDENCIA" 
                      className="w-full pl-11 pr-4 py-3 bg-white border border-slate-100 rounded-2xl text-xs font-bold uppercase transition-all outline-none cursor-default" 
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400">Descripción Equipo</label>
                  <div className="relative">
                    <AlertTriangle className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    <input 
                      type="text" 
                      value={equipoDesc}
                      readOnly
                      placeholder="DETALLE TÉCNICO" 
                      className="w-full pl-11 pr-4 py-3 bg-white border border-slate-100 rounded-2xl text-xs font-bold uppercase transition-all outline-none cursor-default" 
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400">Sucursal / Cliente</label>
                  <div className="relative">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    <input 
                      type="text" 
                      value={sucursal ? `${sucursal} | Empresa` : ""}
                      readOnly
                      placeholder="UBICACIÓN ASOCIADA" 
                      className="w-full pl-11 pr-4 py-3 bg-white border border-slate-100 rounded-2xl text-xs font-bold uppercase transition-all outline-none cursor-default" 
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400">Fecha Auto.</label>
                  <div className="relative">
                    <History className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    <input 
                      type="text" 
                      value={today}
                      readOnly
                      className="w-full pl-11 pr-4 py-3 bg-slate-100/50 border border-slate-100 rounded-2xl text-xs font-bold outline-none cursor-default" 
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400">Título del Ticket</label>
              <input 
                type="text" 
                placeholder="EJ: FALLA COMPRESOR SALA B" 
                className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold uppercase transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none" 
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">Prioridad</label>
                <select 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
                  value={prioridad}
                  onChange={(e) => setPrioridad(e.target.value)}
                >
                  <option value="Baja">Baja</option>
                  <option value="Media">Media</option>
                  <option value="Alta">Alta</option>
                  <option value="CRÍTICA">CRÍTICA</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">Tipo Incidencia</label>
                <select className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500">
                  <option>Falla Técnica</option>
                  <option>Mejora Solicitada</option>
                  <option>Consulta Preventiva</option>
                  <option>Garantía</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400">Descripción del Problema</label>
              <textarea 
                rows={3} 
                placeholder="Detalle el problema observado..." 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none resize-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500" 
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400">Asignar Personal</label>
              <select 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
                value={asignadoA}
                onChange={(e) => setAsignadoA(e.target.value)}
              >
                <option value="Nelson Bravo (Tech Lead)">Nelson Bravo (Tech Lead)</option>
                <option value="Gonzalo Bravo (Senior Tech)">Gonzalo Bravo (Senior Tech)</option>
                <option value="Disponible para cualquiera">Disponible para cualquiera</option>
              </select>
            </div>

            <div className="flex gap-4">
              <button type="button" className="flex-1 py-4 bg-slate-50 text-slate-400 rounded-[24px] border border-slate-100 flex flex-col items-center justify-center gap-2 hover:bg-slate-100/80 transition-all group">
                <Camera className="w-6 h-6 group-hover:text-blue-500 transition-colors" />
                <span className="text-[9px] font-black uppercase">Adjuntar Evidencia</span>
              </button>
              <button type="button" className="flex-1 py-4 bg-slate-50 text-slate-400 rounded-[24px] border border-slate-100 flex flex-col items-center justify-center gap-2 hover:bg-rose-50 hover:text-rose-600 transition-all group hover:border-rose-100">
                 <Trash2 className="w-6 h-6" />
                 <span className="text-[9px] font-black uppercase">Limpiar Fotos</span>
              </button>
            </div>

            <button disabled={isSaving} type="submit" className="w-full py-5 bg-blue-600 text-white text-xs font-black uppercase tracking-widest rounded-[32px] shadow-2xl shadow-blue-500/20 active:scale-[0.98] transition-all hover:bg-blue-700 mt-4 flex items-center justify-center gap-3 disabled:opacity-50">
              {isSaving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Save className="w-5 h-5" />}
              {isSaving ? "Guardando..." : "Emitir y Guardar Ticket"}
            </button>
          </form>
        </div>
      </div>

      <AssetSearchModal 
        isOpen={showAssetSearch}
        onClose={() => setShowAssetSearch(false)}
        onSelect={handleSelectAsset}
        tag={searchQuery}
        setTag={setSearchQuery}
        cliente={searchClient}
        setCliente={setSearchClient}
        sucursal={searchSucursal}
        setSucursal={setSucursal}
        descripcion={searchDescription}
        setDescripcion={setSearchDescription}
        clients={ALMACEN_LABELS}
        results={filteredEquipos}
      />
    </>
  );
};
