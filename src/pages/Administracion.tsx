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
  X,
  Eye,
  Briefcase
} from "lucide-react";
import { ClientModal } from "../components/modals/ClientModal";
import { useAppStore } from "../store/useAppStore";
import { db, LocalCliente, LocalSucursal, LocalUsuario } from "../db/database";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/apiFetch";

type AdminTab = "users" | "clients";

export default function Administracion() {
  const { permisos } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>("users");
  const [showUserModal, setShowUserModal] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState<{ client: LocalCliente, branches: LocalSucursal[] } | null>(null);
  const [filter, setFilter] = useState("");

  const users = useAppStore(state => state.users);
  const clients = useAppStore(state => state.clients);
  const branches = useAppStore(state => state.branches);
  const addUsuario = useAppStore(state => state.addUsuario);
  const hydrate = useAppStore(state => state.hydrate);

  if (!permisos?.gestionar_usuarios) {
    return <div className="p-20 text-center text-slate-400 font-black uppercase italic">Acceso Denegado</div>;
  }

  const filteredUsers = users.filter(u => `${u.nombre} ${u.email || ""} ${u.rol}`.toLowerCase().includes(filter.toLowerCase()));
  const filteredClients = clients
    .filter(c => c.activo !== false)
    .filter(c => `${c.nombre} ${c.email || ""} ${c.empresa || ""}`.toLowerCase().includes(filter.toLowerCase()));

  const handleEditClient = (client: LocalCliente) => {
    const clientBranches = branches.filter(b => b.cliente_id === client.uuid_sync);
    setEditingClient({ client, branches: clientBranches });
    setShowClientModal(true);
  };

  const handleAddClient = () => {
    setEditingClient(null);
    setShowClientModal(true);
  };

  const handleCreateUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nombre = String(form.get("nombre") || "").trim();
    const email = String(form.get("email") || "").trim();
    const rol = String(form.get("rol") || "tecnico").trim();
    const pin = String(form.get("pin") || "").trim();

    if (!nombre || !email || !pin) {
      alert("Nombre, correo y PIN son obligatorios.");
      return;
    }

    const response = await apiFetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, email, correo: email, rol, perfil: rol, pin, activo: true })
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      alert(payload.error || "No se pudo crear el usuario.");
      return;
    }

    const saved: LocalUsuario = {
      uuid_sync: payload.data.uuid_sync,
      id: payload.data.id,
      nombre: payload.data.nombre,
      email: payload.data.correo,
      rol: payload.data.perfil,
      pin: "",
      activo: payload.data.activo,
      updated_at: payload.data.updated_at || Date.now(),
      sync_status: "synced",
      version: 1,
      retry_count: 0
    };
    await db.users.put(saved);
    addUsuario(saved);
    setShowUserModal(false);
  };

  return (
    <div className="flex flex-col gap-8 text-left animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Administración de Accesos</h2>
          <p className="text-slate-500 text-sm font-medium">Gestión de perfiles técnicos, administrativos y clientes.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => hydrate()} className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-all">
            <RotateCcw className="w-4 h-4" /> Actualizar Lista
          </button>
          <button
            onClick={() => activeTab === "users" ? setShowUserModal(true) : handleAddClient()}
            className="bg-slate-900 text-white px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-all shadow-xl shadow-slate-900/10"
          >
            <Plus className="w-4 h-4" /> {activeTab === "users" ? "Nuevo Usuario" : "Nuevo Cliente"}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-6 border-b border-slate-200">
        <button onClick={() => setActiveTab("users")} className={`py-4 px-2 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === "users" ? "border-slate-900 text-slate-900" : "border-transparent text-slate-400"}`}>Usuarios y Perfiles</button>
        <button onClick={() => setActiveTab("clients")} className={`py-4 px-2 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === "clients" ? "border-slate-900 text-slate-900" : "border-transparent text-slate-400"}`}>Gestión de Clientes</button>
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
          <div className="p-6 border border-slate-100 rounded-[32px] bg-white mb-4">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
              <input value={filter} onChange={(e) => setFilter(e.target.value)} type="text" placeholder="Filtrar por nombre, correo o perfil..." className="w-full pl-12 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold transition-all focus:ring-2 focus:ring-slate-900/10" />
            </div>
          </div>

          {activeTab === "users" && (
            <div className="bg-white rounded-[40px] border border-slate-200 overflow-hidden shadow-sm">
              <div className="divide-y divide-slate-50">
                {filteredUsers.map(u => (
                  <div key={u.uuid_sync} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 font-black text-xs">
                        {u.nombre.split(" ").map(n => n[0]).join("").slice(0, 3)}
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">{u.nombre}</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{u.email}</p>
                      </div>
                      <div className="ml-4 px-3 py-1 bg-slate-100 rounded-full text-[9px] font-black uppercase text-slate-600">{u.rol}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className={`p-2.5 rounded-xl transition-all ${u.activo ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-300"}`}>
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

          {activeTab === "clients" && (
            <div className="space-y-4">
              {filteredClients.length === 0 ? (
                <div className="text-center p-8 bg-slate-50 rounded-[32px] border border-dashed border-slate-300">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">No hay clientes registrados</p>
                </div>
              ) : filteredClients.map(c => {
                const clientBranches = branches.filter(b => b.cliente_id === c.uuid_sync);
                return (
                  <div key={c.uuid_sync} className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm hover:shadow-xl transition-all group">
                    <div className="flex justify-between items-center mb-6">
                      <div className="flex items-center gap-4">
                        <div className="p-4 bg-slate-900 text-white rounded-3xl"><Building2 className="w-6 h-6" /></div>
                        <div>
                          <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">{c.nombre}</h4>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{c.rut || c.empresa} - {c.email || "Sin correo"}</p>
                        </div>
                      </div>
                      <button onClick={() => handleEditClient(c)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-black uppercase rounded-xl transition-all flex items-center gap-2">
                        <Edit2 className="w-3 h-3" /> Editar Ficha
                      </button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-2">
                      <InfoBox label="Sucursales" value={`${clientBranches.length}`} />
                      <InfoBox label="Estado" value="Activo" />
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 col-span-2">
                        <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Dirección Matriz</span>
                        <span className="text-xs font-bold text-slate-600 line-clamp-1">{c.direccion || "No registrada"}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
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
            <form onSubmit={handleCreateUser} className="p-8 space-y-6">
              <Input name="nombre" label="Nombre Completo" required />
              <Input name="email" label="Correo Electrónico" type="email" required />
              <select name="rol" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold uppercase outline-none">
                <option value="visita">Visita</option>
                <option value="tecnico">Técnico</option>
                <option value="contratista">Contratista</option>
                <option value="supervisor">Supervisor</option>
                <option value="administrador">Administrador</option>
                <option value="cliente">Cliente</option>
                <option value="programador">Programador</option>
              </select>
              <Input name="pin" label="PIN de Seguridad (4 a 8 dígitos)" type="password" maxLength={8} required />
              <button className="w-full py-4 bg-slate-900 text-white text-xs font-black uppercase tracking-widest rounded-3xl shadow-xl shadow-slate-900/20 active:scale-[0.98] transition-all">Crear Perfil Usuario</button>
            </form>
          </div>
        </div>
      )}

      <ClientModal
        isOpen={showClientModal}
        onClose={() => setShowClientModal(false)}
        editingClient={editingClient}
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

function Input({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-black uppercase text-slate-400">{label}</label>
      <input {...props} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-slate-900/10" />
    </div>
  );
}

function InfoBox({ label, value }: { label: string, value: string }) {
  return (
    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
      <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">{label}</span>
      <span className="text-xl font-black text-slate-900">{value}</span>
    </div>
  );
}
