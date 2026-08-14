import React, { useState } from 'react';
import { 
  ChevronDown, Save, Trash2, Edit2, Pin, Filter
} from 'lucide-react';

interface FilterPresetsDropdownProps {
  onApply: (filters: any) => void;
}

export const FilterPresetsDropdown: React.FC<FilterPresetsDropdownProps> = ({ onApply }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
       <button 
         onClick={() => setIsOpen(!isOpen)}
         className="bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase text-slate-600 hover:bg-slate-100 transition-all flex items-center gap-2"
        >
          <Filter className="w-4 h-4" /> Mis Filtros <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
       </button>

       {isOpen && (
         <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-3xl border border-slate-200 shadow-2xl z-50 p-4 animate-in slide-in-from-top-2">
            <div className="space-y-4">
               <div className="flex flex-col gap-1">
                  <h4 className="text-[9px] font-black uppercase text-slate-400 tracking-widest px-2">Presets Guardados</h4>
                  <div className="space-y-1">
                     <PresetItem label="Críticos Planta B" date="24/04" />
                     <PresetItem label="Atrasados Nelson" date="22/04" />
                  </div>
               </div>
               <div className="pt-4 border-t border-slate-50 space-y-2">
                  <input type="text" placeholder="NOMBRE FILTRO..." className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[9px] font-bold uppercase outline-none focus:ring-1 focus:ring-blue-500" />
                  <button className="w-full py-2.5 bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20">
                     <Save className="w-3.5 h-3.5" /> Guardar Filtro
                  </button>
               </div>
            </div>
         </div>
       )}
    </div>
  );
};

function PresetItem({ label, date }: { label: string, date: string }) {
  return (
    <div className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl cursor-pointer group">
       <div className="flex items-center gap-2">
          <Pin className="w-3 h-3 text-slate-300" />
          <span className="text-[10px] font-black text-slate-900 uppercase line-clamp-1">{label}</span>
       </div>
       <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
          <button className="p-1 text-slate-300 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
       </div>
    </div>
  );
}
