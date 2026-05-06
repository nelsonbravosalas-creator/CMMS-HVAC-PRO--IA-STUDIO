import React, { useState } from 'react';
import { 
  X, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, ChevronDown, Activity, Box, User
} from 'lucide-react';

interface MaintenanceCalendarProps {
  onClose: () => void;
}

export const MaintenanceCalendar: React.FC<MaintenanceCalendarProps> = ({ onClose }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDate());

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-6xl h-[85vh] rounded-[40px] shadow-2xl overflow-hidden flex flex-col md:flex-row animate-in fade-in zoom-in-95 duration-300">
        
        {/* Sidebar: Day Details */}
        <div className="md:w-80 bg-slate-50 border-r border-slate-100 flex flex-col">
           <div className="p-8 border-b border-slate-100">
              <h3 className="text-2xl font-black text-slate-900 leading-none">{selectedDay}</h3>
              <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-1">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</p>
           </div>
           
           <div className="p-6 flex-1 overflow-y-auto space-y-4 custom-scrollbar">
              <div className="flex items-center justify-between italic mb-2">
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Actividades</span>
                 <span className="text-[10px] font-black text-blue-600 uppercase bg-blue-50 px-2 py-0.5 rounded-full">2 Eventos</span>
              </div>
              
              <CalendarEvent tag="21-STK.AC.001" time="09:00 AM" type="Preventivo" status="programado" />
              <CalendarEvent tag="Fancoil-02" time="15:30 PM" type="Correctivo" status="atrasado" />
           </div>

           <div className="p-6 bg-slate-100/50 border-t border-slate-100 space-y-2">
              <LegendItem label="Programado" color="bg-blue-500" />
              <LegendItem label="Realizado" color="bg-emerald-500" />
              <LegendItem label="Atrasado" color="bg-red-500" />
           </div>
        </div>

        {/* Content: Main Calendar Grid */}
        <div className="flex-1 flex flex-col bg-white">
          <div className="p-8 flex justify-between items-center border-b border-slate-50">
             <div className="flex items-center gap-6">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h3>
                <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                   <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} className="p-2 hover:bg-white rounded-xl transition-all shadow-sm"><ChevronLeft className="w-4 h-4" /></button>
                   <button onClick={() => setCurrentDate(new Date())} className="px-4 py-2 hover:bg-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm">Hoy</button>
                   <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} className="p-2 hover:bg-white rounded-xl transition-all shadow-sm"><ChevronRight className="w-4 h-4" /></button>
                </div>
             </div>
             <button onClick={onClose} className="p-3 hover:bg-slate-100 rounded-full transition-colors"><X className="w-6 h-6" /></button>
          </div>

          <div className="p-8 flex-1">
             <div className="grid grid-cols-7 mb-4">
                {["LUN", "MAR", "MIE", "JUE", "VIE", "SAB", "DOM"].map(d => (
                  <div key={d} className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">{d}</div>
                ))}
             </div>
             
             <div className="grid grid-cols-7 gap-1 h-full">
                {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                  <div key={`empty-${i}`} className="bg-slate-50/50 rounded-2xl h-24"></div>
                ))}
                {days.map(d => (
                  <div 
                    key={d} 
                    onClick={() => setSelectedDay(d)}
                    className={`rounded-2xl h-24 p-2 transition-all cursor-pointer flex flex-col gap-1 ${
                      selectedDay === d ? 'ring-2 ring-blue-600 bg-blue-50 shadow-xl z-10' : 'bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                     <span className={`text-[10px] font-black ${selectedDay === d ? 'text-blue-600' : 'text-slate-400'}`}>{d}</span>
                     {d === 15 && <div className="w-full h-2 bg-blue-500 rounded-full"></div>}
                     {d === 20 && <div className="w-full h-2 bg-red-500 rounded-full"></div>}
                  </div>
                ))}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function CalendarEvent({ tag, time, type, status }: { tag: string, time: string, type: string, status: string }) {
  const colors: any = { programado: 'bg-blue-500', realizado: 'bg-emerald-500', atrasado: 'bg-red-500' };
  return (
    <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl transition-all cursor-pointer group">
       <div className="flex justify-between items-start mb-2">
          <span className="text-[10px] font-black text-blue-600 uppercase tracking-tight">{tag}</span>
          <div className={`w-2 h-2 rounded-full ${colors[status]}`}></div>
       </div>
       <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase mb-2">
          <Clock className="w-3 h-3" /> {time}
       </div>
       <button className="w-full py-2 bg-slate-50 group-hover:bg-blue-600 group-hover:text-white text-[8px] font-black uppercase rounded-xl transition-all">Ver Detalle</button>
    </div>
  );
}

function LegendItem({ label, color }: { label: string, color: string }) {
  return (
    <div className="flex items-center gap-3">
       <div className={`w-2 h-2 rounded-full ${color}`}></div>
       <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{label}</span>
    </div>
  );
}
