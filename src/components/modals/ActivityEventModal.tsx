import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Calendar as CalendarIcon, 
  MapPin, 
  Users, 
  FileText, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Ticket,
  Link as LinkIcon
} from 'lucide-react';

interface ActivityEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: any;
}

export function ActivityEventModal({ isOpen, onClose, event }: ActivityEventModalProps) {
  if (!event) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className={`p-6 text-white ${
              event.resource?.status === 'ejecutada' ? 'bg-emerald-600' : 
              event.resource?.status === 'pendiente' ? 'bg-amber-500' : 
              event.resource?.status === 're-coordinada' ? 'bg-rose-500' : 
              'bg-blue-600'
            }`}>
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-black uppercase tracking-tight">{event.title}</h2>
                  <p className="text-white/80 font-bold text-sm mt-1 uppercase tracking-widest">{event.resource?.client} - {event.resource?.branch}</p>
                </div>
                <button 
                  onClick={onClose}
                  className="p-2 bg-black/20 hover:bg-black/40 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 md:p-8 overflow-y-auto space-y-8 flex-1">
              
              {/* Core Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Horario</p>
                      <p className="text-sm font-bold text-slate-900">{event.start?.toLocaleString()} - {event.end?.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Dirección (Ubicación)</p>
                      <p className="text-sm font-bold text-slate-900">{event.resource?.address || 'Av. Principal 123, Ciudad'}</p>
                      <a href="#" className="text-xs font-bold text-blue-600 hover:underline">Ver en Google Maps</a>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Users className="w-5 h-5 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Invitados / Participantes</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2 py-1 rounded-lg">{event.resource?.tech} (Técnico Líder)</span>
                        {event.resource?.assistant && <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2 py-1 rounded-lg">{event.resource?.assistant} (Ayudante)</span>}
                        {event.resource?.guests?.map((guest: string, i: number) => (
                          <span key={i} className="text-xs font-bold bg-blue-50 text-blue-700 px-2 py-1 rounded-lg border border-blue-100">{guest}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-slate-400">
                  <FileText className="w-4 h-4" />
                  <p className="text-xs font-black uppercase tracking-widest">Detalles de Actividad</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-sm text-slate-700 font-medium">
                    {event.resource?.details || 'Realizar mantenimiento preventivo según pauta del fabricante. Verificar presiones de refrigerante, consumos eléctricos y limpieza de serpentines.'}
                  </p>
                </div>
              </div>

              {/* Milestones / Synergy Timeline */}
              <div className="space-y-4">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Hitos y Sinergia CMMS</p>
                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-slate-200 before:to-transparent">
                  
                  {/* Milestone 1: Ticket Creation */}
                  <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full border-2 border-white bg-blue-500 text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                      <Ticket className="w-3 h-3" />
                    </div>
                    <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-xl border border-slate-100 bg-white shadow-sm flex flex-col justify-center">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-black text-slate-900 text-xs uppercase">Creación de Ticket</span>
                        <span className="font-bold text-slate-400 text-[10px]">22 Abr 09:15</span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Ticket <span className="font-bold text-blue-600">{event.resource?.ticketNum || 'TK-4512'}</span> generado en sistema.
                      </p>
                    </div>
                  </div>

                  {/* Milestone 2: Maintenance Planned */}
                  <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full border-2 border-white bg-blue-500 text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                      <CalendarIcon className="w-3 h-3" />
                    </div>
                    <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-xl border border-slate-100 bg-white shadow-sm flex flex-col justify-center">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-black text-slate-900 text-xs uppercase">Planificación</span>
                        <span className="font-bold text-slate-400 text-[10px]">23 Abr 14:30</span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium">Asignado a {event.resource?.tech} en calendario.</p>
                    </div>
                  </div>

                  {/* Milestone 3: Execution */}
                  <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                    <div className={`flex items-center justify-center w-6 h-6 rounded-full border-2 border-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 ${event.resource?.status === 'ejecutada' ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                      <CheckCircle2 className="w-3 h-3" />
                    </div>
                    <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-xl border border-slate-100 bg-white shadow-sm flex flex-col justify-center">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-black text-slate-900 text-xs uppercase">Mantenimiento</span>
                        <span className="font-bold text-slate-400 text-[10px]">{event.resource?.status === 'ejecutada' ? 'Completado' : 'Pendiente'}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium">
                        {event.resource?.status === 'ejecutada' ? `Informe ${event.resource?.reportNum} emitido.` : 'Esperando ejecución del trabajo.'}
                      </p>
                    </div>
                  </div>

                </div>
              </div>

            </div>

            {/* Footer Actions */}
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 rounded-b-3xl">
              <button 
                className="px-6 py-2.5 rounded-xl font-black text-slate-400 text-xs uppercase tracking-widest hover:text-slate-600 transition-colors"
                onClick={onClose}
              >
                Cerrar
              </button>
              <button className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center gap-2 transition-all active:scale-95">
                <LinkIcon className="w-4 h-4" />
                Ir a Ticket
              </button>
              <button className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-600/20 flex items-center gap-2 transition-all active:scale-95">
                <CalendarIcon className="w-4 h-4" />
                Agregar a Google Calendar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
