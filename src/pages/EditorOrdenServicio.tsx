import React, { useState, useRef, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { 
  FileText, 
  Save, 
  Send,
  Camera,
  Trash2,
  PenTool,
  UploadCloud,
  ChevronLeft,
  CheckSquare,
  AlertTriangle,
  ClipboardList,
  MapPin,
  Search,
  Maximize,
  CheckCircle2,
  ChevronDown,
  Plus
} from "lucide-react";
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import DictationTextarea from "../components/DictationTextarea";
import LoadingIndicator from "../components/LoadingIndicator";
import { SearchableSelect } from "../components/SearchableSelect";
import { AssetSearchModal } from "../components/modals/AssetSearchModal";
import { FullscreenSignatureModal } from "../components/modals/FullscreenSignatureModal";
import { db } from "../db/database";
import { syncEngine } from "../sync/syncEngine";
import { useAppStore } from "../store/useAppStore";

export interface ChecklistItemData {
  status?: 'ok' | 'obs' | 'falla';
  findings: string;
  photos: string[];
  expanded?: boolean;
}

const OS_CHECKLIST_ITEMS = [
  { key: "inspeccionVisual", label: "Inspección visual general" },
  { key: "limpiezaExterior", label: "Limpieza Exterior" },
  { key: "tomaDatos", label: "Toma de datos de condicion" },
  { key: "revisionFuncionamiento", label: "Revision de funcionamiento" },
  { key: "conexionesElectricas", label: "Conexiones eléctricas" },
  { key: "medicionConsumos", label: "Medición de consumos" },
  { key: "funcionamientoGeneral", label: "Funcionamiento general" }
];

type Section = 'general' | 'checklist' | 'hallazgos' | 'galeria' | 'firma';

export default function EditorOrdenServicio() {
  const [, params] = useRoute<{ id: string }>("/ordenes-servicio/:id");
  const [, setLocation] = useLocation();
  const rawId = params?.id;
  const isNew = rawId === "nuevo";
  const [uuid, setUuid] = useState(isNew ? crypto.randomUUID() : rawId || crypto.randomUUID());
  
  const clients = useAppStore(state => state.clients);
  const branches = useAppStore(state => state.branches);

  const OS_DRAFT_KEY = `OS_DRAFT_${uuid}`;

  const [activeSection, setActiveSection] = useState<Section>('general');
  const [isSyncing, setIsSyncing] = useState(false);
  const [status, setStatus] = useState<'borrador'|'firmada'|'enviada'>('borrador');
  const [showFullscreenSignature, setShowFullscreenSignature] = useState(false);
  const [signatureType, setSignatureType] = useState<'tecnico' | 'cliente'>('tecnico');
  const [activePhotoField, setActivePhotoField] = useState<string | null>(null);

  const [ubicacionGeografica, setUbicacionGeografica] = useState<{lat: number, lng: number} | undefined>();
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState("");
  const [showAssetSearch, setShowAssetSearch] = useState(false);

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

  const canvasTecRef = useRef<HTMLCanvasElement>(null);
  const canvasCliRef = useRef<HTMLCanvasElement>(null);

  const [generalData, setGeneralData] = useState({
    cliente: "",
    sucursal: "",
    edificio: "",
    region: "",
    tecnico: "Nelson Bravo",
    nombreCliente: "",
    fecha: new Date().toISOString().split('T')[0],
    equipoTag: "",
    descripcionEquipo: "",
    tipoServicio: "Preventivo",
  });

  const [checklist, setChecklist] = useState<Record<string, ChecklistItemData>>({
    inspeccionVisual: { findings: "", photos: [] },
    limpiezaExterior: { findings: "", photos: [] },
    tomaDatos: { findings: "", photos: [] },
    revisionFuncionamiento: { findings: "", photos: [] },
    conexionesElectricas: { findings: "", photos: [] },
    medicionConsumos: { findings: "", photos: [] },
    funcionamientoGeneral: { findings: "", photos: [] }
  });

  const [hallazgos, setHallazgos] = useState({
    condicionInicial: "",
    condicionFinal: "",
    observaciones: "",
    conclusiones: "",
    recomendaciones: ""
  });

  const [galeria, setGaleria] = useState<{src: string, desc: string}[]>([]);

  const normalizeChecklist = (rawChecklist: any) => {
    const normalized: Record<string, ChecklistItemData> = {};
    const keys = ['inspeccionVisual', 'limpiezaExterior', 'tomaDatos', 'revisionFuncionamiento', 'conexionesElectricas', 'medicionConsumos', 'funcionamientoGeneral'];
    keys.forEach(k => {
      const rawVal = rawChecklist?.[k];
      if (!rawVal) {
        normalized[k] = { findings: "", photos: [] };
      } else if (typeof rawVal === 'string') {
        let status: 'ok' | 'obs' | 'falla' | undefined = undefined;
        if (rawVal === 'OK') status = 'ok';
        else if (rawVal === 'NOK') status = 'falla';
        else if (rawVal === 'N/A') status = 'obs';
        normalized[k] = { status, findings: "", photos: [] };
      } else {
        normalized[k] = {
          status: rawVal.status,
          findings: rawVal.findings || "",
          photos: rawVal.photos || [],
          expanded: rawVal.expanded || false
        };
      }
    });
    return normalized;
  };

  // Load from local storage draft or DB
  useEffect(() => {
    if (isNew) {
      const saved = localStorage.getItem(OS_DRAFT_KEY);
      if (saved) {
        try {
          const data = JSON.parse(saved);
          if (data.generalData) setGeneralData(data.generalData);
          if (data.checklist) setChecklist(normalizeChecklist(data.checklist));
          if (data.hallazgos) setHallazgos(data.hallazgos);
          if (data.galeria) setGaleria(data.galeria);
          if (data.status) setStatus(data.status);
          if (data.ubicacionGeografica) setUbicacionGeografica(data.ubicacionGeografica);
        } catch (e) {
          console.error("Error parsing OS draft", e);
        }
      } else {
        const activeClient = localStorage.getItem("active_client");
        if (activeClient) {
          setGeneralData(prev => ({ ...prev, cliente: activeClient }));
        }
      }
    } else if (uuid) {
      db.ordenes_servicio.get(uuid).then(existing => {
        if (existing && existing.data) {
          const data = existing.data;
          if (data.generalData) setGeneralData(data.generalData);
          if (data.checklist) setChecklist(normalizeChecklist(data.checklist));
          if (data.hallazgos) setHallazgos(data.hallazgos);
          if (data.galeria) setGaleria(data.galeria);
          if (existing.estado) setStatus(existing.estado as any);
          if (data.ubicacionGeografica) setUbicacionGeografica(data.ubicacionGeografica);
        }
      }).catch(console.error);
    }
  }, [isNew, uuid]);

  // Save to local storage auto
  useEffect(() => {
    if (isNew) {
      const draft = { generalData, checklist, hallazgos, galeria, status, ubicacionGeografica };
      localStorage.setItem(OS_DRAFT_KEY, JSON.stringify(draft));
    }
  }, [generalData, checklist, hallazgos, galeria, status, ubicacionGeografica, isNew]);

  useEffect(() => {
    if (activeSection === 'firma') {
      setupCanvas(canvasTecRef.current);
      setupCanvas(canvasCliRef.current);
    }
  }, [activeSection]);

  const addImageToGallery = async (file: File) => {
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve) => {
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
    const base64 = await base64Promise;
    setGaleria(prev => [...prev, { src: base64, desc: "" }]);
  };

  const handleSyncAndFinalize = async () => {
    setIsSyncing(true);

    const isCanvasEmpty = (canvas: HTMLCanvasElement | null) => {
      if (!canvas) return true;
      const blank = document.createElement('canvas');
      blank.width = canvas.width;
      blank.height = canvas.height;
      return canvas.toDataURL() === blank.toDataURL();
    };

    if (isCanvasEmpty(canvasTecRef.current)) {
      alert("Error: No es posible finalizar: falta la firma del técnico.");
      setIsSyncing(false);
      return;
    }

    if (isCanvasEmpty(canvasCliRef.current)) {
      alert("Error: No es posible finalizar: falta la firma del cliente.");
      setIsSyncing(false);
      return;
    }

    const dataPayload = {
      generalData,
      checklist,
      hallazgos,
      galeria,
      ubicacionGeografica,
      status: 'firmada',
      firmas: {
        tecnico: canvasTecRef.current?.toDataURL() || '',
        cliente: canvasCliRef.current?.toDataURL() || ''
      },
      fechaSincronizacionLocal: new Date().toISOString()
    };

    // 1. Guardado Local en Dexie
    const record = {
      uuid_sync: uuid,
      id: rawId && rawId !== 'nuevo' ? rawId : `OS-${Date.now()}`,
      draft_key: OS_DRAFT_KEY,
      estado: 'firmada',
      sync_status: 'pending_insert' as const,
      updated_at: Date.now(),
      data: dataPayload
    };

    try {
      if (isNew) {
        await db.ordenes_servicio.put(record);
        await db.sync_queue.add({
          table: 'ordenes_servicio',
          uuid_sync: uuid,
          operation: 'insert',
          timestamp: Date.now(),
          data: record
        });
      } else {
        const existing = await db.ordenes_servicio.get(uuid);
        await db.ordenes_servicio.put({ ...existing, ...record, sync_status: 'pending_update' });
        await db.sync_queue.add({
          table: 'ordenes_servicio',
          uuid_sync: uuid,
          operation: 'update',
          timestamp: Date.now(),
          data: { ...existing, ...record }
        });
      }

      // Triggers background sync to Neon
      syncEngine.triggerSync().catch(console.error);

      setStatus('firmada');
      localStorage.removeItem(OS_DRAFT_KEY);
      
      // Export PDF via Email Automáticamente
      try {
        const { jsPDF } = await import('jspdf');
        const doc = new jsPDF('p', 'mm', 'a4');
        doc.setFont("helvetica", "bold");
        doc.text(`ORDEN DE SERVICIO`, 10, 10);
        doc.setFontSize(10);
        doc.text(`Cliente: ${dataPayload.generalData.cliente}`, 10, 20); 
        doc.text(`Técnico: ${dataPayload.generalData.tecnico}`, 10, 25);
        
        const pdfBase64 = doc.output('datauristring');
        const { DocumentExportService } = await import('../lib/DocumentExportService');
        const exportResult = await DocumentExportService.exportDocument({
          documentId: record.id,
          documentType: 'work_order', 
          method: 'email',
          clientId: dataPayload.generalData.cliente, // We have the clientId saved here hopefully
          pdfBase64
        });
        alert(`Orden de Servicio guardada y firmada exitosamente.\n${exportResult.message}`);
      } catch (exportError: any) {
         console.warn("Export fallido", exportError);
         alert(`Orden de Servicio guardada exitosamente.\nNota: No se pudo enviar el correo: ${exportError.message}`);
      }

      setLocation("/ordenes-servicio");
    } catch (error) {
      console.error("Error saving OS:", error);
      alert("Hubo un error guardando localmente.");
    } finally {
      setIsSyncing(false);
    }
  };

  const menu: { id: Section, label: string, icon: any }[] = [
    { id: 'general', label: 'Inf. General', icon: <FileText className="w-4 h-4" /> },
    { id: 'checklist', label: 'Checklist', icon: <CheckSquare className="w-4 h-4" /> },
    { id: 'hallazgos', label: 'Hallazgos', icon: <ClipboardList className="w-4 h-4" /> },
    { id: 'galeria', label: 'Evidencia', icon: <Camera className="w-4 h-4" /> },
    { id: 'firma', label: 'Firmas', icon: <PenTool className="w-4 h-4" /> }
  ];

  const handleGeneralChange = (field: string, value: string) => {
    setGeneralData(prev => ({ ...prev, [field]: value }));
  };

  const handleChecklistChange = (field: string, value: ChecklistItemData) => {
    setChecklist(prev => ({ ...prev, [field]: value }));
  };

  const handleHallazgosChange = (field: string, value: string) => {
    setHallazgos(prev => ({ ...prev, [field]: value }));
  };

  const isReadOnly = status === 'enviada' || status === 'firmada';

  const renderSection = () => {
    switch (activeSection) {
      case 'general':
        return (
          <SectionBox title="Información General del Servicio">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div>
                  <label className="text-[10px] font-black uppercase text-slate-400">Cliente / Instalación</label>
                  <SearchableSelect
                    options={[
                      { value: "", label: "Seleccione un cliente..." },
                      ...clients.filter(c => !c.deleted_at).map(c => ({
                        value: c.uuid_sync,
                        label: c.nombre
                      }))
                    ]}
                    value={generalData.cliente}
                    onChange={val => {
                      handleGeneralChange('cliente', val);
                      handleGeneralChange('sucursal', '');
                    }}
                    disabled={isReadOnly}
                    placeholder="Seleccione un cliente..."
                  />
               </div>
               <div>
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
                    onChange={val => {
                      const selectedSuc = branches.find(b => b.uuid_sync === val);
                      const regionVal = selectedSuc?.region || '';
                      handleGeneralChange('sucursal', val);
                      handleGeneralChange('region', regionVal);
                    }}
                    disabled={isReadOnly || !generalData.cliente}
                    placeholder="Seleccione una sucursal..."
                  />
               </div>
               <div>
                  <label className="text-[10px] font-black uppercase text-slate-400">Edificio, Planta, Sector</label>
                  <input type="text" value={generalData.edificio} onChange={e => handleGeneralChange('edificio', e.target.value)} disabled={isReadOnly} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold mt-1 outline-none focus:ring-2 focus:ring-blue-500/20" />
               </div>
               <div>
                  <label className="text-[10px] font-black uppercase text-slate-400">Región</label>
                  <input type="text" value={generalData.region} onChange={e => handleGeneralChange('region', e.target.value)} disabled={isReadOnly} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold mt-1 outline-none focus:ring-2 focus:ring-blue-500/20" />
               </div>
               <div>
                  <label className="text-[10px] font-black uppercase text-slate-400">Técnico Responsable</label>
                  <input type="text" value={generalData.tecnico} onChange={e => handleGeneralChange('tecnico', e.target.value)} disabled={isReadOnly} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold mt-1 outline-none focus:ring-2 focus:ring-blue-500/20" />
               </div>
               <div>
                  <label className="text-[10px] font-black uppercase text-slate-400">Nombre Cliente</label>
                  <input type="text" value={generalData.nombreCliente} onChange={e => handleGeneralChange('nombreCliente', e.target.value)} disabled={isReadOnly} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold mt-1 outline-none focus:ring-2 focus:ring-blue-500/20" />
               </div>
               <div>
                  <label className="text-[10px] font-black uppercase text-slate-400">Fecha del Servicio</label>
                  <input type="date" value={generalData.fecha} onChange={e => handleGeneralChange('fecha', e.target.value)} disabled={isReadOnly} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold mt-1 outline-none focus:ring-2 focus:ring-blue-500/20" />
               </div>
               <div>
                  <label className="text-[10px] font-black uppercase text-slate-400">Equipo (TAG)</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input 
                      type="text" 
                      value={generalData.equipoTag} 
                      onChange={e => handleGeneralChange('equipoTag', e.target.value)} 
                      disabled={isReadOnly} 
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20" 
                      placeholder="Ej. 21-STK.AC.001"
                    />
                    {!isReadOnly && (
                      <button 
                        type="button" 
                        onClick={() => setShowAssetSearch(true)}
                        className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 hover:bg-blue-100 transition-colors"
                        title="Buscar Equipo"
                      >
                        <Search className="w-5 h-5" />
                      </button>
                    )}
                  </div>
               </div>
               <div>
                  <label className="text-[10px] font-black uppercase text-slate-400">Descripción Equipo</label>
                  <input type="text" value={generalData.descripcionEquipo} onChange={e => handleGeneralChange('descripcionEquipo', e.target.value)} disabled={isReadOnly} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold mt-1 outline-none focus:ring-2 focus:ring-blue-500/20" />
               </div>
               <div className="md:col-span-2">
                  <label className="text-[10px] font-black uppercase text-slate-400">Tipo de Servicio</label>
                  <select value={generalData.tipoServicio} onChange={e => handleGeneralChange('tipoServicio', e.target.value)} disabled={isReadOnly} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold mt-1 outline-none focus:ring-2 focus:ring-blue-500/20">
                     <option value="Preventivo">Preventivo</option>
                     <option value="Correctivo">Correctivo</option>
                     <option value="Instalación">Instalación</option>
                     <option value="Diagnóstico">Diagnóstico</option>
                     <option value="Mejora">Mejora</option>
                     <option value="Emergencia">Emergencia</option>
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
                      mapId="os_map_id"
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
        );
      case 'checklist':
        return (
          <SectionBox title="Checklist de Inspección">
             <div className="space-y-4">
                {OS_CHECKLIST_ITEMS.map((item) => {
                  const key = item.key;
                  const currentItem = checklist[key] || { findings: '', photos: [] };
                  return (
                    <div key={key} className="space-y-2">
                      <div className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group transition-all hover:bg-slate-100 gap-4">
                         <div className="flex flex-col xl:flex-row xl:items-center gap-4 flex-1">
                            <span className="text-xs font-black uppercase text-slate-700 min-w-[200px]">{item.label}</span>
                            <div className="flex flex-wrap items-center gap-1.5">
                               <button 
                                 type="button"
                                 disabled={isReadOnly}
                                 onClick={() => setChecklist({...checklist, [key]: {...currentItem, status: 'ok'}})}
                                 className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all border ${
                                   currentItem.status === 'ok' 
                                     ? 'bg-emerald-500 text-white border-emerald-600 shadow-md shadow-emerald-500/20' 
                                     : 'bg-white text-slate-400 border-slate-200 hover:border-emerald-300 hover:text-emerald-500'
                                 }`}
                               >
                                 Ok
                               </button>
                               <button 
                                 type="button"
                                 disabled={isReadOnly}
                                 onClick={() => setChecklist({...checklist, [key]: {...currentItem, status: 'obs', expanded: true}})}
                                 className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all border ${
                                   currentItem.status === 'obs' 
                                     ? 'bg-amber-500 text-white border-amber-600 shadow-md shadow-amber-500/20' 
                                     : 'bg-white text-slate-400 border-slate-200 hover:border-amber-300 hover:text-amber-500'
                                 }`}
                               >
                                 Observación
                               </button>
                               <button 
                                 type="button"
                                 disabled={isReadOnly}
                                 onClick={() => setChecklist({...checklist, [key]: {...currentItem, status: 'falla', expanded: true}})}
                                 className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all border ${
                                   currentItem.status === 'falla' 
                                     ? 'bg-rose-500 text-white border-rose-600 shadow-md shadow-rose-500/20' 
                                     : 'bg-white text-slate-400 border-slate-200 hover:border-rose-300 hover:text-rose-500'
                                 }`}
                               >
                                 Falla
                               </button>
                            </div>
                         </div>
                         <button type="button" onClick={() => setChecklist({...checklist, [key]: {...currentItem, expanded: !currentItem.expanded}})} className="p-2 w-full md:w-auto hover:bg-white rounded-xl transition-all shadow-sm md:ml-4 flex justify-center">
                            <ChevronDown className={`w-4 h-4 transition-transform duration-300 text-slate-400 ${currentItem.expanded ? 'rotate-180 text-blue-600' : ''}`} />
                         </button>
                      </div>
                      {currentItem.expanded && (
                        <div className="p-4 md:p-6 bg-white border border-slate-100 rounded-3xl mx-2 shadow-inner space-y-4 animate-in slide-in-from-top-2 duration-200">
                           <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase text-blue-600 tracking-widest">Hallazgos y Observaciones</label>
                              <DictationTextarea 
                                value={currentItem.findings || ''}
                                onChange={(v) => setChecklist({...checklist, [key]: {...currentItem, findings: v}})}
                                placeholder="Detalle el estado o anomalía detectada..."
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 pr-12 text-slate-800" 
                                rows={3} 
                                disabled={isReadOnly}
                              />
                           </div>
                           <div>
                              <label className="text-[10px] font-black uppercase text-blue-600 tracking-widest block mb-2">Evidencias Focalizadas</label>
                              <div className="flex flex-wrap gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                 {currentItem.photos?.map((img, picIdx) => (
                                   <div key={picIdx} className="w-20 h-20 bg-slate-50 border border-slate-100 rounded-2xl overflow-hidden relative group shrink-0">
                                      <img src={img} alt={`Focalizada ${picIdx}`} className="w-full h-full object-cover" />
                                      {!isReadOnly && (
                                        <button 
                                          type="button"
                                          onClick={() => {
                                            const updatedPhotos = currentItem.photos.filter((_, pIdx) => pIdx !== picIdx);
                                            setChecklist({ ...checklist, [key]: { ...currentItem, photos: updatedPhotos } });
                                          }}
                                          className="absolute inset-0 bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      )}
                                   </div>
                                 ))}
                                 {!isReadOnly && (
                                    <button 
                                      type="button"
                                      onClick={() => {
                                        setActivePhotoField(key);
                                        setTimeout(() => {
                                          document.getElementById('checklist_photo_input')?.click();
                                        }, 50);
                                      }}
                                      className="min-w-[80px] h-20 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors"
                                    >
                                       <Plus className="w-4 h-4" />
                                       <span className="text-[9px] font-black uppercase mt-1">Cámara</span>
                                    </button>
                                 )}
                              </div>
                           </div>
                        </div>
                      )}
                    </div>
                  );
                })}
             </div>
             <input 
               id="checklist_photo_input" 
               type="file" 
               accept="image/*" 
               className="hidden" 
               onChange={async (e) => {
                 const file = e.target.files?.[0];
                 if (!file || !activePhotoField) return;
                 const reader = new FileReader();
                 const base64Promise = new Promise<string>((resolve) => {
                   reader.onload = () => resolve(reader.result as string);
                   reader.readAsDataURL(file);
                 });
                 const base64 = await base64Promise;
                 
                 setChecklist(prev => {
                   const item = prev[activePhotoField] || { findings: "", photos: [] };
                   return {
                     ...prev,
                     [activePhotoField]: {
                       ...item,
                       photos: [...(item.photos || []), base64]
                     }
                   };
                 });
                 e.target.value = '';
               }} 
             />
          </SectionBox>
        );
      case 'hallazgos':
        return (
          <SectionBox title="Resumen de Hallazgos">
            <div className="space-y-4">
              <div>
                 <label className="text-[10px] font-black uppercase text-slate-400">Condicion inicial / Final</label>
                 <DictationTextarea rows={3} value={hallazgos.condicionInicial} onChange={v => handleHallazgosChange('condicionInicial', v)} disabled={isReadOnly} />
              </div>
              <div>
                 <label className="text-[10px] font-black uppercase text-slate-400">Observaciones</label>
                 <DictationTextarea rows={3} value={hallazgos.observaciones} onChange={v => handleHallazgosChange('observaciones', v)} disabled={isReadOnly} />
              </div>
              <div>
                 <label className="text-[10px] font-black uppercase text-slate-400">Conclusiones</label>
                 <DictationTextarea rows={3} value={hallazgos.conclusiones} onChange={v => handleHallazgosChange('conclusiones', v)} disabled={isReadOnly} />
              </div>
              <div>
                 <label className="text-[10px] font-black uppercase text-slate-400">Recomendaciones</label>
                 <DictationTextarea rows={3} value={hallazgos.recomendaciones} onChange={v => handleHallazgosChange('recomendaciones', v)} disabled={isReadOnly} />
              </div>
            </div>
          </SectionBox>
        );
      case 'galeria':
        return (
          <SectionBox title="Evidencia Fotográfica">
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
                     className="aspect-square border-2 border-dashed border-slate-300 rounded-3xl flex flex-col items-center justify-center text-slate-400 hover:text-blue-500 hover:border-blue-500 hover:bg-blue-50/50 transition-all cursor-pointer"
                   >
                      <UploadCloud className="w-8 h-8 mb-2" />
                      <span className="text-xs font-bold uppercase">Añadir Foto</span>
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
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-8">
               <SectionBox title="Firma Técnica de Ejecución">
                  <div className="space-y-4">
                     <canvas ref={canvasTecRef} className="w-full h-48 bg-slate-50 border border-slate-200 rounded-3xl touch-none shadow-inner" />
                     <div className="flex justify-between items-center mt-2">
                        <div className="flex items-center gap-2">
                           <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                           <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{generalData.tecnico}</span>
                        </div>
                        <div className="flex gap-2">
                           {!isReadOnly && (
                             <button className="text-[10px] font-black uppercase text-blue-500 hover:text-blue-600 transition-colors bg-blue-50 px-3 py-1.5 rounded-lg flex items-center gap-1" onClick={() => {
                                 setSignatureType('tecnico');
                                 setShowFullscreenSignature(true);
                             }}>
                                <Maximize className="w-3 h-3" /> Pantalla Completa
                             </button>
                           )}
                           {!isReadOnly && <button className="text-[10px] font-black uppercase text-slate-400 hover:text-red-500 transition-colors bg-slate-100 px-3 py-1.5 rounded-lg flex items-center" onClick={() => {
                               const ctx = canvasTecRef.current?.getContext('2d');
                               ctx?.clearRect(0, 0, canvasTecRef.current?.width || 0, canvasTecRef.current?.height || 0);
                           }}>Borrar</button>}
                        </div>
                     </div>
                  </div>
               </SectionBox>
               <SectionBox title="Conformidad del Cliente">
                  <div className="space-y-4">
                     <canvas ref={canvasCliRef} className={`w-full h-48 bg-slate-50 border border-slate-200 rounded-3xl touch-none shadow-inner ${isReadOnly ? 'opacity-40' : ''}`} />
                    <div className="flex justify-between items-center mt-2">
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Área de Firma Cliente</span>
                       <div className="flex gap-2">
                           {!isReadOnly && (
                             <button className="text-[10px] font-black uppercase text-blue-500 hover:text-blue-600 transition-colors bg-blue-50 px-3 py-1.5 rounded-lg flex items-center gap-1" onClick={() => {
                                 setSignatureType('cliente');
                                 setShowFullscreenSignature(true);
                             }}>
                                <Maximize className="w-3 h-3" /> Pantalla Completa
                             </button>
                           )}
                           {!isReadOnly && <button className="text-[10px] font-black uppercase text-slate-400 hover:text-red-500 transition-colors bg-slate-100 px-3 py-1.5 rounded-lg flex items-center" onClick={() => {
                               const ctx = canvasCliRef.current?.getContext('2d');
                               ctx?.clearRect(0, 0, canvasCliRef.current?.width || 0, canvasCliRef.current?.height || 0);
                           }}>Borrar</button>}
                       </div>
                    </div>
                     <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Nombre de quien recibe</label>
                        <input 
                          type="text" 
                          value={generalData.nombreCliente || ""}
                          onChange={(e) => handleGeneralChange('nombreCliente', e.target.value)}
                          disabled={isReadOnly}
                          className={`w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold uppercase transition-all outline-none ${isReadOnly ? 'opacity-60 cursor-not-allowed' : 'focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500'}`} 
                        />
                     </div>
                  </div>
               </SectionBox>
            </div>

            {!isReadOnly && (
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center">
                 <AlertTriangle className="w-12 h-12 text-amber-500 mb-4" />
                 <h3 className="text-lg font-black text-slate-900 uppercase mb-2">Finalizar Orden de Servicio</h3>
                 <p className="text-sm text-slate-500 mb-6 max-w-md">
                    Al firmar y sincronizar esta orden, se generará el documento final y su estado pasará a Solo Lectura. No podrá ser modificado.
                 </p>
                 <button 
                   onClick={handleSyncAndFinalize}
                   disabled={isSyncing}
                   className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-black uppercase tracking-widest flex items-center gap-3 transition-colors shadow-lg shadow-blue-600/20 disabled:opacity-50"
                 >
                   {isSyncing ? <LoadingIndicator size="sm" color="white" /> : <Save className="w-5 h-5" />}
                   {isSyncing ? "Sincronizando..." : "Guardar y Finalizar O.S."}
                 </button>
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col gap-6 text-left h-[calc(100vh-8rem)]">
      {/* Top Header Row */}
      <div className="flex items-center justify-between shrink-0">
         <div className="flex items-center gap-4">
            <button 
              onClick={() => setLocation("/ordenes-servicio")}
              className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
               <h2 className="text-lg md:text-xl font-black text-slate-900 uppercase truncate">
                 {isNew ? 'Nueva Orden de Servicio' : `Orden de Servicio ${uuid}`}
               </h2>
               <div className="flex items-center gap-2 mt-1">
                 <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${
                   status === 'firmada' ? 'bg-emerald-100 text-emerald-700' :
                   status === 'enviada' ? 'bg-blue-100 text-blue-700' :
                   'bg-slate-200 text-slate-600'
                 }`}>
                   {status}
                 </span>
               </div>
            </div>
         </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 h-full min-h-0">
        {/* Navigation Sidebar */}
        <div className="w-full lg:w-64 shrink-0 flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto pb-2 lg:pb-0 scrollbar-hide">
          {menu.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`flex items-center gap-3 px-4 py-3 xl:py-4 rounded-2xl text-sm font-bold uppercase tracking-widest transition-all whitespace-nowrap lg:whitespace-normal text-left ${
                activeSection === item.id 
                  ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' 
                  : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900 shadow-sm'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto rounded-3xl pb-12">
           {renderSection()}
        </div>
      </div>
      
      {showAssetSearch && (
        <AssetSearchModal 
          onClose={() => setShowAssetSearch(false)}
          onSelect={(asset) => {
            handleGeneralChange('equipoTag', asset.tag);
            handleGeneralChange('descripcionEquipo', `${asset.tipo} ${asset.marca || ''} ${asset.modelo || ''}`);
            setShowAssetSearch(false);
          }}
        />
      )}
      <FullscreenSignatureModal
          isOpen={showFullscreenSignature}
          onClose={() => setShowFullscreenSignature(false)}
          title={signatureType === 'tecnico' ? "Firma Técnico de Ejecución" : "Firma Cliente"}
          onSave={(dataUrl) => {
            const canvas = signatureType === 'tecnico' ? canvasTecRef.current : canvasCliRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            const img = new Image();
            img.onload = () => {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            };
            img.src = dataUrl;
            setShowFullscreenSignature(false);
          }}
       />
    </div>
  );
}

function SectionBox({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-[32px] p-6 lg:p-10 border border-slate-200 shadow-sm mb-6">
      <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-8 flex items-center gap-3">
        <span className="w-2 h-8 bg-blue-600 rounded-full inline-block"></span>
        {title}
      </h3>
      {children}
    </div>
  );
}



// Simple canvas setup for drawing signatures
function setupCanvas(canvas: HTMLCanvasElement | null) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Handle high-dpi displays
  const rect = canvas.parentElement?.getBoundingClientRect() || { width: 400, height: 200 };
  canvas.width = rect.width;
  canvas.height = rect.height;

  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#0f172a';

  let isDrawing = false;
  let lastX = 0;
  let lastY = 0;

  const getPos = (e: MouseEvent | TouchEvent) => {
    const r = canvas.getBoundingClientRect();
    if (e instanceof MouseEvent) {
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    } else {
      return { x: e.touches[0].clientX - r.left, y: e.touches[0].clientY - r.top };
    }
  };

  const draw = (e: MouseEvent | TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.stroke();
    lastX = x;
    lastY = y;
  };

  canvas.onmousedown = (e) => { isDrawing = true; const { x, y } = getPos(e); lastX = x; lastY = y; };
  canvas.ontouchstart = (e) => { isDrawing = true; const { x, y } = getPos(e); lastX = x; lastY = y; draw(e); };
  
  canvas.onmousemove = draw;
  canvas.ontouchmove = draw;
  
  window.addEventListener('mouseup', () => isDrawing = false);
  canvas.ontouchend = () => isDrawing = false;
}
