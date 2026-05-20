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
  Search
} from "lucide-react";
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import DictationTextarea from "../components/DictationTextarea";
import LoadingIndicator from "../components/LoadingIndicator";
import { SearchableSelect } from "../components/SearchableSelect";
import { AssetSearchModal } from "../components/modals/AssetSearchModal";
import { useAppStore } from "../store/useAppStore";

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

  const [checklist, setChecklist] = useState({
    inspeccionVisual: "",
    limpiezaExterior: "",
    tomaDatos: "",
    revisionFuncionamiento: "",
    conexionesElectricas: "",
    medicionConsumos: "",
    funcionamientoGeneral: ""
  });

  const [hallazgos, setHallazgos] = useState({
    condicionInicial: "",
    condicionFinal: "",
    observaciones: "",
    conclusiones: "",
    recomendaciones: ""
  });

  const [galeria, setGaleria] = useState<{src: string, desc: string}[]>([]);

  // Load from local storage draft
  useEffect(() => {
    if (isNew) {
      const saved = localStorage.getItem(OS_DRAFT_KEY);
      if (saved) {
        try {
          const data = JSON.parse(saved);
          if (data.generalData) setGeneralData(data.generalData);
          if (data.checklist) setChecklist(data.checklist);
          if (data.hallazgos) setHallazgos(data.hallazgos);
          if (data.galeria) setGaleria(data.galeria);
          if (data.status) setStatus(data.status);
          if (data.ubicacionGeografica) setUbicacionGeografica(data.ubicacionGeografica);
        } catch (e) {
          console.error("Error parsing OS draft", e);
        }
      }
    }
  }, [isNew]);

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

    const assetData = {
      generalData,
      checklist,
      hallazgos,
      galeria,
      ubicacionGeografica,
      status: 'firmada',
      sync_status: "pendiente",
      fechaSincronizacionLocal: new Date().toISOString()
    };

    // 1. Guardado Local (Feedback Inmediato)
    localStorage.setItem(`registro_os_${uuid}`, JSON.stringify(assetData));

    // 2. Ejecución diferida para la Nube
    setTimeout(() => {
      setStatus('firmada');
      setIsSyncing(false);
      localStorage.removeItem(OS_DRAFT_KEY);
      alert("Orden de Servicio guardada y firmada exitosamente.");
      setLocation("/ordenes-servicio");
    }, 0);
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

  const handleChecklistChange = (field: string, value: string) => {
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
                    onChange={val => handleGeneralChange('sucursal', val)}
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
                <ChecklistItem label="Inspección visual general" value={checklist.inspeccionVisual} onChange={v => handleChecklistChange('inspeccionVisual', v)} readonly={isReadOnly} />
                <ChecklistItem label="Limpieza Exterior" value={checklist.limpiezaExterior} onChange={v => handleChecklistChange('limpiezaExterior', v)} readonly={isReadOnly} />
                <ChecklistItem label="Toma de datos de condicion" value={checklist.tomaDatos} onChange={v => handleChecklistChange('tomaDatos', v)} readonly={isReadOnly} />
                <ChecklistItem label="Revision de funcionamiento" value={checklist.revisionFuncionamiento} onChange={v => handleChecklistChange('revisionFuncionamiento', v)} readonly={isReadOnly} />
                <ChecklistItem label="Conexiones eléctricas" value={checklist.conexionesElectricas} onChange={v => handleChecklistChange('conexionesElectricas', v)} readonly={isReadOnly} />
                <ChecklistItem label="Medición de consumos" value={checklist.medicionConsumos} onChange={v => handleChecklistChange('medicionConsumos', v)} readonly={isReadOnly} />
                <ChecklistItem label="Funcionamiento general" value={checklist.funcionamientoGeneral} onChange={v => handleChecklistChange('funcionamientoGeneral', v)} readonly={isReadOnly} />
             </div>
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
             <SectionBox title="Firmas del Documento">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   {/* Firma Técnico */}
                   <div className="space-y-2">
                      <div className="flex justify-between items-center bg-slate-50 px-4 py-2 rounded-t-xl border border-b-0 border-slate-200">
                         <span className="text-xs font-black text-slate-900 uppercase">Técnico: {generalData.tecnico}</span>
                         {!isReadOnly && (
                           <button onClick={() => {
                             const canvas = canvasTecRef.current;
                             if(canvas) {
                               const ctx = canvas.getContext('2d');
                               ctx?.clearRect(0,0,canvas.width,canvas.height);
                             }
                           }} className="text-[10px] font-bold text-red-500 uppercase hover:underline">Limpiar</button>
                         )}
                      </div>
                      <div className="bg-white border border-slate-200 rounded-b-xl overflow-hidden relative">
                         {isReadOnly && <div className="absolute inset-0 bg-slate-50/50 z-10" />}
                         <canvas ref={canvasTecRef} className="w-full h-48 cursor-crosshair touch-none" />
                      </div>
                   </div>

                   {/* Firma Cliente */}
                   <div className="space-y-2">
                      <div className="flex justify-between items-center bg-slate-50 px-4 py-2 rounded-t-xl border border-b-0 border-slate-200">
                         <span className="text-xs font-black text-slate-900 uppercase">Cliente: {generalData.nombreCliente || "Nombre Cliente"}</span>
                         {!isReadOnly && (
                           <button onClick={() => {
                             const canvas = canvasCliRef.current;
                             if(canvas) {
                               const ctx = canvas.getContext('2d');
                               ctx?.clearRect(0,0,canvas.width,canvas.height);
                             }
                           }} className="text-[10px] font-bold text-red-500 uppercase hover:underline">Limpiar</button>
                         )}
                      </div>
                      <div className="bg-white border border-slate-200 rounded-b-xl overflow-hidden relative">
                         {isReadOnly && <div className="absolute inset-0 bg-slate-50/50 z-10" />}
                         <canvas ref={canvasCliRef} className="w-full h-48 cursor-crosshair touch-none" />
                      </div>
                   </div>
                </div>
             </SectionBox>

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

function ChecklistItem({ label, value, onChange, readonly }: { label: string, value: string, onChange: (v:string)=>void, readonly: boolean }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-slate-50 border border-slate-100 rounded-2xl">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 cursor-pointer">
           <input type="radio" value="OK" checked={value === 'OK'} disabled={readonly} onChange={() => onChange('OK')} className="peer sr-only" />
           <div className="px-4 py-2 text-xs font-bold uppercase rounded-lg border border-slate-200 text-slate-500 peer-checked:bg-emerald-500 peer-checked:text-white peer-checked:border-emerald-500 transition-all">OK</div>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
           <input type="radio" value="NOK" checked={value === 'NOK'} disabled={readonly} onChange={() => onChange('NOK')} className="peer sr-only" />
           <div className="px-4 py-2 text-xs font-bold uppercase rounded-lg border border-slate-200 text-slate-500 peer-checked:bg-red-500 peer-checked:text-white peer-checked:border-red-500 transition-all">NOK</div>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
           <input type="radio" value="N/A" checked={value === 'N/A'} disabled={readonly} onChange={() => onChange('N/A')} className="peer sr-only" />
           <div className="px-4 py-2 text-xs font-bold uppercase rounded-lg border border-slate-200 text-slate-500 peer-checked:bg-slate-700 peer-checked:text-white peer-checked:border-slate-700 transition-all">N/A</div>
        </label>
      </div>
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
