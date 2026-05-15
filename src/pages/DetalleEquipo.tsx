
import React, { useState, useEffect, useMemo } from "react";
import { 
  ArrowLeft, 
  Settings2, 
  History, 
  FileText, 
  PenTool, 
  QrCode, 
  Printer, 
  Share2, 
  Trash2, 
  AlertCircle,
  ExternalLink,
  ChevronDown,
  Layout,
  Clock,
  MoreVertical,
  Download,
  Plus,
  RefreshCw,
  Copy,
  Info,
  Edit2,
  ScanLine,
  X,
  Wrench
} from "lucide-react";
import { Link, useRoute } from "wouter";
import { EQUIPOS_DATA, Equipo } from "../data/assets";
import { TicketForm } from "../components/modals/TicketForm";
import { NuevoMantenimientoModal } from "../components/modals/NuevoMantenimientoModal";
import { db } from "../db/database";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line
} from "recharts";

import { useAppStore } from "../store/useAppStore";
import { useAssets } from "../hooks/useAssets";

type Tab = "info" | "historial" | "historico" | "documentos";

export default function DetalleEquipo() {
  const [, params] = useRoute<{ tag: string }>("/equipos/:tag");
  const tag = params ? params.tag : undefined;
  
  const assets = useAppStore(state => state.assets);
  const loading = useAppStore(state => state.isLoading);
  const equipo = useMemo(() => assets.find(a => a.tag === tag), [assets, tag]);

  const { editAsset } = useAssets();
  
  const preventive_maintenance = useAppStore(state => state.preventive_maintenance);
  const historialMantenimiento = useMemo(() => 
    preventive_maintenance.filter(m => m.equipo_tag === tag),
    [preventive_maintenance, tag]
  );
  
  const [activeTab, setActiveTab] = useState<Tab>("info");
  const [isEditing, setIsEditing] = useState(false);
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [showMantenimientoForm, setShowMantenimientoForm] = useState(false);
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    if (equipo) setFormData(equipo);
  }, [equipo]);

  const handleSave = async () => {
    if (!equipo) return;
    try {
      await editAsset(equipo.uuid_sync, formData);
      setIsEditing(false);
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500 font-medium">Cargando datos del equipo...</div>;
  }

  if (!equipo) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8 bg-white rounded-3xl border border-slate-200">
        <AlertCircle className="w-16 h-16 text-slate-200 mb-4" />
        <h2 className="text-xl font-black text-slate-900 uppercase">Equipo No Encontrado</h2>
        <p className="text-slate-500 text-sm mt-2 font-medium">El TAG solicitado no existe en nuestra base de datos maestra.</p>
        <Link href="/equipos">
          <button className="mt-8 px-6 py-2.5 bg-blue-600 text-white font-black text-xs uppercase tracking-widest rounded-xl">Volver al Inventario</button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 text-left pb-12 animate-in fade-in duration-500">
      {/* Upper Navigation & Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/equipos">
            <button className="p-2.5 hover:bg-slate-100 text-slate-400 hover:text-slate-900 rounded-xl transition-colors">
              <X className="w-5 h-5" />
            </button>
          </Link>
          <div>
             <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">{equipo.nombre}</h1>
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                  equipo.estado === 'falla' ? 'bg-red-100 text-red-600' : 
                  equipo.estado === 'mantenimiento' ? 'bg-amber-100 text-amber-600' : 
                  'bg-emerald-100 text-emerald-600'
                }`}>
                  {equipo.estado}
                </span>
             </div>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{equipo.tag}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <button 
             onClick={() => isEditing ? handleSave() : setIsEditing(true)} 
             className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all ${isEditing ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
           >
              <Plus className="w-4 h-4" /> {isEditing ? 'Guardar Cambios' : 'Editar Ficha'}
           </button>
           {isEditing && (
             <button 
               onClick={() => setIsEditing(false)} 
               className="px-4 py-2.5 bg-red-100 text-red-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-200 transition-all font-black"
             >
               Cancelar
             </button>
           )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Functional Modules */}
        <div className="lg:col-span-8 flex flex-col gap-8">
           
           {/* Tabs */}
           <div className="flex items-center gap-4 border-b border-slate-200">
              <button 
                onClick={() => setActiveTab("info")}
                className={`py-4 px-2 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === "info" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-400 hover:text-slate-600"}`}
              >
                Información Técnica
              </button>
              <button 
                onClick={() => setActiveTab("historial")}
                className={`py-4 px-2 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === "historial" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-400 hover:text-slate-600"}`}
              >
                Historial Mantenimiento
              </button>
              <button 
                onClick={() => setActiveTab("historico")}
                className={`py-4 px-2 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === "historico" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-400 hover:text-slate-600"}`}
              >
                Histórico de Cambios
              </button>
              <button 
                onClick={() => setActiveTab("documentos")}
                className={`py-4 px-2 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === "documentos" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-400 hover:text-slate-600"}`}
              >
                Documentación
              </button>
           </div>

           {activeTab === "info" && (
             <div className="flex flex-col gap-8">
                {/* Identification & Specs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="bg-white p-6 rounded-3xl border border-slate-200 space-y-6">
                      <div className="flex items-center gap-3 pb-4 border-b border-slate-50">
                         <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Info className="w-4 h-4" /></div>
                         <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">Especificaciones Maestras</h3>
                      </div>
                      <div className="space-y-4">
                         <ParamRow label="Nombre del Activo" value={formData.nombre} field="nombre" onChange={(f, v) => setFormData({...formData, [f]: v})} editable={isEditing} />
                         <ParamRow label="Tipo de Equipo" value={formData.tipo} field="tipo" onChange={(f, v) => setFormData({...formData, [f]: v})} editable={isEditing} />
                         <ParamRow label="Marca / Fabr." value={formData.marca} field="marca" onChange={(f, v) => setFormData({...formData, [f]: v})} editable={isEditing} />
                         <ParamRow label="Modelo / Serie" value={`${formData.modelo} / ${formData.serie || 'N/A'}`} field="modelo" onChange={(f, v) => setFormData({...formData, [f]: v})} editable={isEditing} />
                         <ParamRow label="Capacidad (BTU)" value={`${formData.capacidad}`} field="capacidad" onChange={(f, v) => setFormData({...formData, [f]: v})} editable={isEditing} />
                         <ParamRow label="Refrigerante" value={formData.refrigerante} field="refrigerante" onChange={(f, v) => setFormData({...formData, [f]: v})} editable={isEditing} />
                      </div>
                   </div>
 
                   <div className="bg-white p-6 rounded-3xl border border-slate-200 space-y-6">
                      <div className="flex items-center gap-3 pb-4 border-b border-slate-50">
                         <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><Layout className="w-4 h-4" /></div>
                         <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">Ubicación y Vida Útil</h3>
                      </div>
                      <div className="space-y-4">
                         <ParamRow label="Área / Departamento" value={formData.area} field="area" onChange={(f, v) => setFormData({...formData, [f]: v})} editable={isEditing} />
                         <ParamRow label="Ubicación Física" value={formData.ubicacion} field="ubicacion" onChange={(f, v) => setFormData({...formData, [f]: v})} editable={isEditing} />
                         <ParamRow label="Vida Útil (Años)" value={`${formData.vida_util}`} field="vida_util" onChange={(f, v) => setFormData({...formData, [f]: v})} editable={isEditing} />
                         <ParamRow label="Voltaje / Corriente" value={`${formData.voltaje}V / ${formData.corriente}A`} field="voltaje" onChange={(f, v) => setFormData({...formData, [f]: v})} editable={isEditing} />
                         <ParamRow label="Fecha Instalación" value={formData.fecha_instalacion || 'S/I'} field="fecha_instalacion" onChange={(f, v) => setFormData({...formData, [f]: v})} editable={isEditing} />
                      </div>
                   </div>
                </div>

                {/* Costs & Incidencies Summary Chart */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200">
                   <div className="flex justify-between items-center mb-8">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-50 text-slate-400 rounded-lg"><BarChart className="w-4 h-4" /></div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">Resumen de Costos e Incidencias (12 meses)</h3>
                      </div>
                      <div className="text-[10px] font-black text-emerald-600 uppercase">Ahorro Estimado: +12% vs Promedio</div>
                   </div>
                   <div className="h-[250px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={mockChartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700}} />
                          <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700}} />
                          <Tooltip 
                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                            labelStyle={{ textTransform: 'uppercase', fontSize: '10px', fontWeight: 900, marginBottom: '4px' }}
                          />
                          <Bar dataKey="costo" fill="#2563eb" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="incidencias" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                   </div>
                </div>
             </div>
           )}

           {activeTab === "historial" && (
             <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                   <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">Registro de Intervenciones</h3>
                   <button 
                    onClick={() => setShowMantenimientoForm(true)}
                    className="px-4 py-2 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center gap-2"
                   >
                      <Plus className="w-3.5 h-3.5" /> Programar Mantenimiento
                   </button>
                </div>
                <div className="divide-y divide-slate-50">
                   {historialMantenimiento.length === 0 ? (
                     <div className="p-20 text-center text-slate-400 italic text-xs font-bold uppercase">No hay registros de mantenimiento para este equipo</div>
                   ) : (
                     historialMantenimiento.map(m => (
                       <div key={m.uuid_sync} className="p-6 hover:bg-slate-50 transition-colors group">
                          <div className="flex justify-between items-start mb-4">
                             <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-slate-100 text-slate-500 rounded-xl"><RefreshCw className="w-4 h-4" /></div>
                                <div>
                                   <h4 className="text-sm font-black text-slate-900 uppercase">{m.tipo}</h4>
                                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">REALIZADO EL {m.fecha} POR {m.tecnico}</p>
                                </div>
                             </div>
                             <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-blue-600"><Edit2 className="w-3.5 h-3.5" /></button>
                                <button className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-slate-900"><Copy className="w-3.5 h-3.5" /></button>
                                <button className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                             </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[10px] font-bold uppercase mt-2">
                             <div><span className="text-slate-400 block mb-1 uppercase text-[8px] tracking-[0.2em]">Hallazgos</span> <span className="text-slate-700">{m.hallazgos || 'Ninguno'}</span></div>
                             <div><span className="text-slate-400 block mb-1 uppercase text-[8px] tracking-[0.2em]">Acciones Tomadas</span> <span className="text-slate-700">{m.acciones || 'Ninguna'}</span></div>
                          </div>
                       </div>
                     ))
                   )}
                </div>
             </div>
           )}

           {activeTab === "historico" && (
              <div className="flex flex-col gap-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="bg-white p-6 rounded-3xl border border-slate-200">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                          <Clock className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">24/04/2026 - 10:22 AM</p>
                          <h4 className="text-sm font-black text-slate-900 uppercase">Cambio de Ubicación</h4>
                        </div>
                      </div>
                      <button className="p-2 hover:bg-slate-50 rounded-xl text-slate-400"><ChevronDown className="w-4 h-4" /></button>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-50 grid grid-cols-2 gap-4">
                       <div className="p-3 bg-red-50 text-red-700 rounded-2xl">
                          <span className="text-[9px] font-black uppercase opacity-60 block">Anterior</span>
                          <span className="text-xs font-bold uppercase tracking-tight">Bodega 01 - Estantería B</span>
                       </div>
                       <div className="p-3 bg-emerald-50 text-emerald-700 rounded-2xl">
                          <span className="text-[9px] font-black uppercase opacity-60 block">Nuevo</span>
                          <span className="text-xs font-bold uppercase tracking-tight">Bodega 01 - Mesón Ventas</span>
                       </div>
                    </div>
                  </div>
                ))}
              </div>
           )}

           {activeTab === "documentos" && (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <DocumentCard type="pdf" title="Informe de Instalación Original" date="02/02/2026" />
                <DocumentCard type="html" title="Ficha Técnica del Fabricante (Manual)" date="N/A" />
                <div className="border-2 border-dashed border-slate-200 rounded-3xl p-8 flex flex-col items-center justify-center text-center gap-3 hover:bg-slate-50 transition-colors cursor-pointer">
                   <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center"><Download className="w-6 h-6" /></div>
                   <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Arrastra o sube nuevos documentos</p>
                </div>
             </div>
           )}

        </div>

        {/* Right Column: Actions & Quick Info */}
        <div className="lg:col-span-4 flex flex-col gap-8">
           
           {/* QR Section */}
           <div className="bg-white p-8 rounded-[40px] border border-slate-200 flex flex-col items-center text-center gap-6 shadow-sm">
              <div className="relative">
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                  <QrCode className="w-32 h-32 text-slate-900" />
                </div>
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white p-2.5 rounded-2xl shadow-xl border-4 border-white">
                   <ScanLine className="w-5 h-5" />
                </div>
              </div>
              <div>
                 <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">Etiqueta Inteligente</h4>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Sincronizado con base de datos maestra</p>
              </div>
              <div className="grid grid-cols-2 gap-3 w-full">
                 <button className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2">
                    <Printer className="w-3.5 h-3.5" /> Imprimir
                 </button>
                 <button className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2">
                    <Download className="w-3.5 h-3.5" /> Exportar
                 </button>
              </div>
              <button className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-orange-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                 <Settings2 className="w-4 h-4" /> Reasignar TAG (RESERVED)
              </button>
           </div>

           {/* Quick Actions */}
           <div className="bg-slate-900 p-8 rounded-[40px] text-white space-y-6">
              <h3 className="text-xs font-black uppercase tracking-widest opacity-60">Operaciones Rápidas</h3>
              <div className="flex flex-col gap-3">
                 <button 
                  onClick={() => setShowTicketForm(true)}
                  className="w-full py-4 bg-white/10 hover:bg-white/20 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2 border border-white/10"
                 >
                    <PenTool className="w-4 h-4" /> Abrir Ticket de Falla
                 </button>
                 <button 
                  onClick={() => setShowMantenimientoForm(true)}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2 border border-blue-500"
                 >
                    <Wrench className="w-4 h-4" /> Registrar Mantenimiento
                 </button>
                 <button className="w-full py-4 bg-red-500/20 hover:bg-red-500/40 text-red-400 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2 border border-red-500/20">
                    <Trash2 className="w-4 h-4" /> Revertir Último Cambio
                 </button>
              </div>
           </div>

           {/* Technicians */}
           <div className="bg-white p-8 rounded-[40px] border border-slate-200 space-y-6">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Técnicos Asignados</h3>
              <div className="space-y-4">
                 {equipo.tecnicos.map(t => (
                   <div key={t} className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                         {t.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="text-xs font-black text-slate-900 uppercase tracking-tight">{t}</div>
                   </div>
                 ))}
                 <button className="w-full py-3 bg-slate-50 text-slate-400 hover:text-blue-600 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all">
                    Gestionar Técnicos
                 </button>
              </div>
           </div>

        </div>
      </div>
      {showTicketForm && (
        <TicketForm 
          onClose={() => setShowTicketForm(false)} 
          equipoTag={equipo.tag}
        />
      )}
      {showMantenimientoForm && (
        <NuevoMantenimientoModal
          onClose={() => {
            setShowMantenimientoForm(false);
          }}
          equipoTag={equipo.tag}
        />
      )}
    </div>
  );
}

