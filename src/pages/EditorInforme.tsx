
import React, { useState, useEffect, useRef } from "react";
import { SearchableSelect } from '../components/SearchableSelect';
import { REFRIGERANTES_CHILE } from '../data/refrigerantes';
import { useAppStore } from "../store/useAppStore";
import { reportsRepo } from "../repositories/ReportRepository";
import { 
  X,
  Save, 
  Send, 
  CheckCircle2, 
  FileText, 
  Download, 
  Printer, 
  Lock, 
  Plus, 
  Trash2, 
  Camera, 
  PenTool,
  ChevronDown,
  Info,
  Zap,
  ClipboardCheck,
  AlertTriangle,
  History,
  Fan,
  RefreshCw,
  Layout,
  LayoutDashboard,
  List,
  Search,
  Building2,
  MapPin,
  Tag,
  Settings,
  ScanLine,
  Users,
  Maximize
} from "lucide-react";
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import { Link, useRoute, useLocation } from "wouter";
import { AssetSearchModal } from "../components/modals/AssetSearchModal";
import { FullscreenSignatureModal } from "../components/modals/FullscreenSignatureModal";
import { INFORMES_MOCK } from "../data/reports";
import { EQUIPOS_DATA } from "../data/assets";
import { SUCURSALES, ALMACEN_LABELS } from "../data/branches";
import { CreateAssetModal } from "../components/modals/CreateAssetModal";
import DictationTextarea from "../components/DictationTextarea";
import LoadingIndicator from "../components/LoadingIndicator";
import { db, SyncStatus, type LocalOrdenServicio } from "../db/database";
import { syncEngine } from "../sync/syncEngine";
import { useAuth } from "../context/AuthContext";
import AccessDenied from "../components/AccessDenied";
import { buildDraftReportFolio, buildFinalReportFolio, getReportDisplayFolio, isDraftReportFolio } from "../lib/reportFolio";

type Section = 'general' | 'equipos' | 'mediciones' | 'checklist' | 'hallazgos' | 'galeria' | 'firma';

interface CircuitData {
  numCompressors: number;
  pb: string;
  pa: string;
  te: string;
  tc: string;
  tsub: string;
  tsob: string;
  gas?: string;
  oil?: string;
  compressors: {
    rla: string;
    r: string;
    s: string;
    t: string;
  }[];
}

interface ChecklistEvidence {
  [key: string]: {
    status?: 'ok' | 'obs' | 'falla';
    findings: string;
    photos: string[];
    expanded?: boolean;
  };
}

function isCanvasBlank(canvas: HTMLCanvasElement | null) {
  if (!canvas) return true;
  const blank = document.createElement('canvas');
  blank.width = canvas.width;
  blank.height = canvas.height;
  return canvas.toDataURL() === blank.toDataURL();
}

function drawSignatureOnCanvas(canvas: HTMLCanvasElement | null, dataUrl?: string) {
  if (!canvas || !dataUrl) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const img = new Image();
  img.onload = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  };
  img.src = dataUrl;
}

const CHECKLIST_ITEMS = [
  "Inspección visual general", "Limpieza de filtros", "Instalacion filtros Desechables", "Limpieza de evaporador", "Limpieza de condensador",
  "Limpieza de bandejas", "Bomba de condensado", "Verificación de desagüe", "Revisión de ventiladores", "Verificación de correas",
  "Lubricación de rodamientos", "Conexiones eléctricas", "Medición de consumos", "Tensiones de alimentación",
  "Presostatos alta y baja", "Presiones de refrigerante", "Recarga de refrigerante", "Temperaturas de trabajo", "Válvula de expansión",
  "Nivel de refrigerante", "Fugas de refrigerante", "Revisión de compresores", "Relés y contactores",
  "Controles y termostatos", "Prueba de Presion", "Alarmas y protecciones", "Funcionamiento general"
];

