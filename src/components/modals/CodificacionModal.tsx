import React, { useState } from 'react';
import { X, Plus, Tags, Building2, Wrench } from 'lucide-react';
import { db } from '../../db/database';
import { useAppStore } from '../../store/useAppStore';

const REGIONES_CHILE = [
  "Arica y Parinacota",
  "Tarapacá",
  "Antofagasta",
  "Atacama",
  "Coquimbo",
  "Valparaíso",
  "Metropolitana de Santiago",
  "Libertador General Bernardo O'Higgins",
  "Maule",
  "Ñuble",
  "Biobío",
  "La Araucanía",
  "Los Ríos",
  "Los Lagos",
  "Aysén del General Carlos Ibáñez del Campo",
  "Magallanes y de la Antártica Chilena"
];

interface CodificacionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CodificacionModal({ isOpen, onClose }: CodificacionModalProps) {
  const [tab, setTab] = useState<'sucursal' | 'equipo'>('sucursal');
  
  // Sucursal state
  const [sucursalCodigo, setSucursalCodigo] = useState('');
  const [sucursalNombre, setSucursalNombre] = useState('');
  const [sucursalDireccion, setSucursalDireccion] = useState('');
  const [sucursalRegion, setSucursalRegion] = useState('');

  // Equipo state
  const [equipoCodigo, setEquipoCodigo] = useState('');
  const [equipoDescripcion, setEquipoDescripcion] = useState('');

  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSaveSucursal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sucursalCodigo || !sucursalNombre) {
      alert("El código y la descripción son obligatorios");
      return;
    }
    
    setIsSaving(true);
    try {
      const uuid_sync = crypto.randomUUID();
      const newSucursal = {
        uuid_sync,
        id: `SUB-${Date.now()}`,
        nombre: sucursalNombre,
        codigo: sucursalCodigo,
        cliente_id: 'default', // Para efectos de esta versión
        direccion: sucursalDireccion,
        ciudad: '',
        region: sucursalRegion,
        activo: true,
        updated_at: Date.now(),
        sync_status: 'pending_insert' as const,
      };
      
      await db.branches.add(newSucursal);
      
      // Update store if needed? No, Dexie hooks will auto reload UI
      // await useAppStore.getState().syncWithDB();
      
      alert('Sucursal registrada correctamente');
      setSucursalCodigo('');
      setSucursalNombre('');
      setSucursalDireccion('');
      setSucursalRegion('');
    } catch(err) {
      alert('Error al guardar la sucursal. Verifique que el código no exista.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveEquipo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!equipoCodigo || !equipoDescripcion) {
      alert("El código y la descripción son obligatorios");
      return;
    }

    if (equipoCodigo.length > 2) {
      alert("Para la categoría de equipo se recomiendan usar 2 dígitos o letras (Ej: '00', 'AC')");
    }
    
    setIsSaving(true);
    try {
      const uuid_sync = crypto.randomUUID();
      const newEquipo = {
        uuid_sync,
        codigo: equipoCodigo.toUpperCase(),
        descripcion: equipoDescripcion,
        activo: true,
        updated_at: Date.now(),
        sync_status: 'pending_insert' as const,
      };
      
      await db.catalog_asset_types.add(newEquipo);
      
      alert('Categoría de Equipo registrada correctamente');
      setEquipoCodigo('');
      setEquipoDescripcion('');
    } catch(err) {
      alert('Error al guardar la categoría. Verifique que el código no exista.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
       <div className="bg-white w-full max-w-2xl rounded-t-3xl sm:rounded-[32px] shadow-2xl animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-200 flex flex-col h-[100dvh] sm:h-auto sm:max-h-[90vh]">
          
          <div className="p-6 sm:p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
             <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-500/20">
                   <Tags className="w-6 h-6" />
                </div>
                <div>
                   <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Codificación de TAG</h3>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Reglas de Negocio / Catálogos</p>
                </div>
             </div>
             <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5" /></button>
          </div>

          <div className="flex p-4 gap-2 bg-slate-50 border-b border-slate-100">
             <button 
               onClick={() => setTab('sucursal')}
               className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                 tab === 'sucursal' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:bg-slate-100'
               }`}
             >
                <Building2 className="w-4 h-4" />
                Sucursal / Almacén
             </button>
             <button 
               onClick={() => setTab('equipo')}
               className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                 tab === 'equipo' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:bg-slate-100'
               }`}
             >
                <Wrench className="w-4 h-4" />
                Categoría de Equipo
             </button>
          </div>

          <div className="p-6 sm:p-8 overflow-y-auto flex-1">
            {tab === 'sucursal' && (
              <form onSubmit={handleSaveSucursal} className="space-y-6">
                 <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed">
                       Formato recomendado para Sucursal:<br/>
                       Único globalmente, generalmente hasta 6 caracteres. Ej: <span className="text-blue-600">21-STK</span>
                    </p>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1 md:col-span-1">
                       <label className="text-[10px] font-black uppercase text-slate-400" style={{width: 'auto', fontSize: '13px'}}>Código de Sucursal/Almacén/Proyecto/Edificio *</label>
                       <input 
                         type="text" 
                         value={sucursalCodigo}
                         onChange={e => setSucursalCodigo(e.target.value.toUpperCase())}
                         placeholder="Ej: 21-STK" 
                         className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold uppercase transition-all focus:ring-2 focus:ring-blue-500/20 outline-none" 
                         required
                       />
                    </div>
                    <div className="space-y-1 md:col-span-1">
                       <label className="text-[10px] font-black uppercase text-slate-400">Nombre / Descripción *</label>
                       <input 
                         type="text" 
                         value={sucursalNombre}
                         onChange={e => setSucursalNombre(e.target.value)}
                         placeholder="Ej: Bodega Central" 
                         className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold uppercase transition-all focus:ring-2 focus:ring-blue-500/20 outline-none" 
                         required
                       />
                    </div>
                    <div className="space-y-1 md:col-span-1">
                       <label className="text-[10px] font-black uppercase text-slate-400">Región</label>
                       <select 
                         value={sucursalRegion}
                         onChange={e => setSucursalRegion(e.target.value)}
                         className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold uppercase transition-all focus:ring-2 focus:ring-blue-500/20 outline-none"
                       >
                         <option value="">Seleccione una Región</option>
                         {REGIONES_CHILE.map(region => (
                           <option key={region} value={region}>{region}</option>
                         ))}
                       </select>
                    </div>
                    <div className="space-y-1 md:col-span-1">
                       <label className="text-[10px] font-black uppercase text-slate-400">Dirección</label>
                       <input 
                         type="text" 
                         value={sucursalDireccion}
                         onChange={e => setSucursalDireccion(e.target.value)}
                         placeholder="Ej: Av. Principal 123" 
                         className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold uppercase transition-all focus:ring-2 focus:ring-blue-500/20 outline-none" 
                       />
                    </div>
                 </div>

                 <div className="pt-4 flex justify-end">
                    <button 
                      type="submit" 
                      disabled={isSaving}
                      className="flex gap-2 items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-blue-600/20 disabled:opacity-50"
                    >
                       {isSaving ? "Guardando..." : "Guardar Sucursal"}
                       {!isSaving && <Plus className="w-4 h-4" />}
                    </button>
                 </div>
              </form>
            )}

            {tab === 'equipo' && (
              <form onSubmit={handleSaveEquipo} className="space-y-6">
                 <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed">
                       Formato recomendado para Equipo:<br/>
                       Único globalmente, usar 2 dígitos o letras. Ej: <span className="text-blue-600">00</span> o <span className="text-blue-600">AC</span><br/>
                       (Preparado para escalar con otros módulos de informes especializados)
                    </p>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1 md:col-span-1">
                       <label className="text-[10px] font-black uppercase text-slate-400">Código Equipo (2 Caracteres) *</label>
                       <input 
                         type="text"
                         maxLength={4}
                         value={equipoCodigo}
                         onChange={e => setEquipoCodigo(e.target.value.toUpperCase())}
                         placeholder="Ej: 00 o AC"
                         className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-black uppercase transition-all focus:ring-2 focus:ring-blue-500/20 outline-none tracking-widest" 
                         required
                       />
                    </div>
                    <div className="space-y-1 md:col-span-1">
                       <label className="text-[10px] font-black uppercase text-slate-400">Descripción del Equipo *</label>
                       <input 
                         type="text" 
                         value={equipoDescripcion}
                         onChange={e => setEquipoDescripcion(e.target.value)}
                         placeholder="Ej: Otros Equipamientos" 
                         className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold uppercase transition-all focus:ring-2 focus:ring-blue-500/20 outline-none" 
                         required
                       />
                    </div>
                 </div>

                 <div className="pt-4 flex justify-end">
                    <button 
                      type="submit" 
                      disabled={isSaving}
                      className="flex gap-2 items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-blue-600/20 disabled:opacity-50"
                    >
                       {isSaving ? "Guardando..." : "Guardar Equipo"}
                       {!isSaving && <Plus className="w-4 h-4" />}
                    </button>
                 </div>
              </form>
            )}
          </div>
       </div>
    </div>
  );
}
