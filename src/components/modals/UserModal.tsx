import React, { useEffect, useMemo, useState } from "react";
import { Building2, ShieldCheck, UserRound, X } from "lucide-react";
import { db, LocalUsuario } from "../../db/database";
import { useAuth } from "../../context/AuthContext";
import { useAppStore } from "../../store/useAppStore";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => Promise<void> | void;
  editingUser: LocalUsuario | null;
}

const ROLE_OPTIONS = [
  { value: "administrador", label: "Administrador global", requiresClient: false, allowsMultiple: false },
  { value: "supervisor", label: "Supervisor", requiresClient: true, allowsMultiple: true },
  { value: "tecnico", label: "Técnico", requiresClient: true, allowsMultiple: true },
  { value: "contratista", label: "Contratista", requiresClient: true, allowsMultiple: false },
  { value: "cliente", label: "Usuario cliente", requiresClient: true, allowsMultiple: false },
  { value: "visita", label: "Visita", requiresClient: true, allowsMultiple: false }
] as const;

function normalizeRole(value: string | undefined) {
  const normalized = String(value || "tecnico")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return ROLE_OPTIONS.some(option => option.value === normalized) ? normalized : "tecnico";
}

export function UserModal({ isOpen, onClose, onSaved, editingUser }: Props) {
  const { user } = useAuth();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [perfil, setPerfil] = useState("tecnico");
  const [pin, setPin] = useState("");
  const [clienteIds, setClienteIds] = useState<string[]>([]);
  const [activo, setActivo] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const clients = useAppStore(state => state.clients);
  const activeClients = useMemo(
    () => clients
      .filter(client => client.activo !== false && !client.deleted_at && Boolean(client.id))
      .sort((a, b) => String(a.nombre || a.empresa || a.id).localeCompare(String(b.nombre || b.empresa || b.id), "es")),
    [clients]
  );
  const selectedRole = ROLE_OPTIONS.find(option => option.value === perfil) || ROLE_OPTIONS[3];

  useEffect(() => {
    if (!isOpen) return;
    const editingRole = normalizeRole(editingUser?.rol);
    setNombre(editingUser?.nombre || "");
    setEmail(editingUser?.email || "");
    setPerfil(editingRole);
    setPin("");
    setActivo(editingUser?.activo ?? true);
    setClienteIds(editingUser?.cliente_ids?.length
      ? editingUser.cliente_ids
      : editingUser?.cliente_id
        ? [editingUser.cliente_id]
        : []);
    setError("");
  }, [editingUser, isOpen]);

  useEffect(() => {
    if (!selectedRole.requiresClient) {
      setClienteIds([]);
    }
  }, [selectedRole.requiresClient]);

  if (!isOpen) return null;

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (user?.perfil !== "administrador") {
      setError("Solo el administrador global puede crear o editar usuarios.");
      return;
    }
    if (!nombre.trim() || !email.trim()) {
      setError("Nombre y correo son obligatorios.");
      return;
    }
    if (!editingUser && !/^\d{4}$/.test(pin)) {
      setError("El PIN inicial debe contener exactamente 4 dígitos.");
      return;
    }
    if (pin && !/^\d{4}$/.test(pin)) {
      setError("El nuevo PIN debe contener exactamente 4 dígitos.");
      return;
    }
    if (selectedRole.requiresClient && clienteIds.length === 0) {
      setError("Debe asignar al menos un cliente para este perfil.");
      return;
    }

    setIsSaving(true);
    try {
      const uuidSync = editingUser?.uuid_sync || crypto.randomUUID();
      const id = editingUser?.id || `U-${Date.now()}`;
      const assignedClientIds = selectedRole.allowsMultiple ? clienteIds : clienteIds.slice(0, 1);
      const defaultClientId = assignedClientIds[0] || null;
      const payload = {
        id,
        uuid_sync: uuidSync,
        nombre: nombre.trim(),
        correo: email.trim().toLowerCase(),
        perfil,
        activo,
        cliente_id: defaultClientId,
        cliente_ids: assignedClientIds,
        ...(pin ? { pin } : {})
      };

      const token = sessionStorage.getItem("auth_token");
      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || "No fue posible guardar el usuario.");
      }

      await db.users.put({
        uuid_sync: result.data?.uuid_sync || uuidSync,
        id,
        nombre: payload.nombre,
        email: payload.correo,
        rol: perfil,
        activo,
        cliente_id: defaultClientId || undefined,
        cliente_ids: assignedClientIds,
        updated_at: Date.now(),
        sync_status: "synced"
      });

      await db.user_clientes
        .where("user_id")
        .equals(result.data?.uuid_sync || uuidSync)
        .delete();
      for (const assignedClientId of assignedClientIds) {
        const relationId = `UC-${result.data?.uuid_sync || uuidSync}-${assignedClientId}`;
        await db.user_clientes.put({
          uuid_sync: relationId,
          id: relationId,
          user_id: result.data?.uuid_sync || uuidSync,
          cliente_id: assignedClientId,
          created_at: Date.now(),
          updated_at: Date.now(),
          sync_status: "synced"
        });
      }

      await useAppStore.getState().hydrate();
      await onSaved?.();
      onClose();
    } catch (saveError: any) {
      setError(saveError?.message || "Error al guardar el usuario.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-[36px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-7 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
              {editingUser ? "Editar usuario" : "Crear usuario"}
            </h3>
            <p className="text-xs text-slate-500 mt-1">Identidad, rol y alcance operativo del usuario.</p>
          </div>
          <button type="button" aria-label="Cerrar formulario de usuario" onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form className="p-7 space-y-5" onSubmit={handleSave}>
          {error && (
            <div className="px-4 py-3 rounded-2xl bg-red-50 border border-red-100 text-red-700 text-xs font-bold">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-1.5">
              <span className="text-[10px] font-black uppercase text-slate-500">Nombre completo</span>
              <div className="relative">
                <UserRound className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={nombre}
                  onChange={event => setNombre(event.target.value)}
                  type="text"
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
                  required
                />
              </div>
            </label>

            <label className="space-y-1.5">
              <span className="text-[10px] font-black uppercase text-slate-500">Correo de acceso</span>
              <input
                value={email}
                onChange={event => setEmail(event.target.value)}
                type="email"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
                required
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-1.5">
              <span className="text-[10px] font-black uppercase text-slate-500">Rol del sistema</span>
              <div className="relative">
                <ShieldCheck className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <select
                  value={perfil}
                  onChange={event => setPerfil(event.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none"
                >
                  {ROLE_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </label>

            <label className="space-y-1.5">
              <span className="text-[10px] font-black uppercase text-slate-500">
                {editingUser ? "Nuevo PIN (opcional)" : "PIN inicial"}
              </span>
              <input
                value={pin}
                onChange={event => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
                type="password"
                inputMode="numeric"
                maxLength={4}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-center text-lg font-black tracking-[0.4em] outline-none"
                placeholder="••••"
                required={!editingUser}
              />
            </label>
          </div>

          {selectedRole.requiresClient && selectedRole.allowsMultiple ? (
            <fieldset className="space-y-2">
              <legend className="text-[10px] font-black uppercase text-slate-500">Clientes habilitados</legend>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 rounded-2xl border border-slate-200 bg-slate-50">
                {activeClients.map(client => {
                  const checked = clienteIds.includes(client.id);
                  return (
                    <label key={client.uuid_sync} className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setClienteIds(current =>
                          checked
                            ? current.filter(id => id !== client.id)
                            : [...current, client.id]
                        )}
                        className="w-4 h-4 accent-blue-600"
                      />
                      <span className="min-w-0">
                        <span className="block text-xs font-black text-slate-800 truncate">{client.nombre}</span>
                        <span className="block text-[10px] text-slate-500">{client.rut || client.id}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-500">
                Al iniciar sesión deberá elegir uno. Podrá cambiarlo desde el encabezado durante la sesión.
              </p>
            </fieldset>
          ) : selectedRole.requiresClient ? (
            <label className="space-y-1.5 block">
              <span className="text-[10px] font-black uppercase text-slate-500">Cliente predeterminado</span>
              <div className="relative">
                <Building2 className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <select
                  value={clienteIds[0] || ""}
                  onChange={event => setClienteIds(event.target.value ? [event.target.value] : [])}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none"
                  required
                >
                  <option value="">Seleccione un cliente...</option>
                  {activeClients.map(client => (
                    <option key={client.uuid_sync} value={client.id}>{client.nombre} · {client.rut || client.id}</option>
                  ))}
                </select>
              </div>
              <p className="text-[11px] text-slate-500">
                El usuario ingresará directamente a este cliente. Las sucursales se filtran dentro de cada módulo.
              </p>
            </label>
          ) : (
            <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 text-xs text-blue-800">
              Este rol opera en contexto global y no requiere un cliente predeterminado.
            </div>
          )}

          <label className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-slate-200 bg-slate-50">
            <div>
              <span className="block text-xs font-black uppercase text-slate-800">Usuario activo</span>
              <span className="block text-[11px] text-slate-500 mt-0.5">Los usuarios inactivos no pueden iniciar sesión.</span>
            </div>
            <input
              type="checkbox"
              checked={activo}
              onChange={event => setActivo(event.target.checked)}
              className="w-5 h-5 accent-blue-600"
            />
          </label>

          <button
            disabled={isSaving}
            className="w-full py-4 bg-slate-900 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-slate-900/20 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {isSaving ? "Guardando..." : editingUser ? "Guardar cambios" : "Crear usuario"}
          </button>
        </form>
      </div>
    </div>
  );
}
