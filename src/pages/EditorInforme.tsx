
import React, { useState, useEffect, useRef } from "react";
import { 
  ArrowLeft, 
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
  Search,
  Building2,
  MapPin,
  Tag,
  Settings,
  ScanLine,
  Users
} from "lucide-react";
import { Link, useRoute, useLocation } from "wouter";
import { AssetSearchModal } from "../components/modals/AssetSearchModal";
import { INFORMES_MOCK } from "../data/reports";
import { EQUIPOS_DATA } from "../data/assets";
import { CreateAssetModal } from "../components/modals/CreateAssetModal";
import LoadingIndicator from "../components/LoadingIndicator";
import { DataStore } from "../services/dataStore";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import * as XLSX from "xlsx";
import { GoogleGenAI } from "@google/genai";

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

const CHECKLIST_ITEMS = [
  "Inspección visual general", "Limpieza de filtros", "Instalacion filtros Desechables", "Limpieza de evaporador", "Limpieza de condensador",
  "Limpieza de bandejas", "Bomba de condensado", "Verificación de desagüe", "Revisión de ventiladores", "Verificación de correas",
  "Lubricación de rodamientos", "Conexiones eléctricas", "Medición de consumos", "Tensiones de alimentación",
  "Presostatos alta y baja", "Presiones de refrigerante", "Recarga de refrigerante", "Temperaturas de trabajo", "Válvula de expansión",
  "Nivel de refrigerante", "Fugas de refrigerante", "Revisión de compresores", "Relés y contactores",
  "Controles y termostatos", "Prueba de Presion", "Alarmas y protecciones", "Funcionamiento general"
];

type OCRPayload = {
  marca?: string;
  modelo?: string;
  n_serie?: string;
  refrigerante?: string;
  capacidad_btu?: string;
  voltaje?: string;
  amperaje?: string;
};

function isValidOCRPayload(payload: unknown): payload is OCRPayload {
  if (!payload || typeof payload !== "object") return false;

  const candidate = payload as Record<string, unknown>;
  const requiredFields = ["marca", "modelo", "refrigerante"];
  return requiredFields.every(field => typeof candidate[field] === "string" && candidate[field].trim().length > 0);
}

function normalizeOCRPayload(payload: OCRPayload) {
  return {
    marca: payload.marca?.trim() || "",
    modelo: payload.modelo?.trim() || "",
    serie: payload.n_serie?.trim() || "",
    refrigerante: payload.refrigerante?.trim() || "",
    capacidad: payload.capacidad_btu?.trim() || "",
    voltaje: payload.voltaje?.trim() || ""
  };
}

function buildReportSnapshot(generalData: Record<string, unknown>, machineData: Record<string, unknown>, circuits: CircuitData[], checklist: ChecklistEvidence, observaciones: string, galeria: {src: string; desc: string}[], status: string) {
  return {
    generalData,
    machineData,
    circuits,
    checklist,
    observaciones,
    galeria,
    status
  };
}

