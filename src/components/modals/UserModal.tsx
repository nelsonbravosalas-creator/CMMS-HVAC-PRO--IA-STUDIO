import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { LocalUsuario } from "../../db/database";
import { userRepo } from "../../repositories/UserRepository";
import { useAppStore } from "../../store/useAppStore";
import { syncEngine } from "../../sync/syncEngine";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  editingUser: LocalUsuario | null;
}

export function UserModal({ isOpen, onClose, editingUser }: Props) {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [perfil, setPerfil] = useState("Técnico");
  const [pin, setPin] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (editingUser) {
      setNombre(editingUser.nombre || "");
      setEmail(editingUser.email || "");
      setPerfil(editingUser.rol || "Técnico");
      setPin(editingUser.pin || "");
    } else {
      setNombre("");
      setEmail("");
      setPerfil("Técnico");
      setPin("");
    }
  }, [editingUser, isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre || !email || !pin) {
       alert("Nombre, Correo y PIN son obligatorios");
       return;
    }
    
    setIsSaving(true);
    try {
       const userPayload: Partial<LocalUsuario> = {
          nombre,
          email,
          rol: perfil,
          pin,
          activo: true
       };

       if (editingUser) {
          await userRepo.update(editingUser.uuid_sync, userPayload);
       } else {
          await userRepo.create({
             ...userPayload,
             id: `U-${Date.now()}`
          } as any);
       }

       await useAppStore.getState().hydrate();
       syncEngine.triggerSync();
       onClose();
    } catch (err) {
       console.error(err);
       alert("Error al guardar el usuario");
    } finally {
       setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
       <div className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl animate-in zoom-in-95 duration-200">
          <div className="p-8 border-b border-slate-50 flex justify-between items-center">
             <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
             <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-5 h-5" /></button>
          </div>
          <form className="p-8 space-y-6" onSubmit={handleSave}>
             <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">Nombre Completo</label>
                <input value={nombre} onChange={e => setNombre(e.target.value)} type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-slate-900/10" required />
             </div>
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase text-slate-400">Correo Electrónico</label>
                   <input value={email} onChange={e => setEmail(e.target.value)} type="email" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none" required />
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase text-slate-400">Perfil Acceso</label>
                   <select value={perfil} onChange={e => setPerfil(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold uppercase outline-none">
                      <option>Visita</option>
                      <option>Técnico</option>
                      <option>Contratista</option>
                      <option>Supervisor</option>
                      <option>Administrador</option>
                      <option>Cliente</option>
                   </select>
                </div>
             </div>
             <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">PIN de Seguridad (4 dígitos)</label>
                <input value={pin} onChange={e => setPin(e.target.value.replace(/[^0-9]/g, ''))} type="password" maxLength={4} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-center text-xl font-black tracking-widest outline-none" placeholder="****" required />
             </div>
             <button disabled={isSaving} className="w-full py-4 bg-slate-900 text-white text-xs font-black uppercase tracking-widest rounded-3xl shadow-xl shadow-slate-900/20 active:scale-[0.98] transition-all disabled:opacity-50">
                {isSaving ? 'Guardando...' : (editingUser ? 'Guardar Cambios' : 'Crear Perfil Usuario')}
             </button>
          </form>
       </div>
    </div>
  );
}
