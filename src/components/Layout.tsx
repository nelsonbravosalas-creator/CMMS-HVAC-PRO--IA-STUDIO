/**
 * Componente de Diseño Estructural (Layout).
 * Define el marco visual persistente, incluyendo la barra lateral (Desktop) 
 * y la navegación optimizada para pulgar (Mobile).
 * 
 * @module components/Layout
 */

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
  Database,
  Bell,
  WifiOff,
  Moon,
  Sun,
  Download,
  MoreHorizontal,
  X,
  AlertTriangle,
  Zap,
  Menu as MenuIcon,
  Building2,
  Fingerprint,
  Search,
} from "lucide-react";
import { ReactNode, useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "motion/react";

/**
 * Propiedades del componente NavItem.
 */
interface NavItemProps {
  href: string;
  icon: any;
  label: string;
  badge?: number;
  badgeColor?: string;
  onClick?: () => void;
  variant?: 'default' | 'large';
  isDarkMode?: boolean;
}

const NAV_ITEMS = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/scanner", icon: ScanLine, label: "Scanner QR" },
  { href: "/equipos", icon: Box, label: "Equipos", badgeKey: 'equiposTotal', badgeColor: "bg-purple-600" },
  { href: "/mapa", icon: MapPin, label: "Mapa" },
  { href: "/clientes", icon: Building2, label: "Clientes" },
  { href: "/mantenimientos", icon: Wrench, label: "Mantenimientos", badgeKey: 'preventive_maintenancePendientes', badgeColor: "bg-amber-500" },
  { href: "/planificacion", icon: CalendarIcon, label: "Calendario" },
  { href: "/ordenes-servicio", icon: FileText, label: "Órdenes de Servicio", badgeKey: 'ordenesServicioTotal', badgeColor: "bg-indigo-500" },
  { href: "/informes", icon: FileText, label: "Informes HVAC", badgeKey: 'informesPendientesFirma', badgeColor: "bg-blue-500" },
  { href: "/tickets", icon: Ticket, label: "Tickets", badgeKey: 'ticketsAbiertos' },
  { href: "/reportes", icon: BarChart3, label: "Reportes" },
  { href: "/eficiencia", icon: Zap, label: "Eficiencia Energética" },
  { href: "/administracion", icon: Users, label: "Administración", section: "Configuración" },
  { href: "/biometria", icon: Fingerprint, label: "Acceso Biométrico", section: "Configuración" },
  { href: "/consola", icon: Terminal, label: "Consola", section: "Configuración" },
  { href: "/configuracion", icon: Settings, label: "Configuración", section: "Configuración" },
];

/**
 * Componente de navegación individual.
 * Soporta dos variantes: 'default' para barra lateral desktop y 'large' para menú táctil móvil.
 */
