import React, { useState } from 'react';
import { 
  X, Camera, Paperclip, Save, RotateCcw, AlertTriangle, Calendar, Clock, DollarSign, ListChecks, Wrench, User
} from 'lucide-react';
import { DataStore } from '../../services/dataStore';
import { Mantenimiento } from '../../data/mantenimientos';

interface NuevoMantenimientoModalProps {
  onClose: () => void;
  onSave?: (mantenimiento: Mantenimiento) => void;
  duplicateId?: string;
}

export const NuevoMantenimientoModal: React.FC<NuevoMantenimientoModalProps> = ({ onClose, onSave, duplicateId }) => {
  const [hasChanges, setHasChanges] = useState(false);
  const [tag, setTag] = useState('');
  const [serviceType, setServiceType] = useState<'preventivo' | 'correctivo' | 'inspeccion' | 'instalacion'>('preventivo');
  const [status, setStatus] = useState<'programado' | 'realizado' | 'ejecutado' | 're-programado' | 'anulado'>('programado');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [technician, setTechnician] = useState('Nelson Bravo');
  const [duration, setDuration] = useState('60');
  const [cost, setCost] = useState('0');
  const [description, setDescription] = useState('');
  const [findings, setFindings] = useState('');
  const [actions, setActions] = useState('');
  const [nextDate, setNextDate] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [spares, setSpares] = useState('');

  const handleClose = () => {
    if (hasChanges) {
      if (confirm("Hay cambios sin guardar. ¿Desea descartar los cambios?")) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tag || !description) {
      alert("Completa al menos TAG y descripción para guardar el mantenimiento.");
      return;
    }

    const newMantenimiento: Mantenimiento = {
      id: `M-${Date.now()}`,
      tag,
      tipo: serviceType,
      fecha: date,
      estado: status,
      sucursal: 'Santiago B01',
      tecnico: technician,
      descripcion: `${description}\nHallazgos: ${findings}\nAcciones: ${actions}`
    };

    DataStore.addMantenimiento(newMantenimiento);
    onSave?.(newMantenimiento);
    onClose();
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

        <form className="p-10 space-y-8 overflow-y-auto" onSubmit={handleSubmit} onChange={() => setHasChanges(true)}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">Equipo Destino (TAG)</label>
                <input
                  type="text"
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  placeholder="EJ: 21-STK.AC.001"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-500/10"
                />
             </div>
             <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">Tipo Servicio</label>
                <select
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value as any)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold uppercase outline-none"
                >
                  <option value="preventivo">Preventivo</option>
                  <option value="correctivo">Correctivo</option>
                  <option value="inspeccion">Inspección</option>
                  <option value="instalacion">Instalación</option>
                </select>
             </div>
             <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">Estado Final</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold uppercase outline-none"
                >
                  <option value="realizado">Realizado</option>
                  <option value="programado">Programado</option>
                  <option value="ejecutado">Ejecutado</option>
                  <option value="re-programado">Re-Programado</option>
                  <option value="anulado">Anulado</option>
                </select>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
             <Field label="Fecha" type="date" value={date} onChange={(value) => setDate(value)} icon={<Calendar className="w-3 h-3" />} />
             <Field label="Técnico" type="text" value={technician} onChange={(value) => setTechnician(value)} icon={<User className="w-3 h-3" />} />
             <Field label="Duración (Min)" type="number" value={duration} onChange={(value) => setDuration(value)} icon={<Clock className="w-3 h-3" />} />
             <Field label="Costo Materiales" type="number" value={cost} onChange={(value) => setCost(value)} icon={<DollarSign className="w-3 h-3" />} />
          </div>

          <div className="space-y-6">
             <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">Descripción de trabajos realizados</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none resize-none"
                />
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase text-slate-400">Hallazgos Críticos</label>
                   <textarea
                     rows={2}
                     value={findings}
                     onChange={(e) => setFindings(e.target.value)}
                     className="w-full px-4 py-3 bg-red-50/30 border border-red-100 rounded-2xl text-xs font-bold outline-none resize-none"
                   />
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase text-slate-400">Acciones Recomendadas</label>
                   <textarea
                     rows={2}
                     value={actions}
                     onChange={(e) => setActions(e.target.value)}
                     className="w-full px-4 py-3 bg-blue-50/30 border border-blue-100 rounded-2xl text-xs font-bold outline-none resize-none"
                   />
                </div>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-50 rounded-[32px] border border-slate-100">
             <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">Próxima Mantención</label>
                <input
                  type="date"
                  value={nextDate}
                  onChange={(e) => setNextDate(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold outline-none"
                />
             </div>
             <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">Repuestos Utilizados (Separar por coma)</label>
                <input
                  type="text"
                  value={spares}
                  onChange={(e) => setSpares(e.target.value)}
                  placeholder="Filtro 20x20, Refrigerante R410..."
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold outline-none"
                />
             </div>
          </div>

          <div className="flex gap-4">
             <button type="submit" className="flex-1 py-5 bg-blue-600 text-white text-xs font-black uppercase tracking-widest rounded-[32px] shadow-2xl shadow-blue-500/20 active:scale-[0.98] transition-all">
                Finalizar y Guardar Registro
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

function Field({ label, type, value, onChange, icon }: { label: string, type: string, value: string, onChange: (value: string) => void, icon: React.ReactNode }) {
  return (
    <div className="space-y-1">
       <div className="flex items-center gap-1.5 ml-1">
          <div className="text-slate-300">{icon}</div>
          <label className="text-[9px] font-black uppercase text-slate-400">{label}</label>
       </div>
       <input
         type={type}
         value={value}
         onChange={(e) => onChange(e.target.value)}
         className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none"
       />
    </div>
  );
}
