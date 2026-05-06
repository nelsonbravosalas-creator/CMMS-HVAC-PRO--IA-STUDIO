import React, { useState } from "react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend
} from "recharts";
import { 
  Download, 
  Filter, 
  FileSpreadsheet, 
  FileText, 
  Save, 
  Trash2, 
  ChevronDown, 
  Eye, 
  EyeOff,
  Settings2,
  TrendingUp,
  DollarSign,
  Box,
  Activity
} from "lucide-react";
import { ExportFilterPresetsDropdown } from "../components/modals/ExportFilterPresetsDropdown";
import { FilterPresetsDropdown } from "../components/modals/FilterPresetsDropdown";

type ReportTab = "kpis" | "costos" | "equipos" | "actividad";

export default function Reportes() {
  const [activeTab, setActiveTab] = useState<ReportTab>("kpis");
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#6366f1'];

  return (
    <div className="flex flex-col gap-8 text-left animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Reportes y Analítica</h2>
          <p className="text-slate-500 text-sm font-medium">Visualización de KPIs y exportación de datos maestros.</p>
        </div>
        <div className="flex items-center gap-2">
           <button onClick={() => setShowExportOptions(!showExportOptions)} className="bg-slate-900 text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-xl shadow-slate-900/10">
              <Download className="w-4 h-4" /> Centro de Exportación
           </button>
        </div>
      </div>

      {/* Global Filters */}
      <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-wrap items-center gap-4">
         <FilterPresetsDropdown onApply={() => {}} />
         <FilterItem label="Estado" value="Todos" icon={<Activity className="w-3.5 h-3.5" />} />
         <FilterItem label="Área" value="Operaciones" icon={<Box className="w-3.5 h-3.5" />} />
         <FilterItem label="Desde" value="01/04/2026" />
         <FilterItem label="Hasta" value="30/04/2026" />
         <button className="ml-auto p-2.5 bg-slate-100 text-slate-400 rounded-xl hover:text-blue-600 transition-colors"><Settings2 className="w-4 h-4" /></button>
      </div>

      {/* Export Panel (Collapsible) */}
      {showExportOptions && (
        <div className="bg-slate-50 border border-slate-200 rounded-[32px] p-8 animate-in slide-in-from-top-4 duration-300">
           <div className="flex justify-between items-center mb-6">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">Configuración de Exportación</h3>
              <div className="flex items-center gap-4">
                 <button onClick={() => setShowPreview(!showPreview)} className="text-[10px] font-black uppercase text-blue-600 flex items-center gap-2">
                    {showPreview ? <><EyeOff className="w-3.5 h-3.5" /> Ocultar Preview</> : <><Eye className="w-3.5 h-3.5" /> Mostrar Preview</>}
                 </button>
                 <ExportFilterPresetsDropdown onApply={() => {}} />
              </div>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <ExportSelect label="Hojas a incluir" value="Equipos, Historial" />
              <ExportSelect label="Técnico" value="Todos" />
              <ExportSelect label="Costo Mín" value="$0" />
              <ExportSelect label="Formato" value="Excel (.xlsx)" />
           </div>

           <div className="flex gap-4">
              <button className="px-6 py-3 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl flex items-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95 transition-all">
                 <FileSpreadsheet className="w-4 h-4" /> Generar Excel
              </button>
              <button className="px-6 py-3 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl flex items-center gap-2 shadow-lg shadow-red-600/20 active:scale-95 transition-all">
                 <FileText className="w-4 h-4" /> Generar PDF
              </button>
           </div>
        </div>
      )}

      {/* Main Tabs Navigation */}
      <div className="flex items-center gap-6 border-b border-slate-200">
         <TabButton active={activeTab === 'kpis'} onClick={() => setActiveTab('kpis')} label="KPIs de Operación" />
         <TabButton active={activeTab === 'costos'} onClick={() => setActiveTab('costos')} label="Análisis de Costos" />
         <TabButton active={activeTab === 'equipos'} onClick={() => setActiveTab('equipos')} label="Estado Activos" />
         <TabButton active={activeTab === 'actividad'} onClick={() => setActiveTab('actividad')} label="Actividad Técnica" />
      </div>

      {/* Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
         <div className="lg:col-span-12">
            {activeTab === 'kpis' && (
              <div className="space-y-8 animate-in fade-in duration-300">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <KPICard label="MTBF" value="482 hrs" sub="Mejora de +15%" trend="up" />
                    <KPICard label="Tiempo Resol." value="1.2 d" sub="Baja de 0.2d" trend="down" />
                    <KPICard label="Tasa Falla" value="2.1%" sub="Estable" trend="neutral" />
                 </div>
                 <ChartBox title="Actividad Mensual - Tickets vs Mantenimientos">
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={mockData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700}} />
                        <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                        <Legend iconType="circle" wrapperStyle={{fontSize: '10px', fontWeight: 900, textTransform: 'uppercase'}} />
                        <Line type="monotone" dataKey="tickets" stroke="#2563eb" strokeWidth={3} dot={{r: 4}} />
                        <Line type="monotone" dataKey="mantenimientos" stroke="#10b981" strokeWidth={3} dot={{r: 4}} />
                      </LineChart>
                    </ResponsiveContainer>
                 </ChartBox>
              </div>
            )}

            {activeTab === 'costos' && (
              <div className="space-y-8 animate-in fade-in duration-300 text-left">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <ChartBox title="Distribución de Costos por Tipo">
                       <ResponsiveContainer width="100%" height={250}>
                          <PieChart>
                             <Pie data={costDist} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                {costDist.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                             </Pie>
                             <Tooltip />
                             <Legend iconType="circle" layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{fontSize: '9px', fontWeight: 900, textTransform: 'uppercase'}} />
                          </PieChart>
                       </ResponsiveContainer>
                    </ChartBox>
                    <div className="bg-white p-8 rounded-[40px] border border-slate-200">
                       <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 mb-6">Top Equipos por Costo Manutención</h3>
                       <div className="space-y-4">
                          {[1,2,3,4].map(i => (
                            <div key={i} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-2xl transition-colors">
                               <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center font-black text-xs">{i}</div>
                                  <div>
                                     <p className="text-xs font-black text-slate-900 uppercase">21-STK.AC.0{i+10}</p>
                                     <p className="text-[10px] font-bold text-slate-400">SALA SERVIDORES {i}</p>
                                  </div>
                               </div>
                               <div className="text-right">
                                  <p className="text-sm font-black text-slate-900">$124.500</p>
                                  <p className="text-[9px] font-black text-red-500 uppercase">+5% de presupuesto</p>
                               </div>
                            </div>
                          ))}
                       </div>
                    </div>
                 </div>
              </div>
            )}
         </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`py-4 px-2 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${
        active ? "border-blue-600 text-blue-600" : "border-transparent text-slate-400 hover:text-slate-600"
      }`}
    >
      {label}
    </button>
  );
}

function KPICard({ label, value, sub, trend }: { label: string, value: string, sub: string, trend: 'up' | 'down' | 'neutral' }) {
  return (
    <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm relative overflow-hidden group">
       <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity`}>
          <TrendingUp className="w-12 h-12" />
       </div>
       <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{label}</span>
       <div className="text-3xl font-black text-slate-900 my-2">{value}</div>
       <div className="flex items-center gap-2 italic">
          <span className={`text-[10px] font-black uppercase ${
            trend === 'up' ? 'text-emerald-500' : trend === 'down' ? 'text-red-500' : 'text-slate-400'
          }`}>{sub}</span>
       </div>
    </div>
  );
}

function ChartBox({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm flex flex-col text-left">
       <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 mb-8">{title}</h3>
       {children}
    </div>
  );
}

function FilterItem({ label, value, icon }: { label: string, value: string, icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl cursor-pointer hover:bg-slate-100 transition-colors">
       <div className="text-slate-400">{icon}</div>
       <div className="flex flex-col">
          <span className="text-[8px] font-black uppercase text-slate-400 opacity-60 leading-none">{label}</span>
          <span className="text-[10px] font-black uppercase text-slate-900">{value}</span>
       </div>
       <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
    </div>
  );
}

function ExportSelect({ label, value }: { label: string, value: string }) {
  return (
    <div className="space-y-1">
       <label className="text-[9px] font-black uppercase text-slate-400">{label}</label>
       <div className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase flex justify-between items-center cursor-pointer hover:border-blue-300 transition-colors">
          {value}
          <ChevronDown className="w-3.5 h-3.5 text-slate-300" />
       </div>
    </div>
  );
}

const mockData = [
  { name: 'ENE', tickets: 12, mantenimientos: 14 },
  { name: 'FEB', tickets: 8, mantenimientos: 15 },
  { name: 'MAR', tickets: 20, mantenimientos: 12 },
  { name: 'ABR', tickets: 15, mantenimientos: 18 },
  { name: 'MAY', tickets: 10, mantenimientos: 16 },
];

const costDist = [
  { name: 'Preventivos', value: 45 },
  { name: 'Repuestos', value: 30 },
  { name: 'Urgencias', value: 15 },
  { name: 'Otros', value: 10 },
];
