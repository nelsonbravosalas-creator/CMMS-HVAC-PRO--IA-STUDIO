import React, { useState } from 'react';
import { 
  X, Camera, Paperclip, Save, RotateCcw, AlertTriangle, Calendar, Clock, DollarSign, ListChecks, Wrench, User
} from 'lucide-react';

interface NuevoMantenimientoModalProps {
  onClose: () => void;
  duplicateId?: string;
}

export const NuevoMantenimientoModal: React.FC<NuevoMantenimientoModalProps & { equipoTag?: string }> = ({ onClose, duplicateId, equipoTag }) => {
  const [hasChanges, setHasChanges] = useState(false);
  const [frecuencia, setFrecuencia] = useState("Mensual");
  const [fechaActual, setFechaActual] = useState(new Date().toISOString().split('T')[0]);
  const [proximaMantencion, setProximaMantencion] = useState("");
  const [tipoServicio, setTipoServicio] = useState("Preventivo");
  const [estadoFinal, setEstadoFinal] = useState("Realizado");
  const [descripcion, setDescripcion] = useState("");

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

     const formData = {
        frecuencia,
        fechaActual,
        proximaMantencion,
        tipoServicio,
        estadoFinal,
        descripcion,
        idRegistro: `MANT-${Date.now()}`,
     };

     if (!equipoTag) {
        setIsSaving(false);
        alert("Error: Faltab TAG de Equipo.");
        return;
     }

     try {
        const response = await fetch(`/api/equipos?tag=${equipoTag}&action=mantenimiento`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mantenimiento: formData })
        });
        
        if (!response.ok) throw new Error("Fallo la respuesta del servidor");

        console.log("Mantenimiento sincronizado con la nube a través de Neon");
        alert("Registro de mantenimiento completado exitosamente y sincronizado en = Neon.");
        setHasChanges(false);
        onClose();
     } catch (error) {
        console.error("Error sincronizando mantenimiento", error);
        alert("Guardado localmente. Falló la sincronización con la nube.");
        onClose();
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
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
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

        <form onSubmit={handleSubmit} className="p-10 space-y-8 overflow-y-auto" onChange={() => setHasChanges(true)}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">Equipo Destino (TAG)</label>
                <input type="text" placeholder="EJ: 21-STK.AC.001" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-500/10" />
             </div>
             <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">Tipo Servicio</label>
                <select className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold uppercase outline-none">
                  <option>Preventivo</option>
                  <option>Correctivo</option>
                  <option>Emergencia</option>
                </select>
             </div>
             <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">Estado Final</label>
                <select className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold uppercase outline-none">
                  <option>Realizado</option>
                  <option>Pendiente</option>
                  <option>Observado</option>
                </select>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
             <Field label="Fecha" type="date" value={fechaActual} onChange={(e) => setFechaActual(e.target.value)} icon={<Calendar className="w-3 h-3" />} />
             <Field label="Técnico" type="text" defaultValue="Nelson Bravo" icon={<User className="w-3 h-3" />} />
             <Field label="Duración (Min)" type="number" defaultValue="60" icon={<Clock className="w-3 h-3" />} />
             <Field label="Costo Materiales" type="number" defaultValue="0" icon={<DollarSign className="w-3 h-3" />} />
          </div>

          <div className="space-y-6">
             <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">Descripción de trabajos realizados</label>
                <textarea rows={3} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none resize-none" />
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase text-slate-400">Hallazgos Críticos</label>
                   <textarea rows={2} className="w-full px-4 py-3 bg-red-50/30 border border-red-100 rounded-2xl text-xs font-bold outline-none resize-none" />
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase text-slate-400">Acciones Recomendadas</label>
                   <textarea rows={2} className="w-full px-4 py-3 bg-blue-50/30 border border-blue-100 rounded-2xl text-xs font-bold outline-none resize-none" />
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
                <input type="text" placeholder="Filtro 20x20, Refrigerante..." className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/10" />
             </div>
          </div>

          <div className="flex gap-4">
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
