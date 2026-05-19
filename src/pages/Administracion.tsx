import React, { useState } from "react";
import { 
  Users, 
  ShieldCheck, 
  UserPlus, 
  RotateCcw, 
  MoreVertical, 
  ToggleLeft, 
  ToggleRight, 
  Edit2, 
  Key, 
  Shield, 
  User as UserIcon,
  Search,
  Building2,
  Lock,
  ChevronRight,
  Plus,
  Trash2,
  X,
  Eye,
  Briefcase,
  UserCircle
} from "lucide-react";
import { USUARIOS_MOCK, Usuario, CLIENTES_MOCK, Cliente } from "../data/users";
import { ClientModal } from "../components/modals/ClientModal";

type AdminTab = "users" | "clients";

export default function Administracion() {
  const [activeTab, setActiveTab] = useState<AdminTab>("users");
  const [showUserModal, setShowUserModal] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [filter, setFilter] = useState("");

  return (
    <div className="flex flex-col gap-8 text-left animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Administración de Accesos</h2>
          <p className="text-slate-500 text-sm font-medium">Gestión de perfiles técnicos, administrativos y clients.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-all">
            <RotateCcw className="w-4 h-4" /> Actualizar Lista
          </button>
          <button 
            onClick={() => activeTab === 'users' ? setShowUserModal(true) : setShowClientModal(true)}
            className="bg-slate-900 text-white px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-all shadow-xl shadow-slate-900/10"
          >
            <Plus className="w-4 h-4" /> {activeTab === 'users' ? 'Nuevo Usuario' : 'Nuevo Cliente'}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-6 border-b border-slate-200">
         <button onClick={() => setActiveTab('users')} className={`py-4 px-2 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'users' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400'}`}>Usuarios y Perfiles</button>
         <button onClick={() => setActiveTab('clients')} className={`py-4 px-2 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'clients' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400'}`}>Gestión de Clientes (PROGRAMADOR)</button>
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
            {activeTab === 'users' && (
              <div className="bg-white rounded-[40px] border border-slate-200 overflow-hidden shadow-sm">
                 <div className="p-6 border-b border-slate-50 flex items-center gap-4">
                    <div className="flex-1 relative">
                       <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                       <input type="text" placeholder="Filtrar por nombre o correo..." className="w-full pl-12 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold transition-all focus:ring-2 focus:ring-slate-900/10" />
                    </div>
                 </div>
                 <div className="divide-y divide-slate-50">
                    {USUARIOS_MOCK.map(u => (
                      <div key={u.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                         <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 font-black text-xs">
                               {u.nombre.split(' ').map(n => n[0]).join('')}
                            </div>
                            <div>
                               <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">{u.nombre}</h4>
                               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{u.correo}</p>
                            </div>
                            <div className="ml-4 px-3 py-1 bg-slate-100 rounded-full text-[9px] font-black uppercase text-slate-600">{u.perfil}</div>
                         </div>
                         <div className="flex items-center gap-2">
                             <button className={`p-2.5 rounded-xl transition-all ${u.activo ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-300'}`}>
                                {u.activo ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                             </button>
                             <button className="p-2.5 hover:bg-slate-100 text-slate-400 hover:text-blue-600 rounded-xl transition-colors"><Edit2 className="w-4 h-4" /></button>
                             <button className="p-2.5 hover:bg-slate-100 text-slate-400 hover:text-slate-900 rounded-xl transition-colors"><Key className="w-4 h-4" /></button>
                             <button className="p-2.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl transition-colors opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
                         </div>
                      </div>
                    ))}
                 </div>
              </div>
            )}

            {activeTab === 'clients' && (
              <div className="space-y-4">
                 {CLIENTES_MOCK.map(c => (
                    <div key={c.id} className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm hover:shadow-xl transition-all group">
                       <div className="flex justify-between items-center mb-6">
                          <div className="flex items-center gap-4">
                             <div className="p-4 bg-slate-900 text-white rounded-3xl"><Building2 className="w-6 h-6" /></div>
                             <div>
                                <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">{c.nombre}</h4>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{c.rut} • Plan {c.plan}</p>
                             </div>
                          </div>
                          <div className="flex items-center gap-2">
                             <button className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-black uppercase rounded-xl transition-all">Expandir Ficha</button>
                             <button className="p-2 text-slate-300 hover:text-slate-900"><MoreVertical className="w-4 h-4" /></button>
                          </div>
                       </div>
                       <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-2">
                          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                             <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Usuarios</span>
                             <span className="text-xl font-black text-slate-900">{c.usuariosIds.length}</span>
                          </div>
                          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                             <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Estado</span>
                             <span className="text-[10px] font-black text-emerald-600 uppercase">Activo</span>
                          </div>
                       </div>
                    </div>
                 ))}
              </div>
            )}
         </div>
      </div>

      {showUserModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                 <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Nuevo Usuario</h3>
                 <button onClick={() => setShowUserModal(false)} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-5 h-5" /></button>
              </div>
              <form className="p-8 space-y-6">
                 <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400">Nombre Completo</label>
                    <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-slate-900/10" />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                       <label className="text-[10px] font-black uppercase text-slate-400">Correo Electrónico</label>
                       <input type="email" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none" />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[10px] font-black uppercase text-slate-400">Perfil Acceso</label>
                       <select className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold uppercase outline-none">
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
                    <input type="password" maxLength={4} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-center text-xl font-black tracking-widest outline-none" placeholder="****" />
                 </div>
                 <button className="w-full py-4 bg-slate-900 text-white text-xs font-black uppercase tracking-widest rounded-3xl shadow-xl shadow-slate-900/20 active:scale-[0.98] transition-all">Crear Perfil Usuario</button>
              </form>
           </div>
        </div>
      )}

      <ClientModal isOpen={showClientModal} onClose={() => setShowClientModal(false)} />
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
