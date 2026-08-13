import { useState, useMemo, useEffect } from "react";
import { 
  ScanLine, 
  TrendingUp, 
  AlertTriangle, 
  Clock, 
  Wrench, 
  Ticket, 
  Search,
  Filter,
  CheckCircle2,
  FileWarning,
  Activity,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell,
  BarChart,
  Bar,
  Label
} from "recharts";
import { Link } from "wouter";
import { useAppStore } from "../store/useAppStore";
import { ALMACEN_LABELS } from "../data/branches";

function formatToDDMMAAAA(dateStr: string): string {
  if (!dateStr) return "-";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr;
  
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const y = parts[0];
    const m = parts[1];
    const d = parts[2];
    return `${d}/${m}/${y}`;
  }
  return dateStr;
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  }
  return null;
}

function calculateAndFormatProximoMantenimiento(ultimoMantenimiento: string, proximoMantenimiento: string, frecuencia?: string): string {
  if (!ultimoMantenimiento) {
    if (proximoMantenimiento) return formatToDDMMAAAA(proximoMantenimiento);
    return "-";
  }

  const lastDate = parseDate(ultimoMantenimiento);
  if (!lastDate || isNaN(lastDate.getTime())) {
    if (proximoMantenimiento) return formatToDDMMAAAA(proximoMantenimiento);
    return "-";
  }

  let monthsToAdd = 6;
  
  if (frecuencia) {
    const freq = frecuencia.toLowerCase();
    if (freq.includes("mensual")) monthsToAdd = 1;
    else if (freq.includes("bi") || freq.includes("2")) monthsToAdd = 2;
    else if (freq.includes("tri") || freq.includes("3") || freq.includes("quarter")) monthsToAdd = 3;
    else if (freq.includes("cuatri") || freq.includes("4")) monthsToAdd = 4;
    else if (freq.includes("semes") || freq.includes("6") || freq.includes("half")) monthsToAdd = 6;
    else if (freq.includes("anual") || freq.includes("12") || freq.includes("year")) monthsToAdd = 12;
  } else if (proximoMantenimiento) {
    const nextDateObj = parseDate(proximoMantenimiento);
    if (nextDateObj && !isNaN(nextDateObj.getTime())) {
      const diffMonths = (nextDateObj.getFullYear() - lastDate.getFullYear()) * 12 + (nextDateObj.getMonth() - lastDate.getMonth());
      if (diffMonths > 0) {
        monthsToAdd = diffMonths;
      }
    }
  }

  const nextDate = new Date(lastDate);
  nextDate.setMonth(nextDate.getMonth() + monthsToAdd);

  const d = String(nextDate.getDate()).padStart(2, '0');
  const m = String(nextDate.getMonth() + 1).padStart(2, '0');
  const y = nextDate.getFullYear();

  return `${d}/${m}/${y}`;
}

