import React, { useState } from "react";
import { 
  Users, 
  ShieldCheck, 
  RotateCcw, 
  ToggleLeft, 
  ToggleRight, 
  Edit2, 
  Key, 
  Shield, 
  User as UserIcon,
  Search,
  Building2,
  Plus,
  Trash2,
  Eye,
  Briefcase
} from "lucide-react";
import { UserModal } from "../components/modals/UserModal";
import { useAppStore } from "../store/useAppStore";

export default function Administracion() {
  const [showUserModal, setShowUserModal] = useState(false);
  const [filter, setFilter] = useState("");
  const [editingUser, setEditingUser] = useState<any | null>(null);

  const users = useAppStore(state => state.users);

  const handleAddUser = () => {
    setEditingUser(null);
    setShowUserModal(true);
  };

  const activeUsers = users.filter(u => 
    u.nombre?.toLowerCase().includes(filter.toLowerCase()) || 
    u.email?.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-8 text-left animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Administración de Accesos</h2>
          <p className="text-slate-500 text-sm font-medium">Gestión de perfiles técnicos, administrativos y credenciales locales seguras.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-all">
            <RotateCcw className="w-4 h-4" /> Actualizar Lista
          </button>
          <button 
            onClick={handleAddUser}
            className="bg-slate-900 text-white px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-all shadow-xl shadow-slate-900/10"
          >
            <Plus className="w-4 h-4" /> Nuevo Usuario
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
         <div className="lg:col-span-1 space-y-4">
            <div className="bg-slate-900 p-8 rounded-[40px] text-white space-y-6">
               <h3 className="text-xs font-black uppercase tracking-widest opacity-60">Matriz de Perfiles</h3>
               <div className="space-y-4">
                  <ProfileBadge label="Programador" desc="Control total root" icon={<Shield className="w-3.5 h-3.5" />} color="text-red-400" />
                  <ProfileBadge label="Administrador" desc="Gestión operativa total" icon={<ShieldCheck className="w-3.5 h-3.5" />} color="text-emerald-400" />
                  <ProfileBadge label="Supervisor" desc="Revisión y firmas" icon={<Users className="w-3.5 h-3.5" />} color="text-blue-400" />
                  <ProfileBadge label="Técnico" desc="Operación de terreno" icon={<UserIcon className="w-3.5 h-3.5" />} color="text-slate-400" />
                  <ProfileBadge label="Contratista" desc="Ejecutor externo" icon={<Briefcase className="w-3.5 h-3.5" />} color="text-amber-400" />
                  <ProfileBadge label="Cliente" desc="Visualización y aprobación" icon={<Building2 className="w-3.5 h-3.5" />} color="text-indigo-400" />
                  <ProfileBadge label="Visita" desc="Solo lectura reportes" icon={<Eye className="w-3.5 h-3.5" />} color="text-cyan-400" />
               </div>
            </div>
         </div>

         <div className="lg:col-span-3">
            <div className="bg-white rounded-[40px] border border-slate-200 overflow-hidden shadow-sm">
               <div className="p-6 border-b border-slate-50 flex items-center gap-4">
                  <div className="flex-1 relative">
                     <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                     <input 
                       type="text" 
                       placeholder="Filtrar por nombre o correo..." 
                       value={filter}
                       onChange={(e) => setFilter(e.target.value)}
                       className="w-full pl-12 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold transition-all focus:ring-2 focus:ring-slate-900/10" 
                     />
                  </div>
               </div>
               <div className="divide-y divide-slate-50">
                  {activeUsers.map(u => (
                    <div key={u.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                       <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 font-black text-xs">
                             {u.nombre.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                          </div>
                          <div>
                             <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">{u.nombre}</h4>
                             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{u.email}</p>
                          </div>
                          <div className="ml-4 px-3 py-1 bg-slate-100 rounded-full text-[9px] font-black uppercase text-slate-600">{u.rol}</div>
                       </div>
                       <div className="flex items-center gap-2">
                           <button className={`p-2.5 rounded-xl transition-all ${u.activo ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-300'}`}>
                              {u.activo ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                           </button>
                           <button onClick={() => { setEditingUser(u); setShowUserModal(true); }} className="p-2.5 hover:bg-slate-100 text-slate-400 hover:text-blue-600 rounded-xl transition-colors"><Edit2 className="w-4 h-4" /></button>
                           <button className="p-2.5 hover:bg-slate-100 text-slate-400 hover:text-slate-900 rounded-xl transition-colors"><Key className="w-4 h-4" /></button>
                           <button className="p-2.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl transition-colors opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
                       </div>
                    </div>
                  ))}
               </div>
            </div>
         </div>
      </div>

      <UserModal
         isOpen={showUserModal}
         onClose={() => setShowUserModal(false)}
         editingUser={editingUser}
      />
    </div>
  );
}

function ProfileBadge({ label, desc, icon, color }: { label: string, desc: string, icon: React.ReactNode, color: string }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-2xl">
       <div className={`${color}`}>{icon}</div>
       <div>
          <h4 className="text-[10px] font-black uppercase tracking-widest text-white leading-none mb-0.5">{label}</h4>
          <p className="text-[9px] font-medium text-white/40">{desc}</p>
       </div>
    </div>
  );
}
