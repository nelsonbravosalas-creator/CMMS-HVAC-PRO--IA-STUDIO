import React, { useState } from 'react';
import { 
  X, Camera, Trash2, Tag, AlertTriangle, User, MessageSquare, Save, Search, Building2, History, MapPin
} from 'lucide-react';
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import { AssetSearchModal } from './AssetSearchModal';
import { EQUIPOS_DATA } from '../../data/assets';
import { ALMACEN_LABELS } from '../../data/branches';
import { useTickets } from '../../hooks/useTickets';
import { SearchableSelect } from '../SearchableSelect';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { useAppStore } from '../../store/useAppStore';

interface TicketFormProps {
  onClose: () => void;
  equipoTag?: string;
}

export const TicketForm: React.FC<TicketFormProps> = ({ onClose, equipoTag: initialTag }) => {
  const { createTicket } = useTickets();
  const [showAssetSearch, setShowAssetSearch] = useState(false);
  const [tag, setTag] = useState(initialTag || "");
  const [equipoDesc, setEquipoDesc] = useState("");
  const [cliente, setCliente] = useState(localStorage.getItem("active_client") || "");
  const [sucursal, setSucursal] = useState("");
  
  // Form fields
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [prioridad, setPrioridad] = useState("Media");
  const [tipoIncidencia, setTipoIncidencia] = useState("Falla Técnica");
  const [asignadoA, setAsignadoA] = useState("Nelson Bravo (Tech Lead)");
  
  const storeClients = useAppStore(state => state.clients);
  const storeBranches = useAppStore(state => state.branches);

  const activeClientUuid = localStorage.getItem("active_client");
  const localAssets = useLiveQuery(() => {
    let query = db.assets.filter(a => !a.deleted_at && a.estado !== 'baja');
    if (activeClientUuid) {
      return query.and(a => a.cliente_id === activeClientUuid).toArray();
    }
    return query.toArray();
  }, [activeClientUuid]) || [];

  React.useEffect(() => {
    if (tag && localAssets.length > 0) {
      const eq = localAssets.find(a => a.tag === tag);
      if (eq) {
        setEquipoDesc(eq.nombre || "");
        setCliente(eq.cliente_id || "");
        const branchObj = storeBranches && eq.sucursal_id ? storeBranches.find(b => b.uuid_sync === eq.sucursal_id) : null;
        setSucursal(branchObj ? branchObj.nombre : (eq.ubicacion || ""));
      }
    }
  }, [tag, localAssets, storeBranches]);
  
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
  
  // Search Modal States
  const [searchQuery, setSearchQuery] = useState("");
  const [searchClient, setSearchClient] = useState("");
  const [searchSucursal, setSearchSucursal] = useState("");
  const [searchDescription, setSearchDescription] = useState("");

  const filteredEquipos = localAssets.filter(eq => {
    const matchTag = searchQuery ? eq.tag.toLowerCase().includes(searchQuery.toLowerCase()) : true;
    const matchDesc = searchDescription ? eq.nombre.toLowerCase().includes(searchDescription.toLowerCase()) : true;
    const branchObj = storeBranches ? storeBranches.find(b => b.uuid_sync === eq.sucursal_id) : null;
    const matchSucursal = searchSucursal ? eq.sucursal_id === searchSucursal || (branchObj && branchObj.nombre === searchSucursal) : true;
    return matchTag && matchDesc && matchSucursal;
  });

  const handleSelectAsset = (eq: any) => {
    setTag(eq.tag);
    setEquipoDesc(eq.nombre);
    
    // Attempt to resolve names from IDs
    const clientObj = storeClients && eq.cliente_id ? storeClients.find(c => c.uuid_sync === eq.cliente_id) : null;
    const clientName = clientObj ? clientObj.nombre : eq.cliente_id;
    setCliente(eq.cliente_id); 
    
    const branchObj = storeBranches && eq.sucursal_id ? storeBranches.find(b => b.uuid_sync === eq.sucursal_id) : null;
    const branchName = branchObj ? branchObj.nombre : eq.sucursal_id;
    setSucursal(branchName);
    
    setShowAssetSearch(false);
  };

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [imagenes, setImagenes] = useState<string[]>([]);
  const [imagePreviews, setImagePreviews] = useState<{id: string, url: string}[]>([]);

  const handleImageCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    // Process image: compress and watermark
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = async () => {
      if (!ctx) return;
      
      // Target max width/height
      const MAX_SIZE = 1200;
      let width = img.width;
      let height = img.height;
      if (width > height && width > MAX_SIZE) {
        height *= MAX_SIZE / width;
        width = MAX_SIZE;
      } else if (height > MAX_SIZE) {
        width *= MAX_SIZE / height;
        height = MAX_SIZE;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      ctx.drawImage(img, 0, 0, width, height);
      
      // Add watermark
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, height - 60, width, 60);
      
      ctx.font = '20px sans-serif';
      ctx.fillStyle = 'white';
      const dateStr = new Date().toLocaleString('es-CL');
      ctx.fillText(`Fecha: ${dateStr}`, 20, height - 35);
      ctx.fillText(`Usuario: Actual User | TAG: ${tag || 'N/A'}`, 20, height - 10);
      
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const blobId = crypto.randomUUID();
        // Save to blob store
        await db.blobs.put({
          uuid_sync: blobId,
          blob: blob,
          mime_type: 'image/jpeg',
          created_at: Date.now()
        });
        
        const blobRef = `blob:${blobId}`;
        setImagenes(prev => [...prev, blobRef]);
        
        // Add to preview
        const reader = new FileReader();
        reader.onload = () => {
          setImagePreviews(prev => [...prev, { id: blobRef, url: reader.result as string }]);
        };
        reader.readAsDataURL(blob);
      }, 'image/jpeg', 0.8);
    };
    
    img.src = URL.createObjectURL(file);
  };

  const removeImage = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const uuid = id.replace('blob:', '');
    await db.blobs.delete(uuid);
    setImagenes(prev => prev.filter(imgId => imgId !== id));
    setImagePreviews(prev => prev.filter(p => p.id !== id));
  };

  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    if (tipoIncidencia === 'Falla Técnica' && !tag) {
       alert("Un ticket de tipo 'Falla Técnica' requiere vincular un activo (TAG) obligatorio.");
       setIsSaving(false);
       return;
    }

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
        ubicacionGeografica,
        imagenes,
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
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
        <div className="bg-white w-full max-w-2xl rounded-t-3xl sm:rounded-[40px] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-200 flex flex-col h-[100dvh] sm:h-auto sm:max-h-[95vh]">
          {/* Header */}
          <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
            <div>
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Nuevo Ticket de Soporte</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Vincule un activo para mayor precisión en la trazabilidad</p>
            </div>
            <button onClick={onClose} className="p-3 hover:bg-slate-200 rounded-2xl transition-all text-slate-400 hover:text-slate-900"><X className="w-6 h-6" /></button>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto flex-1 min-h-0">
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
              <div className="space-y-1 z-40">
                <label className="text-[10px] font-black uppercase text-slate-400">Prioridad</label>
                <SearchableSelect
                  options={[
                    { value: 'Baja', label: 'Baja' },
                    { value: 'Media', label: 'Media' },
                    { value: 'Alta', label: 'Alta' },
                    { value: 'CRÍTICA', label: 'CRÍTICA' },
                  ]}
                  value={prioridad}
                  onChange={setPrioridad}
                  placeholder="Selecciona prioridad"
                />
              </div>
              <div className="space-y-1 z-30">
                <label className="text-[10px] font-black uppercase text-slate-400">Tipo Incidencia</label>
                <SearchableSelect
                  options={[
                    { value: 'Falla Técnica', label: 'Falla Técnica' },
                    { value: 'Mejora Solicitada', label: 'Mejora Solicitada' },
                    { value: 'Consulta Preventiva', label: 'Consulta Preventiva' },
                    { value: 'Garantía', label: 'Garantía' },
                  ]}
                  value={tipoIncidencia}
                  onChange={setTipoIncidencia}
                  placeholder="Selecciona tipo"
                />
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

            <div className="space-y-1 z-20">
              <label className="text-[10px] font-black uppercase text-slate-400">Asignar Personal</label>
              <SearchableSelect
                options={[
                  { value: 'Nelson Bravo (Tech Lead)', label: 'Nelson Bravo (Tech Lead)' },
                  { value: 'Gonzalo Bravo (Senior Tech)', label: 'Gonzalo Bravo (Senior Tech)' },
                  { value: 'Disponible para cualquiera', label: 'Disponible para cualquiera' },
                ]}
                value={asignadoA}
                onChange={setAsignadoA}
                placeholder="Selecciona personal"
                icon={<User className="w-4 h-4 text-slate-400" />}
              />
            </div>

            <div className="flex gap-4">
              <input type="file" accept="image/*" capture="environment" className="hidden" ref={fileInputRef} onChange={handleImageCapture} />
              <button 
                type="button" 
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 py-4 bg-slate-50 text-slate-400 rounded-[24px] border border-slate-100 flex flex-col items-center justify-center gap-2 hover:bg-slate-100/80 transition-all group"
              >
                <Camera className="w-6 h-6 group-hover:text-blue-500 transition-colors" />
                <span className="text-[9px] font-black uppercase">Adjuntar Evidencia</span>
              </button>
              <button 
                type="button" 
                onClick={captureGPS}
                disabled={gpsLoading}
                className="flex-1 py-4 bg-slate-50 text-slate-400 rounded-[24px] border border-slate-100 flex flex-col items-center justify-center gap-2 hover:bg-emerald-50 hover:text-emerald-600 transition-all group hover:border-emerald-100"
              >
                 <MapPin className={`w-6 h-6 ${gpsLoading ? 'animate-pulse text-emerald-500' : (ubicacionGeografica ? 'text-emerald-500' : '')}`} />
                 <span className="text-[9px] font-black uppercase">
                   {gpsLoading ? 'Obteniendo GPS...' : (ubicacionGeografica ? 'Ubicación Capturada' : 'Capturar Ubicación')}
                 </span>
              </button>
            </div>

            {imagePreviews.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-4">
                {imagePreviews.map(preview => (
                  <div key={preview.id} className="relative aspect-square bg-slate-100 rounded-2xl overflow-hidden group">
                    <img src={preview.url} alt="evidencia" className="w-full h-full object-cover" />
                    <button 
                      type="button"
                      onClick={(e) => removeImage(preview.id, e)}
                      className="absolute top-2 right-2 bg-rose-500 text-white p-1.5 rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {gpsError && (
              <p className="text-xs text-rose-500 font-bold">{gpsError}</p>
            )}

            {ubicacionGeografica && import.meta.env.VITE_GOOGLE_MAPS_PLATFORM_KEY && (
              <div className="w-full h-48 rounded-2xl overflow-hidden border border-slate-200 mt-2">
                <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_PLATFORM_KEY}>
                  <Map 
                    defaultZoom={15} 
                    defaultCenter={ubicacionGeografica}
                    mapId="ticket_map_id"
                    disableDefaultUI
                  >
                    <AdvancedMarker position={ubicacionGeografica}>
                      <Pin background={'#ef4444'} borderColor={'#7f1d1d'} glyphColor={'#7f1d1d'} />
                    </AdvancedMarker>
                  </Map>
                </APIProvider>
              </div>
            )}

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
