import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { db, LocalUsuario } from "../../db/database";
import { useAppStore } from "../../store/useAppStore";

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
  const [cliente_id, setClienteId] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const clients = useAppStore(state => state.clients);
  const activeClientId = localStorage.getItem("active_client");
  const activeClients = clients.filter(c => 
    c.activo !== false && 
    (!activeClientId || c.uuid_sync === activeClientId || c.id === activeClientId)
  );

  useEffect(() => {
    if (editingUser) {
      setNombre(editingUser.nombre || "");
      setEmail(editingUser.email || "");
      setPerfil(editingUser.rol || "Técnico");
      setPin("");
      setClienteId(localStorage.getItem("active_client") || editingUser.cliente_id || "");
    } else {
      setNombre("");
      setEmail("");
      setPerfil("Técnico");
      setPin("");
      // Default to the currently selected active client in mobile/desktop
      setClienteId(localStorage.getItem("active_client") || "");
    }
  }, [editingUser, isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre || !email || (!editingUser && !pin)) {
       alert(editingUser ? "Nombre y Correo son obligatorios" : "Nombre, Correo y PIN son obligatorios");
       return;
    }
    if (perfil === "Cliente" && !cliente_id) {
       alert("Debe seleccionar un cliente para vincular este usuario");
       return;
    }
    
    setIsSaving(true);
    try {
       const userPayload = {
          id: editingUser?.id || `U-${Date.now()}`,
          uuid_sync: editingUser?.uuid_sync || crypto.randomUUID(),
          nombre,
          correo: email,
          perfil,
          activo: true,
          cliente_id: cliente_id || undefined,
          ...(pin ? { pin } : {})
       };

       const token = sessionStorage.getItem("auth_token");
       const response = await fetch("/api/users", {
         method: "POST",
         headers: {
           "Content-Type": "application/json",
           ...(token ? { Authorization: `Bearer ${token}` } : {})
         },
         body: JSON.stringify(userPayload)
       });
       const result = await response.json().catch(() => ({}));
       if (!response.ok) {
         throw new Error(result.error || "No fue posible guardar el usuario");
       }

       await db.users.put({
         uuid_sync: userPayload.uuid_sync,
         id: userPayload.id,
         nombre,
         email,
         rol: perfil,
         activo: true,
         cliente_id: cliente_id || undefined,
         cliente_ids: cliente_id ? [cliente_id] : [],
         updated_at: Date.now(),
         sync_status: "synced"
       });
       await useAppStore.getState().hydrate();
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
             {perfil === "Cliente" && (
                <div className="space-y-1 animate-in fade-in duration-200">
                   <label className="text-[10px] font-black uppercase text-slate-400">Cliente Asociado a este Usuario</label>
                   <select 
                     value={cliente_id} 
                     onChange={() => undefined}
                     disabled
                     className="w-full px-4 py-3 bg-slate-100 border border-slate-100 rounded-2xl text-xs font-bold uppercase outline-none cursor-not-allowed"
                     required
                   >
                     {activeClients.map(c => (
                        <option key={c.uuid_sync} value={c.uuid_sync}>{c.nombre}</option>
                     ))}
                   </select>
                </div>
             )}
             <button disabled={isSaving} className="w-full py-4 bg-slate-900 text-white text-xs font-black uppercase tracking-widest rounded-3xl shadow-xl shadow-slate-900/20 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {isSaving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : null}
                {isSaving ? 'Guardando...' : (editingUser ? 'Guardar Cambios' : 'Crear Perfil Usuario')}
             </button>
          </form>
       </div>
    </div>
  );
}
