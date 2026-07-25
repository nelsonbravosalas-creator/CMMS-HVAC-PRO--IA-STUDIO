import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/database";
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit, 
  AlertCircle, 
  Package, 
  Wrench, 
  Scale, 
  Car, 
  Clipboard, 
  Activity,
  User,
  Minus,
  CheckCircle,
  Truck
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { syncEngine } from "../sync/syncEngine";

type CategoriaInventario = 'maquinas' | 'instrumentos' | 'vehiculos' | 'insumos' | 'materiales_repuestos';

const CATEGORIAS: Record<CategoriaInventario, { label: string; icon: any; color: string }> = {
  maquinas: { label: "Máquinas y Herramientas", icon: Wrench, color: "text-blue-500 bg-blue-50 border-blue-200" },
  instrumentos: { label: "Instrumentos", icon: Scale, color: "text-purple-500 bg-purple-50 border-purple-200" },
  vehiculos: { label: "Vehículos", icon: Car, color: "text-amber-500 bg-amber-50 border-amber-200" },
  insumos: { label: "Insumos", icon: Clipboard, color: "text-emerald-500 bg-emerald-50 border-emerald-200" },
  materiales_repuestos: { label: "Materiales y Repuestos", icon: Package, color: "text-rose-500 bg-rose-50 border-rose-200" }
};

