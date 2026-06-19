import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Building2 } from 'lucide-react';
import { SearchableSelect } from '../SearchableSelect';
import { REGIONES_CHILE } from '../../data/regions';
import { LocalCliente, LocalSucursal } from '../../db/database';
import { ClientRepository } from '../../repositories/ClientRepository';
import { BranchRepository } from '../../repositories/BranchRepository';
import { syncEngine } from '../../sync/syncEngine';
import { useAppStore } from '../../store/useAppStore';

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingClient?: { client: LocalCliente, branches: LocalSucursal[] } | null;
}

interface SubLocation {
  id: string;
  uuid_sync?: string;
  tipo: string;
  nombre: string;
  direccion: string;
  codigo: string;
  region: string;
  contacto_nombre?: string;
  contacto_correo?: string;
  contacto_cargo?: string;
  repeats_client?: boolean;
}

const cleanRut = (value: string) => value.replace(/[^0-9kK]/g, '').toUpperCase();

const formatRut = (value: string) => {
  const cleaned = cleanRut(value);
  if (!cleaned) return '';

  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);
  if (!body) return dv;

  const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${formattedBody}-${dv}`;
};

const isValidRut = (value: string) => {
  const cleaned = cleanRut(value);
  if (cleaned.length < 2) return false;

  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);
  let sum = 0;
  let multiplier = 2;

  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const expected = 11 - (sum % 11);
  const expectedDv = expected === 11 ? '0' : expected === 10 ? 'K' : String(expected);
  return dv === expectedDv;
};

export function ClientModal({ isOpen, onClose, editingClient }: ClientModalProps) {
  const [subs, setSubs] = useState<SubLocation[]>([]);
  const [nombre, setNombre] = useState('');
  const [rut, setRut] = useState('');
  const [direccion, setDireccion] = useState('');
  const [region, setRegion] = useState("");
  const [contactoNombre, setContactoNombre] = useState('');
  const [contactoCargo, setContactoCargo] = useState('');
  const [contactoEmail, setContactoEmail] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [sinSucursales, setSinSucursales] = useState(false);

  useEffect(() => {
    if (sinSucursales) {
      if (subs.length === 0) {
        setSubs([{ id: Math.random().toString(), tipo: 'Tienda', nombre: 'Casa Matriz', direccion: direccion, codigo: 'MATR', region: region }]);
      } else {
        setSubs(subs.slice(0, 1).map(s => ({ ...s, nombre: 'Casa Matriz', direccion: direccion, codigo: s.codigo || 'MATR', region: region })));
      }
    }
  }, [sinSucursales]);

  useEffect(() => {
    if (editingClient && isOpen) {
      setNombre(editingClient.client.nombre || '');
      setRut(formatRut(editingClient.client.rut || ''));
      setDireccion(editingClient.client.direccion || '');
      setRegion(editingClient.client.region || '');
      setContactoNombre(editingClient.client.contacto_nombre || '');
      setContactoCargo(editingClient.client.contacto_cargo || '');
      setContactoEmail(editingClient.client.email || '');

      const loadedSubs = editingClient.branches.map(b => {
        const hasContact = !!(b.contacto_nombre || b.contacto_correo || b.contacto_cargo);
        const isSame = hasContact && 
          (b.contacto_nombre === (editingClient.client.contacto_nombre || '')) &&
          (b.contacto_correo === (editingClient.client.contacto_correo || editingClient.client.email || '')) &&
          (b.contacto_cargo === (editingClient.client.contacto_cargo || ''));

        return {
          id: b.id,
          uuid_sync: b.uuid_sync,
          tipo: 'Tienda',
          nombre: b.nombre,
          direccion: b.direccion || '',
          codigo: b.codigo,
          region: b.region || '',
          contacto_nombre: b.contacto_nombre || '',
          contacto_correo: b.contacto_correo || '',
          contacto_cargo: b.contacto_cargo || '',
          repeats_client: isSame || (!hasContact && !!editingClient.client.contacto_nombre),
        };
      });
      setSubs(loadedSubs);
      
      // Auto-detect if it's "sin sucursales" format
      if (loadedSubs.length === 1 && loadedSubs[0].nombre === 'Casa Matriz') {
         setSinSucursales(true);
      } else {
         setSinSucursales(false);
      }
    } else {
      setNombre('');
      setRut('');
      setDireccion('');
      setRegion('');
      setContactoNombre('');
      setContactoCargo('');
      setContactoEmail('');
      setSubs([]);
      setSinSucursales(false);
    }
  }, [editingClient, isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!nombre) {
      alert("El nombre de la empresa es obligatorio");
      return;
    }
    if (rut && !isValidRut(rut)) {
      alert("El RUT ingresado no es válido. Revise el número y el dígito verificador.");
      return;
    }

    setIsSaving(true);
    try {
      const clientRepo = new ClientRepository();
      const branchRepo = new BranchRepository();
      let clientId = editingClient?.client.uuid_sync;

      // VALIDATE NO DUPLICATE CLIENT NAME OR RUT
      const clientsList = useAppStore.getState().clients;
      const normalizedRut = cleanRut(rut);
      const formattedRut = formatRut(rut);
      const normalizedName = nombre.trim().toLowerCase();

      for (const c of clientsList) {
        if (editingClient && c.uuid_sync === editingClient.client.uuid_sync) {
          continue;
        }
        if (c.deleted_at) {
          continue;
        }
        
        const cRut = cleanRut(c.rut || "");
        if (normalizedRut && cRut && normalizedRut === cRut) {
          alert(`Error: Ya existe un cliente registrado con el RUT ${formattedRut}. No se permiten RUTs duplicados.`);
          setIsSaving(false);
          return;
        }

        const cName = (c.nombre || "").trim().toLowerCase();
        if (normalizedName && cName && normalizedName === cName) {
          alert(`Error: Ya existe un cliente con el nombre "${nombre}". No se permiten clientes de nombre idéntico duplicados.`);
          setIsSaving(false);
          return;
        }
      }

      // VALIDATE GLOBAL UNIQUE BRANCH CODES BEFORE SAVING
      const allBranches = await branchRepo.getAll();
      for (const sub of subs) {
        if (!sub.codigo) {
           alert("El código de la sucursal (SUB) es obligatorio.");
           setIsSaving(false);
           return;
        }
        const duplicate = allBranches.find(b => b.codigo === sub.codigo && b.uuid_sync !== sub.uuid_sync && !b.deleted_at);
        if (duplicate) {
           alert(`El código de sucursal ${sub.codigo} ya está en uso. Los códigos deben ser únicos globalmente.`);
           setIsSaving(false);
           return;
        }
      }

      // Format helpers
      const formatClientId = (name: string) => {
        return name
          .toUpperCase()
          .trim()
          .replace(/[^A-Z0-9]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');
      };

      const getBranchId = (code: string) => {
        const cleanSiglas = (code || "").toUpperCase().replace(/[^A-Z0-9]/g, '');
        return `000000${cleanSiglas}`;
      };

      if (editingClient) {
        // Update client
        const updatedClient = {
          ...editingClient.client,
          id: formatClientId(nombre),
          nombre,
          empresa: nombre,
          rut: formattedRut,
          direccion,
          region,
          contacto_nombre: contactoNombre,
          contacto_cargo: contactoCargo,
          contacto_correo: contactoEmail,
          email: contactoEmail,
        };
        await clientRepo.update(editingClient.client.uuid_sync, updatedClient);
        
        // Handle branches
        const existingBranchMap = new Map(editingClient.branches.map(b => [b.uuid_sync, b]));
        
        for (const sub of subs) {
          const sName = sub.repeats_client ? contactoNombre : (sub.contacto_nombre || '');
          const sCorreo = sub.repeats_client ? contactoEmail : (sub.contacto_correo || '');
          const sCargo = sub.repeats_client ? contactoCargo : (sub.contacto_cargo || '');

          if (sub.uuid_sync && existingBranchMap.has(sub.uuid_sync)) {
            // Update
            const existing = existingBranchMap.get(sub.uuid_sync)!;
            const updatedBranch = {
              ...existing,
              id: getBranchId(sub.codigo),
              nombre: sub.nombre,
              codigo: sub.codigo,
              descripcion: sinSucursales ? direccion : sub.direccion,
              direccion: sinSucursales ? direccion : sub.direccion,
              region: sinSucursales ? region : (sub.region || region || ''),
              contacto_nombre: sName,
              contacto_correo: sCorreo,
              contacto_cargo: sCargo,
            };
            await branchRepo.update(sub.uuid_sync, updatedBranch);
            existingBranchMap.delete(sub.uuid_sync); // Mark as processed
          } else {
            // Create new
            const newBranchId = getBranchId(sub.codigo);
            const newBranch: Omit<LocalSucursal, 'uuid_sync' | 'updated_at' | 'sync_status'> = {
              id: newBranchId,
              cliente_id: editingClient.client.uuid_sync,
              codigo: sub.codigo,
              nombre: sub.nombre,
              direccion: sinSucursales ? direccion : sub.direccion,
              ciudad: '',
              region: sinSucursales ? region : (sub.region || region || ''),
              activo: true,
              contacto_nombre: sName,
              contacto_correo: sCorreo,
              contacto_cargo: sCargo,
            };
            await branchRepo.create(newBranch);
          }
        }

        // Soft delete missing branches
        for (const [uuid, branchToRemove] of Array.from(existingBranchMap.entries())) {
          // Rule: Do not delete if it has assets
          const db = (await import('../../db/database')).db;
          const assetsCount = await db.assets.where('sucursal_id').equals(uuid).filter(a => !a.deleted_at).count();
          if (assetsCount > 0) {
             alert(`No se puede eliminar la sucursal ${branchToRemove.nombre} porque tiene ${assetsCount} activo(s) asociado(s). Se marcará como inactiva.`);
             await branchRepo.update(uuid, { ...branchToRemove, activo: false });
          } else {
             await branchRepo.delete(uuid);
          }
        }

      } else {
        // Create new client
        const newClientId = formatClientId(nombre);
        const newClient: Omit<LocalCliente, 'uuid_sync' | 'updated_at' | 'sync_status'> = {
          id: newClientId,
          nombre,
          empresa: nombre,
          rut: formattedRut,
          direccion,
          region,
          contacto_nombre: contactoNombre,
          contacto_cargo: contactoCargo,
          contacto_correo: contactoEmail,
          email: contactoEmail,
          telefono: '',
          activo: true
        };
        const createdClient = await clientRepo.create(newClient);
        clientId = createdClient.uuid_sync;

        // Create branches
        for (const sub of subs) {
          const sName = sub.repeats_client ? contactoNombre : (sub.contacto_nombre || '');
          const sCorreo = sub.repeats_client ? contactoEmail : (sub.contacto_correo || '');
          const sCargo = sub.repeats_client ? contactoCargo : (sub.contacto_cargo || '');

          const newBranchId = getBranchId(sub.codigo);
          const newBranch: Omit<LocalSucursal, 'uuid_sync' | 'updated_at' | 'sync_status'> = {
            id: newBranchId,
            cliente_id: clientId!,
            codigo: sub.codigo,
            nombre: sub.nombre,
            direccion: sinSucursales ? direccion : sub.direccion,
            ciudad: '',
            region: sinSucursales ? region : (sub.region || region || ''),
            activo: true,
            contacto_nombre: sName,
            contacto_correo: sCorreo,
            contacto_cargo: sCargo,
          };
          await branchRepo.create(newBranch);
        }
      }

      await useAppStore.getState().hydrate();
      syncEngine.triggerSync();
      setIsSaving(false);
      onClose();
    } catch (err) {
      console.error(err);
      alert("Ocurrió un error al guardar");
      setIsSaving(false);
    }
  };

  const addSub = () => {
    setSubs([...subs, { 
      id: Math.random().toString(), 
      tipo: 'Tienda', 
      nombre: '', 
      direccion: '', 
      codigo: '', 
      region: region || '',
      contacto_nombre: '',
      contacto_correo: '',
      contacto_cargo: '',
      repeats_client: false
    }]);
  };

  const updateSub = (id: string, field: keyof SubLocation, value: any) => {
    setSubs(subs.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const updateSubPartial = (id: string, partial: Partial<SubLocation>) => {
    setSubs(subs.map(s => s.id === id ? { ...s, ...partial } : s));
  };

  const handleRutChange = (value: string) => {
    setRut(formatRut(value));
  };

  const removeSub = (id: string) => {
    setSubs(subs.filter(s => s.id !== id));
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
       <div className="bg-white w-full max-w-4xl rounded-t-3xl sm:rounded-[40px] shadow-2xl animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-200 flex flex-col h-[100dvh] sm:h-auto sm:max-h-[90vh]">
          <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50 relative shrink-0">
             <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-500/20">
                   <Building2 className="w-6 h-6" />
                </div>
                <div>
                   <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{editingClient ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Alta de Cliente y Multi-Sucursales (SUBs)</p>
                </div>
             </div>
             <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors absolute top-8 right-8"><X className="w-5 h-5" /></button>
          </div>
          
          <div className="p-6 md:p-8 overflow-y-auto space-y-8 flex-1 min-h-0">
             <div className="space-y-6">
                 <h4 className="text-xs font-black uppercase text-indigo-600 tracking-widest border-b border-slate-100 pb-2">Información Principal</h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1">
                       <label className="text-[10px] font-black uppercase text-slate-400">Nombre Empresa *</label>
                       <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej. ACME Corp" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold uppercase transition-all focus:ring-2 focus:ring-indigo-500/20 outline-none" />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[10px] font-black uppercase text-slate-400">RUT Empresa</label>
                       <input type="text" value={rut} onChange={e => handleRutChange(e.target.value)} placeholder="77.123.456-7" inputMode="text" maxLength={12} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold uppercase transition-all focus:ring-2 focus:ring-indigo-500/20 outline-none" />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[10px] font-black uppercase text-slate-400">Dirección Matriz</label>
                       <input type="text" value={direccion} onChange={e => setDireccion(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold uppercase transition-all focus:ring-2 focus:ring-indigo-500/20 outline-none" />
                    </div>
                    <div className="space-y-1 z-50">
                       <label className="text-[10px] font-black uppercase text-slate-400">Región</label>
                       <SearchableSelect
                         options={REGIONES_CHILE}
                         value={region}
                         onChange={setRegion}
                         placeholder="Seleccionar Región"
                       />
                    </div>
                 </div>
             </div>

             <div className="space-y-6">
                 <h4 className="text-xs font-black uppercase text-indigo-600 tracking-widest border-b border-slate-100 pb-2">Contacto Comercial</h4>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-1">
                       <label className="text-[10px] font-black uppercase text-slate-400">Persona de Contacto</label>
                       <input type="text" value={contactoNombre} onChange={e => setContactoNombre(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold uppercase transition-all focus:ring-2 focus:ring-indigo-500/20 outline-none" />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[10px] font-black uppercase text-slate-400">Cargo</label>
                       <input type="text" value={contactoCargo} onChange={e => setContactoCargo(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold uppercase transition-all focus:ring-2 focus:ring-indigo-500/20 outline-none" />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[10px] font-black uppercase text-slate-400">Correo de Contacto</label>
                       <input type="email" value={contactoEmail} onChange={e => setContactoEmail(e.target.value)} placeholder="correo@empresa.com" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold uppercase transition-all focus:ring-2 focus:ring-indigo-500/20 outline-none lowercase" />
                    </div>
                 </div>
             </div>

             <div className="space-y-6">
                 <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h4 className="text-xs font-black uppercase text-indigo-600 tracking-widest">Sucursales (SUB)</h4>
                    {!sinSucursales && (
                      <button onClick={addSub} className="text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-indigo-100 transition-colors">
                         <Plus className="w-3 h-3" /> Agregar SUB
                      </button>
                    )}
                 </div>
                 
                 <div className="flex items-center gap-2 mt-2">
                    <input 
                       type="checkbox" 
                       id="sinSucursales"
                       checked={sinSucursales}
                       onChange={e => setSinSucursales(e.target.checked)}
                       className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                    />
                    <label htmlFor="sinSucursales" className="text-xs font-bold text-slate-600 cursor-pointer">
                       El cliente no tiene sucursal, pero la dirección será la sucursal
                    </label>
                 </div>
                 
                 <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed">
                       La codificación final de cada TAG constará del formato:<br/>
                       <span className="text-indigo-600">{"[CÓDIGO_SUB(4)].[TIPO_EQUIPO(3)].[CORRELATIVO(4)]"}</span>
                    </p>
                 </div>

                 {subs.map((sub, index) => (
                    <div key={sub.id} className="p-4 sm:p-6 bg-slate-50 border border-slate-200 rounded-3xl relative group space-y-4 shadow-sm">
                       {!sinSucursales && (
                         <button onClick={() => removeSub(sub.id)} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100">
                            <Trash2 className="w-4 h-4" />
                         </button>
                       )}
                       <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-white px-2 py-1 rounded-md shadow-sm border border-slate-100">SUB {index + 1}</span>
                       <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                          <div className="space-y-1">
                             <label className="text-[9px] font-black uppercase text-slate-400">Tipo</label>
                             <select disabled={sinSucursales} value={sub.tipo} onChange={e => updateSub(sub.id, 'tipo', e.target.value)} className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold uppercase transition-all focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:opacity-50">
                                <option value="Tienda">Tienda</option>
                                <option value="Bodega">Bodega / Almacén</option>
                                <option value="Proyecto">Proyecto</option>
                                <option value="Sitio">Sitio</option>
                                <option value="Area">Área</option>
                             </select>
                          </div>
                          <div className="space-y-1">
                             <label className="text-[9px] font-black uppercase text-slate-400">Codificador (6 Caracteres)</label>
                             <input type="text" maxLength={6} placeholder="Ej. 21-STK" value={sub.codigo} onChange={e => updateSub(sub.id, 'codigo', e.target.value.toUpperCase())} className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase transition-all focus:ring-2 focus:ring-indigo-500/20 outline-none tracking-widest select-all text-indigo-600" />
                          </div>
                          <div className="space-y-1 md:col-span-2">
                             <label className="text-[9px] font-black uppercase text-slate-400">Nombre de la Sucursal</label>
                             <input disabled={sinSucursales} type="text" placeholder="Nombre identificador" value={sub.nombre} onChange={e => updateSub(sub.id, 'nombre', e.target.value)} className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold uppercase transition-all focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:bg-slate-100 disabled:text-slate-500" />
                          </div>
                          <div className="space-y-1 md:col-span-2">
                             <label className="text-[9px] font-black uppercase text-slate-400">Dirección</label>
                             <input disabled={sinSucursales} type="text" placeholder="Dirección de la instalación" value={sub.direccion} onChange={e => updateSub(sub.id, 'direccion', e.target.value)} className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold uppercase transition-all focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:bg-slate-100 disabled:text-slate-500" />
                          </div>
                          <div className="space-y-1 md:col-span-2">
                             <label className="text-[9px] font-black uppercase text-slate-400">Región de la Sucursal</label>
                             <select 
                                disabled={sinSucursales} 
                                value={sub.region || region || ""} 
                                onChange={e => updateSub(sub.id, 'region', e.target.value)} 
                                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold uppercase transition-all focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:opacity-50"
                             >
                                <option value="">Heredar Región ({region || "Metropolitana de Santiago"})</option>
                                {REGIONES_CHILE.map(r => (
                                   <option key={r.value} value={r.value}>{r.label}</option>
                                ))}
                             </select>
                          </div>

                          <div className="flex items-center gap-2 mt-2 md:col-span-4 border-t border-slate-100 pt-3">
                             <input 
                                type="checkbox" 
                                id={`repeats_client_${sub.id}`}
                                checked={!!sub.repeats_client}
                                onChange={e => {
                                   const isChecked = e.target.checked;
                                   if (isChecked) {
                                      updateSubPartial(sub.id, { 
                                         repeats_client: true,
                                         contacto_nombre: contactoNombre,
                                         contacto_cargo: contactoCargo,
                                         contacto_correo: contactoEmail
                                      });
                                   } else {
                                      updateSubPartial(sub.id, { 
                                         repeats_client: false
                                      });
                                   }
                                }}
                                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                             />
                             <label htmlFor={`repeats_client_${sub.id}`} className="text-[10px] font-black uppercase text-indigo-600 tracking-wider cursor-pointer">
                                ¿Mismos datos de contacto del cliente?
                             </label>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:col-span-4">
                             <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase text-slate-400">Persona de Contacto del Sitio</label>
                                <input 
                                   disabled={sub.repeats_client}
                                   type="text" 
                                   placeholder="Ej. Pedro Pérez" 
                                   value={sub.repeats_client ? contactoNombre : sub.contacto_nombre || ''} 
                                   onChange={e => updateSub(sub.id, 'contacto_nombre', e.target.value)} 
                                   className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold uppercase transition-all focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:bg-slate-100 disabled:text-slate-500" 
                                />
                             </div>
                             <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase text-slate-400">Cargo de Contacto</label>
                                <input 
                                   disabled={sub.repeats_client}
                                   type="text" 
                                   placeholder="Ej. Jefe de Local" 
                                   value={sub.repeats_client ? contactoCargo : sub.contacto_cargo || ''} 
                                   onChange={e => updateSub(sub.id, 'contacto_cargo', e.target.value)} 
                                   className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold uppercase transition-all focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:bg-slate-100 disabled:text-slate-500" 
                                />
                             </div>
                             <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase text-slate-400">Correo de Contacto</label>
                                <input 
                                   disabled={sub.repeats_client}
                                   type="email" 
                                   placeholder="contacto@sucursal.com" 
                                   value={sub.repeats_client ? contactoEmail : sub.contacto_correo || ''} 
                                   onChange={e => updateSub(sub.id, 'contacto_correo', e.target.value)} 
                                   className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold uppercase transition-all focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:bg-slate-100 disabled:text-slate-500 lowercase" 
                                />
                             </div>
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
