import { useState, useMemo } from "react";
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
import { EQUIPOS_DATA } from "../data/equipos";

const DATA_MONTHLY = [
  { name: 'Ene', cost: 4200, activity: 120 },
  { name: 'Feb', cost: 3800, activity: 98 },
  { name: 'Mar', cost: 5100, activity: 145 },
  { name: 'Abr', cost: 4800, activity: 130 },
];

const ALMACEN_LABELS: Record<string, string> = { 
  '11-STK': 'Iquique', '12-STK': 'Antofagasta', '13-STK': 'Copiapó', 
  '21-STK': 'Santiago 14 de la Fama', '21-STK-SB': 'BME La Vara 3310',
  '23-STK': 'Viña del Mar', '24-STK': 'Rancagua', '31-STK': 'Concepción',
  '32-STK': 'Puerto Montt', 'Planta-STK': 'Planta Industrial'
};

const DATA_POWER = [
  { name: 'Santiago', power: 400 },
  { name: 'Antofagasta', power: 320 },
  { name: 'Concepción', power: 280 },
  { name: 'Iquique', power: 150 },
];

const DATA_STATUS = [
  { name: 'Operativo', value: 85, color: '#10b981' },
  { name: 'Falla', value: 5, color: '#ef4444' },
  { name: 'Preventivo', value: 10, color: '#f59e0b' },
];

/**
 * Vista de Panel de Control (Dashboard).
 * Provee una visión holística de la salud operativa de los activos HVAC.
 * 
 * @module pages/Dashboard
 */

export default function Dashboard() {
  /** Estado para filtrar por sucursal / almacén */
  const [almacen, setAlmacen] = useState("");
  /** Estado para filtrar por estado técnico (falla, mantenimiento, operativo) */
  const [estado, setEstado] = useState("");

  /**
   * Memoización de equipos filtrados.
   * Optimiza el rendimiento evitando re-filtros en re-renders innecesarios.
   */
  const filteredEquipos = useMemo(() => {
    return EQUIPOS_DATA.filter(eq => {
      const matchAlmacen = almacen ? eq.tag.startsWith(almacen) : true;
      const matchEstado = estado ? eq.estado === estado : true;
      return matchAlmacen && matchEstado;
    });
  }, [almacen, estado]);

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
      tickets: fallas * 2 // Mocked relation
    };
  }, [filteredEquipos]);

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
    <div className="flex flex-col gap-8">
      {/* Header / Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-[#a7e6b1] tracking-tight uppercase">Salud Operativa</h2>
          <p className="text-slate-500 text-sm font-medium">Resumen ejecutivo y monitoreo de activos real-time.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-white rounded-lg border border-slate-200 p-1 shadow-sm">
            <select 
              value={almacen}
              onChange={(e) => setAlmacen(e.target.value)}
              className="bg-transparent text-xs font-bold px-3 py-1 outline-none text-slate-600 border-r border-slate-100"
            >
              <option value="">Todos los Almacenes</option>
              {Object.entries(ALMACEN_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v} ({k})</option>
              ))}
            </select>
            <select 
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className="bg-transparent text-xs font-bold px-3 py-1 outline-none text-slate-600"
            >
              <option value="">Cualquier Estado</option>
              <option value="falla">Falla Crítica</option>
              <option value="mantenimiento">Mantenimiento</option>
              <option value="operativo">Operativo</option>
            </select>
          </div>
          
          <Link href="/scanner?autoScan=true">
            <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-widest px-4 py-2.5 rounded-lg shadow-lg shadow-blue-600/20 flex items-center gap-2 transition-all active:scale-95">
              <ScanLine className="w-4 h-4" /> Escanear QR
            </button>
          </Link>
        </div>
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard label="Disponibilidad" value={kpis.disponibilidad} trend="+0.4%" icon={Activity} color="text-emerald-500" />
        <KPICard label="MTBF" value="420h" trend="-12h" icon={Clock} color="text-blue-500" />
        <KPICard label="MTTR" value="4.2h" trend="-0.8h" icon={Wrench} color="text-amber-500" />
        <KPICard label="Tickets Activos" value={kpis.tickets.toString().padStart(2, '0')} icon={Ticket} color="text-red-500" alert={kpis.tickets > 0} />
        <KPICard label="Equipos en Falla" value={kpis.fallas.toString().padStart(2, '0')} icon={AlertTriangle} color="text-rose-500" alert={kpis.fallas > 0} />
        <KPICard label="Mantv. Pendientes" value={kpis.mantv.toString().padStart(2, '0')} icon={CheckCircle2} color="text-slate-500" />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
        {/* Costos y Actividad Recent */}
        <div className="xl:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-left">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="font-bold text-slate-900 uppercase text-xs tracking-widest">Gasto Estimado Mensual</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Estimación basada en {kpis.total} activos</p>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Costos (USD)</span>
              </div>
            </div>
          </div>
          <div className="h-64 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={DATA_MONTHLY}>
                <defs>
                  <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}} />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  labelStyle={{fontWeight: 'bold', fontSize: '12px'}}
                />
                <Area type="monotone" dataKey="cost" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorCost)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Distribución por Estado Real */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-left">
          <h3 className="font-bold text-slate-900 uppercase text-xs tracking-widest mb-4">Estado del Parque</h3>
          <div className="h-56 relative">
            <ResponsiveContainer width="100%" height="100%">
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
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-black text-slate-900">{kpis.total}</span>
              <span className="text-[9px] font-bold text-slate-400 uppercase">Activos</span>
            </div>
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

        {/* Potencia por Almacén (Semi-Real) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-left">
          <h3 className="font-bold text-slate-900 uppercase text-xs tracking-widest mb-6">Demanda Estimada (kW)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={DATA_POWER} layout="vertical">
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#64748b'}} width={70} />
                <Tooltip />
                <Bar dataKey="power" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
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
                      <span className="text-blue-600 uppercase">{eq.proximoMantenimiento}</span>
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
                <span className="text-[10px] font-black text-white">02</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/20 px-2 py-1 rounded-lg">
                <span className="text-[9px] font-black uppercase text-white/90">Contratista:</span>
                <span className="text-[10px] font-black text-white">{kpis.mantv}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/20 px-2 py-1 rounded-lg">
                <span className="text-[9px] font-black uppercase text-white/90">Visita:</span>
                <span className="text-[10px] font-black text-white">01</span>
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

function KPICard({ label, value, trend, icon: Icon, color, alert }: any) {
  return (
    <div className={`p-4 bg-white rounded-2xl border shadow-sm flex flex-col gap-2 transition-all hover:shadow-md ${alert ? 'border-red-100 ring-4 ring-red-500/5 pulse-red' : 'border-slate-100'}`}>
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
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</div>
        <div className="text-xl font-black text-slate-900 tracking-tight">{value}</div>
      </div>
    </div>
  );
}