export default function InventarioInterno() {
  const activeClientId = localStorage.getItem("active_client") || "default";
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<CategoriaInventario | "all">("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  // Form states
  const [formData, setFormData] = useState({
    nombre: "",
    codigo: "",
    categoria: "maquinas" as CategoriaInventario,
    stock: 0,
    unidad: "unidades",
    marca: "",
    modelo: "",
    estado: "disponible",
    asignado_a: ""
  });

  // Query inventory from Dexie
  const items = useLiveQuery(async () => {
    const list = await db.inventory.toArray();
    // Filter by client partition and skip soft-deleted
    return list.filter(item => {
      const isClient = item.cliente_id === activeClientId;
      const notDeleted = item.sync_status !== "pending_delete";
      return isClient && notDeleted;
    });
  }, [activeClientId]) || [];

  // Computed metrics
  const totalItems = items.length;
  const totalStockVal = items.reduce((sum, item) => sum + (item.stock || 0), 0);
  const limitWarningItems = items.filter(item => item.stock <= 3).length;
  const activeVehicles = items.filter(item => item.categoria === "vehiculos" && item.estado === "disponible").length;

  // Filter items
  const filteredItems = items.filter(item => {
    const matchesSearch = item.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (item.marca && item.marca.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = selectedCategory === "all" || item.categoria === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleStockChange = async (uuid_sync: string, increment: number) => {
    const item = await db.inventory.get(uuid_sync);
    if (!item) return;
    const newStock = Math.max(0, (item.stock || 0) + increment);
    
    await db.inventory.update(uuid_sync, {
      stock: newStock,
      updated_at: Date.now(),
      sync_status: "pending_update"
    });
    
    // Add transaction to Sync Queue
    await db.sync_queue.add({
      table: "inventory",
      uuid_sync,
      operation: "update",
      timestamp: Date.now(),
      data: { ...item, stock: newStock }
    });
    
    syncEngine.triggerSync();
  };

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormData({
      nombre: "",
      codigo: "",
      categoria: "maquinas",
      stock: 0,
      unidad: "unidades",
      marca: "",
      modelo: "",
      estado: "disponible",
      asignado_a: ""
    });
    setShowAddModal(true);
  };

  const handleOpenEdit = (item: any) => {
    setEditingItem(item);
    setFormData({
      nombre: item.nombre,
      codigo: item.codigo,
      categoria: item.categoria,
      stock: item.stock,
      unidad: item.unidad,
      marca: item.marca || "",
      modelo: item.modelo || "",
      estado: item.estado || "disponible",
      asignado_a: item.asignado_a || ""
    });
    setShowAddModal(true);
  };

  const handleDelete = async (uuid_sync: string) => {
    if (!confirm("¿Está seguro de que desea eliminar este ítem del inventario?")) return;
    
    await db.inventory.update(uuid_sync, {
      sync_status: "pending_delete",
      updated_at: Date.now()
    });

    await db.sync_queue.add({
      table: "inventory",
      uuid_sync,
      operation: "delete",
      timestamp: Date.now(),
      data: {}
    });

    syncEngine.triggerSync();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre || !formData.codigo) {
      alert("Por favor complete los campos obligatorios");
      return;
    }

    const now = Date.now();
    const itemPayload = {
      nombre: formData.nombre,
      codigo: formData.codigo,
      categoria: formData.categoria,
      stock: Number(formData.stock),
      unidad: formData.unidad,
      marca: formData.marca,
      modelo: formData.modelo,
      estado: formData.estado,
      asignado_a: formData.asignado_a,
      cliente_id: activeClientId,
      updated_at: now
    };

    if (editingItem) {
      // Edit
      await db.inventory.update(editingItem.uuid_sync, {
        ...itemPayload,
        sync_status: "pending_update"
      });

      await db.sync_queue.add({
        table: "inventory",
        uuid_sync: editingItem.uuid_sync,
        operation: "update",
        timestamp: now,
        data: { uuid_sync: editingItem.uuid_sync, ...itemPayload }
      });
    } else {
      // Create
      const newUuid = crypto.randomUUID();
      await db.inventory.add({
        uuid_sync: newUuid,
        id: `INV-${Date.now()}`,
        ...itemPayload,
        sync_status: "pending_insert"
      });

      await db.sync_queue.add({
        table: "inventory",
        uuid_sync: newUuid,
        operation: "insert",
        timestamp: now,
        data: { uuid_sync: newUuid, id: `INV-${Date.now()}`, ...itemPayload }
      });
    }

    setShowAddModal(false);
    syncEngine.triggerSync();
  };

  return (
    <div id="inventario-interno-container" className="p-6 md:p-8 space-y-8 bg-slate-50 min-h-screen text-slate-800">
      
      {/* Header and Add Action */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Package className="w-8 h-8 text-blue-600" />
            Control de Inventario Interno
          </h1>
          <p className="text-slate-500 font-medium">Asignación, trazabilidad y stock físico de recursos técnicos.</p>
        </div>
        <button 
          id="btn-nuevo-item-inventario"
          onClick={handleOpenAdd}
          className="bg-blue-600 text-white px-5 py-3 rounded-2xl font-bold tracking-wider hover:bg-blue-700 transition flex items-center gap-2 shadow-lg shadow-blue-600/10 active:scale-95 duration-100"
        >
          <Plus className="w-5 h-5" />
          Registrar Recurso
        </button>
      </div>

      {/* Metrics Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="p-4 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Productos Registrados</p>
            <p className="text-2xl font-black text-slate-800">{totalItems}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="p-4 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Stock Físico Global</p>
            <p className="text-2xl font-black text-slate-800">{totalStockVal}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="p-4 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Stock Bajo (Crítico)</p>
            <p className="text-2xl font-black text-slate-800">{limitWarningItems}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="p-4 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100">
            <Car className="w-6 h-6" />
          </div>
          <div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Vehículos Disponibles</p>
            <p className="text-2xl font-black text-slate-800">{activeVehicles}</p>
          </div>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Buscar por nombre, código..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-sm transition"
          />
        </div>
        
        {/* Horizontal Category Pill Filter */}
        <div className="flex items-center gap-2 overflow-x-auto w-full no-scrollbar pb-1 md:pb-0">
          <button 
            onClick={() => setSelectedCategory("all")}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wider transition ${selectedCategory === "all" ? "bg-slate-900 text-white shadow" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            Todos
          </button>
          {Object.entries(CATEGORIAS).map(([key, item]) => {
            const Icon = item.icon;
            return (
              <button 
                key={key}
                onClick={() => setSelectedCategory(key as CategoriaInventario)}
                className={`px-4 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wider transition flex items-center gap-2 ${selectedCategory === key ? "bg-blue-600 text-white shadow shadow-blue-600/10" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Inventory Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.map((item) => {
          const categoryMeta = CATEGORIAS[item.categoria];
          const CategoryIcon = categoryMeta?.icon || Package;
          const isLowStock = item.stock <= 3;

          return (
            <motion.div 
              layout 
              id={`inv-${item.id}`}
              key={item.uuid_sync} 
              className="bg-white p-6 rounded-3xl border border-slate-200/80 hover:shadow-md transition duration-200 flex flex-col justify-between"
            >
              <div>
                {/* Meta details */}
                <div className="flex justify-between items-center mb-4">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest border ${categoryMeta?.color || 'bg-slate-50 border-slate-200'}`}>
                    {categoryMeta?.label}
                  </span>
                  <span className="text-slate-400 font-mono text-xs font-bold uppercase">{item.codigo}</span>
                </div>

                <h3 className="text-base font-black text-slate-800 tracking-tight mb-1">{item.nombre}</h3>
                <div className="space-y-1.5 text-xs text-slate-500 font-medium mb-5">
                  {item.marca && <p>Marca: <span className="text-slate-700 font-bold">{item.marca}</span> {item.modelo && `| Modelo: ${item.modelo}`}</p>}
                  {item.asignado_a && <p className="flex items-center gap-1">Asignado: <span className="text-blue-600 font-bold underline flex items-center gap-0.5"><User className="w-3 h-3" /> {item.asignado_a}</span></p>}
                  <p>Estado: <span className={`font-bold uppercase tracking-wide px-2 py-0.5 rounded text-[10px] ${item.estado === "disponible" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>{item.estado}</span></p>
                </div>
              </div>

              {/* Adjust Stock Panel */}
              <div className="border-t border-slate-100 pt-4 flex justify-between items-center bg-slate-50 -mx-6 -mb-6 p-4 rounded-b-3xl mt-4">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleStockChange(item.uuid_sync, -1)}
                    className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition shadow-sm"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <div className="text-center px-2">
                    <span className={`text-base font-black ${isLowStock ? 'text-rose-600' : 'text-slate-800'}`}>{item.stock}</span>
                    <span className="text-[10px] text-slate-400 block font-bold leading-3 uppercase">{item.unidad}</span>
                  </div>
                  <button 
                    onClick={() => handleStockChange(item.uuid_sync, 1)}
                    className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Edit Actions */}
                <div className="flex gap-1.5">
                  <button 
                    title="Editar"
                    onClick={() => handleOpenEdit(item)}
                    className="p-2 bg-white text-slate-500 hover:text-teal-600 rounded-xl border border-slate-200 hover:border-teal-200 transition shadow-sm"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button 
                    title="Eliminar"
                    onClick={() => handleDelete(item.uuid_sync)}
                    className="p-2 bg-white text-slate-500 hover:text-rose-600 rounded-xl border border-slate-200 hover:border-rose-200 transition shadow-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
        {filteredItems.length === 0 && (
          <div className="col-span-full py-16 text-center text-slate-400 font-medium">
            <Package className="w-12 h-12 mx-auto text-slate-300 mb-2" />
            No se encontraron recursos técnicos asignados en esta categoría.
          </div>
        )}
      </div>

      {/* Elegant Add/Edit Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-lg shadow-2xl shadow-slate-950/20 overflow-hidden"
            >
              <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                <h2 className="text-xl font-black flex items-center gap-2">
                  <Package className="w-6 h-6 text-blue-400" />
                  {editingItem ? "Modificar Recurso" : "Registrar Recurso Interno"}
                </h2>
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="p-1 text-slate-400 hover:text-white transition font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSave} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Nombre del Recurso *</label>
                    <input 
                      type="text" 
                      required
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      placeholder="Ej: Multímetro digital Fluke 117"
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Código Único *</label>
                    <input 
                      type="text" 
                      required
                      value={formData.codigo}
                      onChange={(e) => setFormData({ ...formData, codigo: e.target.value.toUpperCase() })}
                      placeholder="Ej: FLU-117"
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Categoría *</label>
                    <select 
                      value={formData.categoria}
                      onChange={(e) => setFormData({ ...formData, categoria: e.target.value as CategoriaInventario })}
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="maquinas">1. Máquinas y Herramientas</option>
                      <option value="instrumentos">2. Instrumentos</option>
                      <option value="vehiculos">3. Vehículos</option>
                      <option value="insumos">4. Insumos</option>
                      <option value="materiales_repuestos">5. Materiales y Repuestos</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Stock Inicial</label>
                    <input 
                      type="number" 
                      min="0"
                      value={formData.stock}
                      onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) })}
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Unidad de Medida</label>
                    <input 
                      type="text" 
                      value={formData.unidad}
                      onChange={(e) => setFormData({ ...formData, unidad: e.target.value })}
                      placeholder="Ej: unidades, metros, kit"
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Marca</label>
                    <input 
                      type="text" 
                      value={formData.marca}
                      onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
                      placeholder="Opcional"
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Modelo</label>
                    <input 
                      type="text" 
                      value={formData.modelo}
                      onChange={(e) => setFormData({ ...formData, modelo: e.target.value })}
                      placeholder="Opcional"
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Asignado a (Personal)</label>
                    <input 
                      type="text" 
                      value={formData.asignado_a}
                      onChange={(e) => setFormData({ ...formData, asignado_a: e.target.value })}
                      placeholder="Técnico o Supervisor"
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Estado Operativo</label>
                    <select 
                      value={formData.estado}
                      onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="disponible">✓ Disponible</option>
                      <option value="mantenimiento">⚠ En Mantenimiento</option>
                      <option value="baja">☠ Dado de baja</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 mt-6">
                  <button 
                    type="button" 
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold uppercase transition"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase transition shadow-md shadow-blue-600/10"
                  >
                    Guardar Recurso
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
