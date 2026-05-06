import React, { useState } from 'react';
import { 
  Zap, 
  Thermometer, 
  TrendingDown, 
  DollarSign, 
  Calendar,
  Building2,
  AlertCircle,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  X,
  Printer,
  ExternalLink,
  Download,
  QrCode,
  Box
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  LineChart,
  Line,
  Cell,
  Legend
} from 'recharts';
import { motion } from 'motion/react';
import { QRLabelModal } from '../components/modals/QRLabelModal';

const ENERGY_DATA = [
  { month: 'Ene', elect: 4500, thermal: 12000, efficiency: 2.6 },
  { month: 'Feb', elect: 4800, thermal: 13500, efficiency: 2.8 },
  { month: 'Mar', elect: 4200, thermal: 11000, efficiency: 2.6 },
  { month: 'Abr', elect: 3900, thermal: 9500, efficiency: 2.4 },
  { month: 'May', elect: 3500, thermal: 7000, efficiency: 2.0 },
  { month: 'Jun', elect: 3200, thermal: 6000, efficiency: 1.9 },
  { month: 'Jul', elect: 3100, thermal: 5500, efficiency: 1.8 },
];

const BRANCH_COSTS_INITIAL = [
  { id: '1', name: 'Iquique', kwPrice: 145, status: 'Normal' },
  { id: '2', name: 'Antofagasta', kwPrice: 152, status: 'Elevado' },
  { id: '3', name: 'Copiapó', kwPrice: 148, status: 'Normal' },
  { id: '4', name: 'Santiago 14 de la Fama', kwPrice: 125, status: 'Optimo' },
  { id: '5', name: 'BME La Vara', kwPrice: 128, status: 'Normal' },
  { id: '6', name: 'Viña del Mar', kwPrice: 135, status: 'Normal' },
  { id: '7', name: 'Concepción', kwPrice: 132, status: 'Normal' },
];

