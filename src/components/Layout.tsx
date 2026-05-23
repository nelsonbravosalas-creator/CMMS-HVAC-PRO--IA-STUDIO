import { 
  LayoutDashboard, 
  ScanLine, 
  Box, 
  Wrench, 
  FileText, 
  Ticket, 
  BarChart3, 
  MapPin,
  ChevronDown,
  Users,
  Calendar as CalendarIcon,
  Terminal,
  Settings,
  Building,
  Menu,
  Bell,
  WifiOff,
  Cloud,
  CloudOff,
  RefreshCw,
  Moon,
  Sun,
  Download,
  MoreHorizontal,
  X,
  AlertTriangle,
  Zap,
} from "lucide-react";
import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { DataStore, useDataStore } from "../services/dataStore";

interface LayoutProps {
  children: ReactNode;
}

interface NavItemProps {
  href: string;
  icon: any;
  label: string;
  badge?: number;
  badgeColor?: string;
  onClick?: () => void;
  variant?: 'default' | 'large';
}

function NavItem({ href, icon: Icon, label, badge, badgeColor = "bg-red-500", onClick, variant = 'default' }: NavItemProps) {
  const [location] = useLocation();
  const isActive = location === href;

  if (variant === 'large') {
    return (
      <Link href={href} onClick={onClick}>
        <div className={`mx-4 my-2 p-5 rounded-3xl border-2 flex items-center gap-6 cursor-pointer transition-all active:scale-95 ${
          isActive 
            ? "bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-600/30 font-black" 
            : "bg-slate-900/50 border-white/10 text-slate-400 hover:bg-slate-800"
        }`}>
          <Icon className={`w-8 h-8 ${isActive ? "text-white" : "text-slate-500"}`} />
          <span className="flex-1 whitespace-nowrap text-sm font-black uppercase tracking-[0.1em]">{label}</span>
          {badge !== undefined && badge > 0 && (
            <span className={`${badgeColor} text-white rounded-full w-8 h-8 flex items-center justify-center text-[10px] font-black border-2 border-slate-900`}>
              {badge}
            </span>
          )}
        </div>
      </Link>
    );
  }

  return (
    <Link href={href} onClick={onClick}>
      <div className={`flex items-center gap-3 px-6 py-3 cursor-pointer transition-colors text-sm border-l-4 ${
        isActive 
          ? "bg-slate-800 text-white border-blue-500 font-semibold" 
          : "hover:bg-slate-800 hover:text-slate-50 border-transparent text-slate-400"
      }`}>
        <Icon className={`w-4 h-4 ${isActive ? "text-blue-400" : ""}`} />
        <span className="flex-1 whitespace-nowrap">{label}</span>
        {badge !== undefined && badge > 0 && (
          <span className={`${badgeColor} text-white rounded px-1.5 py-px text-[10px] ml-auto font-bold animate-pulse`}>
            {badge}
          </span>
        )}
      </div>
    </Link>
  );
}