function NavItem({ href, icon: Icon, label, badge, badgeColor = "bg-red-500", onClick, variant = 'default', isDarkMode = true }: NavItemProps) {
  const [location] = useLocation();
  const isActive = location === href;

  if (variant === 'large') {
    return (
      <Link href={href} onClick={onClick}>
        <div className={`mx-4 my-2 p-5 rounded-3xl border-2 flex items-center gap-6 cursor-pointer transition-all active:scale-95 ${
          isActive 
            ? "bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-600/30 font-black" 
            : isDarkMode
              ? "bg-slate-900/50 border-white/10 text-slate-100 hover:bg-slate-800"
              : "bg-white border-slate-200 text-slate-900 hover:bg-slate-50 shadow-sm"
        }`}>
          <Icon className={`w-8 h-8 ${isActive ? "text-white" : isDarkMode ? "text-slate-100" : "text-slate-900"}`} />
          <span className="flex-1 whitespace-nowrap text-sm font-black uppercase tracking-[0.1em]">{label}</span>
          {badge !== undefined && badge > 0 && (
            <span className={`${badgeColor} text-white rounded-full w-8 h-8 flex items-center justify-center text-[10px] font-black border-2 ${isDarkMode ? 'border-slate-900' : 'border-white'}`}>
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
          ? `font-semibold border-blue-500 ${isDarkMode ? 'bg-slate-800 text-white' : 'bg-blue-50 text-blue-700'}`
          : isDarkMode 
            ? "hover:bg-slate-800 hover:text-white border-transparent text-slate-100"
            : "hover:bg-slate-100 hover:text-slate-900 border-transparent text-slate-900"
      }`}>
        <Icon className={`w-4 h-4 ${isActive ? (isDarkMode ? "text-blue-400" : "text-blue-600") : ""}`} />
        <span className="flex-1 whitespace-nowrap font-medium">{label}</span>
        {badge !== undefined && badge > 0 && (
          <span className={`${badgeColor} text-white rounded px-1.5 py-px text-[10px] ml-auto font-bold animate-pulse`}>
            {badge}
          </span>
        )}
      </div>
    </Link>
  );
}

/**
 * Propiedades del Layout.
 * @interface LayoutProps
 */
interface LayoutProps {
  /** Contenido de la página actual que será renderizado dentro del marco. */
  children: ReactNode;
}

/**
 * Componente funcional Layout.
 * 
 * Funcionalidades transversales:
 * - Persistencia de Barra Lateral: Navegación rápida entre módulos CMMS.
 * - Soporte PWA: Banner de instalación para capacidades offline.
 * - Tematización: Cambio entre modo claro / oscuro (Dark Mode nativo).
 * - UX Móvil: Navegación de una sola mano con switch de lateralidad (Zurdo/Diestro).
 * - Monitoreo de Red: Visualización de operaciones pendientes de sincronización (Offline ops).
 * 
 * @param {LayoutProps} props
 * @returns {JSX.Element} Estructura base con Header, Sidebar y Main Area.
 */
import { syncEngine } from '../sync/syncEngine';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';

export default function Layout({ children }: LayoutProps) {
  /** Dynamic active client name */
  const activeClientId = localStorage.getItem("active_client");
  const activeClientName = useLiveQuery(async () => {
    if (!activeClientId) return null;
    const client = await db.clients.get(activeClientId);
    return client ? client.nombre : null;
  }, [activeClientId]) || "Entorno General";

  /** Fetch active clients list for responsive dropdown selection */
  const activeClients = useLiveQuery(async () => {
    const clients = await db.clients.toArray();
    return clients.filter(c => c.activo !== false);
  }) || [];

  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [clientToSwitch, setClientToSwitch] = useState<any | null>(null);

  const filteredClients = useMemo(() => {
    if (!clientSearchQuery.trim()) return activeClients;
    return activeClients.filter(c => 
      c.nombre.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
      (c.rut && c.rut.toLowerCase().includes(clientSearchQuery.toLowerCase()))
    );
  }, [activeClients, clientSearchQuery]);

  /** Control de apertura del menú lateral en dispositivos móviles */
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  /** Control del drawer de acciones secundarias (Mobile) */
  const [isMoreDrawerOpen, setIsMoreDrawerOpen] = useState(false);
  /** Estado del tema visual (Inicia en modo claro por defecto) */
  const [isDarkMode, setIsDarkMode] = useState(false);
  /** Visibilidad del banner de Progressive Web App */
  const [showPWABanner, setShowPWABanner] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Initial sync
    syncEngine.triggerSync();

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPWABanner(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
         console.log('User accepted the A2HS prompt');
      }
      setDeferredPrompt(null);
      setShowPWABanner(false);
    }
  };

  /** Posición de los controles móviles para ergonimía (Derecha/Izquierda) */
  const [menuPosition, setMenuPosition] = useState<'left' | 'right'>('right');

  // Real-time queries for badges
  const ticketsAbiertos = useLiveQuery(() => 
    db.work_orders.where('estado').anyOf('abierto', 'en_proceso').count()
  ) ?? 0;

  const mantenimientosPendientes = useLiveQuery(() => 
    db.preventive_maintenance.where('estado').notEqual('ejecutado').count()
  ) ?? 0;

  const informesTotal = useLiveQuery(() => db.reports.count()) ?? 0;
  
  const equiposTotal = useLiveQuery(() => 
    db.assets.filter(a => !a.deleted_at).count()
  ) ?? 0;

  const ordenesServicioTotal = useLiveQuery(() => db.ordenes_servicio.count()) ?? 0;

  const equiposEnFalla = useLiveQuery(() => 
    db.assets.where('estado').equals('falla').count()
  ) ?? 0;

  /** 
   * Estadísticas y contadores de insignias (Badges).
   */
  const stats = {
    ticketsAbiertos: ticketsAbiertos,
    preventive_maintenancePendientes: mantenimientosPendientes,
    informesPendientesFirma: informesTotal, // Re-purposed to show total docs for informes
    ordenesServicioTotal: ordenesServicioTotal,
    equiposTotal: equiposTotal,
    offlineOps: 0,
    equiposEnFalla: equiposEnFalla,
    disponibilidadGlobal: "98.2%"
  };

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  return (
    <div className={`h-screen w-full flex overflow-hidden font-sans ${isDarkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* Sidebar - Desktop */}
      <aside className={`hidden lg:flex w-[260px] h-full flex-col border-r shadow-xl z-20 ${isDarkMode ? 'bg-slate-950 border-slate-900' : 'bg-white border-slate-200'}`}>
        <div className={`px-6 py-5 text-lg font-bold border-b flex items-center gap-2.5 ${isDarkMode ? 'text-white border-slate-900' : 'text-slate-900 border-slate-100'}`}>
          <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] text-white">HV</span>
          </div>
          <span className="truncate tracking-tight uppercase text-sm">Control HVAC</span>
        </div>
        
        <nav className="mt-4 flex-1 flex flex-col overflow-y-auto scrollbar-hide py-2">
          {NAV_ITEMS.map((item, idx) => (
            <div key={item.href}>
              {item.section && (idx === 0 || NAV_ITEMS[idx-1].section !== item.section) && (
                <div className={`mt-6 mb-2 px-6 text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  {item.section}
                </div>
              )}
              <NavItem 
                isDarkMode={isDarkMode} 
                href={item.href} 
                icon={item.icon} 
                label={item.label} 
                badge={item.badgeKey ? (stats as any)[item.badgeKey] : undefined}
                badgeColor={item.badgeColor}
              />
            </div>
          ))}
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

      {/* Mobile Drawer Navigation */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] lg:hidden"
            />
            
            {/* Drawer */}
            <motion.aside
              initial={{ x: menuPosition === 'right' ? '100%' : '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: menuPosition === 'right' ? '100%' : '-100%' }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className={`fixed top-0 ${menuPosition === 'right' ? 'right-0' : 'left-0'} h-full w-[320px] z-[110] lg:hidden shadow-2xl flex flex-col ${
                isDarkMode ? 'bg-slate-950 border-white/5' : 'bg-slate-50 border-slate-200'
              } border-x overflow-hidden`}
            >
              <div className={`p-8 border-b flex justify-between items-center ${isDarkMode ? 'bg-slate-900/50 border-white/5' : 'bg-white border-slate-200'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
                    <span className="text-[10px] text-white font-black">HV</span>
                  </div>
                  <span className={`font-black uppercase tracking-widest text-xs ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Menu Principal</span>
                </div>
                <button 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`p-3 rounded-2xl cursor-pointer active:scale-90 transition-transform border ${
                    isDarkMode ? 'bg-white/5 border-[#39FF14] shadow-[0_0_15px_rgba(57,255,20,0.3)] text-[#39FF14]' : 'bg-slate-100 border-slate-200 text-slate-600'
                  }`}
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto py-6 space-y-1 custom-scrollbar">
                {NAV_ITEMS.map((item) => (
                  <NavItem 
                    key={item.href}
                    isDarkMode={isDarkMode} 
                    variant="large" 
                    href={item.href} 
                    icon={item.icon} 
                    label={item.label} 
                    badge={item.badgeKey ? (stats as any)[item.badgeKey] : undefined}
                    badgeColor={item.badgeColor}
                    onClick={() => setIsMobileMenuOpen(false)} 
                  />
                ))}
              </nav>

              <div className={`p-6 border-t ${isDarkMode ? 'bg-slate-950/80 border-white/5' : 'bg-white border-slate-100'} backdrop-blur-md`}>
                <button 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white font-black text-sm rounded-[24px] uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                  Continuar
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        
        {/* Header */}
        <header className={`h-16 shrink-0 border-b flex items-center justify-between px-4 lg:px-8 z-30 shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-4">
            <button 
              className={`lg:hidden p-2 transition-colors ${isDarkMode ? 'text-slate-400 hover:text-blue-400' : 'text-slate-600 hover:text-blue-600'}`} 
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <MenuIcon className="w-6 h-6" />
            </button>
            <h1 className={`text-xs font-bold uppercase tracking-widest hidden sm:block ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Panel Operativo Global
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* Sync Status */}
            {stats.offlineOps > 0 && (
              <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded">
                <WifiOff className="w-3 h-3 text-amber-500" />
                <span className="text-[9px] font-bold text-amber-500 uppercase hidden md:inline">{stats.offlineOps} PENDIENTES</span>
              </div>
            )}

            {/* Notifications Bell */}
            <div className="relative cursor-pointer group p-2">
              <Bell className={`w-5 h-5 transition-transform group-hover:scale-110 ${stats.equiposEnFalla > 0 ? 'text-red-500 animate-bounce' : isDarkMode ? 'text-slate-400' : 'text-slate-600'}`} />
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

            {/* Active Client Dropdown Selector */}
            <div className="relative">
              <button 
                onClick={() => setIsClientDropdownOpen(!isClientDropdownOpen)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-black tracking-wider uppercase cursor-pointer hover:opacity-90 active:scale-95 transition-all outline-none ${
                  isDarkMode 
                    ? 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800' 
                    : 'bg-white/80 border-slate-200 text-slate-700 shadow-sm hover:bg-slate-50'
                }`}
              >
                <Database className={`w-3.5 h-3.5 shrink-0 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                <span className="max-w-[120px] sm:max-w-[180px] truncate">{activeClientName}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {isClientDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsClientDropdownOpen(false)} />
                  <div className={`absolute right-0 mt-2 w-72 rounded-2xl border p-4 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-200 ${
                    isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
                  }`}>
                    {/* Search Field */}
                    <div className="relative mb-3">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                      <input
                        type="text"
                        value={clientSearchQuery}
                        onChange={(e) => setClientSearchQuery(e.target.value)}
                        placeholder="Buscar cliente..."
                        className={`w-full pl-9 pr-4 py-2 text-xs font-bold rounded-xl outline-none border transition-colors ${
                          isDarkMode 
                            ? 'bg-slate-950 border-slate-800 focus:border-blue-500 text-white placeholder-slate-500' 
                            : 'bg-slate-50 border-slate-100 focus:border-blue-500 text-slate-800 placeholder-slate-400'
                        }`}
                      />
                    </div>

                    <div className="max-h-48 overflow-y-auto space-y-1 custom-scrollbar">
                      {/* Entorno General Option */}
                      <button
                        onClick={() => {
                          setIsClientDropdownOpen(false);
                          if (activeClientId) {
                            setClientToSwitch({ uuid_sync: "", nombre: "Entorno General" });
                          }
                        }}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl text-[10px] font-bold uppercase transition-all text-left ${
                          !activeClientId 
                            ? (isDarkMode ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'bg-blue-50 text-blue-700 border border-blue-100')
                            : (isDarkMode ? 'hover:bg-slate-800/50 text-slate-400 border border-transparent' : 'hover:bg-slate-50 text-slate-500 border border-transparent')
                        }`}
                      >
                        <span className="truncate">Entorno General</span>
                        {!activeClientId && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                      </button>

                      {filteredClients.map((client) => {
                        const isActive = activeClientId === client.uuid_sync;
                        return (
                          <button
                            key={client.uuid_sync}
                            onClick={() => {
                              setIsClientDropdownOpen(false);
                              if (activeClientId !== client.uuid_sync) {
                                setClientToSwitch(client);
                              }
                            }}
                            className={`w-full flex flex-col p-2.5 rounded-xl text-left transition-all border ${
                              isActive 
                                ? (isDarkMode ? 'bg-blue-600/20 text-blue-400 border-blue-500/30' : 'bg-blue-50 text-blue-700 border-blue-100')
                                : (isDarkMode ? 'hover:bg-slate-800/50 text-slate-300 border-transparent' : 'hover:bg-slate-50 text-slate-700 border-transparent')
                            }`}
                          >
                            <span className="text-[10px] font-black uppercase truncate leading-tight">{client.nombre}</span>
                            {client.rut && (
                              <span className="text-[8px] font-bold text-slate-400 mt-0.5">{client.rut}</span>
                            )}
                          </button>
                        );
                      })}

                      {filteredClients.length === 0 && clientSearchQuery.trim() !== "" && (
                        <div className="text-center py-4 text-[10px] font-black uppercase text-slate-400">
                          No se encontraron clientes
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
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
              <button onClick={handleInstallClick} className="ml-4 px-2 py-0.5 bg-white/20 hover:bg-white/30 rounded border border-white/40 transition-colors">INSTALAR</button>
            </div>
            <X 
              className={`w-3 h-3 cursor-pointer opacity-70 hover:opacity-100 p-0.5 rounded-full border transition-all ${
                isDarkMode ? 'border-[#39FF14] text-[#39FF14] shadow-[0_0_8px_rgba(57,255,20,0.5)]' : 'border-transparent'
              }`} 
              onClick={() => setShowPWABanner(false)} 
            />
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

          <motion.div 
            key={menuPosition}
            drag
            dragMomentum={false}
            dragElastic={0.1}
            whileDrag={{ scale: 1.05, boxShadow: "0px 30px 60px rgba(0,0,0,0.5)" }}
            className={`flex items-center gap-2 p-2 mt-0 -mb-[23px] mr-[1px] rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.3)] border backdrop-blur-2xl transition-all duration-300 cursor-grab active:cursor-grabbing touch-none ${
              isDarkMode ? 'bg-slate-900/95 border-white/5' : 'bg-white/95 border-slate-200'
            } ${menuPosition === 'left' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            
            {/* Secondary Actions (More) */}
            <div 
              className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-colors ${isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
              onClick={() => setIsMoreDrawerOpen(true)}
            >
              <MoreHorizontal className="w-6 h-6" />
            </div>

            <Link href="/mantenimientos">
              <div className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center transition-colors relative ${isDarkMode ? 'text-slate-400 hover:text-blue-400' : 'text-slate-600 hover:text-blue-600'}`}>
                <Wrench className="w-6 h-6" />
                {stats.preventive_maintenancePendientes > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-amber-500 text-[10px] text-white flex items-center justify-center rounded-full font-black border-2 border-slate-900">
                    {stats.preventive_maintenancePendientes}
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
              <div className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center transition-colors ${isDarkMode ? 'text-slate-400 hover:text-blue-400' : 'text-slate-600 hover:text-blue-600'}`}>
                <LayoutDashboard className="w-6 h-6" />
              </div>
            </Link>
          </motion.div>
        </nav>
      </div>

      {/* More Options Drawer (Mobile - Thumb Optimized) */}
      {isMoreDrawerOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] lg:hidden" onClick={() => setIsMoreDrawerOpen(false)} />
          <div className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 rounded-t-[40px] z-[70] p-8 pb-12 lg:hidden animate-in slide-in-from-bottom duration-500 max-h-[85vh] overflow-y-auto">
            <div className="w-16 h-1.5 bg-slate-800 rounded-full mx-auto mb-8 shrink-0"></div>
            
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

              <Link href="/clientes" onClick={() => setIsMoreDrawerOpen(false)}>
                <div className="flex items-center gap-4 p-5 bg-slate-800/50 border border-slate-700/50 rounded-3xl active:scale-95 transition-all">
                  <div className="w-12 h-12 bg-blue-600/20 rounded-2xl flex items-center justify-center text-blue-400"><Building2 className="w-6 h-6" /></div>
                  <span className="text-xs font-black text-slate-200 uppercase tracking-widest">Clientes</span>
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

              <Link href="/biometria" onClick={() => setIsMoreDrawerOpen(false)}>
                <div className="flex items-center gap-4 p-5 bg-slate-800/50 border border-slate-700/50 rounded-3xl active:scale-95 transition-all">
                  <div className="w-12 h-12 bg-teal-600/20 rounded-2xl flex items-center justify-center text-teal-400"><Fingerprint className="w-6 h-6" /></div>
                  <span className="text-xs font-black text-slate-200 uppercase tracking-widest">Biometría</span>
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

      {/* Session Switch Confirmation Dialog */}
      <AnimatePresence>
        {clientToSwitch && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-md z-[1000]"
              onClick={() => setClientToSwitch(null)}
            />
            
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 250 }}
              className={`fixed inset-x-4 top-[25vh] md:top-[30vh] md:max-w-md md:mx-auto z-[1010] p-6 rounded-[32px] border shadow-2xl flex flex-col text-center ${
                isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
              }`}
            >
              <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-5 animate-pulse">
                <AlertTriangle className="w-7 h-7" />
              </div>
              
              <h3 className="text-lg font-black uppercase tracking-tight mb-2 leading-snug">
                ¿Confirmar Cambio de Cliente?
              </h3>
              
              <p className={`text-xs font-semibold leading-relaxed mb-6 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Está a punto de cerrar la sesión de trabajo activa en <span className="font-extrabold text-blue-500">{activeClientName}</span> para cargar de manera segura los registros y parámetros correspondientes a <span className="font-extrabold text-blue-500">{clientToSwitch.nombre}</span>.
              </p>

              <div className="grid grid-cols-2 gap-3.5">
                <button
                  onClick={() => setClientToSwitch(null)}
                  className={`py-3.5 rounded-xl font-bold uppercase tracking-widest text-[9px] border transition-all active:scale-95 ${
                    isDarkMode 
                      ? 'bg-slate-800 border-slate-700 hover:bg-slate-700/50 text-slate-300' 
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-transparent'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    if (clientToSwitch.uuid_sync) {
                      localStorage.setItem("active_client", clientToSwitch.uuid_sync);
                    } else {
                      localStorage.removeItem("active_client");
                    }
                    window.location.href = "/";
                  }}
                  className="py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold uppercase tracking-widest text-[9px] shadow-lg shadow-blue-600/20 transition-all active:scale-95"
                >
                  Sí, Cambiar
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
