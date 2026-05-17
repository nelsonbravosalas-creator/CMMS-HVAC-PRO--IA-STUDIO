import React, { useState } from 'react';
import { X, Plus, Trash2, Building2 } from 'lucide-react';
import { clientRepo } from '../../repositories/ClientRepository';
import { branchRepo } from '../../repositories/BranchRepository';
import { useAppStore } from '../../store/useAppStore';
import { syncEngine } from '../../sync/syncEngine';

interface ClientModalProps { isOpen: boolean; onClose: () => void; }
interface SubLocation { id: string; tipo: string; nombre: string; direccion: string; codigo: string; }

export function ClientModal({ isOpen, onClose }: ClientModalProps) {
  const [subs, setSubs] = useState<SubLocation[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [nombre, setNombre] = useState('');
  const [rut, setRut] = useState('');
  const [direccion, setDireccion] = useState('');
  const [region, setRegion] = useState('');
  const [email, setEmail] = useState('');
  const addCliente = useAppStore(state => state.addCliente);
  const addBranch = useAppStore(state => state.addBranch);

  if (!isOpen) return null;

  const addSub = () => setSubs([...subs, { id: crypto.randomUUID(), tipo: 'Tienda', nombre: '', direccion: '', codigo: '' }]);
  const updateSub = (id: string, field: keyof SubLocation, value: string) => setSubs(subs.map(s => s.id === id ? { ...s, [field]: value } : s));
  const removeSub = (id: string) => setSubs(subs.filter(s => s.id !== id));

  const handleSave = async () => {
    if (!nombre.trim()) {
      alert('Nombre de empresa es obligatorio.');
      return;
    }

    setIsSaving(true);
    try {
      const clientId = `CLI-${Date.now()}`;
      const savedClient = await clientRepo.save({
        uuid_sync: crypto.randomUUID(), id: clientId, nombre, empresa: rut, email, telefono: '', direccion: `${direccion} ${region}`.trim(),
        updated_at: Date.now(), sync_status: 'pending_insert', version: 1, retry_count: 0
      } as any);
      addCliente(savedClient);

      for (const sub of subs) {
        if (!sub.nombre.trim()) continue;
        const savedBranch = await branchRepo.save({
          uuid_sync: crypto.randomUUID(), id: sub.codigo || `SUB-${Date.now()}-${sub.id}`, nombre: sub.nombre,
          cliente_id: savedClient.id, direccion: sub.direccion, ciudad: sub.tipo, region,
          updated_at: Date.now(), sync_status: 'pending_insert', version: 1, retry_count: 0
        } as any);
        addBranch(savedBranch);
      }

      syncEngine.triggerSync();
      alert('Cliente registrado localmente y encolado para sincronización.');
      onClose();
    } catch (error: any) {
      alert(`Error al guardar cliente: ${error.message || error}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl rounded-[40px] shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50 relative shrink-0">
          <div className="flex items-center gap-4"><div className="p-3 bg-indigo-600 text-white rounded-2xl"><Building2 className="w-6 h-6" /></div><div><h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Nuevo Cliente</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Alta offline-first de cliente y sucursales</p></div></div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-8 overflow-y-auto space-y-8 flex-1">
          <Section title="Información Principal">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field label="Nombre Empresa" value={nombre} onChange={setNombre} placeholder="Ej. ACME Corp" />
              <Field label="RUT Empresa" value={rut} onChange={setRut} placeholder="77.123.456-7" />
              <Field label="Dirección Matriz" value={direccion} onChange={setDireccion} />
              <Field label="Región" value={region} onChange={setRegion} />
              <Field label="Correo de Contacto" type="email" value={email} onChange={setEmail} placeholder="correo@empresa.com" />
            </div>
          </Section>

          <Section title="Sucursales (SUB)">
            <button onClick={addSub} className="text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-indigo-100 transition-colors"><Plus className="w-3 h-3" /> Agregar SUB</button>
            <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100"><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed">La codificación final de cada TAG usa el formato <span className="text-indigo-600">[CÓDIGO_SUB].[TIPO_EQUIPO].[CORRELATIVO]</span>.</p></div>
            {subs.map((sub, index) => (
              <div key={sub.id} className="p-4 sm:p-6 bg-slate-50 border border-slate-200 rounded-3xl relative group space-y-4 shadow-sm">
                <button onClick={() => removeSub(sub.id)} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl"><Trash2 className="w-4 h-4" /></button>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-white px-2 py-1 rounded-md shadow-sm border border-slate-100">SUB {index + 1}</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                  <select value={sub.tipo} onChange={e => updateSub(sub.id, 'tipo', e.target.value)} className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold uppercase"><option value="Tienda">Tienda</option><option value="Bodega">Bodega</option><option value="Proyecto">Proyecto</option><option value="Sitio">Sitio</option><option value="Area">Área</option></select>
                  <input type="text" maxLength={4} placeholder="CÓD" value={sub.codigo} onChange={e => updateSub(sub.id, 'codigo', e.target.value.toUpperCase())} className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest text-indigo-600" />
                  <input type="text" placeholder="Nombre sucursal" value={sub.nombre} onChange={e => updateSub(sub.id, 'nombre', e.target.value)} className="w-full md:col-span-2 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold uppercase" />
                  <input type="text" placeholder="Dirección" value={sub.direccion} onChange={e => updateSub(sub.id, 'direccion', e.target.value)} className="w-full md:col-span-4 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold uppercase" />
                </div>
              </div>
            ))}
            {subs.length === 0 && <div className="text-center p-8 bg-slate-50 rounded-3xl border border-dashed border-slate-300"><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">No hay sucursales registradas</p></div>}
          </Section>
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
          <button disabled={isSaving} onClick={onClose} className="px-6 py-3 bg-white hover:bg-slate-100 text-slate-600 rounded-xl font-black text-xs uppercase tracking-widest border border-slate-200 disabled:opacity-50">Cancelar</button>
          <button disabled={isSaving} onClick={handleSave} className="flex gap-2 items-center px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs uppercase tracking-widest disabled:opacity-50">{isSaving ? 'Guardando...' : 'Guardar Cliente'}</button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="space-y-6"><h4 className="text-xs font-black uppercase text-indigo-600 tracking-widest border-b border-slate-100 pb-2">{title}</h4>{children}</div>;
}

function Field({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-400">{label}</label><input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-indigo-500/20" /></div>;
}
