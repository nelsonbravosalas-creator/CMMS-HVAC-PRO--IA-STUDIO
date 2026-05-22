import React, { useState } from 'react';
import { 
  X, Camera, Paperclip, Save, RotateCcw, AlertTriangle, Calendar, Clock, DollarSign, ListChecks, Wrench, User, Search, MapPin
} from 'lucide-react';
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';

import { useMantenimientos } from '../../hooks/useMantenimientos';
import { AssetSearchModal } from './AssetSearchModal';

interface NuevoMantenimientoModalProps {
  onClose: () => void;
  duplicateId?: string;
  equipoTag?: string;
}

export const NuevoMantenimientoModal: React.FC<NuevoMantenimientoModalProps> = ({ onClose, duplicateId, equipoTag: initialTag }) => {
  const { createMantenimiento } = useMantenimientos();
  const [hasChanges, setHasChanges] = useState(false);
  const [frecuencia, setFrecuencia] = useState("Mensual");
  const [fechaActual, setFechaActual] = useState(new Date().toISOString().split('T')[0]);
  const [proximaMantencion, setProximaMantencion] = useState("");
  const [tipoServicio, setTipoServicio] = useState("Preventivo");
  const [estadoFinal, setEstadoFinal] = useState("Realizado");
  const [descripcion, setDescripcion] = useState("");
  const [equipoTag, setEquipoTag] = useState(initialTag || "");
  const [tecnico, setTecnico] = useState("Nelson Bravo");
  const [duracion, setDuracion] = useState("60");
  const [costoMateriales, setCostoMateriales] = useState("0");
  const [hallazgos, setHallazgos] = useState("");
  const [recomendaciones, setRecomendaciones] = useState("");
  const [repuestos, setRepuestos] = useState("");
  
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

  React.useEffect(() => {
    if(!fechaActual) return;
    try {
      const dateParts = fechaActual.split('-');
      if (dateParts.length !== 3) return;
      const date = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
      
      let nextDate: Date | null = null;
      switch(frecuencia) {
          case "Mensual": date.setMonth(date.getMonth() + 1); nextDate = date; break;
          case "Bi-Mestral": date.setMonth(date.getMonth() + 2); nextDate = date; break;
          case "Trimestral": date.setMonth(date.getMonth() + 3); nextDate = date; break;
          case "Cuatrimestral": date.setMonth(date.getMonth() + 4); nextDate = date; break;
          case "Semestral": date.setMonth(date.getMonth() + 6); nextDate = date; break;
          case "Anual": date.setFullYear(date.getFullYear() + 1); nextDate = date; break;
          case "Por Demanda": 
          case "Unico":
          default: nextDate = null; break;
      }
      if (nextDate) {
          const year = nextDate.getFullYear();
          const month = String(nextDate.getMonth() + 1).padStart(2, '0');
          const day = String(nextDate.getDate()).padStart(2, '0');
          setProximaMantencion(`${year}-${month}-${day}`);
      } else {
          setProximaMantencion("");
      }
    } catch(e) {
    }
  }, [frecuencia, fechaActual]);

  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     setIsSaving(true);

     if (!equipoTag) {
        setIsSaving(false);
        alert("Error: Falta TAG de Equipo.");
        return;
     }

     try {
        const docId = `MANT-${Date.now()}`;
        await createMantenimiento({
          id: docId,
          equipo_tag: equipoTag,
          tipo: tipoServicio,
          estado: estadoFinal,
          fecha: fechaActual,
          tecnico: tecnico,
          hallazgos: hallazgos,
          acciones: descripcion,
          repuestos: repuestos,
          ubicacionGeografica
        });
        
        if (estadoFinal === 'realizado' || estadoFinal === 'completado') {
           try {
              const { jsPDF } = await import('jspdf');
              const doc = new jsPDF('p', 'mm', 'a4');
              doc.setFont("helvetica", "bold");
              doc.text(`REGISTRO DE MANTENIMIENTO: ${docId}`, 10, 10);
              doc.setFontSize(10);
              doc.text(`Técnico: ${tecnico}`, 10, 20);
              doc.text(`Equipo: ${equipoTag}`, 10, 25);
              
              const pdfBase64 = doc.output('datauristring');
              const { DocumentExportService } = await import('../../lib/DocumentExportService');
              const exportResult = await DocumentExportService.exportDocument({
                documentId: docId,
                documentType: 'maintenance',
                method: 'email',
                assetTag: equipoTag,
                pdfBase64
              });
              alert(`Mantenimiento Finalizado.\n${exportResult.message}`);
           } catch (e: any) {
              console.warn("Export error", e);
              alert(`Mantenimiento guardado.\nNota: Módulo de email fallido: ${e.message}`);
           }
        }
        
        onClose();
     } catch (error) {
        console.error("Error guardando mantenimiento", error);
        alert("Error al guardar el registro.");
     } finally {
        setIsSaving(false);
     }
  };

  const handleClose = () => {
    if (hasChanges) {
      if (confirm("Hay cambios sin guardar. ¿Desea descartar los cambios?")) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-t-3xl sm:rounded-[40px] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-200 flex flex-col h-[100dvh] sm:h-auto sm:max-h-[90vh]">
        
        <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-4">
             <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-500/20">
                <Wrench className="w-6 h-6" />
             </div>
             <div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                  {duplicateId ? 'Duplicar Registro' : 'Nuevo Mantenimiento'}
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Bitácora técnica de intervención activa</p>
             </div>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-10 space-y-8 overflow-y-auto flex-1 min-h-0" onChange={() => setHasChanges(true)}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">Equipo Destino (TAG)</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="text" 
                    placeholder="EJ: 21-STK.AC.001" 
                    className="flex-1 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-500/10" 
                    value={equipoTag}
                    onChange={(e) => setEquipoTag(e.target.value)}
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowAssetSearch(true)}
                    className="p-3 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100 hover:bg-blue-100 transition-colors"
                    title="Buscar Equipo"
                  >
                    <Search className="w-5 h-5" />
                  </button>
                </div>
             </div>
             <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">Tipo Servicio</label>
                <select 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold uppercase outline-none"
                  value={tipoServicio}
                  onChange={(e) => setTipoServicio(e.target.value)}
                >
                  <option value="Preventivo">Preventivo</option>
                  <option value="Correctivo">Correctivo</option>
                  <option value="Emergencia">Emergencia</option>
                </select>
             </div>
             <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">Estado Final</label>
                <select 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold uppercase outline-none"
                  value={estadoFinal}
                  onChange={(e) => setEstadoFinal(e.target.value)}
                >
                  <option value="Realizado">Realizado</option>
                  <option value="Pendiente">Pendiente</option>
                  <option value="Observado">Observado</option>
                </select>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
             <Field label="Fecha" type="date" value={fechaActual} onChange={(e) => setFechaActual(e.target.value)} icon={<Calendar className="w-3 h-3" />} />
             <Field label="Técnico" type="text" value={tecnico} onChange={(e) => setTecnico(e.target.value)} icon={<User className="w-3 h-3" />} />
             <Field label="Duración (Min)" type="number" value={duracion} onChange={(e) => setDuracion(e.target.value)} icon={<Clock className="w-3 h-3" />} />
             <Field label="Costo Materiales" type="number" value={costoMateriales} onChange={(e) => setCostoMateriales(e.target.value)} icon={<DollarSign className="w-3 h-3" />} />
          </div>

          <div className="space-y-6">
             <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">Descripción de trabajos realizados</label>
                <textarea 
                  rows={3} 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none resize-none" 
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                />
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase text-slate-400">Hallazgos Críticos</label>
                   <textarea 
                    rows={2} 
                    className="w-full px-4 py-3 bg-red-50/30 border border-red-100 rounded-2xl text-xs font-bold outline-none resize-none" 
                    value={hallazgos}
                    onChange={(e) => setHallazgos(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase text-slate-400">Acciones Recomendadas</label>
                   <textarea 
                    rows={2} 
                    className="w-full px-4 py-3 bg-blue-50/30 border border-blue-100 rounded-2xl text-xs font-bold outline-none resize-none" 
                    value={recomendaciones}
                    onChange={(e) => setRecomendaciones(e.target.value)}
                  />
                </div>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 bg-slate-50 rounded-[32px] border border-slate-100">
             <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">Frecuencia</label>
                <select value={frecuencia} onChange={(e) => setFrecuencia(e.target.value)} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-500/10">
                  <option value="Unico">Único</option>
                  <option value="Mensual">Mensual</option>
                  <option value="Bi-Mestral">Bi-Mestral</option>
                  <option value="Trimestral">Trimestral</option>
                  <option value="Cuatrimestral">Cuatrimestral</option>
                  <option value="Semestral">Semestral</option>
                  <option value="Anual">Anual</option>
                  <option value="Por Demanda">Por Demanda</option>
                </select>
             </div>
             <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">Sugerencia Próx. Mantención</label>
                <input type="date" value={proximaMantencion} onChange={(e) => setProximaMantencion(e.target.value)} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/10" />
             </div>
             <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">Repuestos Utilizados</label>
                <input 
                  type="text" 
                  placeholder="Filtro 20x20, Refrigerante..." 
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/10" 
                  value={repuestos}
                  onChange={(e) => setRepuestos(e.target.value)}
                />
             </div>
          </div>
          
          <div className="flex gap-4 mt-4">
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
          {gpsError && (
              <p className="text-xs text-rose-500 font-bold mt-2">{gpsError}</p>
          )}

          {ubicacionGeografica && import.meta.env.VITE_GOOGLE_MAPS_PLATFORM_KEY && (
              <div className="w-full h-48 rounded-2xl overflow-hidden border border-slate-200 mt-4 mb-4">
                <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_PLATFORM_KEY}>
                  <Map 
                    defaultZoom={15} 
                    defaultCenter={ubicacionGeografica}
                    mapId="mantenimiento_map_id"
                    disableDefaultUI
                  >
                    <AdvancedMarker position={ubicacionGeografica}>
                      <Pin background={'#ef4444'} borderColor={'#7f1d1d'} glyphColor={'#7f1d1d'} />
                    </AdvancedMarker>
                  </Map>
                </APIProvider>
              </div>
          )}

          <div className="flex gap-4 mt-6">
             <button type="submit" disabled={isSaving} className="flex-1 py-5 bg-blue-600 text-white text-xs font-black uppercase tracking-widest rounded-[32px] shadow-2xl shadow-blue-500/20 active:scale-[0.98] transition-all flex justify-center items-center gap-2 disabled:opacity-50">
                {isSaving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : null}
                {isSaving ? "Guardando..." : "Finalizar y Guardar Registro"}
             </button>
             <button type="button" onClick={handleClose} className="px-10 py-5 bg-slate-100 text-slate-400 text-xs font-black uppercase tracking-widest rounded-[32px] hover:bg-slate-200 transition-all">
                Cancelar
             </button>
          </div>
        </form>
      </div>

      {showAssetSearch && (
        <AssetSearchModal 
          onClose={() => setShowAssetSearch(false)}
          onSelect={(asset) => {
            setEquipoTag(asset.tag);
            setShowAssetSearch(false);
          }}
        />
      )}
    </div>
  );
};

function Field({ label, type, value, defaultValue, onChange, icon }: { label: string, type: string, value?: string, defaultValue?: string, onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void, icon: React.ReactNode }) {
  return (
    <div className="space-y-1">
       <div className="flex items-center gap-1.5 ml-1">
          <div className="text-slate-300">{icon}</div>
          <label className="text-[9px] font-black uppercase text-slate-400">{label}</label>
       </div>
       <input type={type} value={value} defaultValue={defaultValue} onChange={onChange} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none" />
    </div>
  );
}
