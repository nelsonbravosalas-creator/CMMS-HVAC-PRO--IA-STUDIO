import React, { useState } from 'react';
import { X, Plus, Trash2, Building2 } from 'lucide-react';

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SubLocation {
  id: string;
  tipo: string;
  nombre: string;
  direccion: string;
  codigo: string;
}

export function ClientModal({ isOpen, onClose }: ClientModalProps) {
  const [subs, setSubs] = useState<SubLocation[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    setIsSaving(true);
    
    // Non blocking save
    const clientData = {
      subs,
      fechaSincronizacionLocal: new Date().toISOString()
    };
    
    localStorage.setItem(`cliente_${Date.now()}`, JSON.stringify(clientData));
    
    setTimeout(() => {
      setIsSaving(false);
      alert('Cliente Registrado Correctamente');
      onClose();
    }, 0);
  };

  const addSub = () => {
    setSubs([...subs, { id: Math.random().toString(), tipo: 'Tienda', nombre: '', direccion: '', codigo: '' }]);
  };

  const updateSub = (id: string, field: keyof SubLocation, value: string) => {
    setSubs(subs.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const removeSub = (id: string) => {
    setSubs(subs.filter(s => s.id !== id));
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
       <div className="bg-white w-full max-w-4xl rounded-[40px] shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
          <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50 relative shrink-0">
             <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-500/20">
                   <Building2 className="w-6 h-6" />
                </div>
                <div>
                   <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Nuevo Cliente</h3>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Alta de Cliente y Multi-Sucursales (SUBs)</p>
                </div>
             </div>
             <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors absolute top-8 right-8"><X className="w-5 h-5" /></button>
          </div>
          
          <div className="p-8 overflow-y-auto space-y-8 flex-1">
             <div className="space-y-6">
                 <h4 className="text-xs font-black uppercase text-indigo-600 tracking-widest border-b border-slate-100 pb-2">Información Principal</h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1">
                       <label className="text-[10px] font-black uppercase text-slate-400">Nombre Empresa</label>
                       <input type="text" placeholder="Ej. ACME Corp" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold uppercase transition-all focus:ring-2 focus:ring-indigo-500/20 outline-none" />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[10px] font-black uppercase text-slate-400">RUT Empresa</label>
                       <input type="text" placeholder="77.123.456-7" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold uppercase transition-all focus:ring-2 focus:ring-indigo-500/20 outline-none" />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[10px] font-black uppercase text-slate-400">Dirección Matriz</label>
                       <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold uppercase transition-all focus:ring-2 focus:ring-indigo-500/20 outline-none" />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[10px] font-black uppercase text-slate-400">Región</label>
                       <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold uppercase transition-all focus:ring-2 focus:ring-indigo-500/20 outline-none" />
                    </div>
                 </div>
             </div>

             <div className="space-y-6">
                 <h4 className="text-xs font-black uppercase text-indigo-600 tracking-widest border-b border-slate-100 pb-2">Contacto Comercial</h4>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-1">
                       <label className="text-[10px] font-black uppercase text-slate-400">Persona de Contacto</label>
                       <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold uppercase transition-all focus:ring-2 focus:ring-indigo-500/20 outline-none" />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[10px] font-black uppercase text-slate-400">Cargo</label>
                       <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold uppercase transition-all focus:ring-2 focus:ring-indigo-500/20 outline-none" />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[10px] font-black uppercase text-slate-400">Correo de Contacto</label>
                       <input type="email" placeholder="correo@empresa.com" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold uppercase transition-all focus:ring-2 focus:ring-indigo-500/20 outline-none lowercase" />
                    </div>
                 </div>
             </div>

             <div className="space-y-6">
                 <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h4 className="text-xs font-black uppercase text-indigo-600 tracking-widest">Sucursales (SUB)</h4>
                    <button onClick={addSub} className="text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-indigo-100 transition-colors">
                       <Plus className="w-3 h-3" /> Agregar SUB
                    </button>
                 </div>
                 
                 <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed">
                       La codificación final de cada TAG constará del formato:<br/>
                       <span className="text-indigo-600">{"[CÓDIGO_SUB(4)].[TIPO_EQUIPO(3)].[CORRELATIVO(4)]"}</span>
                    </p>
                 </div>

                 {subs.map((sub, index) => (
                    <div key={sub.id} className="p-4 sm:p-6 bg-slate-50 border border-slate-200 rounded-3xl relative group space-y-4 shadow-sm">
                       <button onClick={() => removeSub(sub.id)} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100">
                          <Trash2 className="w-4 h-4" />
                       </button>
                       <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-white px-2 py-1 rounded-md shadow-sm border border-slate-100">SUB {index + 1}</span>
                       <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                          <div className="space-y-1">
                             <label className="text-[9px] font-black uppercase text-slate-400">Tipo</label>
                             <select value={sub.tipo} onChange={e => updateSub(sub.id, 'tipo', e.target.value)} className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold uppercase transition-all focus:ring-2 focus:ring-indigo-500/20 outline-none">
                                <option value="Tienda">Tienda</option>
                                <option value="Bodega">Bodega / Almacén</option>
                                <option value="Proyecto">Proyecto</option>
                                <option value="Sitio">Sitio</option>
                                <option value="Area">Área</option>
                             </select>
                          </div>
                          <div className="space-y-1">
                             <label className="text-[9px] font-black uppercase text-slate-400">Codificador (4 Caracteres)</label>
                             <input type="text" maxLength={4} placeholder="Ej. ST01" value={sub.codigo} onChange={e => updateSub(sub.id, 'codigo', e.target.value.toUpperCase())} className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase transition-all focus:ring-2 focus:ring-indigo-500/20 outline-none tracking-widest select-all text-indigo-600" />
                          </div>
                          <div className="space-y-1 md:col-span-2">
                             <label className="text-[9px] font-black uppercase text-slate-400">Nombre de la Sucursal</label>
                             <input type="text" placeholder="Nombre identificador" value={sub.nombre} onChange={e => updateSub(sub.id, 'nombre', e.target.value)} className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold uppercase transition-all focus:ring-2 focus:ring-indigo-500/20 outline-none" />
                          </div>
                          <div className="space-y-1 md:col-span-4">
                             <label className="text-[9px] font-black uppercase text-slate-400">Dirección</label>
                             <input type="text" placeholder="Dirección de la instalación" value={sub.direccion} onChange={e => updateSub(sub.id, 'direccion', e.target.value)} className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold uppercase transition-all focus:ring-2 focus:ring-indigo-500/20 outline-none" />
                          </div>
                       </div>
                    </div>
                 ))}
                 
                 {subs.length === 0 && (
                   <div className="text-center p-8 bg-slate-50 rounded-3xl border border-dashed border-slate-300">
                     <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">No hay sucursales registradas</p>
                   </div>
                 )}
             </div>
          </div>

          <div className="p-6 pl-[26px] -ml-[5px] mb-[26px] mt-0 mr-0 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
             <button disabled={isSaving} onClick={onClose} className="px-6 py-3 bg-white hover:bg-slate-100 text-slate-600 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-sm border border-slate-200 disabled:opacity-50">
                Cancelar
             </button>
             <button disabled={isSaving} onClick={handleSave} className="flex gap-2 items-center px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-indigo-600/20 disabled:opacity-50">
                {isSaving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : null}
                {isSaving ? "Guardando..." : "Guardar Cliente"}
             </button>
          </div>
       </div>
    </div>
  );
}