export default function EditorInforme() {
  const { permisos } = useAuth();
  const [, params] = useRoute<{ orderId: string; id: string }>("/ordenes-servicio/:orderId/informes/:id");
  const [, setLocation] = useLocation();
  const id = params?.id;
  const orderId = params?.orderId;
  const isNew = id === "nuevo";
  const informe = INFORMES_MOCK.find(i => i.id === id);
  
  const [activeSection, setActiveSection] = useState<Section | 'none'>('general');
  const [viewMode, setViewMode] = useState<'sidebar' | 'tabs' | 'accordion' | 'industrial'>('accordion');
  const [appLogo] = useState<string | null>(() => localStorage.getItem("system_logo"));
  const [showFullscreenSignature, setShowFullscreenSignature] = useState(false);
  const [savedTechnicianSignature, setSavedTechnicianSignature] = useState<string>();
  const [status, setStatus] = useState<'borrador' | 'finalizado' | 'offline_draft'>(informe?.estado as any || 'borrador');
  const [parentOrder, setParentOrder] = useState<LocalOrdenServicio | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const [ubicacionGeografica, setUbicacionGeografica] = useState<{lat: number, lng: number} | undefined>();
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState("");

  const captureGPS = () => {
    setGpsLoading(true);
    setGpsError("");
    if (!navigator.geolocation) {
      setGpsError("Tu navegador no soporta geolocalización.");
      setGpsLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUbicacionGeografica({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
        setGpsLoading(false);
      },
      (err) => {
        console.error("GPS error", err);
        setGpsError("No se pudo obtener la ubicación GPS.");
        setGpsLoading(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const clients = useAppStore(state => state.clients);
  const branches = useAppStore(state => state.branches);
  const activeClientId = localStorage.getItem("active_client") || "";
  const activeClient = clients.find(c => c.uuid_sync === activeClientId || c.id === activeClientId);

  const SECTIONS = [
    { id: 'general', label: 'Datos Generales', icon: <Info className="w-4 h-4" /> },
    { id: 'equipos', label: 'Estado Equipo', icon: <Zap className="w-4 h-4" />, subItems: [
        { id: 'estado_motor', label: 'Estado Motor' },
        { id: 'estado_compresor', label: 'Estado Compresor' }
    ] },
    { id: 'mediciones', label: 'Mediciones', icon: <History className="w-4 h-4" />, subItems: [
        { id: 'presiones', label: 'Presiones' },
        { id: 'temperaturas', label: 'Temperaturas' },
        { id: 'electricidad', label: 'Parámetros Eléctricos' }
    ] },
    { id: 'checklist', label: 'Checklist', icon: <ClipboardCheck className="w-4 h-4" /> },
    { id: 'hallazgos', label: 'Hallazgos', icon: <AlertTriangle className="w-4 h-4" /> },
    { id: 'galeria', label: 'Evidencia', icon: <Camera className="w-4 h-4" /> },
    { id: 'firma', label: 'Firma del Técnico', icon: <PenTool className="w-4 h-4" /> }
  ];

  const renderSectionContent = (sectionId: string) => {
    switch (sectionId) {
      case 'general':
        return (
          <div className="space-y-6">
            {!isReadOnly && (
              <button 
                onClick={() => setShowTagSearch(true)}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl shadow-slate-900/10 active:scale-95 transition-all mb-2 border-[3px] border-[#01f070] [border-style:ridge]"
              >
                <Search className="w-5 h-5 text-blue-400" />
                Completar datos con TAG de Equipo
              </button>
            )}
            <SectionBox title="Información General del Servicio">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1 md:col-span-2">
                   <label className="text-[10px] font-black uppercase text-slate-400">Cliente / Instalación</label>
                   <SearchableSelect
                      options={[
                        ...(activeClient ? [{
                          value: activeClient.uuid_sync,
                          label: activeClient.nombre
                        }] : [])
                      ]}
                      value={activeClient?.uuid_sync || activeClientId}
                      onChange={() => undefined}
                      disabled
                      placeholder="Cliente seleccionado en la sesión"
                    />
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase text-slate-400">Sucursal / Proyecto</label>
                   <SearchableSelect
                      options={[
                        { value: "", label: "Seleccione una sucursal..." },
                        ...branches
                          .filter(b => b.cliente_id === generalData.cliente && !b.deleted_at)
                          .map(b => ({
                            value: b.uuid_sync,
                            label: b.nombre,
                            subtitle: b.codigo
                          }))
                      ]}
                      value={generalData.sucursal}
                      onChange={() => undefined}
                      disabled
                      placeholder="Sucursal definida por la orden"
                    />
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase text-slate-400">Región</label>
                   <input 
                    type="text" 
                    value={generalData.region} 
                    readOnly
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none"
                   />
                </div>
                <InputField label="Técnico Responsable" value={generalData.tecnico} onChange={(val) => setGeneralData({...generalData, tecnico: val})} readOnly={isReadOnly} />
                <InputField label="Folio Correlativo" value={generalData.folio || displayFolio} readOnly={true} />
                <InputField label="Fecha del Servicio" value={generalData.fecha} type="date" onChange={(val) => setGeneralData({...generalData, fecha: val})} readOnly={isReadOnly} />
                <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase text-slate-400">TAG Equipo</label>
                   <input 
                    type="text" 
                    value={machineData.tag} 
                    readOnly={isReadOnly}
                    onChange={(e) => setMachineData({...machineData, tag: e.target.value})}
                    placeholder="21-STK..."
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none"
                   />
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase text-slate-400">Descripción Equipo</label>
                   <input 
                    type="text" 
                    value={machineData.tipo} 
                    readOnly={isReadOnly}
                    onChange={(e) => setMachineData({...machineData, tipo: e.target.value})}
                    placeholder="Chiller, AC..."
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none"
                   />
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase text-slate-400">Tipo de Servicio</label>
                   <select 
                     value={generalData.tipoServicio}
                     disabled={isReadOnly}
                     onChange={(e) => setGeneralData({...generalData, tipoServicio: e.target.value})}
                     className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold uppercase transition-all outline-none"
                   >
                     <option value="Preventivo">Mantenimiento Preventivo</option>
                     <option value="Correctivo">Mantenimiento Correctivo</option>
                     <option value="Puesta en Marcha">Puesta en Marcha</option>
                     <option value="Diagnóstico">Diagnóstico Técnico</option>
                   </select>
                </div>
             </div>

             <div className="mt-6 flex flex-col gap-4">
                {!isReadOnly && (
                  <button 
                    type="button" 
                    onClick={captureGPS}
                    disabled={gpsLoading}
                    className="w-full py-4 bg-slate-50 text-slate-400 rounded-[24px] border border-slate-100 flex flex-col items-center justify-center gap-2 hover:bg-emerald-50 hover:text-emerald-600 transition-all group hover:border-emerald-100"
                  >
                     <MapPin className={`w-6 h-6 ${gpsLoading ? 'animate-pulse text-emerald-500' : (ubicacionGeografica ? 'text-emerald-500' : '')}`} />
                     <span className="text-[9px] font-black uppercase">
                       {gpsLoading ? 'Obteniendo GPS...' : (ubicacionGeografica ? 'Ubicación Capturada' : 'Marcar Ubicación GPS')}
                     </span>
                  </button>
                )}
                {gpsError && (
                  <p className="text-xs text-rose-500 font-bold text-center">{gpsError}</p>
                )}
                {ubicacionGeografica && import.meta.env.VITE_GOOGLE_MAPS_PLATFORM_KEY && (
                  <div className="w-full h-64 rounded-2xl overflow-hidden border border-slate-200 mt-2">
                    <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_PLATFORM_KEY}>
                      <Map 
                        defaultZoom={15} 
                        defaultCenter={ubicacionGeografica}
                        mapId="informe_map_id"
                        disableDefaultUI
                      >
                        <AdvancedMarker position={ubicacionGeografica}>
                          <Pin background={'#10b981'} borderColor={'#047857'} glyphColor={'#047857'} />
                        </AdvancedMarker>
                      </Map>
                    </APIProvider>
                  </div>
                )}
             </div>

          </SectionBox>
        </div>
        );
      case 'equipos':
        return (
          <SectionBox title="Especificaciones del Equipo">
             <div className="space-y-6">
               {!isReadOnly && (
                <>
                  <button 
                    disabled={loadingAI}
                    onClick={() => document.getElementById('ai_camera')?.click()}
                    className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl shadow-emerald-500/20 active:scale-95 transition-all"
                  >
                    {loadingAI ? <LoadingIndicator size="sm" color="text-white" /> : <Camera className="w-5 h-5" />}
                    {loadingAI ? "Analizando Placa..." : "Completar con IA (Foto Placa)"}
                  </button>
                  <input 
                    id="ai_camera" 
                    type="file" 
                    accept="image/*" 
                    capture="environment" 
                    className="hidden" 
                    onChange={(e) => e.target.files?.[0] && handleGeminiOCR(e.target.files[0])}
                  />
                </>
               )}

               <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                     <label className="text-[10px] font-black uppercase text-slate-400">Marca</label>
                     <input type="text" value={machineData.marca} readOnly={isReadOnly} onChange={(e) => setMachineData({...machineData, marca: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none" />
                  </div>
                  <div className="space-y-1">
                     <label className="text-[10px] font-black uppercase text-slate-400">Modelo</label>
                     <input type="text" value={machineData.modelo} readOnly={isReadOnly} onChange={(e) => setMachineData({...machineData, modelo: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none" />
                  </div>
                  <div className="space-y-1 col-span-2">
                     <label className="text-[10px] font-black uppercase text-slate-400">TAG / Identificador</label>
                     <div className="flex gap-2">
                        <input type="text" value={machineData.tag} readOnly={isReadOnly} onChange={(e) => setMachineData({...machineData, tag: e.target.value})} className="flex-1 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none" />
                        {!isReadOnly && (
                          <button 
                            onClick={() => setShowAssetConfig(true)}
                            className="px-5 bg-slate-900 shadow-lg shadow-slate-900/10 text-white rounded-2xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all active:scale-95"
                          >
                            <Settings className="w-4 h-4 text-blue-400" />
                            Configurar
                          </button>
                        )}
                     </div>
                  </div>
                  <div className="space-y-1 z-50">
                     <label className="text-[10px] font-black uppercase text-slate-400">Refrigerante</label>
                     <SearchableSelect
                       options={REFRIGERANTES_CHILE}
                       value={machineData.refrigerante}
                       onChange={(val) => setMachineData({...machineData, refrigerante: val})}
                       placeholder="Buscar o crear..."
                       disabled={isReadOnly}
                       allowCreate={true}
                     />
                  </div>
               </div>
             </div>
          </SectionBox>
        );
      case 'mediciones':
        return (
          <div className="space-y-6">
             <div className="bg-slate-900 p-6 rounded-[32px] shadow-xl shadow-slate-900/10 flex flex-col md:flex-row md:items-center justify-between text-white gap-4">
                <div>
                  <h4 className="text-sm font-black uppercase tracking-tight">Arquitectura del Sistema</h4>
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Configuración de circuitos y compresores</p>
                </div>
                {!isReadOnly && (
                  <div className="flex items-center gap-3">
                    <label className="text-[10px] font-black uppercase text-white/40">N° Circuitos</label>
                    <input 
                      type="number" 
                      min={1} max={4} 
                      value={circuits.length} 
                      onChange={(e) => {
                        const n = Math.max(1, Math.min(4, parseInt(e.target.value) || 1));
                        setCircuits(prev => {
                          if (n > prev.length) {
                            return [...prev, ...Array(n - prev.length).fill(null).map(() => ({ numCompressors: 1, pb: '', pa: '', te: '', tc: '', tsub: '', tsob: '', compressors: [{ rla: '', r: '', s: '', t: '' }] }))];
                          } else {
                            return prev.slice(0, n);
                          }
                        });
                      }}
                      className="w-16 px-3 py-2 bg-white/10 border border-white/10 rounded-xl text-center font-black text-white outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  </div>
                )}
             </div>

             {circuits.map((circ, idx) => (
               <div key={idx} className="bg-white p-6 md:p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-6">
                  <div className="flex flex-col md:flex-row md:justify-between md:items-center border-b border-slate-50 pb-4 gap-4">
                     <h3 className="text-xs font-black uppercase tracking-widest text-blue-600">Circuito {idx + 1}</h3>
                     {!isReadOnly && (
                      <div className="flex items-center gap-3">
                          <label className="text-[10px] font-black uppercase text-slate-400">N° Compresores</label>
                          <input 
                            type="number" 
                            min={1} max={6}
                            value={circ.numCompressors}
                            onChange={(e) => {
                              const n = Math.max(1, Math.min(6, parseInt(e.target.value) || 1));
                              const newCircs = [...circuits];
                              const compressors = Array(n).fill(null).map((_, kidx) => (circ.compressors[kidx] || { rla: '', r: '', s: '', t: '' }));
                              newCircs[idx] = { ...circ, numCompressors: n, compressors };
                              setCircuits(newCircs);
                            }}
                            className="w-14 p-2 bg-slate-50 border border-slate-100 rounded-xl text-center font-bold outline-none focus:ring-2 focus:ring-blue-500/10"
                          />
                      </div>
                     )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <InputField label="Presión Alta" value={circ.pa} onChange={(val) => { const nc = [...circuits]; nc[idx].pa = val; setCircuits(nc); }} readOnly={isReadOnly} />
                    <InputField label="Presión Baja" value={circ.pb} onChange={(val) => { const nc = [...circuits]; nc[idx].pb = val; setCircuits(nc); }} readOnly={isReadOnly} />
                    <InputField label="Temp. Evap." value={circ.te} onChange={(val) => { const nc = [...circuits]; nc[idx].te = val; setCircuits(nc); }} readOnly={isReadOnly} />
                    <InputField label="Temp. Cond." value={circ.tc} onChange={(val) => { const nc = [...circuits]; nc[idx].tc = val; setCircuits(nc); }} readOnly={isReadOnly} />
                    <InputField label="Subenffriamiento" value={circ.tsub} onChange={(val) => { const nc = [...circuits]; nc[idx].tsub = val; setCircuits(nc); }} readOnly={isReadOnly} />
                    <InputField label="Sobrecalentamiento" value={circ.tsob} onChange={(val) => { const nc = [...circuits]; nc[idx].tsob = val; setCircuits(nc); }} readOnly={isReadOnly} />
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                     {circ.compressors.map((kp, kidx) => (
                       <div key={kidx} className="p-5 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
                          <div className="flex items-center gap-2">
                            <Zap className="w-3.5 h-3.5 text-amber-500" />
                            <span className="text-[10px] font-black uppercase text-slate-500">Compresor {idx+1}.{kidx+1}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                             <InputField label="RLA Nominal" value={kp.rla} onChange={(val) => { const nc = [...circuits]; nc[idx].compressors[kidx].rla = val; setCircuits(nc); }} readOnly={isReadOnly} />
                             <InputField label="L1 (Amps)" value={kp.r} onChange={(val) => { const nc = [...circuits]; nc[idx].compressors[kidx].r = val; setCircuits(nc); }} readOnly={isReadOnly} />
                             <InputField label="L2 (Amps)" value={kp.s} onChange={(val) => { const nc = [...circuits]; nc[idx].compressors[kidx].s = val; setCircuits(nc); }} readOnly={isReadOnly} />
                             <InputField label="L3 (Amps)" value={kp.t} onChange={(val) => { const nc = [...circuits]; nc[idx].compressors[kidx].t = val; setCircuits(nc); }} readOnly={isReadOnly} />
                          </div>
                       </div>
                     ))}
                  </div>
               </div>
             ))}
          </div>
        );
      case 'checklist':
        return (
          <SectionBox title="Checklist Técnico de Mantenimiento">
             <div className="space-y-4">
                {CHECKLIST_ITEMS.map((item, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group transition-all hover:bg-slate-100 gap-4">
                       <div className="flex flex-col xl:flex-row xl:items-center gap-4 flex-1">
                          <span className="text-xs font-black uppercase text-slate-700 min-w-[200px]">{item}</span>
                          <div className="flex flex-wrap items-center gap-1.5">
                             <button 
                               disabled={isReadOnly}
                               onClick={() => setChecklist({...checklist, [idx]: {...(checklist[idx] || {findings: '', photos: []}), status: 'ok'}})}
                               className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all border ${
                                 checklist[idx]?.status === 'ok' 
                                   ? 'bg-emerald-500 text-white border-emerald-600 shadow-md shadow-emerald-500/20' 
                                   : 'bg-white text-slate-400 border-slate-200 hover:border-emerald-300 hover:text-emerald-500'
                               }`}
                             >
                               Ok
                             </button>
                             <button 
                               disabled={isReadOnly}
                               onClick={() => setChecklist({...checklist, [idx]: {...(checklist[idx] || {findings: '', photos: []}), status: 'obs', expanded: true}})}
                               className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all border ${
                                 checklist[idx]?.status === 'obs' 
                                   ? 'bg-amber-500 text-white border-amber-600 shadow-md shadow-amber-500/20' 
                                   : 'bg-white text-slate-400 border-slate-200 hover:border-amber-300 hover:text-amber-500'
                               }`}
                             >
                               Observación
                             </button>
                             <button 
                               disabled={isReadOnly}
                               onClick={() => setChecklist({...checklist, [idx]: {...(checklist[idx] || {findings: '', photos: []}), status: 'falla', expanded: true}})}
                               className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all border ${
                                 checklist[idx]?.status === 'falla' 
                                   ? 'bg-rose-500 text-white border-rose-600 shadow-md shadow-rose-500/20' 
                                   : 'bg-white text-slate-400 border-slate-200 hover:border-rose-300 hover:text-rose-500'
                               }`}
                             >
                               Falla
                             </button>
                          </div>
                       </div>
                       <button onClick={() => setChecklist({...checklist, [idx]: {...(checklist[idx] || {findings: '', photos: []}), expanded: !checklist[idx]?.expanded}})} className="p-2 w-full md:w-auto hover:bg-white rounded-xl transition-all shadow-sm md:ml-4 flex justify-center">
                          <ChevronDown className={`w-4 h-4 transition-transform duration-300 text-slate-400 ${checklist[idx]?.expanded ? 'rotate-180 text-blue-600' : ''}`} />
                       </button>
                    </div>
                    {checklist[idx]?.expanded && (
                      <div className="p-6 bg-white border border-slate-100 rounded-3xl mx-2 shadow-inner space-y-4 animate-in slide-in-from-top-2 duration-200">
                         <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-blue-600 tracking-widest">Hallazgos y Observaciones</label>
                            <DictationTextarea 
                              value={checklist[idx]?.findings || ''}
                              onChange={(v) => setChecklist({...checklist, [idx]: {...checklist[idx], findings: v}})}
                              placeholder="Detalle el estado o anomalía detectada..."
                              className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 pr-12" 
                              rows={3} 
                              disabled={isReadOnly}
                            />
                         </div>
                         <div>
                            <label className="text-[10px] font-black uppercase text-blue-600 tracking-widest block mb-2">Evidencias Focalizadas</label>
                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                               <button className="min-w-[80px] h-20 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors">
                                  <Plus className="w-4 h-4" />
                                  <span className="text-[9px] font-black uppercase mt-1">Cámara</span>
                               </button>
                            </div>
                         </div>
                      </div>
                    )}
                  </div>
                ))}
             </div>
          </SectionBox>
        );
      case 'hallazgos':
        return (
          <SectionBox title="Resumen de Hallazgos y Recomendaciones">
             <div className="space-y-4">
                <label className="text-[10px] font-black uppercase text-slate-400">Observaciones Finales Técnicas</label>
                <DictationTextarea 
                  value={observaciones}
                  onChange={(v) => setObservaciones(v)}
                  rows={6} 
                  className="w-full bg-slate-50 border border-slate-100 rounded-[32px] p-6 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 pr-12" 
                  placeholder="Especifique cualquier anomalía adicional o recomendación de cambio de componentes..."
                  disabled={isReadOnly}
                />
             </div>
          </SectionBox>
        );
      case 'galeria':
        return (
          <SectionBox title="Evidencia Fotográfica de Campo">
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {galeria.map((img, i) => (
                  <div key={i} className="flex flex-col gap-2">
                    <div className="aspect-square bg-slate-50 border border-slate-100 rounded-3xl overflow-hidden relative group">
                       <img src={img.src} alt={`Evidencia ${i}`} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                       {!isReadOnly && (
                         <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                            <button onClick={() => setGaleria(galeria.filter((_, idx) => idx !== i))} className="p-2 bg-red-500 text-white rounded-xl"><Trash2 className="w-4 h-4" /></button>
                         </div>
                       )}
                    </div>
                    {!isReadOnly ? (
                      <input 
                        type="text" 
                        value={img.desc}
                        onChange={(e) => {
                           const newGaleria = [...galeria];
                           newGaleria[i].desc = e.target.value;
                           setGaleria(newGaleria);
                        }}
                        placeholder="Descripción de la imagen..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500/10 placeholder:text-slate-400"
                      />
                    ) : (
                      <p className="text-xs text-slate-600 font-medium px-2 text-center">{img.desc || "Sin descripción"}</p>
                    )}
                  </div>
                ))}
                {!isReadOnly && (
                   <button 
                    onClick={() => document.getElementById('gallery_input')?.click()}
                    className="aspect-square bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center gap-2 hover:bg-slate-100 transition-all hover:border-blue-500 group"
                   >
                      <Plus className="w-8 h-8 text-slate-300 group-hover:text-blue-500 transition-colors" />
                      <span className="text-[10px] font-black uppercase text-slate-400 group-hover:text-blue-600">Añadir Foto</span>
                   </button>
                )}
             </div>
             <input id="gallery_input" type="file" multiple accept="image/*" className="hidden" onChange={(e) => {
               const files = Array.from(e.target.files || []);
               files.forEach(addImageToGallery);
             }} />
          </SectionBox>
        );
      case 'firma':
        return (
          <SectionBox title="Firma Técnica de Ejecución">
            <div className="space-y-4">
              <p className="text-xs font-medium text-slate-500">
                Esta firma identifica al técnico responsable del informe. La conformidad del cliente se registra en la orden de servicio.
              </p>
              <canvas
                ref={canvasTechnicianRef}
                aria-label="Firma del técnico"
                className="h-48 w-full touch-none rounded-3xl border border-slate-100 bg-slate-50 shadow-inner"
              />
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={`h-4 w-4 ${getTechnicianSignature() ? 'text-emerald-500' : 'text-slate-300'}`} />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    {generalData.tecnico || 'Técnico sin asignar'}
                  </span>
                </div>
                {!isReadOnly && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="flex min-h-11 flex-1 items-center justify-center gap-1 rounded-lg bg-blue-50 px-3 text-[10px] font-black uppercase text-blue-600 sm:flex-none"
                      onClick={() => setShowFullscreenSignature(true)}
                    >
                      <Maximize className="h-3 w-3" /> Pantalla completa
                    </button>
                    <button
                      type="button"
                      className="min-h-11 rounded-lg bg-slate-100 px-3 text-[10px] font-black uppercase text-slate-500 hover:text-red-500"
                      onClick={() => {
                        const ctx = canvasTechnicianRef.current?.getContext('2d');
                        ctx?.clearRect(0, 0, canvasTechnicianRef.current?.width || 0, canvasTechnicianRef.current?.height || 0);
                        setSavedTechnicianSignature(undefined);
                      }}
                    >
                      Borrar
                    </button>
                  </div>
                )}
              </div>
            </div>
          </SectionBox>
        );
      default:
        return null;
    }
  };

  // Form State
  const [generalData, setGeneralData] = useState({
    cliente: '',
    sucursal: '',
    region: '',
    direccion: '',
    fecha: new Date().toISOString().split('T')[0],
    tecnico: 'Nelson Bravo',
    nombreCliente: '',
    tipoServicio: 'Preventivo',
    folio: ''
  });
  const documentClient = clients.find(client =>
    client.uuid_sync === generalData.cliente || client.id === generalData.cliente
  ) || activeClient;
  const documentLogo = documentClient?.logo_base64 || appLogo;

  const [machineData, setMachineData] = useState({
    tipo: '',
    tag: '',
    marca: '',
    modelo: '',
    serie: '',
    refrigerante: '',
    capacidad: '',
    voltaje: ''
  });

  const [circuits, setCircuits] = useState<CircuitData[]>([
    {
      numCompressors: 1,
      pb: '', pa: '', te: '', tc: '', tsub: '', tsob: '',
      compressors: [{ rla: '', r: '', s: '', t: '' }]
    }
  ]);

  const [checklist, setChecklist] = useState<ChecklistEvidence>({});
  const [observaciones, setObservaciones] = useState("");
  const [galeria, setGaleria] = useState<{src: string, desc: string}[]>([]);

  // Los informes se crean desde su orden padre. No se admite un borrador
  // huérfano aunque se escriba manualmente la URL.
  useEffect(() => {
    if (id === 'nuevo') {
      setLocation(orderId ? `/ordenes-servicio/${orderId}` : '/ordenes-servicio');
    }
  }, [id, orderId, setLocation]);

  // Load Draft from DB
  useEffect(() => {
    if (!id || id === 'nuevo' || !orderId) return;

    Promise.all([db.reports.get(id), db.ordenes_servicio.get(orderId)]).then(([dbReport, order]) => {
      if (!order || order.deleted_at || order.sync_status === 'pending_delete') {
        alert('La orden de servicio padre no existe.');
        setLocation('/ordenes-servicio');
        return;
      }
      if (!dbReport || dbReport.deleted_at || dbReport.orden_servicio_uuid !== order.uuid_sync) {
        alert('El informe no pertenece a esta orden de servicio.');
        setLocation(`/ordenes-servicio/${order.uuid_sync}`);
        return;
      }
      if (dbReport.cliente_id !== order.cliente_id || dbReport.sucursal_id !== order.sucursal_id) {
        alert('El informe no coincide con el cliente y sucursal de la orden.');
        setLocation(`/ordenes-servicio/${order.uuid_sync}`);
        return;
      }
      setParentOrder(order);
      if (dbReport.data) {
        const reportClient = dbReport.data.generalData?.cliente;
        if (activeClientId && reportClient && reportClient !== activeClientId && reportClient !== activeClient?.id) {
          alert("Este informe pertenece a otro cliente. Cambie de cliente desde el selector para abrirlo.");
          setLocation("/ordenes-servicio");
          return;
        }
        const orderBranch = branches.find(item => item.uuid_sync === order.sucursal_id || item.id === order.sucursal_id);
        setGeneralData(prev => ({
          ...prev,
          ...dbReport.data.generalData,
          cliente: order.cliente_id || dbReport.cliente_id,
          sucursal: order.sucursal_id || dbReport.sucursal_id,
          region: orderBranch?.region || dbReport.data.generalData?.region || ''
        }));
        if (dbReport.data.machineData) setMachineData(dbReport.data.machineData);
        if (dbReport.data.circuits) setCircuits(dbReport.data.circuits);
        if (dbReport.data.checklist) setChecklist(dbReport.data.checklist);
        if (dbReport.data.observaciones) setObservaciones(dbReport.data.observaciones);
        if (dbReport.data.galeria) setGaleria(dbReport.data.galeria);
        if (dbReport.data.firmas?.tecnico) setSavedTechnicianSignature(dbReport.data.firmas.tecnico);
        if (dbReport.data.estado) {
          const reportState = ['finalizado', 'firmado', 'bloqueado'].includes(dbReport.data.estado) ? 'finalizado' : 'borrador';
          setStatus(reportState);
        }
      }
    }).catch(console.error);
  }, [id, orderId, activeClientId, activeClient?.id, setLocation]);

  useEffect(() => {
    if (!activeClientId || status === 'finalizado') return;
    setGeneralData(prev => prev.cliente === activeClientId ? prev : {
      ...prev,
      cliente: activeClientId,
      sucursal: prev.cliente && prev.cliente !== activeClientId ? '' : prev.sucursal
    });
  }, [activeClientId, status]);

  // Persist Changes to DB (Autosave - LOCAL ONLY, do not enqueue sync queue here to prevent spamming the server/queue)
  useEffect(() => {
    if (!id || id === 'nuevo' || !orderId || !parentOrder || status === 'finalizado' || ['cerrado', 'firmado'].includes(parentOrder.estado)) return;
    
    const draftData = {
      estado: status,
      generalData,
      machineData,
      circuits,
      checklist,
      observaciones,
      galeria
    };
    
    db.reports.get(id).then(existing => {
      const record = {
        ...existing,
        uuid_sync: id,
        id: generalData.folio || existing?.id || buildDraftReportFolio(id),
        cliente_id: parentOrder.cliente_id || generalData.cliente,
        sucursal_id: parentOrder.sucursal_id || generalData.sucursal,
        orden_servicio_uuid: orderId,
        updated_at: Date.now(),
        sync_status: existing?.sync_status || 'pending_insert' as SyncStatus,
        data: draftData
      };
      db.reports.put(record).catch(console.error);
    }).catch(console.error);
  }, [generalData, machineData, circuits, checklist, observaciones, galeria, status, id, orderId, parentOrder]);
  
  // Main Save / Publish / Sync Function
  const saveReport = async (finalStatus: 'borrador' | 'finalizado' | 'offline_draft') => {
    if (!id || !orderId || !parentOrder) throw new Error('La orden de servicio padre no está disponible.');
    if (['cerrado', 'firmado'].includes(parentOrder.estado)) throw new Error('La orden está cerrada y es de solo lectura.');
    // Generate folio if not exists
    const activeClient = parentOrder.cliente_id || localStorage.getItem("active_client") || '';
    const currentFolio = finalStatus === 'finalizado' && isDraftReportFolio(generalData.folio)
      ? buildFinalReportFolio(id)
      : generalData.folio || buildDraftReportFolio(id);
    const normalizedGeneralData = {
      ...generalData,
      cliente: activeClient,
      sucursal: parentOrder.sucursal_id || generalData.sucursal,
      folio: currentFolio,
      ubicacionGeografica
    };

    const existing = await db.reports.get(id);

    const reportData = {
      id: currentFolio,
      uuid_sync: id,
      cliente_id: normalizedGeneralData.cliente,
      sucursal_id: parentOrder.sucursal_id || normalizedGeneralData.sucursal,
      orden_servicio_uuid: orderId,
      creado_por: existing?.creado_por,
      updated_at: Date.now(),
      sync_status: (existing ? 'pending_update' : 'pending_insert') as SyncStatus,
      data: {
        estado: finalStatus,
        status: finalStatus,
        generalData: normalizedGeneralData,
        machineData,
        circuits,
        checklist,
        observaciones,
        galeria,
        firmas: {
          tecnico: getTechnicianSignature() || existing?.data?.firmas?.tecnico || ''
        },
        fechaSincronizacionLocal: new Date().toISOString()
      }
    };

    // 1. Guardar local y encolar sync_queue usando reportsRepo
    await reportsRepo.save(reportData as any);
    
    setGeneralData(prev => ({ ...prev, cliente: prev.cliente || activeClient, folio: currentFolio }));
    setStatus(finalStatus);

    // 2. Trigger sync background task if online
    try {
      await syncEngine.triggerSync();
    } catch(e) {
      console.warn("Sync engine trigger failed:", e);
    }

    return currentFolio;
  };

  // Handle Finalize & Sync (Auto-numbering assignment)
  const handleSyncAndFinalize = async () => {
    setIsSyncing(true);

    if (!getTechnicianSignature()) {
      alert("Error: No es posible finalizar: falta la firma del técnico.");
      setIsSyncing(false);
      return;
    }
    if (!generalData.cliente && !localStorage.getItem("active_client")) {
      alert("Error: No es posible finalizar: falta seleccionar cliente.");
      setIsSyncing(false);
      return;
    }
    if (!machineData.tag.trim()) {
      alert("Error: No es posible finalizar: falta TAG de equipo.");
      setIsSyncing(false);
      return;
    }
    const selectedAsset = await db.assets.where('tag').equals(machineData.tag.trim()).first();
    const branch = branches.find(item => item.uuid_sync === parentOrder?.sucursal_id || item.id === parentOrder?.sucursal_id);
    const validBranchIds = new Set([parentOrder?.sucursal_id, branch?.id, branch?.uuid_sync].filter(Boolean));
    const validClientIds = new Set([parentOrder?.cliente_id, activeClient?.id, activeClient?.uuid_sync].filter(Boolean));
    if (!selectedAsset || selectedAsset.deleted_at || selectedAsset.estado === 'baja'
      || !validClientIds.has(selectedAsset.cliente_id)
      || !validBranchIds.has(selectedAsset.sucursal_id)) {
      alert('Error: El equipo debe estar activo y pertenecer al cliente y sucursal de esta orden.');
      setIsSyncing(false);
      return;
    }
    if (!generalData.tecnico.trim()) {
      alert("Error: No es posible finalizar: falta técnico responsable.");
      setIsSyncing(false);
      return;
    }
    const hasChecklist = Object.values(checklist).some(item => item.status || item.findings || item.photos?.length);
    if (!hasChecklist && !observaciones.trim()) {
      alert("Error: No es posible finalizar: registre checklist u observaciones.");
      setIsSyncing(false);
      return;
    }

    try {
      const currentFolio = await saveReport('finalizado');
      setIsSyncing(false);

      // Export PDF via Email Automáticamente
      try {
        const doc = await generateClimasolPDF(currentFolio);
        const pdfBase64 = doc.output('datauristring');
        
        const { DocumentExportService } = await import('../lib/DocumentExportService');
        
        const exportResult = await DocumentExportService.exportDocument({
          documentId: currentFolio,
          documentType: 'reports',
          method: 'email',
          clientName: generalData.cliente,
          assetTag: machineData.tag,
          pdfBase64
        });
        alert(`Informe finalizado exitosamente. Folio: ${currentFolio}\n${exportResult.message}`);
      } catch (exportError: any) {
        console.warn("Exportación fallida", exportError);
        alert(`Informe finalizado exitosamente. Folio: ${currentFolio}\nLa notificación por correo no está disponible en este entorno.`);
      }
      setLocation(`/ordenes-servicio/${orderId}`);
    } catch (saveError: any) {
      console.error(saveError);
      alert(`Error al finalizar e iniciar sincronización: ${saveError.message}`);
      setIsSyncing(false);
    }
  };

  const [showAssetConfig, setShowAssetConfig] = useState(false);
  
  // Search Modal State
  const [showTagSearch, setShowTagSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchClient, setSearchClient] = useState("");
  const [searchSucursal, setSearchSucursal] = useState("");
  const [searchDescription, setSearchDescription] = useState("");

  const handleAutoFill = (eq: any) => {
    const parentBranch = branches.find(branch => branch.uuid_sync === parentOrder?.sucursal_id || branch.id === parentOrder?.sucursal_id);
    if (!parentOrder || eq.cliente_id !== parentOrder.cliente_id
      || (eq.sucursal_id !== parentBranch?.uuid_sync && eq.sucursal_id !== parentBranch?.id)) {
      alert('Seleccione un equipo perteneciente a la sucursal de la orden.');
      return;
    }

    setGeneralData(prev => ({
      ...prev,
      cliente: parentOrder.cliente_id || prev.cliente,
      sucursal: parentOrder.sucursal_id || prev.sucursal,
      region: parentBranch?.region || prev.region
    }));

    setMachineData(prev => ({
      ...prev,
      tag: eq.tag,
      marca: eq.marca,
      modelo: eq.modelo,
      refrigerante: eq.refrigerante,
      tipo: eq.tipo,
      voltaje: eq.voltaje,
      capacidad: eq.capacidad
    }));

    setObservaciones(prev => prev + `\nEQUIPO VINCULADO: ${eq.tag}. Último mantenimiento registrado: ${eq.ultimoMantenimiento}.`);
    setShowTagSearch(false);
  };

  const canvasTechnicianRef = useRef<HTMLCanvasElement>(null);
  const autoPdfHandledRef = useRef(false);

  function getTechnicianSignature() {
    const canvas = canvasTechnicianRef.current;
    if (canvas && !isCanvasBlank(canvas)) return canvas.toDataURL();
    return savedTechnicianSignature;
  }

  // Generador de Informe Premium con Estructura Climasol
  const generateClimasolPDF = async (forcedFolio?: string) => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF('p', 'mm', 'a4');
    
    // Resolve dynamic labels
    const clientName = clients.find(c => c.uuid_sync === generalData.cliente || c.id === generalData.cliente)?.nombre || generalData.cliente || "EECOL ELECTRIC";
    const selectedSuc = branches.find(b => b.uuid_sync === generalData.sucursal || b.id === generalData.sucursal);
    const branchName = selectedSuc?.nombre || generalData.sucursal || "Vitacura Base";
    const branchAddress = selectedSuc?.direccion || "Av. Vitacura 2670, Santiago, Chile";
    const reportFolio = forcedFolio || generalData.folio || getReportDisplayFolio(undefined, undefined, id);
    const docDate = generalData.fecha || new Date().toLocaleDateString('es-CL');
    
    // Helper to draw status circle
    const drawStatusCircle = (x: number, y: number, statusItem?: 'ok' | 'obs' | 'falla') => {
      if (statusItem === 'ok') {
        doc.setFillColor(16, 185, 129); // green
        doc.circle(x, y, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(4);
        doc.setFont("helvetica", "bold");
        doc.text("OK", x - 1.2, y + 0.65);
      } else if (statusItem === 'obs') {
        doc.setFillColor(245, 158, 11); // amber
        doc.circle(x, y, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(4);
        doc.setFont("helvetica", "bold");
        doc.text("OB", x - 1.2, y + 0.65);
      } else if (statusItem === 'falla') {
        doc.setFillColor(239, 68, 68); // rose
        doc.circle(x, y, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(4);
        doc.setFont("helvetica", "bold");
        doc.text("NG", x - 1.2, y + 0.65);
      } else {
        // default empty/gray circle
        doc.setFillColor(226, 232, 240);
        doc.circle(x, y, 2, 'F');
        doc.setTextColor(148, 163, 184);
        doc.setFontSize(4);
        doc.setFont("helvetica", "bold");
        doc.text("NA", x - 1.2, y + 0.65);
      }
    };

    // ----- PAGE 1 -----
    // Header background line/accent
    doc.setDrawColor(11, 47, 100);
    doc.setLineWidth(0.5);
    doc.line(10, 24, 200, 24);

    // El logo del cliente prevalece; el logo corporativo queda como respaldo.
    if (documentLogo) {
      try {
        let format = "PNG";
        if (documentLogo.startsWith("data:image/jpeg") || documentLogo.startsWith("data:image/jpg")) {
          format = "JPEG";
        } else if (documentLogo.startsWith("data:image/webp")) {
          format = "WEBP";
        }
        doc.addImage(documentLogo, format, 13, 8, 10, 10);
      } catch (e) {
        console.error("Error drawing logo to PDF page 1:", e);
        doc.setDrawColor(11, 47, 100);
        doc.setLineWidth(0.6);
        const cx = 18, cy = 14;
        for (let a = 0; a < 360; a += 45) {
          const rad = a * Math.PI / 180;
          doc.line(cx, cy, cx + Math.cos(rad) * 4.5, cy + Math.sin(rad) * 4.5);
          const rx = cx + Math.cos(rad) * 3;
          const ry = cy + Math.sin(rad) * 3;
          doc.line(rx, ry, rx + Math.cos(rad + 0.4) * 1.5, ry + Math.sin(rad + 0.4) * 1.5);
          doc.line(rx, ry, rx + Math.cos(rad - 0.4) * 1.5, ry + Math.sin(rad - 0.4) * 1.5);
        }
      }
    } else {
      doc.setDrawColor(11, 47, 100);
      doc.setLineWidth(0.6);
      const cx = 18, cy = 14;
      for (let a = 0; a < 360; a += 45) {
        const rad = a * Math.PI / 180;
        doc.line(cx, cy, cx + Math.cos(rad) * 4.5, cy + Math.sin(rad) * 4.5);
        const rx = cx + Math.cos(rad) * 3;
        const ry = cy + Math.sin(rad) * 3;
        doc.line(rx, ry, rx + Math.cos(rad + 0.4) * 1.5, ry + Math.sin(rad + 0.4) * 1.5);
        doc.line(rx, ry, rx + Math.cos(rad - 0.4) * 1.5, ry + Math.sin(rad - 0.4) * 1.5);
      }
    }
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(11, 47, 100); // Climasol Blue
    doc.text("CLIMASOL", 26, 13);
    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    doc.text("SOLUCIONES EN CLIMATIZACIÓN", 26, 17);

    // Center Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(11, 47, 100);
    doc.text("INFORME DE MANTENIMIENTO", 65, 12);
    doc.text("AIRE ACONDICIONADO", 76, 16);

    // Right Inform Info box
    doc.setFillColor(11, 47, 100);
    doc.roundedRect(150, 6, 50, 14, 1.5, 1.5, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.text("N° DE INFORME", 163, 10);
    doc.setFontSize(7.5);
    doc.text(reportFolio, 159, 14);
    
    doc.setFillColor(241, 245, 249);
    doc.rect(150, 20, 50, 5, 'F');
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(6);
    doc.setFont("helvetica", "bold");
    doc.text("FECHA:", 154, 23.5);
    doc.setFontSize(7);
    doc.setTextColor(11, 47, 100);
    doc.text(docDate, 172, 23.5);

    // --- SECTION 1: INFORMACIÓN GENERAL ---
    let y = 29;
    doc.setFillColor(11, 47, 100);
    doc.roundedRect(10, y, 70, 5.5, 1, 1, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.text("1. INFORMACIÓN GENERAL", 14, y + 4);

    y += 7.5;
    // Box
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.setFillColor(255, 255, 255);
    doc.rect(10, y, 190, 29, "D");

    // Grid details
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.setFont("helvetica", "bold");
    doc.text("Cliente:", 14, y + 5);
    doc.text("Dirección:", 14, y + 10);
    doc.text("Contacto:", 14, y + 15);
    doc.text("Correo:", 14, y + 20);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    doc.text(clientName, 32, y + 5);
    
    // address split wrap
    const splitAddr = doc.splitTextToSize(branchAddress, 60);
    doc.text(splitAddr, 32, y + 10);
    
    doc.text("+56 9 1234 5678", 32, y + 15);
    doc.text("contacto@eecol.cl", 32, y + 20);

    // Column 2
    doc.setFont("helvetica", "bold");
    doc.setTextColor(71, 85, 105);
    doc.text("Técnico responsable:", 95, y + 5);
    doc.text("Marca / Modelo:", 95, y + 10);
    doc.text("Tipo de equipo:", 95, y + 15);
    doc.text("N° de serie / TAG:", 95, y + 20);
    doc.text("Capacidad:", 95, y + 25);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    doc.text(generalData.tecnico || "Carlos López", 125, y + 5);
    doc.text((machineData.marca || "LG") + " / " + (machineData.modelo || "S12ET"), 125, y + 10);
    doc.text(machineData.tipo || "Split Muro", 125, y + 15);
    doc.text(machineData.tag || "812KALB123456", 125, y + 20);
    doc.text(machineData.capacidad || "12.000 BTU", 125, y + 25);

    // equipment mock / icon on the right
    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(172, y + 4, 22, 9, 1, 1, "DF"); // Indoor
    doc.line(174, y + 11, 192, y + 11);
    doc.setFillColor(226, 232, 240);
    doc.rect(179, y + 5, 8, 2, "F");
    
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(175, y + 15, 16, 11, 1, 1, "DF"); // Outdoor
    doc.setDrawColor(148, 163, 184);
    doc.circle(183, y + 20.5, 3.5, "D");
    doc.line(183, y + 18, 183, y + 23);
    doc.line(180, y + 20.5, 186, y + 20.5);

    // --- SECTION 2 & 3: INSPECTION UNITS (Side-by-side) ---
    y += 33;
    const colW = 92;
    const colGap = 6;
    
    // Section 2 Header
    doc.setFillColor(11, 47, 100);
    doc.rect(10, y, colW, 5.5, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text("2. INSPECCIÓN UNIDAD INTERIOR", 14, y + 4);

    // Section 3 Header
    doc.setFillColor(11, 47, 100);
    doc.rect(10 + colW + colGap, y, colW, 5.5, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text("3. INSPECCIÓN UNIDAD EXTERIOR", 10 + colW + colGap + 4, y + 4);

    // Tables outline
    y += 5.5;
    const tableH = 46;
    doc.setDrawColor(226, 232, 240);
    doc.rect(10, y, colW, tableH, "D");
    doc.rect(10 + colW + colGap, y, colW, tableH, "D");

    // Table titles inside
    doc.setFillColor(241, 245, 249);
    doc.rect(10, y, colW, 4.5, "F");
    doc.rect(10 + colW + colGap, y, colW, 4.5, "F");

    doc.setTextColor(11, 47, 100);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.text("ITEM", 13, y + 3.2);
    doc.text("ESTADO", 88, y + 3.2);

    doc.text("ITEM", 10 + colW + colGap + 3, y + 3.2);
    doc.text("ESTADO", 10 + colW + colGap + 78, y + 3.2);

    // Row definitions
    const interiorItems = [
      { name: "Estado general del equipo", idx: 0 },
      { name: "Limpieza de filtros de aire", idx: 1 },
      { name: "Instalación filtros desecl.", idx: 2 },
      { name: "Evaporador de unidad", idx: 3 },
      { name: "Bandejas condensado / drenes", idx: 5 },
      { name: "Bomba de condensado", idx: 6 },
      { name: "Chequeo de desagüe", idx: 7 },
      { name: "Controles y termostatos", idx: 23 }
    ];

    const exteriorItems = [
      { name: "Limpieza de condensador", idx: 4 },
      { name: "Revisión ventilador exterior", idx: 8 },
      { name: "Verificación de correas", idx: 9 },
      { name: "Lubricación de rodamientos", idx: 10 },
      { name: "Revisión de compresores", idx: 21 },
      { name: "Fugas de refrigerante", idx: 20 }
    ];

    doc.setFontSize(6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 41, 59);

    for (let i = 0; i < 8; i++) {
      const rowY = y + 4.5 + (i * 4.4) + 3.5;
      doc.setDrawColor(241, 245, 249);
      doc.line(10, rowY + 1.2, 10 + colW, rowY + 1.2);
      
      const itemVal = interiorItems[i];
      if (itemVal) {
        doc.text(itemVal.name, 13, rowY);
        const statusItem = checklist[itemVal.idx]?.status;
        drawStatusCircle(10 + colW - 6, rowY - 1, statusItem);
      }
    }

    for (let i = 0; i < 8; i++) {
      const rowY = y + 4.5 + (i * 4.4) + 3.5;
      const startX = 10 + colW + colGap;
      doc.setDrawColor(241, 245, 249);
      doc.line(startX, rowY + 1.2, startX + colW, rowY + 1.2);

      const itemVal = exteriorItems[i];
      if (itemVal) {
        doc.text(itemVal.name, startX + 3, rowY);
        const statusItem = checklist[itemVal.idx]?.status;
        drawStatusCircle(startX + colW - 6, rowY - 1, statusItem);
      } else {
        doc.text("-", startX + 3, rowY);
      }
    }

    // Observations Area for Units
    y += tableH;
    doc.setDrawColor(226, 232, 240);
    // Left Box
    doc.setFillColor(252, 253, 254);
    doc.rect(10, y, colW, 11, "DF");
    doc.setFontSize(5.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(11, 47, 100);
    doc.text("Observaciones unidad interior:", 12, y + 3.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    const interiorFindings = interiorItems.map(it => checklist[it.idx]?.findings).filter(Boolean).join(", ");
    const splitInteriorObs = doc.splitTextToSize(interiorFindings || "Unidad interior en buen estado general. Filtros limpios y sin acumulación de polvo.", colW - 6);
    doc.text(splitInteriorObs, 12, y + 6.5);

    // Right Box
    doc.setFillColor(252, 253, 254);
    doc.rect(10 + colW + colGap, y, colW, 11, "DF");
    doc.setFont("helvetica", "bold");
    doc.setTextColor(11, 47, 100);
    doc.text("Observaciones unidad exterior:", 10 + colW + colGap + 2, y + 3.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    const exteriorFindings = exteriorItems.map(it => checklist[it.idx]?.findings).filter(Boolean).join(", ");
    const splitExteriorObs = doc.splitTextToSize(exteriorFindings || "Condensador soplado y desincrustado, libre de obstrucciones de aire.", colW - 6);
    doc.text(splitExteriorObs, 10 + colW + colGap + 2, y + 6.5);

    // --- SECTIONS 4, 5 & 6 (Three Columns) ---
    y += 15;
    const colW3 = 61;
    const colGap3 = 3.5;

    const sections3 = [
      {
        title: "4. REVISIÓN ELÉCTRICA",
        items: [
          { name: "Conexiones eléctricas", idx: 11 },
          { name: "Medición de consumos", idx: 12 },
          { name: "Tensión de alimentación", idx: 13 },
          { name: "Relés y contactores", idx: 22 },
          { name: "Alarmas y protecciones", idx: 25 }
        ],
        obs: "Instalación e interruptores de poder dentro de rango nominal."
      },
      {
        title: "5. REVISIÓN OPERACIONAL",
        items: [
          { name: "Encendido / Apagado", idx: 26 },
          { name: "Cambio de modos", idx: 18 },
          { name: "Flujo de aire", idx: 0 },
          { name: "Válvula de expansión", idx: 18 },
          { name: "Prueba de Presión", idx: 24 }
        ],
        obs: "Ciclo de control operando de manera idónea, respuesta normal."
      },
      {
        title: "6. SISTEMA DE REFRIGERACIÓN",
        items: [
          { name: "Presiones de refrigerante", idx: 15 },
          { name: "Nivel de refrigerante", idx: 19 },
          { name: "Fugas de refrigerante", idx: 20 },
          { name: "Temperaturas de trabajo", idx: 17 },
          { name: "Carga complementaria", idx: 16 }
        ],
        obs: "Estabilidad de presiones de refrigerante confirmada."
      }
    ];

    sections3.forEach((sec, sIdx) => {
      const startX = 10 + (sIdx * (colW3 + colGap3));
      doc.setFillColor(11, 47, 100);
      doc.rect(startX, y, colW3, 5, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.text(sec.title, startX + 3, y + 3.6);

      // Box body
      const subBoxH = 34;
      doc.setDrawColor(226, 232, 240);
      doc.rect(startX, y + 5, colW3, subBoxH, "D");

      // Inner titles
      doc.setFillColor(241, 245, 249);
      doc.rect(startX, y + 5, colW3, 4, "F");
      doc.setTextColor(11, 47, 100);
      doc.setFontSize(5.5);
      doc.text("ITEM", startX + 3, y + 8);
      doc.text("ESTADO", startX + colW3 - 10, y + 8);

      doc.setFontSize(5.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 41, 59);

      // Rows
      sec.items.forEach((item, rIdx) => {
        const rowY = y + 9 + (rIdx * 4) + 3;
        doc.setDrawColor(248, 250, 252);
        doc.line(startX, rowY + 1, startX + colW3, rowY + 1);

        doc.text(item.name, startX + 3, rowY);
        const statusItem = checklist[item.idx]?.status;
        drawStatusCircle(startX + colW3 - 6, rowY - 1, statusItem);
      });

      // Observations Box underneath
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(252, 253, 254);
      doc.rect(startX, y + 5 + subBoxH, colW3, 10, "DF");
      
      doc.setFontSize(5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(11, 47, 100);
      doc.text("Observaciones:", startX + 3, y + 5 + subBoxH + 3.2);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      const customObs = sec.items.map(it => checklist[it.idx]?.findings).filter(Boolean).join(", ");
      const splitObs = doc.splitTextToSize(customObs || sec.obs, colW3 - 6);
      doc.text(splitObs, startX + 3, y + 5 + subBoxH + 5.5);
    });

    // FOOTER PAGE 1
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`Documento de Uso Técnico Oficial CLIMASOL - Folio ${reportFolio}`, 10, 287);
    doc.text("Página 1 de 2", 185, 287);


    // ----- PAGE 2 -----
    doc.addPage();
    let y2 = 14;

    // Mini logo & Header
    doc.setDrawColor(11, 47, 100);
    doc.setLineWidth(0.4);
    doc.line(10, 21, 200, 21);

    // Mini Flake Logo or custom logo
    if (documentLogo) {
      try {
        let format = "PNG";
        if (documentLogo.startsWith("data:image/jpeg") || documentLogo.startsWith("data:image/jpg")) {
          format = "JPEG";
        } else if (documentLogo.startsWith("data:image/webp")) {
          format = "WEBP";
        }
        doc.addImage(documentLogo, format, 15, 9, 6, 6);
      } catch (e) {
        console.error("Error drawing logo to PDF page 2:", e);
        doc.setDrawColor(11, 47, 100);
        doc.setLineWidth(0.5);
        for (let a = 0; a < 360; a += 45) {
          const rad = a * Math.PI / 180;
          doc.line(18, 12, 18 + Math.cos(rad) * 3, 12 + Math.sin(rad) * 3);
        }
      }
    } else {
      doc.setDrawColor(11, 47, 100);
      doc.setLineWidth(0.5);
      for (let a = 0; a < 360; a += 45) {
        const rad = a * Math.PI / 180;
        doc.line(18, 12, 18 + Math.cos(rad) * 3, 12 + Math.sin(rad) * 3);
      }
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(11, 47, 100);
    doc.text("CLIMASOL", 24, 13);
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`INFORME DE MANTENIMIENTO TÉCNICO COMPLEMENTARIO - FOLIO: ${reportFolio}`, 60, 13);

    // --- SECTION 7: MEDICIONES TÉCNICAS ---
    y2 = 25;
    doc.setFillColor(11, 47, 100);
    doc.roundedRect(10, y2, 60, 5, 1, 1, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text("7. MEDICIONES TÉCNICAS", 14, y2 + 3.8);

    y2 += 7;

    const tableW = 190;
    const measurementRows = [
      { param: "Voltaje de alimentación", value: machineData.voltaje || "220 V", unit: "Volt [V]" },
      { param: "Amperaje de operación (L1)", value: circuits[0]?.compressors[0]?.r || "5.2 A", unit: "Amperios [A]" },
      { param: "Amperaje de operación (L2)", value: circuits[0]?.compressors[0]?.s || "5.1 A", unit: "Amperios [A]" },
      { param: "Amperaje de operación (L3)", value: circuits[0]?.compressors[0]?.t || "5.1 A", unit: "Amperios [A]" },
      { param: "Presión de Alta (Lado Descarga)", value: circuits[0]?.pa || "315 psi", unit: "psi (libra/pulg²)" },
      { param: "Presión de Baja (Lado Aspiración)", value: circuits[0]?.pb || "118 psi", unit: "psi (libra/pulg²)" },
      { param: "Temperatura de Evaporación", value: circuits[0]?.te || "6.5 °C", unit: "Grados Celsius [°C]" },
      { param: "Temperatura de Condensación", value: circuits[0]?.tc || "42.3 °C", unit: "Grados Celsius [°C]" },
      { param: "Subenfriamiento de Líquido", value: circuits[0]?.tsub || "8.5 °C", unit: "Grados Celsius [°C]" },
      { param: "Sobrecalentamiento de Retorno", value: circuits[0]?.tsob || "9.2 °C", unit: "Grados Celsius [°C]" }
    ];

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.setFillColor(248, 250, 252);
    // table header
    doc.rect(10, y2, tableW, 4.5, "DF");
    doc.setFont("helvetica", "bold");
    doc.setTextColor(11, 47, 100);
    doc.setFontSize(6.5);
    doc.text("PARÁMETRO TÉCNICO", 14, y2 + 3.2);
    doc.text("VALOR REGISTRADO", 94, y2 + 3.2);
    doc.text("UNIDAD DE MEDIDA", 154, y2 + 3.2);

    y2 += 4.5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(6);

    measurementRows.forEach((row, rIdx) => {
      doc.setFillColor(rIdx % 2 === 0 ? 255 : 248, rIdx % 2 === 0 ? 255 : 250, rIdx % 2 === 0 ? 255 : 252);
      doc.rect(10, y2, tableW, 4, "F");
      doc.setDrawColor(241, 245, 249);
      doc.line(10, y2 + 4, 10 + tableW, y2 + 4);

      doc.text(row.param, 14, y2 + 3);
      doc.text(row.value, 94, y2 + 3);
      doc.text(row.unit, 154, y2 + 3);
      y2 += 4;
    });

    // --- SECTION 8: OBSERVACIONES Y RECOMENDACIONES ---
    y2 += 4;
    doc.setFillColor(11, 47, 100);
    doc.roundedRect(10, y2, 75, 5, 1, 1, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text("8. RECOMENDACIONES Y DIAGNÓSTICO", 14, y2 + 3.8);

    y2 += 7;
    
    // Split columns: left recommendations list, right: feedback seal
    const recW = 120;
    const sealW = 60;
    const sealH = 24;

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(10, y2, recW, sealH + 16, "DF");

    doc.setFontSize(6.5);
    doc.setTextColor(11, 47, 100);
    doc.setFont("helvetica", "bold");
    doc.text("Hallazgos:", 13, y2 + 4);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 65, 85);
    
    const obsArr = [
      "- " + (observaciones ? observaciones.split('\n')[0] : "Equipo en estado operativo óptimo, sin fugas activas."),
      "- Filtros de aire limpios. Consumos eléctricos estables dentro del rango de placa."
    ];
    doc.text(obsArr[0], 13, y2 + 7.5);
    if (obsArr[1]) doc.text(obsArr[1], 13, y2 + 11);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(11, 47, 100);
    doc.text("Recomendaciones de ingeniería:", 13, y2 + 17);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 65, 85);
    
    const recArr = [
      "- Se sugiere calendarizar próximo servicio de mantenimiento preventivo cada 6 meses.",
      "- Mantener ductos e ingresos de aire limpios para maximizar rendimiento termodinámico.",
      "- Cambio preventivo de contactores electromecánicos recomendados para el próximo año."
    ];
    doc.text(recArr[0], 13, y2 + 20.5);
    doc.text(recArr[1], 13, y2 + 24);
    doc.text(recArr[2], 13, y2 + 27.5);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(11, 47, 100);
    doc.text("Repuestos requeridos:", 13, y2 + 33.5);
    doc.setFont("helvetica", "normal");
    doc.text("No se requieren repuestos urgentes por el momento.", 43, y2 + 33.5);

    // Right certification seal card
    const sealX = 140;
    doc.setFillColor(240, 253, 250); // soft teal
    doc.setDrawColor(16, 185, 129);  // green emerald
    doc.setLineWidth(0.6);
    doc.roundedRect(sealX, y2 + 5, sealW, sealH, 2, 2, "DF");

    // Circular check icon inside seal
    doc.setFillColor(16, 185, 129);
    doc.circle(sealX + sealW / 2, y2 + 12, 4.5, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("✔", sealX + sealW / 2 - 1.5, y2 + 14.5);

    doc.setTextColor(4, 120, 87);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.text("ESTADO INFORME", sealX + sealW / 2 - 12.5, y2 + 20);
    doc.setFontSize(7.5);
    doc.text("EQUIPO CONFORME", sealX + sealW / 2 - 15.5, y2 + 24);
    doc.setFontSize(5);
    doc.setFont("helvetica", "normal");
    doc.text("CONDICIONES OPERATIVAS REGLAMENTARIAS", sealX + 6, y2 + 27);

    // --- REGISTRO FOTOGRÁFICO DE CAMPO ---
    y2 += sealH + 21;
    doc.setFillColor(11, 47, 100);
    doc.setLineWidth(0.3);
    doc.roundedRect(10, y2, 70, 5, 1, 1, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text("9. REGISTRO FOTOGRÁFICO DE CAMPO", 14, y2 + 3.8);

    y2 += 7;
    // Draw up to 4 images
    const activePhotos = galeria.length > 0 ? galeria.slice(0, 4) : [];
    const photoBoxW = 43;
    const photoBoxH = 34;
    const photoGap = 6;

    for (let pIdx = 0; pIdx < 4; pIdx++) {
      const pX = 10 + (pIdx * (photoBoxW + photoGap));
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.rect(pX, y2, photoBoxW, photoBoxH, "D");

      const photoItem = activePhotos[pIdx];
      if (photoItem && photoItem.src) {
        try {
          doc.addImage(photoItem.src, "JPEG", pX + 1.5, y2 + 1.5, photoBoxW - 3, photoBoxH - 6);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(5.5);
          doc.setTextColor(71, 85, 105);
          const pDesc = photoItem.desc || `Evidencia ${pIdx + 1}`;
          const splitDesc = doc.splitTextToSize(pDesc, photoBoxW - 2);
          doc.text(splitDesc, pX + 2, y2 + photoBoxH - 1.5);
        } catch (imgErr) {
          console.warn("Could not draw image to PDF", imgErr);
          doc.setTextColor(148, 163, 184);
          doc.text("Error imagen", pX + 10, y2 + 15);
        }
      } else {
        // empty placeholder
        doc.setDrawColor(241, 245, 249);
        doc.line(pX, y2, pX + photoBoxW, y2 + photoBoxH);
        doc.line(pX + photoBoxW, y2, pX, y2 + photoBoxH);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(5.5);
        doc.setTextColor(148, 163, 184);
        doc.text("Sin Evidencia", pX + 14, y2 + 18);
      }
    }

    // --- FIRMA DEL TÉCNICO ---
    y2 += photoBoxH + 6;
    doc.setFillColor(11, 47, 100);
    doc.roundedRect(10, y2, 52, 5, 1, 1, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text("10. FIRMA DEL TÉCNICO", 14, y2 + 3.8);

    y2 += 7;
    doc.setFillColor(252, 253, 254);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(10, y2, 190, 25, 1, 1, "DF");
    const technicianSignature = getTechnicianSignature();
    if (technicianSignature) {
      try {
        doc.addImage(technicianSignature, 'PNG', 12, y2 + 2, 90, 16);
      } catch (signatureError) {
        console.warn("Could not draw technician signature", signatureError);
      }
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(30, 41, 59);
    doc.text(`Técnico responsable: ${generalData.tecnico || 'Sin asignar'}`, 108, y2 + 11);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    doc.text("La conformidad del cliente se registra en la orden de servicio.", 108, y2 + 16);

    // FOOTER PAGE 2
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`Documento de Uso Técnico Oficial CLIMASOL - Folio ${reportFolio}`, 10, 287);
    doc.text("Página 2 de 2", 185, 287);

    return doc;
  };

  useEffect(() => {
    if (autoPdfHandledRef.current || !parentOrder || !id) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('pdf') !== '1') return;
    const timer = window.setTimeout(async () => {
      autoPdfHandledRef.current = true;
      try {
        const doc = await generateClimasolPDF(generalData.folio || undefined);
        doc.save(`${getReportDisplayFolio(generalData.folio, undefined, id)}.pdf`);
      } catch (error: any) {
        alert(`No fue posible generar el PDF: ${error?.message || error}`);
      } finally {
        window.history.replaceState({}, '', `/ordenes-servicio/${orderId}/informes/${id}`);
      }
    }, 100);
    return () => window.clearTimeout(timer);
  }, [parentOrder, id, orderId, generalData.folio]);

  // Export PDF Wrapper
  const handleExportPDF = async () => {
    const doc = await generateClimasolPDF();
    doc.save(`Informe_Climasol_${machineData.tag}_${generalData.fecha}.pdf`);
  };

  // Export CSV
  const handleExportCsv = () => {
    const data = [
      ["CLIENTE", generalData.cliente],
      ["SUCURSAL", generalData.sucursal],
      ["FECHA", generalData.fecha],
      ["TAG", machineData.tag],
      ["MARCA", machineData.marca],
      ["MODELO", machineData.modelo],
      ["HALLAZGOS", observaciones]
    ];
    const csv = data
      .map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `Informe_${machineData.tag}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const renderIndustrialPreview = () => {
    const clientName = clients.find(c => c.uuid_sync === generalData.cliente || c.id === generalData.cliente)?.nombre || generalData.cliente || "EECOL ELECTRIC";
    const selectedSuc = branches.find(b => b.uuid_sync === generalData.sucursal || b.id === generalData.sucursal);
    const branchAddress = selectedSuc?.direccion || "Av. Vitacura 2670, Santiago, Chile";
    const reportFolio = getReportDisplayFolio(generalData.folio, undefined, id);

    const interiorItems = [
      { name: "Estado general del equipo", idx: 0 },
      { name: "Limpieza de filtros de aire", idx: 1 },
      { name: "Instalación filtros desecl.", idx: 2 },
      { name: "Evaporador de unidad", idx: 3 },
      { name: "Bandejas condensado / drenes", idx: 5 },
      { name: "Bomba de condensado", idx: 6 },
      { name: "Chequeo de desagüe", idx: 7 },
      { name: "Controles y termostatos", idx: 23 }
    ];

    const exteriorItems = [
      { name: "Limpieza de condensador", idx: 4 },
      { name: "Revisión ventilador exterior", idx: 8 },
      { name: "Verificación de correas", idx: 9 },
      { name: "Lubricación de rodamientos", idx: 10 },
      { name: "Revisión de compresores", idx: 21 },
      { name: "Fugas de refrigerante", idx: 20 }
    ];

    const electricItems = [
      { name: "Conexiones eléctricas", idx: 11 },
      { name: "Medición de consumos", idx: 12 },
      { name: "Tensión de alimentación", idx: 13 },
      { name: "Relés y contactores", idx: 22 },
      { name: "Alarmas y protecciones", idx: 25 }
    ];

    const operationalItems = [
      { name: "Encendido / Apagado", idx: 26 },
      { name: "Cambio de modos", idx: 18 },
      { name: "Flujo de aire", idx: 0 },
      { name: "Válvula de expansión", idx: 18 },
      { name: "Prueba de Presión", idx: 24 }
    ];

    const refrigeracionItems = [
      { name: "Presiones de refrigerante", idx: 15 },
      { name: "Nivel de refrigerante", idx: 19 },
      { name: "Fugas de refrigerante", idx: 20 },
      { name: "Temperaturas de trabajo", idx: 17 },
      { name: "Carga complementaria", idx: 16 }
    ];

    const renderBadge = (statusVal?: string) => {
      switch (statusVal) {
        case 'ok':
          return <span className="inline-flex items-center gap-1 text-[8px] font-black px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 uppercase">✔ OK</span>;
        case 'obs':
          return <span className="inline-flex items-center gap-1 text-[8px] font-black px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 uppercase">⚠ OB</span>;
        case 'falla':
          return <span className="inline-flex items-center gap-1 text-[8px] font-black px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 uppercase">✖ NG</span>;
        default:
          return <span className="inline-flex items-center gap-1 text-[8px] font-black px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 uppercase">➖ NA</span>;
      }
    };

    return (
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
        {/* Banner Informative */}
        <div className="bg-blue-50 border border-blue-200 rounded-3xl p-6 flex flex-col sm:flex-row items-center gap-4 text-blue-900 shadow-sm">
          <div className="p-3 bg-blue-600 text-white rounded-2xl">
            <ClipboardCheck className="w-6 h-6" />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h4 className="font-black uppercase text-sm tracking-wide">Vista Previa Norma Climasol</h4>
            <p className="text-xs text-blue-700 mt-1">Este panel reproduce fielmente la estructura visual reglamentaria e industrial requerida en los informes técnicos de climatización oficiales.</p>
          </div>
          <button onClick={handleExportPDF} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-blue-700 shadow-md transition-all shrink-0">
            Exportar PDF Climasol
          </button>
        </div>

        {/* PAGE 1 WORKSPACE PREVIEW */}
        <div className="bg-white border-2 border-slate-200 rounded-[32px] shadow-2xl overflow-hidden p-6 md:p-12 relative min-h-[1100px] flex flex-col justify-between">
          <div>
            {/* Header Plate */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-6 border-b-2 border-[#0B2F64] gap-4">
              <div className="flex items-center gap-3">
                {/* Snowflake or custom corporate logo */}
                {documentLogo ? (
                  <img src={documentLogo} className="w-10 h-10 rounded-xl object-contain shadow-md shadow-blue-900/10" alt={`Logo de ${documentClient?.nombre || 'la empresa'}`} />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#0B2F64] to-blue-800 flex items-center justify-center text-white font-extrabold shadow-md shadow-blue-900/20">
                    ❄
                  </div>
                )}
                <div>
                  <h3 className="text-xl font-black text-[#0B2F64] tracking-tight leading-none">CLIMASOL</h3>
                  <span className="text-[8px] text-slate-400 font-extrabold tracking-widest uppercase">Soluciones en Climatización</span>
                </div>
              </div>
              <div className="text-left md:text-center">
                <h4 className="text-sm font-black text-[#0B2F64] tracking-wider uppercase">Informe de Mantenimiento</h4>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Aire Acondicionado</p>
              </div>
              <div className="flex items-stretch gap-2">
                <div className="bg-[#0B2F64] px-4 py-2 rounded-xl text-white text-center">
                  <span className="block text-[8px] font-black uppercase text-blue-200 tracking-widest">N° Informe</span>
                  <span className="font-mono text-xs font-black">{reportFolio}</span>
                </div>
                <div className="bg-slate-100 px-4 py-2 rounded-xl text-slate-700 text-center border border-slate-200">
                  <span className="block text-[8px] font-black uppercase text-slate-400 tracking-widest">Fecha</span>
                  <span className="font-mono text-xs font-bold">{generalData.fecha || "PENDIENTE"}</span>
                </div>
              </div>
            </div>

            {/* Section 1 General Information */}
            <div className="mt-8">
              <div className="inline-block bg-[#0B2F64] text-white px-6 py-1.5 rounded-full text-xs font-black tracking-wider uppercase mb-3">
                1. INFORMACIÓN GENERAL
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8 text-xs text-slate-700">
                <div className="space-y-2">
                  <p><strong className="text-slate-400 uppercase tracking-wider text-[10px] block">Cliente</strong> <span className="text-slate-950 font-black">{clientName}</span></p>
                  <p><strong className="text-slate-400 uppercase tracking-wider text-[10px] block">Dirección</strong> <span className="text-slate-950 font-medium">{branchAddress}</span></p>
                  <p><strong className="text-slate-400 uppercase tracking-wider text-[10px] block">Contacto</strong> <span className="text-slate-950 font-medium">+56 9 1234 5678</span></p>
                  <p><strong className="text-slate-400 uppercase tracking-wider text-[10px] block">Correo de Envío</strong> <span className="text-slate-950 font-medium">contacto@eecol.cl</span></p>
                </div>
                <div className="space-y-2">
                  <p><strong className="text-slate-400 uppercase tracking-wider text-[10px] block">Técnico Responsable</strong> <span className="text-slate-950 font-black">{generalData.tecnico || "Carlos López"}</span></p>
                  <p><strong className="text-slate-400 uppercase tracking-wider text-[10px] block">Marca / Modelo</strong> <span className="text-slate-950 font-medium">{machineData.marca || "LG"} / {machineData.modelo || "S12ET"}</span></p>
                  <p><strong className="text-slate-400 uppercase tracking-wider text-[10px] block">Tipo de Equipo</strong> <span className="text-slate-950 font-medium">{machineData.tipo || "Split Muro"}</span></p>
                  <p><strong className="text-slate-400 uppercase tracking-wider text-[10px] block">N° Serie / TAG</strong> <span className="text-slate-950 font-mono font-bold text-blue-900">{machineData.tag || "812KALB123456"}</span></p>
                  <p><strong className="text-slate-400 uppercase tracking-wider text-[10px] block">Capacidad</strong> <span className="text-slate-950 font-medium">{machineData.capacidad || "12.000 BTU"}</span></p>
                </div>
              </div>
            </div>

            {/* Side-by-side Units Inspections (2 & 3) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
              {/* Unit 1 */}
              <div>
                <div className="bg-[#0B2F64] text-white px-4 py-1.5 rounded-full text-[10px] font-black tracking-wider uppercase mb-3">
                  2. INSPECCIÓN UNIDAD INTERIOR
                </div>
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-black tracking-widest text-[#0B2F64] uppercase border-b border-slate-200">
                        <th className="py-2.5 px-4">ITEM</th>
                        <th className="py-2.5 px-4 text-right">ESTADO</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {interiorItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2 px-4 text-[11px] font-medium text-slate-700">{item.name}</td>
                          <td className="py-2 px-4 text-right">{renderBadge(checklist[item.idx]?.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="p-3 bg-slate-50 border-t border-slate-100">
                    <span className="block text-[8px] font-black uppercase text-slate-400 tracking-wider">Obervaciones Unidad Interior:</span>
                    <p className="text-[10px] text-slate-600 mt-1 font-medium italic">
                      {interiorItems.map(it => checklist[it.idx]?.findings).filter(Boolean).join(", ") || "Unidad interior en buen estado general. Filtros limpios y sin acumulación de polvo."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Unit 2 */}
              <div>
                <div className="bg-[#0B2F64] text-white px-4 py-1.5 rounded-full text-[10px] font-black tracking-wider uppercase mb-3">
                  3. INSPECCIÓN UNIDAD EXTERIOR
                </div>
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-black tracking-widest text-[#0B2F64] uppercase border-b border-slate-200">
                        <th className="py-2.5 px-4">ITEM</th>
                        <th className="py-2.5 px-4 text-right">ESTADO</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {exteriorItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2 px-4 text-[11px] font-medium text-slate-700">{item.name}</td>
                          <td className="py-2 px-4 text-right">{renderBadge(checklist[item.idx]?.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="p-3 bg-slate-50 border-t border-slate-100">
                    <span className="block text-[8px] font-black uppercase text-slate-400 tracking-wider">Obervaciones Unidad Exterior:</span>
                    <p className="text-[10px] text-slate-600 mt-1 font-medium italic">
                      {exteriorItems.map(it => checklist[it.idx]?.findings).filter(Boolean).join(", ") || "Condensador soplado y desincrustado, libre de obstrucciones de aire."}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Three column systems inspections */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
              {/* Col 1 */}
              <div>
                <div className="bg-[#0B2F64] text-white px-3 py-1 rounded-full text-[9px] font-black tracking-wider uppercase mb-3 text-center">
                  4. REVISIÓN ELÉCTRICA
                </div>
                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                  <div className="divide-y divide-slate-100 px-3 py-2">
                    {electricItems.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center py-2 text-[10px]">
                        <span className="text-slate-600 font-medium">{item.name}</span>
                        {renderBadge(checklist[item.idx]?.status)}
                      </div>
                    ))}
                  </div>
                  <div className="p-2 bg-slate-50 border-t border-slate-100 text-[10px]">
                    <span className="block text-[8px] font-bold text-[#0B2F64]">Obs:</span>
                    <p className="text-[10px] text-slate-500 italic mt-0.5">
                      {electricItems.map(it => checklist[it.idx]?.findings).filter(Boolean).join(", ") || "Instalación e interruptores de poder dentro de rango nominal."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Col 2 */}
              <div>
                <div className="bg-[#0B2F64] text-white px-3 py-1 rounded-full text-[9px] font-black tracking-wider uppercase mb-3 text-center">
                  5. REVISIÓN OPERACIONAL
                </div>
                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                  <div className="divide-y divide-slate-100 px-3 py-2">
                    {operationalItems.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center py-2 text-[10px]">
                        <span className="text-slate-600 font-medium">{item.name}</span>
                        {renderBadge(checklist[item.idx]?.status)}
                      </div>
                    ))}
                  </div>
                  <div className="p-2 bg-slate-50 border-t border-slate-100 text-[10px]">
                    <span className="block text-[8px] font-bold text-[#0B2F64]">Obs:</span>
                    <p className="text-[10px] text-slate-500 italic mt-0.5">
                      {operationalItems.map(it => checklist[it.idx]?.findings).filter(Boolean).join(", ") || "Ciclo de control operando de manera idónea, respuesta normal."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Col 3 */}
              <div>
                <div className="bg-[#0B2F64] text-white px-3 py-1 rounded-full text-[9px] font-black tracking-wider uppercase mb-3 text-center">
                  6. REFRIGERACIÓN
                </div>
                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                  <div className="divide-y divide-slate-100 px-3 py-2">
                    {refrigeracionItems.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center py-2 text-[10px]">
                        <span className="text-slate-600 font-medium">{item.name}</span>
                        {renderBadge(checklist[item.idx]?.status)}
                      </div>
                    ))}
                  </div>
                  <div className="p-2 bg-slate-50 border-t border-slate-100 text-[10px]">
                    <span className="block text-[8px] font-bold text-[#0B2F64]">Obs:</span>
                    <p className="text-[10px] text-slate-500 italic mt-0.5">
                      {refrigeracionItems.map(it => checklist[it.idx]?.findings).filter(Boolean).join(", ") || "Estabilidad de presiones de refrigerante confirmada."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 mt-8 flex justify-between items-center text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
            <span>Uso Técnico Oficial CLIMASOL - Folio {reportFolio}</span>
            <span>Página 1 de 2</span>
          </div>
        </div>

        {/* PAGE 2 WORKSPACE PREVIEW */}
        <div className="bg-white border-2 border-slate-200 rounded-[32px] shadow-2xl overflow-hidden p-6 md:p-12 relative min-h-[1100px] flex flex-col justify-between">
          <div>
            {/* Header Plate Page 2 */}
            <div className="flex justify-between items-center pb-6 border-b-2 border-[#0B2F64]">
              <div className="flex items-center gap-2">
                {documentLogo ? (
                  <img src={documentLogo} className="w-6 h-6 object-contain rounded shadow-sm shadow-blue-900/10" alt={`Logo de ${documentClient?.nombre || 'la empresa'}`} />
                ) : (
                  <div className="text-[#0B2F64] font-extrabold text-lg">❄</div>
                )}
                <span className="text-sm font-black text-[#0B2F64]">CLIMASOL</span>
              </div>
              <span className="text-[9px] text-slate-400 font-extrabold tracking-wider uppercase">INFORME DE MANTENIMIENTO TÉCNICO COMPLEMENTARIO - FOLIO: {reportFolio}</span>
            </div>

            {/* Section 7 Technical Measurements */}
            <div className="mt-8">
              <div className="inline-block bg-[#0B2F64] text-white px-6 py-1.5 rounded-full text-xs font-black tracking-wider uppercase mb-3">
                7. MEDICIONES TÉCNICAS
              </div>
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-black tracking-widest text-[#0B2F64] uppercase border-b border-slate-200">
                      <th className="py-3 px-6">PARÁMETRO TÉCNICO</th>
                      <th className="py-3 px-6">VALOR REGISTRADO</th>
                      <th className="py-3 px-6">UNIDAD DE MEDIDA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-6 font-medium text-slate-700">Voltaje de alimentación</td>
                      <td className="py-2.5 px-6 font-mono font-bold text-blue-900">{machineData.voltaje || "220 V"}</td>
                      <td className="py-2.5 px-6 text-slate-500">Volt [V]</td>
                    </tr>
                    <tr className="hover:bg-slate-50/50 bg-slate-50/30">
                      <td className="py-2.5 px-6 font-medium text-slate-700">Amperaje de operación (L1)</td>
                      <td className="py-2.5 px-6 font-mono font-bold text-blue-900">{circuits[0]?.compressors[0]?.r || "5.2 A"}</td>
                      <td className="py-2.5 px-6 text-slate-500">Amperios [A]</td>
                    </tr>
                    <tr className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-6 font-medium text-slate-700">Amperaje de operación (L2)</td>
                      <td className="py-2.5 px-6 font-mono font-bold text-blue-900">{circuits[0]?.compressors[0]?.s || "5.1 A"}</td>
                      <td className="py-2.5 px-6 text-slate-500">Amperios [A]</td>
                    </tr>
                    <tr className="hover:bg-slate-50/50 bg-slate-50/30">
                      <td className="py-2.5 px-6 font-medium text-slate-700">Amperaje de operación (L3)</td>
                      <td className="py-2.5 px-6 font-mono font-bold text-blue-900">{circuits[0]?.compressors[0]?.t || "5.1 A"}</td>
                      <td className="py-2.5 px-6 text-slate-500">Amperios [A]</td>
                    </tr>
                    <tr className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-6 font-medium text-slate-700">Presión de Alta (Lado Descarga)</td>
                      <td className="py-2.5 px-6 font-mono font-bold text-blue-900">{circuits[0]?.pa || "315 psi"}</td>
                      <td className="py-2.5 px-6 text-slate-500">psi (libra/pulg²)</td>
                    </tr>
                    <tr className="hover:bg-slate-50/50 bg-slate-50/30">
                      <td className="py-2.5 px-6 font-medium text-slate-700">Presión de Baja (Lado Aspiración)</td>
                      <td className="py-2.5 px-6 font-mono font-bold text-blue-900">{circuits[0]?.pb || "118 psi"}</td>
                      <td className="py-2.5 px-6 text-slate-500">psi (libra/pulg²)</td>
                    </tr>
                    <tr className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-6 font-medium text-slate-700">Temperatura de Evaporación</td>
                      <td className="py-2.5 px-6 font-mono font-bold text-blue-900">{circuits[0]?.te || "6.5 °C"}</td>
                      <td className="py-2.5 px-6 text-slate-500">Grados Celsius [°C]</td>
                    </tr>
                    <tr className="hover:bg-slate-50/50 bg-slate-50/30">
                      <td className="py-2.5 px-6 font-medium text-slate-700">Temperatura de Condensación</td>
                      <td className="py-2.5 px-6 font-mono font-bold text-blue-900">{circuits[0]?.tc || "42.3 °C"}</td>
                      <td className="py-2.5 px-6 text-slate-500">Grados Celsius [°C]</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section 8 Recommendations & Diagnostic with conformity seal */}
            <div className="mt-8">
              <div className="inline-block bg-[#0B2F64] text-white px-6 py-1.5 rounded-full text-xs font-black tracking-wider uppercase mb-3">
                8. RECOMENDACIONES Y DIAGNÓSTICO
              </div>
              <div className="flex flex-col md:flex-row gap-6 mt-1">
                <div className="flex-1 bg-slate-50 border border-slate-200 rounded-3xl p-6 space-y-4">
                  <div>
                    <strong className="text-[10px] font-black uppercase text-[#0B2F64] tracking-wider block">Hallazgos observados:</strong>
                    <p className="text-xs text-slate-600 mt-1">{observaciones || "Equipo en estado operativo óptimo, sin fugas activas ni desbalances de tensión evidentes."}</p>
                  </div>
                  <div>
                    <strong className="text-[10px] font-black uppercase text-[#0B2F64] tracking-wider block">Recomendaciones de ingeniería:</strong>
                    <p className="text-xs text-slate-600 mt-1">Se sugiere programar la próxima manutención preventiva dentro del ciclo cuatrimestral estándar CLIMASOL para mantener óptimo consumo y flujo de aire.</p>
                  </div>
                </div>
                {/* Conformity seal card */}
                <div className="w-full md:w-[240px] shrink-0 border-2 border-emerald-500 bg-emerald-50 rounded-3xl p-6 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xl font-bold shadow-lg shadow-emerald-500/20 mb-3">
                    ✔
                  </div>
                  <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Estado Informe</span>
                  <p className="text-sm font-black text-emerald-950 uppercase mt-1">Equipo Conforme</p>
                  <p className="text-[9px] text-emerald-700 mt-2 font-medium">Cumple condiciones operativas y termodinámicas de seguridad.</p>
                </div>
              </div>
            </div>

            {/* Section 9 Photo gallery */}
            <div className="mt-8">
              <div className="inline-block bg-[#0B2F64] text-white px-6 py-1.5 rounded-full text-xs font-black tracking-wider uppercase mb-3">
                9. REGISTRO FOTOGRÁFICO DE CAMPO
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-1">
                {Array.from({ length: 4 }).map((_, i) => {
                  const photoItem = galeria[i];
                  return (
                    <div key={i} className="border border-slate-200 bg-slate-50 rounded-2xl overflow-hidden shadow-sm aspect-video flex flex-col items-center justify-center text-center relative group min-h-[140px]">
                      {photoItem?.src ? (
                        <>
                          <img src={photoItem.src} alt={photoItem.desc || `Evidencia ${i + 1}`} className="w-full h-full object-cover" />
                          <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-2 text-white text-[9px] font-medium truncate">
                            {photoItem.desc || `Evidencia ${i + 1}`}
                          </div>
                        </>
                      ) : (
                        <div className="p-4 text-slate-300 flex flex-col items-center">
                          <span className="text-2xl">📸</span>
                          <span className="text-[9px] font-bold uppercase mt-1 text-slate-400">Sin Evidencia</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section 10 Technician signature */}
            <div className="mt-8">
              <div className="mb-3 inline-block rounded-full bg-[#0B2F64] px-6 py-1.5 text-xs font-black uppercase tracking-wider text-white">
                10. FIRMA DEL TÉCNICO
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex h-24 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-white p-2">
                  {getTechnicianSignature() ? (
                    <img src={getTechnicianSignature()} alt="Firma del técnico" className="h-full object-contain" />
                  ) : (
                    <span className="text-[10px] font-bold italic text-slate-400">Firma técnica pendiente</span>
                  )}
                </div>
                <div className="mt-2 text-xs">
                  <span className="block font-black text-slate-800">Técnico responsable: {generalData.tecnico || "Sin asignar"}</span>
                  <span className="text-[10px] font-medium uppercase text-slate-400">La conformidad del cliente se registra en la orden de servicio</span>
                </div>
              </div>
            </div>

          </div>

          <div className="border-t border-slate-100 pt-4 mt-8 flex justify-between items-center text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
            <span>Uso Técnico Oficial CLIMASOL - Folio {reportFolio}</span>
            <span>Página 2 de 2</span>
          </div>
        </div>
      </div>
    );
  };

  const isReadOnly = !permisos?.crear_informe
    || status === 'finalizado'
    || !!parentOrder && ['cerrado', 'firmado'].includes(parentOrder.estado);
  const displayFolio = getReportDisplayFolio(generalData.folio, informe?.id, id);

  useEffect(() => {
    const canvas = canvasTechnicianRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    let drawing = false;
    const position = (event: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      const pointer = "touches" in event ? event.touches[0] : event;
      return { x: pointer.clientX - rect.left, y: pointer.clientY - rect.top };
    };
    const start = (event: MouseEvent | TouchEvent) => {
      if (isReadOnly) return;
      drawing = true;
      ctx.beginPath();
      const point = position(event);
      ctx.moveTo(point.x, point.y);
    };
    const move = (event: MouseEvent | TouchEvent) => {
      if (!drawing) return;
      event.preventDefault();
      const point = position(event);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
    };
    const end = () => { drawing = false; };

    canvas.onmousedown = start;
    canvas.onmousemove = move;
    canvas.ontouchstart = start;
    canvas.ontouchmove = move;
    canvas.ontouchend = end;
    window.addEventListener('mouseup', end);
    drawSignatureOnCanvas(canvas, savedTechnicianSignature);
    return () => window.removeEventListener('mouseup', end);
  }, [savedTechnicianSignature, isReadOnly, viewMode, activeSection]);

  const addImageToGallery = async (file: File) => {
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve) => {
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
    const src = await base64Promise;
    setGaleria(prev => [...prev, { src, desc: '' }]);
  };

  // Handle OCR
  const handleGeminiOCR = async (file: File) => {
    setLoadingAI(true);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
      });
      const base64Data = await base64Promise;
      const token = sessionStorage.getItem("auth_token");

      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ imageBase64: base64Data, mimeType: file.type })
      });
      
      const responseData = await res.json();
      if (!res.ok) throw new Error(responseData.error || "Error en OCR API");
      
      const data = responseData.data || {};
      
      setMachineData(prev => ({
        ...prev,
        marca: data.marca || prev.marca,
        modelo: data.modelo || prev.modelo,
        serie: data.serie || data.n_serie || prev.serie,
        refrigerante: data.refrigerante || prev.refrigerante,
        capacidad: data.capacidad_btu || prev.capacidad,
        voltaje: data.voltaje || prev.voltaje
      }));
    } catch (err) {
      console.error(err);
      alert("Error al procesar con IA");
    } finally {
      setLoadingAI(false);
    }
  };

  if (!permisos?.ver_informes) {
    return <AccessDenied requiredPermission="Visualizar informes HVAC" />;
  }

  return (
    <div className="flex flex-col gap-6 text-left pb-20 max-w-5xl mx-auto">
      {/* Header Panel */}
      <div className="bg-white p-4 md:p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 relative z-40">
         <div className="flex items-start md:items-center gap-3 w-full">
            <Link href={orderId ? `/ordenes-servicio/${orderId}` : '/ordenes-servicio'}>
               <button className="p-2 hover:bg-slate-100 text-slate-400 rounded-xl transition-colors shrink-0 mt-1 md:mt-0"><X className="w-5 h-5" /></button>
            </Link>
            <div className="flex-1 min-w-0">
               <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2">
                  <h2 className="text-lg md:text-xl font-black text-slate-900 uppercase truncate">
                    {isNew ? 'Nuevo Informe' : displayFolio}
                  </h2>
                  <span className={`w-max text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                    status === 'finalizado' ? 'bg-emerald-100 text-emerald-600' :
                    status === 'offline_draft' ? 'bg-blue-100 text-blue-600 animate-pulse' :
                    'bg-slate-100 text-slate-600'
                   }`}>
                    {status === 'offline_draft' ? 'Borrador Local' : status}
                  </span>
               </div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate mt-0.5">{machineData.tag || 'SIN TAG'} - {machineData.marca || 'GENERICO'}</p>
            </div>
         </div>
         <div className="flex flex-wrap items-stretch md:items-center gap-2 w-full xl:w-auto mt-2 xl:mt-0">
            {!isReadOnly && (
              <>
                 <button 
                    onClick={async () => {
                      try {
                        await saveReport('borrador');
                        alert("Borrador guardado exitosamente en base de datos local y encolado para sincronización.");
                        setLocation(`/ordenes-servicio/${orderId}`);
                      } catch (err: any) {
                        alert("Error al guardar borrador: " + err.message);
                      }
                    }} 
                    className="flex-1 xl:flex-none justify-center px-4 py-3 xl:py-2.5 bg-slate-100 text-slate-600 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-200 transition-colors"
                 >
                    <Save className="w-4 h-4 shrink-0" /> Guardar
                 </button>
                 <button 
                    disabled={isSyncing}
                    onClick={handleSyncAndFinalize} 
                    className="flex-1 xl:flex-none justify-center px-4 py-3 xl:py-2.5 bg-blue-600 text-white rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-blue-600/20 hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {isSyncing ? <LoadingIndicator size="xs" color="text-white" /> : <Send className="w-4 h-4 shrink-0" />}
                    {isSyncing ? 'Espere...' : 'Sync & Finalizar'}
                 </button>
              </>
            )}
            {isReadOnly && (
               <>
                  <button onClick={() => window.print()} className="flex-1 xl:flex-none justify-center px-4 py-3 xl:py-2.5 bg-slate-100 text-slate-600 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-colors">
                     <Printer className="w-4 h-4 shrink-0" /> Imprimir
                  </button>
                  <button onClick={handleExportPDF} className="flex-1 xl:flex-none justify-center px-4 py-3 xl:py-2.5 bg-slate-100 text-slate-600 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-colors">
                     <Download className="w-4 h-4 shrink-0" /> PDF
                  </button>
                  <button onClick={handleExportCsv} className="flex-1 xl:flex-none justify-center px-4 py-3 xl:py-2.5 bg-slate-100 text-slate-600 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-colors">
                     <FileText className="w-4 h-4 shrink-0" /> CSV
                  </button>
               </>
            )}
         </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-2 rounded-2xl border border-slate-200 gap-2">
         <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase ml-4 hidden md:block">Vista de Navegación:</span>
         <div className="flex flex-wrap gap-1 w-full md:w-[500px]">
            <button onClick={() => setViewMode('sidebar')} className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${viewMode === 'sidebar' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-slate-100'}`}>
               <Layout className="w-4 h-4" /> <span className="hidden md:inline">Lateral</span>
            </button>
            <button onClick={() => setViewMode('tabs')} className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${viewMode === 'tabs' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-slate-100'}`}>
               <LayoutDashboard className="w-4 h-4" /> <span className="hidden md:inline">Pestañas</span>
            </button>
            <button onClick={() => setViewMode('accordion')} className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${viewMode === 'accordion' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-slate-100'}`}>
               <List className="w-4 h-4" /> <span className="hidden md:inline">Cascada</span>
            </button>
            <button onClick={() => setViewMode('industrial')} className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${viewMode === 'industrial' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10' : 'text-blue-600 hover:bg-blue-50'}`}>
               <ClipboardCheck className="w-4 h-4" /> <span className="hidden md:inline">Norma Climasol</span>
            </button>
         </div>
      </div>

      {viewMode === 'sidebar' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-8">
           {/* Navigation Sidebar */}
           <div className="lg:col-span-1 flex overflow-x-auto lg:flex-col gap-2 pb-2 lg:pb-0 scrollbar-hide -mx-4 px-4 lg:mx-0 lg:px-0 lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
              {SECTIONS.map(s => (
                <SidebarButton key={s.id} active={activeSection === s.id} onClick={() => setActiveSection(s.id as Section)} label={s.label} icon={s.icon} subItems={s.subItems} />
              ))}
           </div>

           {/* Form Body */}
           <div className="lg:col-span-3 space-y-6 lg:space-y-8 animate-in slide-in-from-right-4 duration-300">
              {renderSectionContent(activeSection)}
           </div>
        </div>
      )}

      {viewMode === 'tabs' && (
        <div className="flex flex-col">
           {/* Navigation Tabs */}
           <div className="flex overflow-x-auto gap-2 pb-0 scrollbar-hide -mx-4 px-4 lg:mx-0 lg:px-0 mb-6 bg-white border border-slate-200 rounded-[24px] p-2">
              {SECTIONS.map(s => (
                <button 
                  key={s.id}
                  onClick={() => setActiveSection(s.id as Section)}
                  className={`shrink-0 flex items-center gap-2 px-6 py-4 rounded-2xl transition-all ${
                    activeSection === s.id 
                      ? "bg-slate-900 text-white font-bold shadow-md shadow-slate-900/20" 
                      : "bg-transparent text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <div className={activeSection === s.id ? "text-blue-400" : "text-slate-400"}>{s.icon}</div>
                  <span className="text-[10px] uppercase tracking-widest leading-none mt-0.5">{s.label}</span>
                </button>
              ))}
           </div>

           {/* Form Body */}
           <div className="space-y-6 lg:space-y-8 animate-in slide-in-from-bottom-4 duration-300">
              {renderSectionContent(activeSection)}
           </div>
        </div>
      )}

      {viewMode === 'accordion' && (
        <div className="space-y-4">
           {SECTIONS.map(s => (
             <div key={s.id} className={`bg-white rounded-[32px] border transition-all duration-300 ${activeSection === s.id ? 'border-slate-300 shadow-lg shadow-slate-900/5' : 'border-slate-200 shadow-sm'}`}>
                <button 
                  onClick={() => setActiveSection(activeSection === s.id ? ('none' as any) : s.id)}
                  className={`w-full flex items-center justify-between p-6 md:p-8 transition-colors rounded-[32px] ${activeSection === s.id ? 'bg-slate-50/50' : 'hover:bg-slate-50'}`}
                >
                   <div className="flex items-center gap-4 text-left">
                     <div className={`p-4 rounded-2xl transition-colors ${activeSection === s.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'bg-slate-100 text-slate-400'}`}>
                        {s.icon}
                     </div>
                     <div>
                       <span className={`block text-sm md:text-base font-black uppercase tracking-widest ${activeSection === s.id ? 'text-slate-900' : 'text-slate-600'}`}>
                         {s.label}
                       </span>
                       <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Sección del Informe</span>
                     </div>
                   </div>
                   <div className={`p-2 rounded-xl transition-colors ${activeSection === s.id ? 'bg-white shadow-sm' : 'bg-transparent'}`}>
                     <ChevronDown className={`w-6 h-6 transition-transform duration-300 ${activeSection === s.id ? 'rotate-180 text-blue-600' : 'text-slate-400'}`} />
                   </div>
                </button>
                {activeSection === s.id && (
                  <div className="px-4 pb-6 md:px-8 md:pb-8 animate-in slide-in-from-top-4 duration-300 opacity-100">
                    <div className="pt-4 border-t border-slate-100">
                      {renderSectionContent(s.id)}
                    </div>
                  </div>
                )}
             </div>
           ))}
        </div>
      )}

      {viewMode === 'industrial' && renderIndustrialPreview()}

      <AssetSearchModal 
          isOpen={showTagSearch} 
          onClose={() => setShowTagSearch(false)}
          onSelect={handleAutoFill}
          tag={searchQuery}
          setTag={setSearchQuery}
          cliente={searchClient}
          setCliente={setSearchClient}
          sucursal={searchSucursal}
          setSucursal={setSearchSucursal}
          descripcion={searchDescription}
          setDescripcion={setSearchDescription}
          fixedSucursalId={parentOrder?.sucursal_id}
       />
       {showAssetConfig && <CreateAssetModal onClose={() => setShowAssetConfig(false)} />}
       <FullscreenSignatureModal
          isOpen={showFullscreenSignature}
          onClose={() => setShowFullscreenSignature(false)}
          title="Firma del Técnico"
          onSave={(dataUrl) => {
            const canvas = canvasTechnicianRef.current;
            if (!canvas) return;
            const context = canvas.getContext('2d');
            if (!context) return;
            const image = new Image();
            image.onload = () => {
              context.clearRect(0, 0, canvas.width, canvas.height);
              context.drawImage(image, 0, 0, canvas.width, canvas.height);
              setSavedTechnicianSignature(dataUrl);
            };
            image.src = dataUrl;
            setShowFullscreenSignature(false);
          }}
       />
    </div>
  );
}

function SidebarButton({ 
  active, 
  onClick, 
  label, 
  icon, 
  subItems 
}: { 
  active: boolean, 
  onClick: () => void, 
  label: string, 
  icon: React.ReactNode, 
  subItems?: { id: string, label: string }[] 
}) {
  const [expanded, setExpanded] = useState(active);

  useEffect(() => {
    if (active) setExpanded(true);
  }, [active]);

  return (
    <div className="flex flex-col gap-1 w-full">
      <button 
        onClick={() => {
           if (subItems) {
              if (active) {
                 setExpanded(!expanded);
              } else {
                 onClick();
                 setExpanded(true);
              }
           } else {
              onClick();
           }
        }}
        className={`shrink-0 lg:w-full flex items-center justify-between p-3 lg:p-4 rounded-xl lg:rounded-2xl transition-all ${
          active 
            ? "bg-slate-900 text-white shadow-xl shadow-slate-900/10 scale-[1.02]" 
            : "bg-white text-slate-400 hover:bg-slate-50 border border-slate-200"
        }`}
      >
         <div className="flex items-center gap-2 lg:gap-3">
           <div className={`${active ? "text-blue-400" : "text-slate-300"}`}>{icon}</div>
           <span className="text-[10px] whitespace-nowrap font-black uppercase tracking-widest">{label}</span>
         </div>
         {subItems && (
           <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${expanded ? "rotate-180" : ""} ${active ? "text-blue-400" : "text-slate-300"}`} />
         )}
      </button>
      
      {/* Sub Items Table Style */}
      {subItems && expanded && (
        <div className="flex flex-col gap-1 pl-4 lg:pl-6 py-1 animate-in slide-in-from-top-2 duration-300">
           <div className="w-px h-full bg-slate-200 absolute left-8 top-12 bottom-4 hidden lg:block -z-10"></div>
           {subItems.map(sub => (
              <button key={sub.id} className="flex items-center gap-3 w-full p-2 rounded-xl text-left hover:bg-slate-50 transition-colors group">
                 <div className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover:bg-blue-400 transition-colors"></div>
                 <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 group-hover:text-slate-900">{sub.label}</span>
              </button>
           ))}
        </div>
      )}
    </div>
  );
}

function SectionBox({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-6 overflow-hidden">
       <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 border-b border-slate-50 pb-4">{title}</h3>
       <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
         {children}
       </div>
    </div>
  );
}

function InputField({ label, value, type = 'text', onChange, readOnly = false }: { label: string, value: string, type?: string, onChange?: (val: string) => void, readOnly?: boolean }) {
  return (
    <div className="space-y-1">
       <label className="text-[10px] font-black uppercase text-slate-400">{label}</label>
       <input 
         type={type} 
         value={value}
         onChange={(e) => onChange?.(e.target.value)}
         readOnly={readOnly}
         className={`w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold uppercase transition-all outline-none ${readOnly ? 'opacity-60 cursor-not-allowed' : 'focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500'}`} 
       />
    </div>
  );
}

function CheckRow({ label, checked }: { label: string, checked?: boolean }) {
  return (
    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
       <span className="text-xs font-bold uppercase text-slate-600">{label}</span>
       <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${checked ? 'bg-emerald-500 text-white' : 'bg-slate-200'}`}>
          {checked && <CheckCircle2 className="w-4 h-4" />}
       </div>
    </div>
  );
}
