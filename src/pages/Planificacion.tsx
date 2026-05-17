import React, { useState } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  User, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCcw, 
  Plus,
  Filter,
  MoreVertical,
  Search,
  LayoutGrid,
  List,
  Tag,
  Building2,
  Truck,
  Users,
  FileText,
  Ticket,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { es } from 'date-fns/locale/es';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { ActivityEventModal } from '../components/modals/ActivityEventModal';
import { useEvents } from '../hooks/useEvents';

const locales = {
  'es': es,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

type ActivityStatus = 'programada' | 'ejecutada' | 'pendiente' | 're-coordinada';

interface Activity {
  id: string;
  title: string;
  tech: string;
  assistant?: string;
  vehicle?: string;
  client: string;
  branch: string;
  tag: string;
  startTime: string;
  duration: string;
  status: ActivityStatus;
  type: 'correctivo' | 'preventivo' | 'inspeccion';
  reportNum?: string;
  ticketNum?: string;
  ticketStatus?: 'abierto' | 'cerrado';
  address?: string;
  guests?: string[];
  details?: string;
}


const STATUS_CONFIG: Record<ActivityStatus, { label: string; icon: any; color: string; bg: string }> = {
  programada: { label: 'Programada', icon: Clock, color: 'text-blue-500', bg: 'bg-blue-50' },
  ejecutada: { label: 'Ejecutada', icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  pendiente: { label: 'Pendiente', icon: AlertCircle, color: 'text-amber-500', bg: 'bg-amber-50' },
  're-coordinada': { label: 'Re-coordinada', icon: RefreshCcw, color: 'text-rose-500', bg: 'bg-rose-50' },
};

export default function Planificacion() {
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [calendarView, setCalendarView] = useState<any>(Views.MONTH);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const { events } = useEvents();
  const activities = events.map(event => event.data as Activity);

  // Generate calendar events from offline-first events table.
  const calendarEvents = activities.map((act, index) => {
    const today = new Date();
    const [hours, minutes] = act.startTime.split(':').map(Number);
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() + index - 1, hours, minutes);
    const end = new Date(start.getTime() + parseInt(act.duration) * 60000);
    return {
      id: act.id,
      title: act.title,
      start,
      end,
      resource: act
    };
  });

  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const CustomEvent = ({ event }: any) => {
    const act = event.resource as Activity;
    const isList = calendarView !== Views.MONTH;
    
    return (
      <div className={`p-1 text-xs truncate rounded h-full ${
        act.status === 'ejecutada' ? 'bg-emerald-100 text-emerald-800' : 
        act.status === 'pendiente' ? 'bg-amber-100 text-amber-800' : 
        act.status === 're-coordinada' ? 'bg-rose-100 text-rose-800' : 
        'bg-blue-100 text-blue-800'
      }`}>
        <div className="font-bold">{event.title}</div>
        {!isList && <div className="text-[10px]">{event.start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {act.tech}</div>}
      </div>
    );
  };

  const handleSelectEvent = (event: any) => {
    setSelectedEvent(event);
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500 pb-32">
      <ActivityEventModal 
        isOpen={!!selectedEvent} 
        onClose={() => setSelectedEvent(null)} 
        event={selectedEvent} 
      />

      {/* Header section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter">Planificación HVAC</h1>
          <p className="text-slate-400 font-bold uppercase text-xs tracking-widest mt-1">Google Calendar Sync / Gestión de Actividades</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="bg-white p-1 rounded-2xl border border-slate-100 shadow-sm flex items-center">
            <button 
              onClick={() => setView('calendar')}
              className={`rounded-xl transition-all flex items-center justify-center ${view === 'calendar' ? 'bg-slate-900 shadow-lg' : 'hover:bg-slate-50'}`}
              style={{ 
                width: '43.9766px', 
                height: '46.9766px', 
                borderStyle: 'ridge', 
                color: '#dee5eb', 
                fontSize: '25px',
                borderWidth: '2px'
              }}
            >
              <LayoutGrid size={25} />
            </button>
            <button 
              onClick={() => setView('list')}
              className={`p-2 rounded-xl transition-all ${view === 'list' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
              style={{ width: '43.9766px', height: '46.9766px' }}
            >
              <List size={25} className="mx-auto" />
            </button>
          </div>
          <button className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-blue-600/20 hover:scale-105 active:scale-95 transition-all">
            <Plus className="w-4 h-4" />
            Nueva Actividad
          </button>
          <button className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-slate-900/20 hover:scale-105 active:scale-95 transition-all">
            <CalendarIcon className="w-4 h-4" />
            Vincular G-Calendar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        {/* Left Column: Calendar View */}
        <div className="xl:col-span-3 space-y-6">
          <div className="bg-white rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden">
            <div className="p-6 md:p-8 border-b border-slate-50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-black text-slate-900 uppercase">
                  {view === 'calendar' ? 'Calendario Operativo' : 'Listado de Actividades'}
                </h2>
              </div>
              
              <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="relative flex-1 md:flex-none">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="text" placeholder="BUSCAR..." className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-black outline-none focus:ring-2 focus:ring-blue-500/10 text-slate-900" />
                </div>
                <button className="p-3 text-slate-400 hover:bg-slate-50 rounded-xl transition-all border border-slate-100 group">
                  <Filter className="w-5 h-5 group-hover:text-blue-500" />
                </button>
              </div>
            </div>

            {view === 'calendar' ? (
              <div className="h-[700px] p-6 calendar-container">
                <style>{`
                  .rbc-calendar { font-family: 'Inter', sans-serif; }
                  .rbc-btn-group button { 
                    color: #94a3b8; 
                    text-transform: uppercase;
                    font-size: 10px;
                    font-weight: 900;
                    letter-spacing: 0.1em;
                    border-color: rgba(255,255,255,0.1);
                    padding: 8px 16px;
                  }
                  .rbc-btn-group button.rbc-active {
                    background: #f1f5f9;
                    color: #0f172a;
                    border-color: #e2e8f0;
                  }
                  .rbc-toolbar-label { font-weight: 900; text-transform: uppercase; color: #f8fafc; font-size: 18px; }
                  .rbc-header { padding: 12px 0; font-weight: 900; font-size: 12px; text-transform: uppercase; color: #94a3b8; border-bottom: 1px solid rgba(255,255,255,0.1); }
                  .rbc-day-bg { border-color: rgba(255,255,255,0.05); }
                  .rbc-month-view, .rbc-time-view, .rbc-agenda-view { border-color: rgba(255,255,255,0.1); border-radius: 16px; overflow: hidden; background: rgba(0,0,0,0.2) }
                  .rbc-month-row { border-color: rgba(255,255,255,0.05); }
                  .rbc-off-range-bg { background: rgba(255,255,255,0.02); }
                  .rbc-today { background: rgba(59, 130, 246, 0.05); }
                  .rbc-event { background: transparent; padding: 2px; }
                  .rbc-time-content { border-top: 1px solid rgba(255,255,255,0.1); }
                  .rbc-timeslot-group { border-bottom: 1px solid rgba(255,255,255,0.05); min-height: 40px; }
                  .rbc-time-gutter .rbc-timeslot-group { color: #94a3b8; font-size: 10px; font-weight: bold; }
                `}</style>
                <Calendar
                  localizer={localizer}
                  events={calendarEvents}
                  startAccessor="start"
                  endAccessor="end"
                  style={{ height: '100%' }}
                  culture="es"
                  view={calendarView}
                  onView={setCalendarView}
                  date={currentDate}
                  onNavigate={setCurrentDate}
                  components={{
                    event: CustomEvent
                  }}
                  onSelectEvent={handleSelectEvent}
                  messages={{
                    next: "Sig",
                    previous: "Ant",
                    today: "Hoy",
                    month: "Mes",
                    week: "Semana",
                    day: "Día",
                    agenda: "Agenda",
                  }}
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="p-4 text-[10px] font-black text-slate-400 uppercase text-left tracking-widest">Actividad / Cliente</th>
                      <th className="p-4 text-[10px] font-black text-slate-400 uppercase text-left tracking-widest">Técnico / Equipo</th>
                      <th className="p-4 text-[10px] font-black text-slate-400 uppercase text-left tracking-widest">Recursos</th>
                      <th className="p-4 text-[10px] font-black text-slate-400 uppercase text-left tracking-widest">Documentos</th>
                      <th className="p-4 text-[10px] font-black text-slate-400 uppercase text-left tracking-widest">Estado</th>
                      <th className="p-4"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {activities.map((act) => (
                      <tr key={act.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="p-4">
                          <div className="space-y-1">
                            <p className="text-xs font-black text-slate-900 uppercase">{act.title}</p>
                            <div className="flex items-center gap-1.5">
                              <Building2 className="w-3 h-3 text-slate-400" />
                              <span className="text-[10px] font-bold text-slate-500 uppercase">{act.client} - {act.branch}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <User className="w-3 h-3 text-blue-500" />
                              <span className="text-[10px] font-black text-slate-700 uppercase">{act.tech}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Tag className="w-3 h-3 text-slate-400" />
                              <span className="text-[9px] font-bold text-slate-400">{act.tag}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <Users className="w-3 h-3 text-slate-400" />
                              <span className="text-[9px] font-bold text-slate-500 uppercase">Ayudante: {act.assistant || 'N/A'}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Truck className="w-3 h-3 text-slate-400" />
                              <span className="text-[9px] font-bold text-slate-500 uppercase">Vehículo: {act.vehicle || 'N/A'}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <FileText className="w-3 h-3 text-slate-400" />
                              <span className="text-[9px] font-bold text-slate-500 uppercase">Inf: {act.reportNum || 'Pend.'}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Ticket className="w-3 h-3 text-slate-400" />
                              <span className="text-[9px] font-bold text-slate-500 uppercase">
                                TK: {act.ticketNum || 'N/A'} 
                                {act.ticketNum && (
                                  <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[8px] font-black ${act.ticketStatus === 'cerrado' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                    {act.ticketStatus}
                                  </span>
                                )}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className={`${STATUS_CONFIG[act.status].bg} px-2 py-1 rounded-full border border-slate-100 inline-flex items-center gap-1.5`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[act.status].color.replace('text-', 'bg-')}`} />
                            <span className={`text-[9px] font-black uppercase ${STATUS_CONFIG[act.status].color}`}>{act.status}</span>
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <button 
                            className="p-2 hover:bg-white rounded-xl transition-all border border-transparent hover:border-slate-100"
                            onClick={() => {
                              const event = calendarEvents.find(e => e.id === act.id);
                              handleSelectEvent(event);
                            }}
                          >
                            <CalendarIcon className="w-4 h-4 text-blue-500" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Details & Tech Activity */}
        <div className="space-y-8">
          {/* Status Summary */}
          <div className="bg-white rounded-[32px] border border-slate-100 p-6 shadow-xl shadow-slate-200/30 space-y-4">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-blue-500" />
              Estado hoy ({format(currentDate, 'dd MMM', { locale: es })})
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                <div key={key} className={`${config.bg} p-4 rounded-2xl border border-slate-100 flex flex-col gap-1`}>
                  <div className="flex items-center justify-between">
                    <config.icon className={`w-4 h-4 ${config.color}`} />
                    <span className="text-xs font-black text-slate-900">01</span>
                  </div>
                  <span className="text-[9px] font-black uppercase text-slate-400 mt-1">{config.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Activity List for Selected Day */}
          <div className="bg-white rounded-[32px] border border-slate-100 p-6 shadow-xl shadow-slate-200/30">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Actividades Próximas</h3>
              <button className="text-[10px] font-black text-blue-600 uppercase hover:underline">Ver Todo</button>
            </div>
            
            <div className="space-y-4">
              {activities.map((act) => (
                <div 
                  key={act.id} 
                  className="p-4 rounded-3xl bg-slate-50 border border-slate-100 hover:border-blue-200 hover:shadow-lg transition-all group cursor-pointer"
                  onClick={() => {
                    const event = calendarEvents.find(e => e.id === act.id);
                    handleSelectEvent(event);
                  }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={`${STATUS_CONFIG[act.status].bg} px-2 py-0.5 rounded-full flex items-center gap-1.5`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[act.status].color.replace('text-', 'bg-')}`} />
                      <span className={`text-[9px] font-black uppercase ${STATUS_CONFIG[act.status].color}`}>{act.status}</span>
                    </div>
                    <button className="p-1 hover:bg-white rounded-lg transition-colors"><MoreVertical className="w-4 h-4 text-slate-300" /></button>
                  </div>
                  
                  <h4 className="text-sm font-black text-slate-900 uppercase leading-snug group-hover:text-blue-600 transition-colors">{act.title}</h4>
                  
                  <div className="mt-4 grid grid-cols-2 gap-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-white border border-slate-100 flex items-center justify-center text-blue-500">
                        <Users className="w-3 h-3" />
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase">{act.tech} {act.assistant && `+ ${act.assistant}`}</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <Truck className="w-3.5 h-3.5 text-slate-300" />
                       <span className="text-[10px] font-bold text-slate-500 uppercase">{act.vehicle || 'S/V'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <Building2 className="w-3.5 h-3.5 text-slate-300" />
                       <span className="text-[10px] font-black text-slate-900 uppercase line-clamp-1">{act.client}</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <Tag className="w-3.5 h-3.5 text-slate-300" />
                       <span className="text-[10px] font-black text-slate-900 uppercase bg-white px-2 py-0.5 rounded-lg border border-slate-100">{act.tag}</span>
                    </div>
                    {(act.reportNum || act.ticketNum) && (
                      <div className="col-span-2 pt-2 border-t border-slate-100 flex gap-4">
                        {act.reportNum && (
                          <div className="flex items-center gap-1.5">
                            <FileText className="w-3 h-3 text-slate-300" />
                            <span className="text-[9px] font-black text-slate-400 uppercase italic">INF: {act.reportNum}</span>
                          </div>
                        )}
                        {act.ticketNum && (
                          <div className="flex items-center gap-1.5">
                            <Ticket className="w-3 h-3 text-slate-300" />
                            <span className="text-[9px] font-black text-slate-400 uppercase italic">
                              TK: {act.ticketNum}
                              <span className={`ml-1 px-1 rounded-full ${act.ticketStatus === 'cerrado' ? 'text-emerald-500 bg-emerald-50' : 'text-rose-500 bg-rose-50'}`}>●</span>
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