export default function EditorInforme() {
  const [, params] = useRoute<{ id: string }>("/informes/:id");
  const [, setLocation] = useLocation();
  const id = params?.id;
  const isNew = id === "nuevo";
  const informe = INFORMES_MOCK.find(i => i.id === id);
  
  const [activeSection, setActiveSection] = useState<Section>('general');
  const [status, setStatus] = useState<'borrador' | 'firmado' | 'bloqueado' | 'offline_draft'>(informe?.estado as any || 'offline_draft');
  const [loadingAI, setLoadingAI] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const DRAFT_KEY = id === "nuevo" ? "hvac_draft_new" : `hvac_draft_${id}`;

  // Form State
  const [generalData, setGeneralData] = useState({
    cliente: '',
    sucursal: '',
    region: '',
    direccion: '',
    fecha: new Date().toISOString().split('T')[0],
    tecnico: 'Nelson Bravo',
    tipoServicio: 'Preventivo',
    folio: ''
  });

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

  // Load Draft from LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setGeneralData(data.generalData);
        setMachineData(data.machineData);
        setCircuits(data.circuits);
        setChecklist(data.checklist);
        setObservaciones(data.observaciones);
        setGaleria(data.galeria);
        if (data.status) setStatus(data.status);
      } catch (e) {
        console.error("Error loading draft", e);
      }
    } else if (informe) {
      // Load from mock if relative found (and no draft exists)
      setGeneralData({ ...generalData, ...informe });
      setMachineData({ ...machineData, tag: informe.tag || '' });
    }
  }, [id]);

  // Persist Changes to LocalStorage
  useEffect(() => {
    if (status === 'firmado' || status === 'bloqueado') return;
    
    const draft = {
      generalData,
      machineData,
      circuits,
      checklist,
      observaciones,
      galeria,
      status
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [generalData, machineData, circuits, checklist, observaciones, galeria, status, DRAFT_KEY]);
  
  // Handle Finalize & Sync (Auto-numbering assignment)
  const handleSyncAndFinalize = async () => {
    setIsSyncing(true);

    const newFolio = `INF-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    setGeneralData(prev => ({ ...prev, folio: newFolio }));

    const snapshot = buildReportSnapshot(
      generalData,
      machineData,
      circuits,
      checklist,
      observaciones,
      galeria,
      status
    );

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      DataStore.enqueueSyncOperation({
        type: "report-finalize",
        payload: {
          folio: newFolio,
          draftKey: DRAFT_KEY,
          snapshot,
          createdAt: new Date().toISOString()
        }
      });
      setStatus('offline_draft');
      setIsSyncing(false);
      alert("Sin conexión. El informe quedó en cola local para sincronización.");
      return;
    }

    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      localStorage.removeItem(DRAFT_KEY);
      setStatus('firmado');
      DataStore.completeSyncOperation(`sync-${Date.now()}`);
      alert(`Informe Sincronizado Exitosamente. Folio Asignado: ${newFolio}`);
    } finally {
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

  const ALMACEN_LABELS: Record<string, string> = { 
    '11-STK': 'Iquique', '12-STK': 'Antofagasta', '13-STK': 'Copiapó', 
    '21-STK': 'Santiago 14 de la Fama', '21-STK-SB': 'BME La Vara 3310',
    '23-STK': 'Viña del Mar', '24-STK': 'Rancagua', '31-STK': 'Concepción',
    '32-STK': 'Puerto Montt', 'Planta-STK': 'Planta Industrial'
  };

  const filteredEquipos = EQUIPOS_DATA.filter(eq => {
    const matchTag = searchQuery ? eq.tag.toLowerCase().includes(searchQuery.toLowerCase()) : true;
    const matchDesc = searchDescription ? eq.nombre.toLowerCase().includes(searchDescription.toLowerCase()) : true;
    const eqSucursal = eq.tag.split('.')[0];
    const matchSucursal = searchSucursal ? eqSucursal === searchSucursal : true;
    return matchTag && matchDesc && matchSucursal;
  });

  const handleAutoFill = (eq: any) => {
    const sucursalCode = eq.tag.split('.')[0];
    const sucursalName = ALMACEN_LABELS[sucursalCode] || sucursalCode;

    setGeneralData(prev => ({
      ...prev,
      cliente: "Empresa Mandante SPA", 
      sucursal: sucursalName,
      region: sucursalCode.startsWith('21') ? 'Metropolitana' : 'Otras Regiones',
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

  const canvasTecRef = useRef<HTMLCanvasElement>(null);
  const canvasCliRef = useRef<HTMLCanvasElement>(null);

  // Export PDF
  const handleExportPDF = async () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    doc.setFont("helvetica", "bold");
    doc.text(`INFORME TÉCNICO: ${machineData.tag}`, 10, 10);
    doc.setFontSize(10);
    doc.text(`Cliente: ${generalData.cliente}`, 10, 20);
    doc.text(`Sucursal: ${generalData.sucursal}`, 10, 25);
    doc.text(`Fecha: ${generalData.fecha}`, 10, 30);
    
    doc.text("Resumen de Hallazgos:", 10, 45);
    doc.setFont("helvetica", "normal");
    const splitText = doc.splitTextToSize(observaciones || "Sin observaciones registradas.", 180);
    doc.text(splitText, 10, 50);

    doc.save(`Informe_${machineData.tag}_${generalData.fecha}.pdf`);
  };

  // Export Excel
  const handleExportExcel = () => {
    const data = [
      ["CLIENTE", generalData.cliente],
      ["SUCURSAL", generalData.sucursal],
      ["FECHA", generalData.fecha],
      ["TAG", machineData.tag],
      ["MARCA", machineData.marca],
      ["MODELO", machineData.modelo],
      ["HALLAZGOS", observaciones]
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Informe");
    XLSX.writeFile(wb, `Informe_${machineData.tag}.xlsx`);
  };

  const isReadOnly = status === 'firmado' || status === 'bloqueado';

  useEffect(() => {
    const setupCanvas = (canvas: HTMLCanvasElement | null) => {
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      
      let drawing = false;
      const getPos = (e: MouseEvent | TouchEvent) => {
        const rect = canvas.getBoundingClientRect();
        const evt = "touches" in e ? e.touches[0] : e;
        return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
      };

      const start = (e: MouseEvent | TouchEvent) => {
        if (isReadOnly) return;
        drawing = true;
        ctx.beginPath();
        const pos = getPos(e);
        ctx.moveTo(pos.x, pos.y);
      };

      const move = (e: MouseEvent | TouchEvent) => {
        if (!drawing) return;
        e.preventDefault();
        const pos = getPos(e);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      };

      const end = () => drawing = false;

      canvas.onmousedown = start;
      canvas.onmousemove = move;
      window.addEventListener('mouseup', end);
      canvas.ontouchstart = start;
      canvas.ontouchmove = move;
      canvas.ontouchend = end;
    };

    setupCanvas(canvasTecRef.current);
    setupCanvas(canvasCliRef.current);
  }, [isReadOnly]);

  const addImageToGallery = async (file: File) => {
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve) => {
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
    const src = await base64Promise;
    setGaleria(prev => [...prev, { src, desc: '' }]);
  };

  // Handle Gemini AI
  const handleGeminiOCR = async (file: File) => {
    if (!process.env.GEMINI_API_KEY) {
      alert("API Key no configurada");
      return;
    }

    setLoadingAI(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
        reader.readAsDataURL(file);
      });
      const base64Data = await base64Promise;

      const prompt = "Extrae de esta placa HVAC: Marca, Modelo, N Serie, Refrigerante, Voltaje, Amperaje Nominal y Capacidad. REGLA: Si la capacidad esta en kW convierte: 1kW=3412 BTU. Si en Toneladas: 1TR=12000 BTU. Devuelve SOLO un objeto JSON con estas keys: {'marca':'','modelo':'','n_serie':'','refrigerante':'','capacidad_btu':'','voltaje':'','amperaje':''}";

      const imgPart = {
        inlineData: {
          data: base64Data,
          mimeType: file.type || "image/jpeg"
        }
      };

      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: { parts: [imgPart, { text: prompt }] }
      });

      const text = result.text || "";
      const jsonMatch = text.match(/\{[\s\S]*?\}/);

      if (!jsonMatch) {
        alert("No se pudo extraer un JSON válido de la placa.");
        return;
      }

      const parsed = JSON.parse(jsonMatch[0]) as unknown;
      if (!isValidOCRPayload(parsed)) {
        alert("La respuesta OCR no contiene los campos mínimos necesarios.");
        return;
      }

      const normalized = normalizeOCRPayload(parsed);
      setMachineData(prev => ({
        ...prev,
        marca: normalized.marca || prev.marca,
        modelo: normalized.modelo || prev.modelo,
        serie: normalized.serie || prev.serie,
        refrigerante: normalized.refrigerante || prev.refrigerante,
        capacidad: normalized.capacidad || prev.capacidad,
        voltaje: normalized.voltaje || prev.voltaje
      }));
    } catch (err) {
      console.error(err);
      alert("Error al procesar con IA");
    } finally {
      setLoadingAI(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 text-left pb-20 max-w-5xl mx-auto">
      {/* Header Panel */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 sticky top-4 z-40 backdrop-blur-md bg-white/90">
         <div className="flex items-center gap-4">
            <Link href="/informes">
               <button className="p-2.5 hover:bg-slate-100 text-slate-400 rounded-xl transition-colors"><ArrowLeft className="w-5 h-5" /></button>
            </Link>
            <div>
               <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-slate-900 uppercase">{isNew ? 'Nuevo Informe' : `Informe ${id}`}</h2>
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${ 
                    status === 'firmado' ? 'bg-emerald-100 text-emerald-600' : 
                    status === 'bloqueado' ? 'bg-amber-100 text-amber-600' : 
                    status === 'offline_draft' ? 'bg-blue-100 text-blue-600 animate-pulse' :
                    'bg-slate-100 text-slate-600'
                   }`}>
                    {status === 'offline_draft' ? 'Borrador Local' : status}
                  </span>
               </div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{machineData.tag || 'SIN TAG'} - {machineData.marca || 'GENERICO'}</p>
            </div>
         </div>
         <div className="flex items-center gap-2">
            {!isReadOnly && (
              <>
                 <button onClick={() => setLocation("/informes")} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-200">
                    <Save className="w-4 h-4" /> Guardar
                 </button>
                 <button 
                    disabled={isSyncing}
                    onClick={handleSyncAndFinalize} 
                    className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-blue-600/20 hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isSyncing ? <LoadingIndicator size="xs" color="text-white" /> : <Send className="w-4 h-4" />}
                    {isSyncing ? 'Sincronizando...' : 'Sincronizar y Finalizar'}
                 </button>
              </>
            )}
            {isReadOnly && (
               <>
                  <button onClick={() => window.print()} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2">
                     <Printer className="w-4 h-4" /> Imprimir
                  </button>
                  <button onClick={handleExportPDF} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2">
                     <Download className="w-4 h-4" /> PDF
                  </button>
                  <button onClick={handleExportExcel} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2">
                     <FileText className="w-4 h-4" /> Excel
                  </button>
               </>
            )}
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
         {/* Navigation Sidebar */}
         <div className="lg:col-span-1 space-y-2">
            <SidebarButton active={activeSection === 'general'} onClick={() => setActiveSection('general')} label="Datos Generales" icon={<Info className="w-4 h-4" />} />
            <SidebarButton active={activeSection === 'equipos'} onClick={() => setActiveSection('equipos')} label="Estado Equipo" icon={<Zap className="w-4 h-4" />} />
            <SidebarButton active={activeSection === 'mediciones'} onClick={() => setActiveSection('mediciones')} label="Mediciones" icon={<History className="w-4 h-4" />} />
            <SidebarButton active={activeSection === 'checklist'} onClick={() => setActiveSection('checklist')} label="Checklist" icon={<ClipboardCheck className="w-4 h-4" />} />
            <SidebarButton active={activeSection === 'hallazgos'} onClick={() => setActiveSection('hallazgos')} label="Hallazgos" icon={<AlertTriangle className="w-4 h-4" />} />
            <SidebarButton active={activeSection === 'galeria'} onClick={() => setActiveSection('galeria')} label="Evidencia" icon={<Camera className="w-4 h-4" />} />
            <SidebarButton active={activeSection === 'firma'} onClick={() => setActiveSection('firma')} label="Firma Documento" icon={<PenTool className="w-4 h-4" />} />
         </div>

         {/* Form Body */}
         <div className="lg:col-span-3 space-y-8 animate-in slide-in-from-right-4 duration-300">
            {activeSection === 'general' && (
              <div className="space-y-6">
                {!isReadOnly && (
                  <button 
                    onClick={() => setShowTagSearch(true)}
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl shadow-slate-900/10 active:scale-95 transition-all mb-2"
                  >
                    <Search className="w-5 h-5 text-blue-400" />
                    Completar datos con TAG de Equipo
                  </button>
                )}
                <SectionBox title="Información General del Servicio">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1 md:col-span-2">
                       <label className="text-[10px] font-black uppercase text-slate-400">Cliente / Instalación</label>
                       <input 
                        type="text" 
                        value={generalData.cliente} 
                        readOnly={isReadOnly}
                        onChange={(e) => setGeneralData({...generalData, cliente: e.target.value})}
                        placeholder="Nombre de la empresa cliente"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none"
                       />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[10px] font-black uppercase text-slate-400">Sucursal / Proyecto</label>
                       <input 
                        type="text" 
                        value={generalData.sucursal} 
                        readOnly={isReadOnly}
                        onChange={(e) => setGeneralData({...generalData, sucursal: e.target.value})}
                        placeholder="Edificio, Planta, Sucursal..."
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none"
                       />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[10px] font-black uppercase text-slate-400">Región</label>
                       <input 
                        type="text" 
                        value={generalData.region} 
                        readOnly={isReadOnly}
                        onChange={(e) => setGeneralData({...generalData, region: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none"
                       />
                    </div>
                    <InputField label="Técnico Responsable" value={generalData.tecnico} onChange={(val) => setGeneralData({...generalData, tecnico: val})} readOnly={isReadOnly} />
                    <InputField label="Folio Correlativo" value={generalData.folio || 'Pnd. Sincronización'} readOnly={true} />
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
              </SectionBox>
            </div>
            )}

            {activeSection === 'equipos' && (
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
                      <div className="space-y-1">
                         <label className="text-[10px] font-black uppercase text-slate-400">Refrigerante</label>
                         <input type="text" value={machineData.refrigerante} readOnly={isReadOnly} onChange={(e) => setMachineData({...machineData, refrigerante: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none" />
                      </div>
                   </div>
                 </div>
              </SectionBox>
            )}

            {activeSection === 'mediciones' && (
              <div className="space-y-6">
                 <div className="bg-slate-900 p-6 rounded-[32px] shadow-xl shadow-slate-900/10 flex items-center justify-between text-white">
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
                   <div key={idx} className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-6">
                      <div className="flex justify-between items-center border-b border-slate-50 pb-4">
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

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            )}

            {activeSection === 'checklist' && (
              <SectionBox title="Checklist Técnico de Mantenimiento">
                 <div className="space-y-4">
                    {CHECKLIST_ITEMS.map((item, idx) => (
                      <div key={idx} className="space-y-2">
                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group transition-all hover:bg-slate-100">
                           <div className="flex flex-col md:flex-row md:items-center gap-4 flex-1">
                              <span className="text-xs font-black uppercase text-slate-700 min-w-[200px]">{item}</span>
                              <div className="flex items-center gap-1.5">
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
                           <button onClick={() => setChecklist({...checklist, [idx]: {...(checklist[idx] || {findings: '', photos: []}), expanded: !checklist[idx]?.expanded}})} className="p-2 hover:bg-white rounded-xl transition-all shadow-sm ml-4">
                              <ChevronDown className={`w-4 h-4 transition-transform duration-300 text-slate-400 ${checklist[idx]?.expanded ? 'rotate-180 text-blue-600' : ''}`} />
                           </button>
                        </div>
                        {checklist[idx]?.expanded && (
                          <div className="p-6 bg-white border border-slate-100 rounded-3xl mx-2 shadow-inner space-y-4 animate-in slide-in-from-top-2 duration-200">
                             <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-blue-600 tracking-widest">Hallazgos y Observaciones</label>
                                <textarea 
                                  value={checklist[idx]?.findings}
                                  onChange={(e) => setChecklist({...checklist, [idx]: {...checklist[idx], findings: e.target.value}})}
                                  placeholder="Detalle el estado o anomalía detectada..."
                                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500" 
                                  rows={3} 
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
            )}

            {activeSection === 'hallazgos' && (
              <SectionBox title="Resumen de Hallazgos y Recomendaciones">
                 <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase text-slate-400">Observaciones Finales Técnicas</label>
                    <textarea 
                      value={observaciones}
                      onChange={(e) => setObservaciones(e.target.value)}
                      rows={6} 
                      className="w-full bg-slate-50 border border-slate-100 rounded-[32px] p-6 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500" 
                      placeholder="Especifique cualquier anomalía adicional o recomendación de cambio de componentes..."
                    />
                 </div>
              </SectionBox>
            )}

            {activeSection === 'galeria' && (
              <SectionBox title="Evidencia Fotográfica de Campo">
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {galeria.map((img, i) => (
                      <div key={i} className="aspect-square bg-slate-50 border border-slate-100 rounded-3xl overflow-hidden relative group">
                         <img src={img.src} alt={`Evidencia ${i}`} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                         {!isReadOnly && (
                           <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <button onClick={() => setGaleria(galeria.filter((_, idx) => idx !== i))} className="p-2 bg-red-500 text-white rounded-xl"><Trash2 className="w-4 h-4" /></button>
                           </div>
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
            )}

            {activeSection === 'firma' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <SectionBox title="Firma Técnica de Ejecución">
                    <div className="space-y-4">
                       <canvas ref={canvasTecRef} className="w-full h-48 bg-slate-50 border border-slate-100 rounded-3xl touch-none shadow-inner" />
                       <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                             <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                             <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{generalData.tecnico}</span>
                          </div>
                          {!isReadOnly && <button className="text-[10px] font-black uppercase text-slate-400 hover:text-red-500 transition-colors" onClick={() => {
                              const ctx = canvasTecRef.current?.getContext('2d');
                              ctx?.clearRect(0, 0, canvasTecRef.current?.width || 0, canvasTecRef.current?.height || 0);
                          }}>Borrar Trazo</button>}
                       </div>
                    </div>
                 </SectionBox>
                 <SectionBox title="Conformidad del Cliente">
                    <div className="space-y-4">
                       <canvas ref={canvasCliRef} className={`w-full h-48 bg-slate-50 border border-slate-100 rounded-3xl touch-none shadow-inner ${isReadOnly ? 'opacity-40' : ''}`} />
                       <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Área de Firma Cliente</span>
                          {!isReadOnly && <button className="text-[10px] font-black uppercase text-slate-400 hover:text-red-500 transition-colors" onClick={() => {
                              const ctx = canvasCliRef.current?.getContext('2d');
                              ctx?.clearRect(0, 0, canvasCliRef.current?.width || 0, canvasCliRef.current?.height || 0);
                          }}>Borrar Trazo</button>}
                       </div>
                       <InputField label="Nombre de quien recibe" value="Gonzalo Bravo" readOnly={isReadOnly} />
                    </div>
                 </SectionBox>
              </div>
            )}
         </div>
      </div>
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
          clients={ALMACEN_LABELS}
          results={filteredEquipos}
       />
       {showAssetConfig && <CreateAssetModal onClose={() => setShowAssetConfig(false)} />}
    </div>
  );
}

function SidebarButton({ active, onClick, label, icon }: { active: boolean, onClick: () => void, label: string, icon: React.ReactNode }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all ${
        active 
          ? "bg-slate-900 text-white shadow-xl shadow-slate-900/10 scale-[1.02]" 
          : "bg-white text-slate-400 hover:bg-slate-50 border border-slate-200"
      }`}
    >
       <div className={`${active ? "text-blue-400" : "text-slate-300"}`}>{icon}</div>
       <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    </button>
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