function ParamRow({ label, value, field, onChange, editable }: { label: string, value: string, field: string, onChange: (f: string, v: string) => void, editable?: boolean }) {
  return (
    <div className="flex flex-col gap-1 group text-left">
       <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{label}</span>
       {editable ? (
         <input 
           type="text" 
           value={value || ''}
           onChange={(e) => onChange(field, e.target.value)}
           className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-xs font-bold uppercase transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none w-full"
         />
       ) : (
         <p className="text-sm font-black text-slate-700 tracking-tight uppercase group-hover:text-slate-900 transition-colors uppercase">{value || 'S/I'}</p>
       )}
    </div>
  );
}

function DocumentCard({ type, title, date }: { type: 'pdf' | 'html', title: string, date: string }) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 hover:border-slate-300 hover:shadow-lg transition-all cursor-pointer group">
       <div className="flex justify-between items-start mb-4">
          <div className={`p-3 rounded-xl ${type === 'pdf' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
             <FileText className="w-6 h-6" />
          </div>
          <button className="p-2 hover:bg-slate-50 rounded-lg text-slate-300 hover:text-slate-900"><MoreVertical className="w-4 h-4" /></button>
       </div>
       <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight mb-1 line-clamp-1">{title}</h4>
       <div className="flex justify-between items-center mt-4">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">SUBIDO: {date}</span>
          <button className="p-2 bg-slate-50 text-slate-400 rounded-lg opacity-0 group-hover:opacity-100 transition-all"><ExternalLink className="w-3.5 h-3.5" /></button>
       </div>
    </div>
  );
}

const mockChartData = [
  { name: 'ENE', costo: 400, incidencias: 2 },
  { name: 'FEB', costo: 300, incidencias: 1 },
  { name: 'MAR', costo: 600, incidencias: 4 },
  { name: 'ABR', costo: 200, incidencias: 0 },
  { name: 'MAY', costo: 450, incidencias: 2 },
  { name: 'JUN', costo: 380, incidencias: 1 },
  { name: 'JUL', costo: 520, incidencias: 3 },
  { name: 'AGO', costo: 290, incidencias: 1 },
  { name: 'SEP', costo: 180, incidencias: 0 },
  { name: 'OCT', costo: 600, incidencias: 5 },
  { name: 'NOV', costo: 410, incidencias: 2 },
  { name: 'DIC', costo: 330, incidencias: 1 },
];