export default function Dashboard() {
  const assets = useAppStore(state => state.assets);
  const work_orders = useAppStore(state => state.work_orders);
  const branches = useAppStore(state => state.branches);
  const clients = useAppStore(state => state.clients);
  const loading = useAppStore(state => state.isLoading);

  const activeClient = localStorage.getItem("active_client");

  const currentClient = useMemo(() => {
    if (!activeClient) return null;
    return clients.find(c => c.uuid_sync === activeClient || c.id === activeClient);
  }, [clients, activeClient]);

  const clientBranches = useMemo(() => {
    if (activeClient) {
      return branches.filter(b => 
        (b.cliente_id === activeClient || 
         (currentClient && (b.cliente_id === currentClient.uuid_sync || b.cliente_id === currentClient.id))) && 
        b.activo !== false && 
        !b.deleted_at
      );
    }
    return branches.filter(b => b.activo !== false && !b.deleted_at);
  }, [branches, activeClient, currentClient]);

  const uniqueClientBranches = useMemo(() => {
    const seen = new Set<string>();
    return clientBranches.filter(branch => {
      const key = String(branch.uuid_sync || branch.id || branch.codigo);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [clientBranches]);

  const clientAssets = useMemo(() => {
    if (activeClient) {
      return assets.filter(eq => 
        eq.cliente_id === activeClient || 
        (currentClient && (eq.cliente_id === currentClient.uuid_sync || eq.cliente_id === currentClient.id))
      );
    }
    return assets;
  }, [assets, activeClient, currentClient]);

  const clientWorkOrders = useMemo(() => {
    if (activeClient) {
      return work_orders.filter(wo => 
        wo.cliente_id === activeClient || 
        (currentClient && (wo.cliente_id === currentClient.uuid_sync || wo.cliente_id === currentClient.id))
      );
    }
    return work_orders;
  }, [work_orders, activeClient, currentClient]);

  const DATA_POWER = useMemo(() => {
    return uniqueClientBranches.map(b => {
      const branchCode = b.codigo || b.id;
      const power = clientAssets
        .filter(eq => eq.tag?.startsWith(branchCode) || eq.sucursal_id === b.id || eq.sucursal_id === b.uuid_sync)
        .reduce((sum, eq) => {
          const voltage = Number(eq.voltaje);
          const current = Number(eq.corriente);
          return Number.isFinite(voltage) && Number.isFinite(current) ? sum + ((voltage * current) / 1000) : sum;
        }, 0);
      return {
        name: b.nombre,
        power: Number(power.toFixed(2))
      };
    }).filter(item => item.power > 0).slice(0, 5);
  }, [uniqueClientBranches, clientAssets]);

  const mtbf = useMemo(() => {
    const hours = clientAssets.map(eq => Number(eq.horas_operacion)).filter(value => Number.isFinite(value) && value > 0);
    const failures = clientWorkOrders.filter(wo => wo.prioridad === 'alta' || wo.prioridad === 'critica').length;
    return hours.length > 0 && failures > 0 ? `${Math.round(hours.reduce((sum, value) => sum + value, 0) / failures)}h` : "—";
  }, [clientAssets, clientWorkOrders]);

  const mttr = useMemo(() => {
    const resolvedWithDuration = clientWorkOrders
      .map(wo => Number((wo as any).duracion_horas))
      .filter(value => Number.isFinite(value) && value >= 0);
    return resolvedWithDuration.length > 0
      ? `${(resolvedWithDuration.reduce((sum, value) => sum + value, 0) / resolvedWithDuration.length).toFixed(1)}h`
      : "—";
  }, [clientWorkOrders]);

  const pendingFirmas = useMemo(() => {
    const pendingCliente = clientWorkOrders.filter(w => w.estado === 'abierto').length;
    const pendingContratista = clientWorkOrders.filter(w => w.estado === 'en_proceso').length;
    const pendingVisita = clientWorkOrders.filter(w => w.estado === 'asignado').length;
    return {
      cliente: String(pendingCliente).padStart(2, '0'),
      contratista: String(pendingContratista).padStart(2, '0'),
      visita: String(pendingVisita).padStart(2, '0')
    };
  }, [clientWorkOrders]);

  /** Estado para filtrar por sucursal / almacén */
  const [almacen, setAlmacen] = useState("");
  /** Estado para filtrar por estado técnico (falla, mantenimiento, operativo) */
  const [estado, setEstado] = useState("");

  // Reset branch filter if it's not valid for the current client's branches
  useEffect(() => {
    if (almacen && !clientBranches.some(b => (b.codigo || b.id) === almacen)) {
      setAlmacen("");
    }
  }, [activeClient, clientBranches, almacen]);


  /**
   * Memoización de equipos filtrados.
   */
  const filteredEquipos = useMemo(() => {
    return clientAssets.filter(eq => {
      let matchAlmacen = true;
      if (almacen) {
        // Find if any branch matches the selected value
        const targetBranch = clientBranches.find(b => (b.codigo || b.id) === almacen || b.id === almacen || b.uuid_sync === almacen);
        if (targetBranch) {
          const branchCode = targetBranch.codigo || targetBranch.id;
          matchAlmacen = eq.tag.startsWith(branchCode) || 
                         eq.sucursal_id === targetBranch.id || 
                         eq.sucursal_id === targetBranch.uuid_sync;
        } else {
          matchAlmacen = eq.tag.startsWith(almacen);
        }
      }
      const matchEstado = estado ? eq.estado === estado : true;
      return matchAlmacen && matchEstado;
    });
  }, [clientAssets, almacen, estado, clientBranches]);

  const kpis = useMemo(() => {
    const total = filteredEquipos.length;
    const fallas = filteredEquipos.filter(e => e.estado === 'falla').length;
    const mantv = filteredEquipos.filter(e => e.estado === 'mantenimiento').length;
    const operativo = filteredEquipos.filter(e => e.estado === 'operativo').length;
    
    const disponibilidad = total > 0 ? ((operativo / total) * 100).toFixed(1) : "0";

    return {
      total,
      fallas,
      mantv,
      operativo,
      disponibilidad: `${disponibilidad}%`,
      work_orders: clientWorkOrders.filter(t => t.estado === 'abierto' || t.estado === 'en_proceso').length
    };
  }, [filteredEquipos, clientWorkOrders]);

  const dataStatus = useMemo(() => {
    const fallas = filteredEquipos.filter(e => e.estado === 'falla').length;
    const mantv = filteredEquipos.filter(e => e.estado === 'mantenimiento').length;
    const operativo = filteredEquipos.filter(e => e.estado === 'operativo').length;
    const total = filteredEquipos.length || 1;

    return [
      { name: 'Operativo', value: Math.round((operativo / total) * 100), count: operativo, color: '#10b981' },
      { name: 'Falla', value: Math.round((fallas / total) * 100), count: fallas, color: '#ef4444' },
      { name: 'Preventivo', value: Math.round((mantv / total) * 100), count: mantv, color: '#f59e0b' },
    ];
  }, [filteredEquipos]);

  return (
    <div className="flex w-full min-w-0 flex-col gap-6 sm:gap-8 overflow-x-hidden">
      {/* Header / Filter Bar */}
      <div className="flex min-w-0 flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-black text-[#a7e6b1] tracking-tight uppercase">Salud Operativa</h2>
          <p className="text-slate-500 text-sm font-medium">Resumen ejecutivo y monitoreo de activos en tiempo real.</p>
        </div>
        
        <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
          <div className="grid w-full min-w-0 grid-cols-2 bg-white rounded-lg border border-slate-200 p-1 shadow-sm sm:flex sm:w-auto">
            <select 
              aria-label="Filtrar por sucursal"
              value={almacen}
              onChange={(e) => setAlmacen(e.target.value)}
              className="w-full min-w-0 bg-transparent text-[11px] sm:text-xs font-bold px-2 sm:px-3 py-2 sm:py-1 outline-none text-slate-600 border-r border-slate-100 dark:bg-slate-900 dark:text-slate-100 dark:border-white/10"
            >
              <option value="">Todas las Sucursales</option>
              {uniqueClientBranches.map(b => (
                <option key={b.id || b.uuid_sync} value={b.codigo || b.id}>
                  {b.nombre} ({b.codigo || b.id})
                </option>
              ))}
            </select>
            <select 
              aria-label="Filtrar por estado técnico"
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className="w-full min-w-0 bg-transparent text-[11px] sm:text-xs font-bold px-2 sm:px-3 py-2 sm:py-1 outline-none text-slate-600 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="">Cualquier Estado</option>
              <option value="falla">Falla Crítica</option>
              <option value="mantenimiento">Mantenimiento</option>
              <option value="operativo">Operativo</option>
            </select>
          </div>
          
          <Link href="/scanner?autoScan=true" className="w-full sm:w-auto">
            <button className="w-full sm:w-auto justify-center bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-widest px-4 py-2.5 rounded-lg shadow-lg shadow-blue-600/20 flex items-center gap-2 transition-all active:scale-95">
              <ScanLine className="w-4 h-4" /> Escanear QR
            </button>
          </Link>
        </div>
      </div>

      {/* Primary KPIs */}
      <div className="grid min-w-0 grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <KPICard label="Disponibilidad" value={kpis.disponibilidad} icon={Activity} color="text-emerald-500" className="text-container-contrast" />
        <KPICard label="MTBF" value={mtbf} icon={Clock} color="text-blue-500" />
        <KPICard label="MTTR" value={mttr} icon={Wrench} color="text-amber-500" />
        <KPICard label="Tickets Activos" value={kpis.work_orders.toString().padStart(2, '0')} icon={Ticket} color="text-red-500" alert={kpis.work_orders > 0} />
        <KPICard label="Equipos en Falla" value={kpis.fallas.toString().padStart(2, '0')} icon={AlertTriangle} color="text-rose-500" alert={kpis.fallas > 0} />
        <KPICard label="Mantv. Pendientes" value={kpis.mantv.toString().padStart(2, '0')} icon={CheckCircle2} color="text-slate-500" />
      </div>

      {/* Charts Grid */}
      <div className="grid min-w-0 grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
        {/* Costos y Actividad Recent */}
        <div className="min-w-0 xl:col-span-2 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm text-left">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="font-bold text-slate-900 uppercase text-xs tracking-widest">Costos mensuales</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Requiere costos registrados en órdenes de trabajo</p>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Costos (USD)</span>
              </div>
            </div>
          </div>
          <div className="h-64 mt-4 flex items-center justify-center rounded-xl bg-slate-50 text-center px-6">
            <p className="text-xs font-bold text-slate-400 uppercase">Aún no hay datos de costos para graficar</p>
          </div>
        </div>

        {/* Distribución por Estado Real */}
        <div className="min-w-0 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm text-left">
          <h3 className="font-bold text-slate-900 uppercase text-xs tracking-widest mb-4">Estado del Parque</h3>
          <div className="h-56 relative">
            {kpis.total > 0 ? (
            <ResponsiveContainer
              width="100%"
              height="100%"
              initialDimension={{ width: 480, height: 224 }}
            >
              <PieChart>
                <Pie
                  data={dataStatus}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {dataStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-50 ring-1 ring-slate-100">
                  <span className="text-2xl font-black leading-none text-slate-900">0</span>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-black uppercase leading-snug tracking-wide text-slate-500">Sin activos registrados</p>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-300">Estado general sin datos</p>
                </div>
              </div>
            )}
            {kpis.total > 0 && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black leading-none text-slate-900">{kpis.total}</span>
                <span className="mt-1 text-[9px] font-bold uppercase tracking-widest text-slate-400">Activos</span>
              </div>
            )}
          </div>
          <div className="mt-4 space-y-2">
            {dataStatus.map(s => (
              <div key={s.name} className="flex justify-between items-center text-[10px] font-bold uppercase transition-opacity" style={{opacity: s.count > 0 ? 1 : 0.4}}>
                <div className="flex items-center gap-2 text-slate-500">
                  <div className="w-1.5 h-1.5 rounded-full" style={{backgroundColor: s.color}}></div>
                  {s.name}
                </div>
                <span className="text-slate-900">{s.value}% ({s.count})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Potencia por Almacén */}
        <div className="min-w-0 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm text-left">
          <h3 className="font-bold text-slate-900 uppercase text-xs tracking-widest mb-6">Potencia nominal (kW)</h3>
          <div className="h-64">
            {DATA_POWER.length > 0 ? (
            <ResponsiveContainer
              width="100%"
              height="100%"
              initialDimension={{ width: 480, height: 256 }}
            >
              <BarChart data={DATA_POWER} layout="vertical">
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#64748b'}} width={70} />
                <Tooltip />
                <Bar dataKey="power" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
            ) : <div className="h-full flex items-center justify-center text-center text-xs font-bold text-slate-400 uppercase px-4">Registre voltaje y corriente para calcular la potencia nominal</div>}
          </div>
        </div>
      </div>

      {/* Recent Activity / Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-left">
          <div className="p-5 border-b border-slate-50 flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-900">Alertas Críticas</h4>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${kpis.fallas > 0 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-400'}`}>
              {kpis.fallas} ACTIVA{kpis.fallas !== 1 ? 'S' : ''}
            </span>
          </div>
          <div className="divide-y divide-slate-50 min-h-[100px]">
             {kpis.fallas > 0 ? (
               filteredEquipos.filter(e => e.estado === 'falla').slice(0, 3).map((eq, i) => (
                <div key={i} className="p-4 flex gap-4 hover:bg-slate-50 transition-colors group cursor-pointer">
                  <div className="w-10 h-10 bg-red-100 text-red-600 rounded-xl flex items-center justify-center shrink-0">
                    <FileWarning className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-bold text-red-500 uppercase tracking-tighter">FALLA DETECTADA - {eq.tag}</span>
                      <span className="text-[9px] font-bold text-slate-400">AHORA</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-800 mt-0.5 line-clamp-1">{eq.nombre} - {eq.ubicacion}</p>
                    <div className="mt-2 flex gap-2">
                      <button className="text-[9px] font-bold bg-blue-600 text-white px-2 py-1 rounded-md uppercase">Atender</button>
                    </div>
                  </div>
                </div>
               ))
             ) : (
               <div className="p-8 text-center text-[10px] font-black text-slate-400 uppercase italic">Sin alertas en este segmento</div>
             )}
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-left">
          <div className="p-5 border-b border-slate-50 flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-900">Mantenimientos Prioritarios</h4>
            <span className="text-[10px] font-bold text-blue-500 uppercase">Ver Calendario</span>
          </div>
          <div className="divide-y divide-slate-50 min-h-[100px]">
            {filteredEquipos.filter(e => e.estado === 'mantenimiento').length > 0 ? (
              filteredEquipos.filter(e => e.estado === 'mantenimiento').slice(0, 3).map((eq, i) => (
                <div key={i} className="p-4 flex gap-4 hover:bg-slate-50 transition-colors cursor-pointer">
                  <div className="w-2 h-10 bg-blue-500 rounded-full"></div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center text-[10px] font-bold mb-1">
                      <span className="text-slate-400 uppercase">Preventivo Programado</span>
                      <span className="text-blue-600 uppercase font-mono tracking-wider">{calculateAndFormatProximoMantenimiento(eq.ultimo_mantenimiento, eq.proximo_mantenimiento, eq.frecuencia_mantenimiento)}</span>
                    </div>
                    <p className="text-sm font-bold text-slate-800 uppercase tracking-tight">{eq.nombre} / {eq.tag}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-[10px] font-black text-slate-400 uppercase italic">Sin mantenimientos programados</div>
            )}
          </div>
        </section>
      </div>

      {/* Auditor Signature Check (for supervisors/admins) */}
      <div className="bg-blue-600 p-6 rounded-2xl shadow-xl shadow-blue-600/20 text-white flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4 text-center md:text-left">
          <div className="p-3 bg-white/20 rounded-2xl border border-white/20">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="flex-1">
            <h4 className="text-lg font-black uppercase tracking-tight leading-none">Pendientes de Firma</h4>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1.5 bg-white/20 px-2 py-1 rounded-lg">
                <span className="text-[9px] font-black uppercase text-white/90">Cliente:</span>
                <span className="text-[10px] font-black text-white">{pendingFirmas.cliente}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/20 px-2 py-1 rounded-lg">
                <span className="text-[9px] font-black uppercase text-white/90">Contratista:</span>
                <span className="text-[10px] font-black text-white">{pendingFirmas.contratista}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/20 px-2 py-1 rounded-lg">
                <span className="text-[9px] font-black uppercase text-white/90">Visita:</span>
                <span className="text-[10px] font-black text-white">{pendingFirmas.visita}</span>
              </div>
            </div>
          </div>
        </div>
        <button className="bg-white text-blue-600 font-black text-xs uppercase tracking-widest px-6 py-3 rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all">
          Revisar Ahora
        </button>
      </div>
    </div>
  );
}

function KPICard({ label, value, trend, icon: Icon, color, alert, className = "" }: any) {
  return (
    <div className={`min-w-0 overflow-hidden p-3 sm:p-4 bg-white rounded-2xl border shadow-sm flex flex-col gap-2 transition-all hover:shadow-md ${alert ? 'border-red-100 ring-4 ring-red-500/5 pulse-red' : 'border-slate-100'} ${className}`}>
      <div className="flex justify-between items-start">
        <div className={`p-2 rounded-lg bg-slate-50 ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        {trend && (
          <span className={`text-[9px] font-black flex items-center gap-0.5 ${trend.startsWith('+') ? 'text-emerald-500' : 'text-rose-500'}`}>
            {trend.startsWith('+') ? <ArrowUpRight className="w-2 h-2" /> : <ArrowDownRight className="w-2 h-2" />}
            {trend}
          </span>
        )}
      </div>
      <div>
        <div className="break-words text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider sm:tracking-widest">{label}</div>
        <div className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">{value}</div>
      </div>
    </div>
  );
}