export default function Layout({ children }: LayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMoreDrawerOpen, setIsMoreDrawerOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showPWABanner, setShowPWABanner] = useState(true);
  const [menuPosition, setMenuPosition] = useState<'left' | 'right'>('right');
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  const pendingSync = useDataStore(() => DataStore.getPendingSyncOperations());

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const stats = {
    ticketsAbiertos: useDataStore(() => DataStore.getTickets().filter(t => t.estado === 'abierto').length),
    mantenimientosPendientes: useDataStore(() => DataStore.getMantenimientos().filter(m => m.estado === 'programado').length),
    informesPendientesFirma: 3,
    offlineOps: pendingSync.filter(op => op.status === 'pending').length,
    equiposEnFalla: useDataStore(() => DataStore.getEquipos().filter(e => e.estado === 'falla').length),
    disponibilidadGlobal: "98.2%"
  };

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  return (
    <div className={`h-screen w-full flex overflow-hidden font-sans ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* Sidebar - Desktop */}
      <aside className={`hidden lg:flex w-[260px] h-full flex-col border-r shadow-xl z-20 ${isDarkMode ? 'bg-slate-950 border-slate-900' : 'bg-white border-slate-200'}`}>
        <div className={`px-6 py-5 text-lg font-bold border-b flex items-center gap-2.5 ${isDarkMode ? 'text-white border-slate-900' : 'text-slate-900 border-slate-100'}`}>
          <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] text-white">HV</span>
          </div>
          <span className="truncate tracking-tight uppercase text-sm">Control HVAC</span>
        </div>
        
        <nav className="mt-4 flex-1 flex flex-col overflow-y-auto scrollbar-hide py-2">
          <NavItem href="/" icon={LayoutDashboard} label="Dashboard" />
          <NavItem href="/scanner" icon={ScanLine} label="Scanner QR" />
          <NavItem href="/equipos" icon={Box} label="Equipos" />
          <NavItem href="/mapa" icon={MapPin} label="Mapa" />
          <NavItem href="/mantenimientos" icon={Wrench} label="Mantenimientos" badge={stats.mantenimientosPendientes} badgeColor="bg-amber-500" />
          <NavItem href="/planificacion" icon={CalendarIcon} label="Calendario" />
          <NavItem href="/informes" icon={FileText} label="Informes HVAC" badge={stats.informesPendientesFirma} badgeColor="bg-blue-500" />
          <NavItem href="/tickets" icon={Ticket} label="Tickets" badge={stats.ticketsAbiertos} />
          <NavItem href="/reportes" icon={BarChart3} label="Reportes" />
          <NavItem href="/eficiencia" icon={Zap} label="Eficiencia Energética" />
          
          <div className={`mt-6 mb-2 px-6 text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>Configuración</div>
          <NavItem href="/administracion" icon={Users} label="Administración" />
          <NavItem href="/consola" icon={Terminal} label="Consola" />
          <NavItem href="/configuracion" icon={Settings} label="Configuración" />
        </nav>

        {/* Sidebar Footer Alerts */}
        <div className={`p-4 border-t space-y-3 ${isDarkMode ? 'border-slate-900 bg-slate-950/50' : 'border-slate-100 bg-slate-50'}`}>
          {stats.equiposEnFalla > 0 && (
            <div className="flex items-center gap-2 text-red-500 animate-pulse bg-red-500/10 p-2 rounded border border-red-500/20">
              <AlertTriangle className="w-3 h-3" />
              <span className="text-[10px] font-bold uppercase">{stats.equiposEnFalla} Equipo en Falla</span>
            </div>
          )}
          <div className="text-[10px] leading-tight">
            <div className="flex justify-between items-center text-slate-500 mb-1">
              <span className="font-bold">Disponibilidad Global</span>
              <span className="text-emerald-500 font-bold">{stats.disponibilidadGlobal}</span>
            </div>
            <div className={`w-full h-1 rounded-full overflow-hidden ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
              <div className="h-full bg-emerald-500 w-[98.2%]"></div>
            </div>
            <div className="mt-2 flex justify-between items-center text-slate-600">
              <span>v2.8.5-pro</span>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                <span className="uppercase text-[9px] font-bold tracking-tighter">System OK</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Menu Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" 
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar Drawer (Thumb Consistent) */}
      <aside className={`fixed top-0 ${menuPosition === 'right' ? 'right-0' : 'left-0'} h-full w-[320px] bg-slate-950 z-[100] transition-transform duration-500 lg:hidden shadow-2xl flex flex-col ${
        isMobileMenuOpen 
          ? 'translate-x-0' 
          : (menuPosition === 'right' ? 'translate-x-full' : '-translate-x-full')
      }`}>
        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-slate-900/50">
          <span className="text-white font-black uppercase tracking-[0.2em] text-xs underline decoration-blue-500 underline-offset-8">Menu Operativo</span>
          <div className="p-4 bg-white/5 rounded-2xl cursor-pointer active:scale-90 transition-transform border border-white/10" onClick={() => setIsMobileMenuOpen(false)}>
            <X className="text-slate-400 w-6 h-6" />
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-6 space-y-2 custom-scrollbar">
          <NavItem variant="large" href="/" icon={LayoutDashboard} label="DASHBOARD" onClick={() => setIsMobileMenuOpen(false)} />
          <NavItem variant="large" href="/scanner" icon={ScanLine} label="SCANNER QR" onClick={() => setIsMobileMenuOpen(false)} />
          <NavItem variant="large" href="/equipos" icon={Box} label="Equipos" onClick={() => setIsMobileMenuOpen(false)} />
          <NavItem variant="large" href="/mantenimientos" icon={Wrench} label="Mantenimientos" badge={stats.mantenimientosPendientes} badgeColor="bg-amber-500" onClick={() => setIsMobileMenuOpen(false)} />
          <NavItem variant="large" href="/planificacion" icon={CalendarIcon} label="Calendario" onClick={() => setIsMobileMenuOpen(false)} />
          <NavItem variant="large" href="/informes" icon={FileText} label="Informes HVAC" badge={stats.informesPendientesFirma} onClick={() => setIsMobileMenuOpen(false)} />
          <NavItem variant="large" href="/tickets" icon={Ticket} label="Tickets" badge={stats.ticketsAbiertos} onClick={() => setIsMobileMenuOpen(false)} />
          <NavItem variant="large" href="/mapa" icon={MapPin} label="Mapa" onClick={() => setIsMoreDrawerOpen(false)} />
          <NavItem variant="large" href="/reportes" icon={BarChart3} label="Reportes" onClick={() => setIsMobileMenuOpen(false)} />
          <NavItem variant="large" href="/eficiencia" icon={Zap} label="EFICIENCIA" onClick={() => setIsMobileMenuOpen(false)} />
          <NavItem variant="large" href="/administracion" icon={Users} label="Administración" onClick={() => setIsMobileMenuOpen(false)} />
          <NavItem variant="large" href="/configuracion" icon={Settings} label="Configuración" onClick={() => setIsMobileMenuOpen(false)} />
        </nav>

        {/* Global Exit Button for thumb interaction */}
        <div className="p-8 border-t border-white/5 bg-slate-950/80 backdrop-blur-md">
           <button 
             onClick={() => setIsMobileMenuOpen(false)}
             className="w-full py-6 bg-yellow-400 hover:bg-yellow-500 text-slate-950 font-black text-sm rounded-[32px] uppercase tracking-[0.3em] shadow-[0_15px_40px_rgba(250,204,21,0.3)] active:scale-95 transition-all border-b-8 border-yellow-600 flex items-center justify-center gap-3"
           >
             <X className="w-5 h-5" />
             Volver
           </button>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        
        {/* Header */}
        <header className={`h-16 shrink-0 border-b flex items-center justify-between px-4 lg:px-8 z-30 shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-4">
            <button className="lg:hidden p-2 text-slate-400 hover:text-blue-500 transition-colors" onClick={() => setIsMobileMenuOpen(true)}>
              <Menu className="w-6 h-6" />
            </button>
            <h1 className={`text-xs font-bold uppercase tracking-widest hidden sm:block ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Panel Operativo Global
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* Sync Status Indicator */}
            <div className={`flex items-center gap-2 px-2 py-1 rounded border ${
              !isOnline 
                ? 'bg-red-500/10 border-red-500/20 text-red-500' 
                : stats.offlineOps > 0 
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' 
                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
            }`}>
              {!isOnline ? (
                <>
                  <WifiOff className="w-3 h-3" />
                  <span className="text-[9px] font-black uppercase hidden md:inline">Offline</span>
                </>
              ) : stats.offlineOps > 0 ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span className="text-[9px] font-black uppercase hidden md:inline">{stats.offlineOps} Pendientes</span>
                </>
              ) : (
                <>
                  <Cloud className="w-3 h-3" />
                  <span className="text-[9px] font-black uppercase hidden md:inline">Sincronizado</span>
                </>
              )}
            </div>

            {/* Notifications Bell */}
            <div className="relative cursor-pointer group p-2">
              <Bell className={`w-5 h-5 transition-transform group-hover:scale-110 ${stats.equiposEnFalla > 0 ? 'text-red-500 animate-bounce' : 'text-slate-400'}`} />
              {stats.equiposEnFalla > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-600 rounded-full border-2 border-slate-900"></span>
              )}
            </div>

            {/* Theme Toggle */}
            <button 
              onClick={toggleTheme} 
              className={`p-2 rounded border transition-colors ${isDarkMode ? 'border-slate-800 hover:bg-slate-800 text-slate-400' : 'border-slate-200 hover:bg-slate-100 text-slate-600'}`}
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Client Selector (Desktop) */}
            <div className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded border text-[10px] font-bold cursor-pointer transition-colors ${
              isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}>
              <Building className="w-3 h-3" />
              <span>SANTIAGO-B01</span>
              <ChevronDown className="w-3 h-3 opacity-50" />
            </div>

            {/* Profile Badge */}
            <div className={`flex items-center gap-3 border-l pl-4 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="hidden lg:flex flex-col items-end">
                <span className={`text-xs font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Nelson Bravo</span>
                <span className="text-[9px] text-emerald-500 font-bold uppercase tracking-tight">Admin</span>
              </div>
              <div className="relative">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-lg shadow-blue-600/30 ring-2 ring-blue-600/20">
                  NB
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full shadow-sm"></div>
              </div>
            </div>
          </div>
        </header>

        {/* PWA Banner */}
        {showPWABanner && (
          <div className="bg-blue-600 text-white px-4 py-2 flex items-center justify-between text-xs font-bold shrink-0 shadow-lg relative z-20">
            <div className="flex items-center gap-2">
              <Download className="w-3 h-3" />
              <span>INSTALAR APP PARA ACCESO OFFLINE</span>
              <button className="ml-4 px-2 py-0.5 bg-white/20 hover:bg-white/30 rounded border border-white/40 transition-colors">INSTALAR</button>
            </div>
            <X className="w-3 h-3 cursor-pointer opacity-70 hover:opacity-100" onClick={() => setShowPWABanner(false)} />
          </div>
        )}

        {/* Main Content Area */}
        <main className={`flex-1 overflow-y-auto p-4 pb-32 lg:p-8 relative ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
          {children}
        </main>

        {/* Mobile Navigation (One-Handed / Ambidiestro) */}
        <nav className={`lg:hidden fixed bottom-6 ${menuPosition === 'right' ? 'right-6' : 'left-6'} z-50 flex items-center gap-3`}>
          {/* Toggle Handness */}
          <button 
            onClick={() => setMenuPosition(menuPosition === 'right' ? 'left' : 'right')}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg border backdrop-blur-md transition-all active:scale-90 ${
              isDarkMode ? 'bg-slate-900/80 border-slate-700 text-slate-400' : 'bg-white/80 border-slate-200 text-slate-600'
            }`}
          >
            {menuPosition === 'right' ? 'R' : 'L'}
          </button>

          <div className={`flex items-center gap-2 p-2 rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.3)] border backdrop-blur-2xl transition-all duration-300 ${
            isDarkMode ? 'bg-slate-900/95 border-white/5' : 'bg-white/95 border-slate-200'
          } ${menuPosition === 'left' ? 'flex-row-reverse' : 'flex-row'}`}>
            
            {/* Secondary Actions (More) */}
            <div 
              className="w-12 h-12 rounded-2xl flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:bg-slate-800 transition-colors"
              onClick={() => setIsMoreDrawerOpen(true)}
            >
              <MoreHorizontal className="w-6 h-6" />
            </div>

            <Link href="/mantenimientos">
              <div className="w-12 h-12 rounded-2xl flex flex-col items-center justify-center text-slate-400 hover:text-blue-500 transition-colors relative">
                <Wrench className="w-6 h-6" />
                {stats.mantenimientosPendientes > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-amber-500 text-[10px] text-white flex items-center justify-center rounded-full font-black border-2 border-slate-900">
                    {stats.mantenimientosPendientes}
                  </span>
                )}
              </div>
            </Link>

            {/* Primary Action (Scanner) */}
            <Link href="/scanner">
              <div className="w-16 h-16 bg-blue-600 rounded-[22px] flex items-center justify-center shadow-xl shadow-blue-600/40 text-white hover:scale-105 active:scale-95 transition-transform cursor-pointer">
                <ScanLine className="w-8 h-8" />
              </div>
            </Link>

            <Link href="/">
              <div className="w-12 h-12 rounded-2xl flex flex-col items-center justify-center text-slate-400 hover:text-blue-500 transition-colors">
                <LayoutDashboard className="w-6 h-6" />
              </div>
            </Link>
          </div>
        </nav>
      </div>

      {/* More Options Drawer (Mobile - Thumb Optimized) */}
      {isMoreDrawerOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] lg:hidden" onClick={() => setIsMoreDrawerOpen(false)} />
          <div className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 rounded-t-[40px] z-[70] p-8 pb-12 lg:hidden animate-in slide-in-from-bottom duration-500">
            <div className="w-16 h-1.5 bg-slate-800 rounded-full mx-auto mb-8"></div>
            
            <div className="grid grid-cols-2 gap-4">
              <Link href="/informes" onClick={() => setIsMoreDrawerOpen(false)}>
                <div className="flex items-center gap-4 p-5 bg-slate-800/50 border border-slate-700/50 rounded-3xl active:scale-95 transition-all">
                  <div className="w-12 h-12 bg-blue-600/20 rounded-2xl flex items-center justify-center text-blue-400"><FileText className="w-6 h-6" /></div>
                  <span className="text-xs font-black text-slate-200 uppercase tracking-widest">Informes</span>
                </div>
              </Link>
              
              <Link href="/equipos" onClick={() => setIsMoreDrawerOpen(false)}>
                <div className="flex items-center gap-4 p-5 bg-slate-800/50 border border-slate-700/50 rounded-3xl active:scale-95 transition-all">
                  <div className="w-12 h-12 bg-emerald-600/20 rounded-2xl flex items-center justify-center text-emerald-400"><Box className="w-6 h-6" /></div>
                  <span className="text-xs font-black text-slate-200 uppercase tracking-widest">Equipos</span>
                </div>
              </Link>

              <Link href="/mapa" onClick={() => setIsMoreDrawerOpen(false)}>
                <div className="flex items-center gap-4 p-5 bg-slate-800/50 border border-slate-700/50 rounded-3xl active:scale-95 transition-all">
                  <div className="w-12 h-12 bg-purple-600/20 rounded-2xl flex items-center justify-center text-purple-400"><MapPin className="w-6 h-6" /></div>
                  <span className="text-xs font-black text-slate-200 uppercase tracking-widest">Mapa</span>
                </div>
              </Link>

              <Link href="/planificacion" onClick={() => setIsMoreDrawerOpen(false)}>
                <div className="flex items-center gap-4 p-5 bg-slate-800/50 border border-slate-700/50 rounded-3xl active:scale-95 transition-all">
                  <div className="w-12 h-12 bg-cyan-600/20 rounded-2xl flex items-center justify-center text-cyan-400"><CalendarIcon className="w-6 h-6" /></div>
                  <span className="text-xs font-black text-slate-200 uppercase tracking-widest">Agenda</span>
                </div>
              </Link>

              <Link href="/reportes" onClick={() => setIsMoreDrawerOpen(false)}>
                <div className="flex items-center gap-4 p-5 bg-slate-800/50 border border-slate-700/50 rounded-3xl active:scale-95 transition-all">
                  <div className="w-12 h-12 bg-amber-600/20 rounded-2xl flex items-center justify-center text-amber-400"><BarChart3 className="w-6 h-6" /></div>
                  <span className="text-xs font-black text-slate-200 uppercase tracking-widest">KPIs</span>
                </div>
              </Link>

              <Link href="/administracion" onClick={() => setIsMoreDrawerOpen(false)}>
                <div className="flex items-center gap-4 p-5 bg-slate-800/50 border border-slate-700/50 rounded-3xl active:scale-95 transition-all">
                  <div className="w-12 h-12 bg-rose-600/20 rounded-2xl flex items-center justify-center text-rose-400"><Users className="w-6 h-6" /></div>
                  <span className="text-xs font-black text-slate-200 uppercase tracking-widest">Admin</span>
                </div>
              </Link>
            </div>

            <button 
              className="mt-8 w-full py-5 bg-slate-100 text-slate-900 font-black text-xs rounded-2xl uppercase tracking-[0.2em] active:scale-95 transition-all shadow-xl shadow-white/5"
              onClick={() => setIsMoreDrawerOpen(false)}
            >
              Volver
            </button>
          </div>
        </>
      )}
    </div>
  );
}
