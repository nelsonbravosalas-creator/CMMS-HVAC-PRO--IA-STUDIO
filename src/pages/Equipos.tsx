import React, { useState, useEffect, useMemo } from "react";
import { 
  Box, 
  Search, 
  Filter, 
  Plus, 
  Grid, 
  List, 
  LayoutGrid, 
  MoreVertical,
  Download,
  ScanLine,
  ChevronDown,
  ChevronRight,
  Bookmark,
  Trash2,
  Edit2,
  Check,
  QrCode
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { DataStore, useDataStore } from "../services/dataStore";
import { Equipo } from "../data/assets";
import { CreateAssetModal } from "../components/modals/CreateAssetModal";
import { BulkUploadModal } from "../components/modals/BulkUploadModal";
import { FilterPresetsDropdown } from "../components/modals/FilterPresetsDropdown";
import { QRLabelModal } from "../components/modals/QRLabelModal";
import { useAuth } from "../context/AuthContext";

type ViewMode = "grid" | "list" | "detail" | "iconic";

interface FilterState {
  search: string;
  tipo: string;
  estado: string;
  area: string;
  almacen: string;
}

export default function Equipos() {
  const { permisos } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectedEqLabel, setSelectedEqLabel] = useState<any | null>(null);
  const equipos = useDataStore(() => DataStore.getEquipos());
  const [filters, setFilters] = useState<FilterState>(() => {
    const saved = localStorage.getItem("equipos_filters");
    return saved ? JSON.parse(saved) : { search: "", tipo: "", estado: "", area: "", almacen: "" };
  });

  const ALMACEN_LABELS: Record<string, string> = { 
    '11-STK': 'Iquique', '12-STK': 'Antofagasta', '13-STK': 'Copiapó', 
    '21-STK': 'Santiago 14 de la Fama', '21-STK-SB': 'BME La Vara 3310',
    '23-STK': 'Viña del Mar', '24-STK': 'Rancagua', '31-STK': 'Concepción',
    '32-STK': 'Puerto Montt', 'Planta-STK': 'Planta Industrial'
  };

  if (!permisos?.ver_dashboard) return <div className="p-20 text-center text-slate-400 font-black uppercase italic">Acceso Denegado</div>;

  const [sortField, setSortField] = useState<keyof Equipo>("tag");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [, setLocation] = useLocation();

  useEffect(() => {
    localStorage.setItem("equipos_filters", JSON.stringify(filters));
  }, [filters]);

  const filteredEquipos = useMemo(() => {
    return equipos.filter(eq => {
      const matchSearch = (eq.tag + eq.nombre + eq.ubicacion).toLowerCase().includes(filters.search.toLowerCase());
      const matchTipo = filters.tipo ? eq.tipo === filters.tipo : true;
      const matchEstado = filters.estado ? eq.estado === filters.estado : true;
      const matchArea = filters.area ? eq.area === filters.area : true;
      
      const eqAlmacen = eq.tag.split('.')[0];
      const matchAlmacen = filters.almacen ? eqAlmacen === filters.almacen : true;

      return matchSearch && matchTipo && matchEstado && matchArea && matchAlmacen;
    }).sort((a, b) => {
      const valA = a[sortField] || "";
      const valB = b[sortField] || "";
      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [equipos, filters, sortField, sortOrder]);

  return (
    <div className="flex flex-col gap-6 text-left relative">
      <QRLabelModal 
        isOpen={!!selectedEqLabel} 
        onClose={() => setSelectedEqLabel(null)} 
        equipment={selectedEqLabel} 
      />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Inventario de Activos HVAC</h2>
          <p className="text-slate-500 text-sm font-medium">Gestión centralizada de equipos y parámetros técnicos.</p>
        </div>
        <div className="flex items-center gap-3">
          {permisos?.crear_equipo && (
            <>
              <button 
                onClick={() => setShowBulkModal(true)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-all">
                <Download className="w-4 h-4" /> Carga Masiva
              </button>
              <button 
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg shadow-blue-600/20">
                <Plus className="w-4 h-4" /> Crear Activo
              </button>
            </>
          )}
        </div>
      </div>
      
      {/* Search & Filter Bar */}
      <div className="flex flex-col gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col lg:flex-row items-center gap-4">
          <div className="flex-1 relative w-full">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar por TAG, Nombre, Ubicación..." 
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold uppercase transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              value={filters.search}
              onChange={(e) => setFilters({...filters, search: e.target.value})}
            />
          </div>
          
          <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto pb-1 lg:pb-0 scrollbar-hide">
              <FilterPresetsDropdown onApply={() => {}} />
              <select 
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-[10px] font-black uppercase outline-none min-w-[150px]"
                value={filters.almacen}
                onChange={(e) => setFilters({...filters, almacen: e.target.value})}
              >
                 <option value="">Todas las Sucursales</option>
                 {Object.entries(ALMACEN_LABELS).map(([k, v]) => (
                   <option key={k} value={k}>{v} ({k})</option>
                 ))}
              </select>
              <select 
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-[10px] font-black uppercase outline-none min-w-[120px]"
                value={filters.tipo}
                onChange={(e) => setFilters({...filters, tipo: e.target.value})}
              >
                 <option value="">Todos los Tipos</option>
                 <option value="Aire acondicionado">Aire acondicionado</option>
               </select>
               <select 
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-[10px] font-black uppercase outline-none min-w-[120px]"
                value={filters.estado}
                onChange={(e) => setFilters({...filters, estado: e.target.value})}
              >
                 <option value="">Cualquier Estado</option>
                 <option value="operativo">Operativo</option>
                 <option value="falla">En Falla</option>
                 <option value="mantenimiento">Mantenimiento</option>
               </select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-50">
           <div className="flex items-center gap-4">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{filteredEquipos.length} Equipos Filtrados</span>
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                 <button onClick={() => setViewMode("grid")} className={`p-1.5 rounded-md transition-colors ${viewMode === "grid" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400"}`}><Grid className="w-3.5 h-3.5" /></button>
                 <button onClick={() => setViewMode("list")} className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400"}`}><List className="w-3.5 h-3.5" /></button>
                 <button onClick={() => setViewMode("iconic")} className={`p-1.5 rounded-md transition-colors ${viewMode === "iconic" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400"}`}><LayoutGrid className="w-3.5 h-3.5" /></button>
              </div>
           </div>
           <div className="flex items-center gap-3">
              <select 
                className="text-[9px] font-black uppercase text-slate-500 outline-none pr-6 bg-transparent"
                value={sortField}
                onChange={(e) => setSortField(e.target.value as any)}
              >
                <option value="tag">Ordenar por TAG</option>
                <option value="nombre">Ordenar por Nombre</option>
                <option value="ultimoMantenimiento">Mantenimiento</option>
              </select>
              <button 
                onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                className="text-[9px] font-black uppercase text-blue-600"
              >
                {sortOrder === "asc" ? "ASC" : "DESC"}
              </button>
           </div>
        </div>
      </div>

      {/* Results Content */}
      <div className="min-h-[400px]">
        {viewMode === "grid" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredEquipos.map((eq: Equipo) => (
              <EquipoCardGrid key={eq.tag} equipo={eq} onShowLabel={setSelectedEqLabel} />
            ))}
          </div>
        )}

        {viewMode === "list" && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  <th className="px-6 py-4">TAG / Equipo</th>
                  <th className="px-6 py-4">Marca / Modelo</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4">Próximo Mantenimiento</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs">
                {filteredEquipos.map((eq: Equipo) => (
                   <EquipoRowList key={eq.tag} equipo={eq} onShowLabel={setSelectedEqLabel} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {viewMode === "iconic" && (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
            {filteredEquipos.map(eq => (
              <div 
                key={eq.tag} 
                onClick={() => setLocation(`/equipos/${eq.tag}`)}
                className="aspect-square bg-white border border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-2 hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group relative"
              >
                 <Box className={`w-8 h-8 transition-transform group-hover:scale-110 ${eq.estado === 'falla' ? 'text-red-500' : 'text-blue-500'}`} />
                 <div className="text-[10px] font-black text-slate-900 line-clamp-1">{eq.tag}</div>
                 <button 
                   onClick={(e) => { e.stopPropagation(); setSelectedEqLabel({ tag: eq.tag, desc: eq.nombre }); }}
                   className="absolute top-2 right-2 p-1 bg-white shadow-sm border border-slate-100 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                 >
                   <QrCode className="w-3 h-3 text-slate-400 hover:text-blue-500" />
                 </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && <CreateAssetModal onClose={() => setShowCreateModal(false)} onSave={(equipo) => DataStore.addEquipo(equipo)} />}
      {showBulkModal && <BulkUploadModal onClose={() => setShowBulkModal(false)} />}
    </div>
  );
}

const EquipoCardGrid: React.FC<{ equipo: Equipo, onShowLabel: (eq: any) => void }> = ({ equipo, onShowLabel }) => {
  const [, setLocation] = useLocation();

  return (
    <div 
      onClick={() => setLocation(`/equipos/${equipo.tag}`)}
      className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all cursor-pointer group text-left flex flex-col overflow-hidden relative"
    >
       <div className={`absolute top-0 left-0 w-full h-1.5 ${equipo.estado === 'falla' ? 'bg-red-500' : equipo.estado === 'mantenimiento' ? 'bg-amber-500' : 'bg-emerald-500'}`}></div>
       
       <div className="flex justify-between items-start mb-4">
          <div className="p-3 bg-slate-50 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 rounded-2xl transition-colors">
            <Box className="w-6 h-6" />
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={(e) => { e.stopPropagation(); onShowLabel({ tag: equipo.tag, desc: equipo.nombre }); }}
              className="p-3 bg-slate-100 hover:bg-white rounded-xl shadow-sm transition-all border border-transparent hover:border-slate-200"
            >
               <QrCode className="w-4 h-4 text-slate-400 hover:text-blue-600" />
            </button>
            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
              equipo.estado === 'falla' ? 'bg-red-100 text-red-600' : 
              equipo.estado === 'mantenimiento' ? 'bg-amber-100 text-amber-600' : 
              'bg-emerald-100 text-emerald-600'
            }`}>
              {equipo.estado}
            </span>
          </div>
       </div>

       <div className="flex-1 space-y-1">
          <h3 className="text-sm font-black text-slate-900 line-clamp-1 uppercase tracking-tight">{equipo.nombre}</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{equipo.tag}</p>
       </div>

       <div className="mt-6 pt-4 border-t border-slate-50 flex flex-col gap-3">
          <div className="flex justify-between items-center text-[10px] font-bold uppercase">
             <span className="text-slate-400">Marca:</span>
             <span className="text-slate-700">{equipo.marca}</span>
          </div>
          <div className="flex justify-between items-center text-[10px] font-bold uppercase">
             <span className="text-slate-400">Próximo Mantenimiento:</span>
             <span className="text-slate-900">{equipo.proximoMantenimiento}</span>
          </div>
       </div>

       <div className="mt-4 flex gap-2">
          <button className="flex-1 py-2 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-lg shadow-blue-600/10 active:scale-95 transition-all opacity-0 group-hover:opacity-100">
             Ver Detalles
          </button>
       </div>
    </div>
  );
}

const EquipoRowList: React.FC<{ equipo: Equipo, onShowLabel: (eq: any) => void }> = ({ equipo, onShowLabel }) => {
  const [, setLocation] = useLocation();

  return (
    <tr 
      onClick={() => setLocation(`/equipos/${equipo.tag}`)}
      className="hover:bg-slate-50 transition-colors cursor-pointer group"
    >
      <td className="px-6 py-4 text-left">
        <div className="flex items-center gap-4">
           <button 
             onClick={(e) => { e.stopPropagation(); onShowLabel({ tag: equipo.tag, desc: equipo.nombre }); }}
             className="p-2 bg-slate-100 hover:bg-blue-600 hover:text-white rounded-lg transition-all"
           >
              <QrCode className="w-4 h-4" />
           </button>
           <div>
             <div className="font-black text-slate-900 uppercase tracking-tight">{equipo.tag}</div>
             <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{equipo.nombre}</div>
           </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <div>
          <span className="font-bold text-slate-700">{equipo.marca}</span>
          <span className="text-slate-400 mx-2">/</span>
          <span className="text-slate-500">{equipo.modelo}</span>
        </div>
      </td>
      <td className="px-6 py-4">
        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
          equipo.estado === 'falla' ? 'bg-red-100 text-red-600' : 
          equipo.estado === 'mantenimiento' ? 'bg-amber-100 text-amber-600' : 
          'bg-emerald-100 text-emerald-600'
        }`}>
          {equipo.estado}
        </span>
      </td>
      <td className="px-6 py-4 font-bold text-slate-600">{equipo.proximoMantenimiento}</td>
      <td className="px-6 py-4 text-right">
         <div className="flex justify-end gap-2 text-slate-300 group-hover:text-slate-500">
            <Edit2 className="w-4 h-4 hover:text-blue-500" />
            <MoreVertical className="w-4 h-4 hover:text-blue-500" />
         </div>
      </td>
    </tr>
  );
}
