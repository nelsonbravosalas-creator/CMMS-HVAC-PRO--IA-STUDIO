import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  ChevronRight,
  Edit2,
  Mail,
  MapPin,
  Plus,
  RotateCcw,
  Search,
  X
} from "lucide-react";
import { ClientModal } from "../components/modals/ClientModal";
import { useAppStore } from "../store/useAppStore";
import { LocalCliente, LocalSucursal } from "../db/database";
import { syncEngine } from "../sync/syncEngine";

const normalizeText = (value?: string) =>
  (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export default function Clientes() {
  const [showClientModal, setShowClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState<{ client: LocalCliente; branches: LocalSucursal[] } | null>(null);
  const [clientFilter, setClientFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const clients = useAppStore(state => state.clients);
  const branches = useAppStore(state => state.branches);

  const getClientBranches = (client: LocalCliente) =>
    branches.filter(branch =>
      (branch.cliente_id === client.uuid_sync || branch.cliente_id === client.id) &&
      branch.activo !== false &&
      !branch.deleted_at
    );

  const activeClients = useMemo(() => {
    const query = normalizeText(clientFilter);

    return clients
      .filter(client => client.activo !== false && !client.deleted_at)
      .filter(client => {
        if (!query) return true;
        return [
          client.nombre,
          client.rut,
          client.email,
          client.contacto_correo,
          client.region
        ].some(value => normalizeText(value).includes(query));
      })
      .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "", "es"));
  }, [clients, clientFilter]);

  useEffect(() => {
    if (activeClients.length === 0) {
      setSelectedClientId(null);
      return;
    }

    const selectionIsVisible = activeClients.some(client => client.uuid_sync === selectedClientId);
    if (!selectionIsVisible) {
      setSelectedClientId(activeClients[0].uuid_sync);
    }
  }, [activeClients, selectedClientId]);

  const selectedClient =
    activeClients.find(client => client.uuid_sync === selectedClientId) ||
    clients.find(client => client.uuid_sync === selectedClientId) ||
    null;

  const selectedClientBranches = useMemo(
    () => selectedClient ? getClientBranches(selectedClient) : [],
    [selectedClient, branches]
  );

  const filteredBranches = useMemo(() => {
    const query = normalizeText(branchFilter);
    if (!query) return selectedClientBranches;

    return selectedClientBranches.filter(branch =>
      [
        branch.codigo,
        branch.nombre,
        branch.direccion,
        branch.ciudad,
        branch.region,
        branch.contacto_nombre,
        branch.contacto_correo
      ].some(value => normalizeText(value).includes(query))
    );
  }, [selectedClientBranches, branchFilter]);

  useEffect(() => {
    setBranchFilter("");
  }, [selectedClientId]);

  const handleEditClient = (client: LocalCliente) => {
    setEditingClient({ client, branches: getClientBranches(client) });
    setShowClientModal(true);
  };

  const handleAddClient = () => {
    setEditingClient(null);
    setShowClientModal(true);
  };

  const handleRefresh = async () => {
    await syncEngine.triggerSync(true);
  };

  return (
    <div className="flex flex-col gap-8 text-left animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Gestión de Clientes</h2>
          <p className="text-slate-500 text-sm font-medium">Administración de clientes y sus respectivas sucursales en terreno.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleRefresh}
            className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-all"
          >
            <RotateCcw className="w-4 h-4" /> Sincronizar
          </button>
          <button
            onClick={handleAddClient}
            className="bg-slate-900 text-white px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-all shadow-xl shadow-slate-900/10"
          >
            <Plus className="w-4 h-4" /> Nuevo Cliente
          </button>
        </div>
      </div>

      <section className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-5 md:p-6 border-b border-slate-100">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Cartera de clientes</p>
              <h3 className="text-lg font-black text-slate-900 mt-1">Selecciona un cliente para ver su detalle</h3>
            </div>
            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-2 rounded-xl self-start md:self-auto">
              {activeClients.length} {activeClients.length === 1 ? "cliente" : "clientes"}
            </span>
          </div>

          <div className="relative mt-5">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              aria-label="Buscar clientes"
              placeholder="Buscar por nombre, RUT, correo o región..."
              value={clientFilter}
              onChange={event => setClientFilter(event.target.value)}
              className="w-full pl-11 pr-11 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold outline-none transition-all focus:bg-white focus:border-slate-400 focus:ring-4 focus:ring-slate-900/5"
            />
            {clientFilter && (
              <button
                type="button"
                onClick={() => setClientFilter("")}
                aria-label="Limpiar búsqueda de clientes"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {activeClients.length === 0 ? (
          <div className="text-center p-12">
            <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-black text-slate-600">No se encontraron clientes</p>
            <p className="text-xs text-slate-400 mt-1">Prueba con otro nombre, RUT, correo o región.</p>
          </div>
        ) : (
          <>
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full min-w-[900px] text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-200">
                    <th className="px-6 py-4">Nombre</th>
                    <th className="px-5 py-4 text-center">Sucursales</th>
                    <th className="px-5 py-4">RUT</th>
                    <th className="px-5 py-4">Correo</th>
                    <th className="px-5 py-4">Región</th>
                    <th className="px-5 py-4 w-12"><span className="sr-only">Ver detalle</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeClients.map(client => {
                    const isSelected = client.uuid_sync === selectedClient?.uuid_sync;
                    const branchCount = getClientBranches(client).length;

                    return (
                      <tr
                        key={client.uuid_sync}
                        onClick={() => setSelectedClientId(client.uuid_sync)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-indigo-50/80 shadow-[inset_4px_0_0_#4f46e5]"
                            : "hover:bg-slate-50"
                        }`}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                              isSelected ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"
                            }`}>
                              <Building2 className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-black text-sm text-slate-900 uppercase truncate">{client.nombre}</p>
                              {client.sync_status === "conflicted" && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-amber-700 mt-1">
                                  <AlertTriangle className="w-3 h-3" /> Conflicto de sincronización
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className="inline-flex min-w-9 justify-center rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
                            {branchCount}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm font-bold text-slate-600 whitespace-nowrap">{client.rut || "Sin RUT"}</td>
                        <td className="px-5 py-4 text-sm text-slate-600 max-w-[220px] truncate">{client.email || client.contacto_correo || "Sin correo"}</td>
                        <td className="px-5 py-4 text-sm font-semibold text-slate-600">{client.region || "Sin región"}</td>
                        <td className="px-5 py-4">
                          <ChevronRight className={`w-5 h-5 transition-transform ${isSelected ? "text-indigo-600 translate-x-1" : "text-slate-300"}`} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="lg:hidden divide-y divide-slate-100">
              {activeClients.map(client => {
                const isSelected = client.uuid_sync === selectedClient?.uuid_sync;
                return (
                  <button
                    type="button"
                    key={client.uuid_sync}
                    onClick={() => setSelectedClientId(client.uuid_sync)}
                    className={`w-full p-5 text-left transition-colors ${isSelected ? "bg-indigo-50" : "hover:bg-slate-50"}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isSelected ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between gap-3">
                          <p className="font-black text-sm text-slate-900 uppercase truncate">{client.nombre}</p>
                          <ChevronRight className={`w-5 h-5 shrink-0 ${isSelected ? "text-indigo-600" : "text-slate-300"}`} />
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3 text-xs">
                          <p><span className="text-slate-400 block">Sucursales</span><strong>{getClientBranches(client).length}</strong></p>
                          <p><span className="text-slate-400 block">RUT</span><strong>{client.rut || "Sin RUT"}</strong></p>
                          <p className="col-span-2 truncate"><span className="text-slate-400 block">Correo</span><strong>{client.email || client.contacto_correo || "Sin correo"}</strong></p>
                          <p className="col-span-2"><span className="text-slate-400 block">Región</span><strong>{client.region || "Sin región"}</strong></p>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </section>

      {selectedClient && (
        <section className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-5 md:p-7 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-5">
              <div className="flex items-start gap-4 min-w-0">
                <div className="p-3.5 bg-slate-900 text-white rounded-2xl shrink-0">
                  <Building2 className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600">Detalle del cliente</p>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mt-1 truncate">{selectedClient.nombre}</h3>
                  <p className="text-xs font-bold text-slate-400 mt-1">{selectedClient.rut || "RUT no registrado"}</p>
                </div>
              </div>
              <button
                onClick={() => handleEditClient(selectedClient)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-black uppercase rounded-xl transition-all flex items-center gap-2 shrink-0"
              >
                <Edit2 className="w-3.5 h-3.5" /> Editar ficha
              </button>
            </div>

            {selectedClient.sync_status === "conflicted" && (
              <div className="mt-5 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <p className="text-xs font-black text-amber-800 uppercase">Conflicto de sincronización</p>
                  <p className="text-xs text-amber-800/80 mt-1">La ficha tiene cambios que deben revisarse antes de consolidarla con la base central.</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mt-6">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Contacto</span>
                <span className="text-sm font-extrabold text-slate-800 block truncate">{selectedClient.contacto_nombre || "No registrado"}</span>
                {selectedClient.contacto_cargo && <span className="text-[10px] font-bold text-slate-500">{selectedClient.contacto_cargo}</span>}
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Correo</span>
                <span className="text-sm font-bold text-slate-700 block truncate">{selectedClient.email || selectedClient.contacto_correo || "No registrado"}</span>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Dirección central</span>
                <span className="text-sm font-bold text-slate-700 line-clamp-2">{selectedClient.direccion || "No registrada"}</span>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Región</span>
                <span className="text-sm font-extrabold text-indigo-600 line-clamp-2">{selectedClient.region || "No registrada"}</span>
              </div>
            </div>
          </div>

          <div className="p-5 md:p-7">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Sucursales asignadas</p>
                <h4 className="font-black text-slate-900 mt-1">
                  {selectedClientBranches.length} {selectedClientBranches.length === 1 ? "sucursal registrada" : "sucursales registradas"}
                </h4>
              </div>

              <div className="relative w-full lg:max-w-md">
                <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  aria-label="Buscar sucursales"
                  placeholder="Buscar sucursal, código, ciudad o contacto..."
                  value={branchFilter}
                  onChange={event => setBranchFilter(event.target.value)}
                  className="w-full pl-11 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold outline-none transition-all focus:bg-white focus:border-slate-400 focus:ring-4 focus:ring-slate-900/5"
                />
                {branchFilter && (
                  <button
                    type="button"
                    onClick={() => setBranchFilter("")}
                    aria-label="Limpiar búsqueda de sucursales"
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {filteredBranches.length === 0 ? (
              <div className="p-10 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <Building2 className="w-9 h-9 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-600">
                  {selectedClientBranches.length === 0 ? "Este cliente no tiene sucursales registradas." : "No hay sucursales que coincidan con la búsqueda."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full min-w-[850px] text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[9px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-200">
                      <th className="px-5 py-3.5">Código y nombre</th>
                      <th className="px-5 py-3.5">Ubicación</th>
                      <th className="px-5 py-3.5">Contacto</th>
                      <th className="px-5 py-3.5">Cargo</th>
                      <th className="px-5 py-3.5">Correo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredBranches.map(branch => (
                      <tr key={branch.uuid_sync || branch.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-4">
                          <div className="font-extrabold text-sm text-slate-800 uppercase">{branch.codigo || branch.id}</div>
                          <div className="text-[10px] text-slate-400 uppercase font-black mt-0.5">{branch.nombre}</div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-start gap-2 text-xs text-slate-600 max-w-[260px]">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                            <div>
                              <p>{branch.direccion || "Dirección no registrada"}</p>
                              <p className="text-[10px] text-indigo-600 font-bold mt-0.5">{branch.region || branch.ciudad || "Región no registrada"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-xs font-extrabold text-slate-700">{branch.contacto_nombre || "No establecido"}</td>
                        <td className="px-5 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400">{branch.contacto_cargo || "—"}</td>
                        <td className="px-5 py-4">
                          {branch.contacto_correo ? (
                            <span className="inline-flex items-center gap-2 text-xs text-indigo-600">
                              <Mail className="w-3.5 h-3.5" /> {branch.contacto_correo}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      <ClientModal
        isOpen={showClientModal}
        onClose={() => setShowClientModal(false)}
        editingClient={editingClient}
      />
    </div>
  );
}