export default function EFIEnergia() {
  const [branchCosts, setBranchCosts] = useState(BRANCH_COSTS_INITIAL);
  const [selectedBranch, setSelectedBranch] = useState('Todas');
  const [selectedKPI, setSelectedKPI] = useState<string | null>(null);
  const [selectedEqLabel, setSelectedEqLabel] = useState<any | null>(null);
  
  const handlePriceChange = (id: string, newPrice: string) => {
    setBranchCosts(prev => prev.map(branch => 
      branch.id === id ? { ...branch, kwPrice: Number(newPrice) } : branch
    ));
  };

  const totalConsumption = ENERGY_DATA.reduce((acc, curr) => acc + curr.elect, 0);
  const avgEfficiency = (ENERGY_DATA.reduce((acc, curr) => acc + curr.efficiency, 0) / ENERGY_DATA.length).toFixed(2);

  const kpiData: Record<string, any> = {
    'eficiencia': {
      title: "Desglose de Eficiencia (EER)",
      methodology: "La eficiencia promediada (EER) se obtiene mediante la sumatoria de la capacidad frigorífica nominal de los equipos operativos dividida por la potencia eléctrica absorbida instantánea (incluyendo periféricos de condensación).",
      formula: "EER = Σ(BTU/h) / Σ(W)",
      equipments: [
        { tag: "CH-STK-01", desc: "Chiller Enfriado por Aire", value: "2.85 EER" },
        { tag: "CH-STK-02", desc: "Chiller Enfriado por Agua", value: "3.42 EER" },
        { tag: "SP-STK-05", desc: "Split Ducto Sala B", value: "2.10 EER" }
      ]
    },
    'consumo': {
      title: "Cálculo de Consumo Eléctrico",
      methodology: "El consumo se determina mediante la integración de las lecturas de los medidores inteligentes vinculados a cada tablero de climatización, restando los consumos no relacionados al proceso térmico.",
      formula: "MWh = ∫ P(t) dt / 10^6",
      equipments: [
        { tag: "MTR-01", desc: "Medidor General Planta", value: "2450 kWh" },
        { tag: "MTR-02", desc: "Medidor Sub-Tablero HVAC", value: "1200 kWh" }
      ]
    },
    'termica': {
      title: "Potencia Térmica Entregada",
      methodology: "Se estima mediante la diferencia de entalpía entre la impulsión y el retorno de agua/aire, multiplicada por el flujo volumétrico medido por los sensores ultrasónicos y térmicos.",
      formula: "Q = ṁ · cp · ΔT",
      equipments: [
        { tag: "UMA-01", desc: "Manejadora Piso 1", value: "24.5 MJ/h" },
        { tag: "UMA-02", desc: "Manejadora Piso 2", value: "32.1 MJ/h" }
      ]
    },
    'costo': {
      title: "Modelamiento de Costo Operativo",
      methodology: "Proyección financiera basada en el consumo real (MWh) multiplicado por el costo unitario por kW/h configurado para cada sucursal en el panel de parámetros.",
      formula: "Costo = Σ (Consumo_branch · $/kW_branch)",
      equipments: [
        { tag: "Iquique", desc: "Venta Energía", value: "$450,200" },
        { tag: "Santiago", desc: "Venta Energía", value: "$1,230,000" }
      ]
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 space-y-8 pb-32">
      <QRLabelModal 
        isOpen={!!selectedEqLabel} 
        onClose={() => setSelectedEqLabel(null)} 
        equipment={selectedEqLabel} 
      />

      {/* Detail Modal */}
      {selectedKPI && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
          >
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{kpiData[selectedKPI]?.title}</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Transparencia y Algoritmos de Cálculo</p>
              </div>
              <button 
                onClick={() => setSelectedKPI(null)}
                className="p-3 hover:bg-white rounded-2xl transition-all shadow-sm group"
              >
                <X className="w-6 h-6 text-slate-300 group-hover:text-slate-900" />
              </button>
            </div>
            
            <div className="p-8 space-y-8 overflow-y-auto">
              <section className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                    <Info className="w-4 h-4" />
                  </div>
                  <h4 className="text-[10px] font-black uppercase text-slate-900 tracking-widest">Metodología de Cálculo</h4>
                </div>
                <div className="p-6 bg-slate-50 rounded-[32px] border border-slate-100 space-y-4">
                  <p className="text-xs text-slate-600 leading-relaxed font-medium uppercase tracking-tight">
                    {kpiData[selectedKPI]?.methodology}
                  </p>
                  <div className="flex justify-center p-4 bg-white rounded-2xl border border-slate-200">
                    <code className="text-sm font-black text-blue-600 font-mono italic">{kpiData[selectedKPI]?.formula}</code>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <h4 className="text-[10px] font-black uppercase text-slate-900 tracking-widest">Equipos Integrados en el Valor</h4>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {kpiData[selectedKPI]?.equipments.map((eq: any, i: number) => (
                    <button 
                      key={i} 
                      onClick={() => setSelectedEqLabel(eq)}
                      className="w-full flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:border-blue-500 hover:shadow-md transition-all group active:scale-[0.98]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 group-hover:text-blue-500 transition-colors">
                          <Activity className="w-4 h-4" />
                        </div>
                        <div className="text-left">
                          <p className="text-[10px] font-black text-slate-900 uppercase">{eq.tag}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{eq.desc}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-blue-600">{eq.value}</span>
                        <ArrowUpRight className="w-3 h-3 text-slate-300 group-hover:text-blue-500" />
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            </div>
            
            <div className="p-8 bg-slate-50 border-t border-slate-100">
              <button 
                onClick={() => setSelectedKPI(null)}
                className="w-full py-4 bg-slate-900 text-white rounded-[24px] text-xs font-black uppercase tracking-widest shadow-xl shadow-slate-900/20 active:scale-95 transition-all"
              >
                Cerrar Detalle
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Header section with focusable background */}
      <div id="root_main" className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Eficiencia Energética (KPI)</h1>
          <p className="text-slate-500 font-bold uppercase text-xs tracking-widest mt-2 flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-500" />
            Monitoreo de Potencia y Costos Operacionales en Tiempo Real
          </p>
        </div>
        
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-600 hover:shadow-lg transition-all active:scale-95">
            <Calendar className="w-4 h-4" /> Periodo: Últimos 6 Meses
          </button>
          <button className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-600/30 hover:bg-blue-700 transition-all active:scale-95">
            <Download className="w-4 h-4" /> Reporte Completo
          </button>
        </div>
      </div>

      {/* Main KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard 
          title="Eficiencia (EER)" 
          value={avgEfficiency} 
          unit="BTU/W" 
          trend="+4.2%" 
          positive={true} 
          icon={TrendingDown} 
          color="bg-emerald-500" 
          onClick={() => setSelectedKPI('eficiencia')}
        />
        <KPICard 
          title="Consumo Eléctrico" 
          value={(totalConsumption/1000).toFixed(1)} 
          unit="MWh" 
          trend="-2.1%" 
          positive={true} 
          icon={Zap} 
          color="bg-amber-500" 
          onClick={() => setSelectedKPI('consumo')}
        />
        <KPICard 
          title="Potencia Térmica" 
          value="84.5" 
          unit="MJ/h" 
          trend="+12%" 
          positive={false} 
          icon={Thermometer} 
          color="bg-blue-500" 
          onClick={() => setSelectedKPI('termica')}
        />
        <KPICard 
          title="Costo Estimado" 
          value="$3.4M" 
          unit="CLP" 
          trend="+0.8%" 
          positive={false} 
          icon={DollarSign} 
          color="bg-rose-500" 
          onClick={() => setSelectedKPI('costo')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Charts Section */}
        <div className="lg:col-span-2 space-y-8">
          {/* Energy Mix Chart */}
          <section className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-6">
             <div className="flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Potencia Eléctrica vs Térmica</h3>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="text-[10px] font-black uppercase text-slate-400 italic tracking-tighter">Térmica</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                    <span className="text-[10px] font-black uppercase text-slate-400 italic tracking-tighter">Eléctrica</span>
                  </div>
                </div>
             </div>
             <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={ENERGY_DATA}>
                    <defs>
                      <linearGradient id="colorElect" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorTherm" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="thermal" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorTherm)" />
                    <Area type="monotone" dataKey="elect" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorElect)" />
                  </AreaChart>
                </ResponsiveContainer>
             </div>
          </section>

          {/* Efficiency Trend Chart */}
          <section className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-6">
             <div className="flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Curva de Desempeño Energético (EER)</h3>
                <div className="px-3 py-1 bg-emerald-100 rounded-full">
                  <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Meta: 3.0+</span>
                </div>
             </div>
             <div className="h-64 w-full">
               <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={ENERGY_DATA}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="stepAfter" dataKey="efficiency" stroke="#10b981" strokeWidth={4} dot={{ r: 6, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 8 }} />
                  </LineChart>
               </ResponsiveContainer>
             </div>
          </section>
        </div>

        {/* Configuration Sidebar */}
        <div className="space-y-8">
          <section className="bg-slate-900 p-8 rounded-[40px] shadow-2xl text-white space-y-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
            
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                  <DollarSign className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-black uppercase tracking-tight">Parametrización</h3>
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">Configuración del costo por kW/h para modelamiento financiero por sucursal</p>
            </div>

            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {branchCosts.map(branch => (
                <div key={branch.id} className="p-5 bg-white/5 border border-white/10 rounded-3xl space-y-3 hover:bg-white/10 transition-colors">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-3 h-3 text-slate-500" />
                      <span className="text-[11px] font-black uppercase tracking-widest">{branch.name}</span>
                    </div>
                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                      branch.status === 'Normal' ? 'bg-emerald-500/20 text-emerald-400' : 
                      branch.status === 'Optimo' ? 'bg-blue-500/20 text-blue-400' : 'bg-rose-500/20 text-rose-400'
                    }`}>
                      {branch.status}
                    </span>
                  </div>
                  
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-black">$</div>
                    <input 
                      type="number" 
                      value={branch.kwPrice}
                      onChange={(e) => handlePriceChange(branch.id, e.target.value)}
                      className="w-full pl-8 pr-16 py-3 bg-black/40 border border-white/10 rounded-2xl text-xs font-black outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-500 uppercase">CLP / kW</div>
                  </div>
                </div>
              ))}
            </div>

            <button className="w-full py-4 bg-white text-slate-900 rounded-3xl text-xs font-black uppercase tracking-widest active:scale-95 transition-all shadow-xl shadow-white/5">
              Reiniciar Valores
            </button>
          </section>

          <section className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-amber-50 rounded-xl flex items-center justify-center text-amber-500">
                <AlertCircle className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Alertas Operativas</h3>
            </div>
            
            <div className="space-y-4">
              <div className="p-4 border-l-4 border-amber-400 bg-amber-50 rounded-r-2xl space-y-1">
                <h4 className="text-[10px] font-black text-amber-900 uppercase">Alta Carga: Antofagasta</h4>
                <p className="text-[9px] font-bold text-amber-700 uppercase leading-snug">Incremento del 15% en el consumo respecto al promedio estacional.</p>
              </div>
              <div className="p-4 border-l-4 border-emerald-400 bg-emerald-50 rounded-r-2xl space-y-1">
                <h4 className="text-[10px] font-black text-emerald-900 uppercase">Optimización: Santiago</h4>
                <p className="text-[9px] font-bold text-emerald-700 uppercase leading-snug">Reducción de peak de potencia tras ajuste de setpoints.</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function KPICard({ title, value, unit, trend, positive, icon: Icon, color, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className="w-full text-left bg-white p-7 rounded-[40px] border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-2xl hover:shadow-slate-200/50 transition-all duration-500 translate-y-0 hover:-translate-y-2 cursor-pointer active:scale-95"
    >
      <div className="relative z-10 space-y-4">
        <div className="flex justify-between items-start">
          <div className={`p-3 rounded-2xl ${color} text-white shadow-lg shadow-current/20 group-hover:scale-110 transition-transform`}>
            <Icon className="w-6 h-6" />
          </div>
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${positive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
            {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {trend}
          </div>
        </div>
        
        <div>
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{title}</h4>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-black text-slate-900">{value}</span>
            <span className="text-[10px] font-black text-slate-400 uppercase">{unit}</span>
          </div>
        </div>
      </div>
      
      {/* Decorative background element */}
      <div className={`absolute -bottom-8 -right-8 w-24 h-24 rounded-full opacity-5 blur-2xl ${color}`} />
    </button>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-slate-100 shadow-2xl space-y-2">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">{label}</p>
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex justify-between gap-8 items-center">
              <span className="text-[10px] font-black uppercase text-slate-500">{entry.name}</span>
              <span className="text-xs font-black text-slate-900">{entry.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
}
