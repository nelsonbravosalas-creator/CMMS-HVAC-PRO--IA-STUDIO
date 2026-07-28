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
  Activity,
  Zap,
  Menu as MenuIcon,
  Building2,
  Fingerprint,
  Package,
  LogOut,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "motion/react";

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
  { href: "/clientes", icon: Building2, label: "Clientes", adminOnly: true },
  { href: "/inventario", icon: Package, label: "Inventario Interno" },
  { href: "/mantenimientos", icon: Wrench, label: "Mantenimientos", badgeKey: 'preventive_maintenancePendientes', badgeColor: "bg-amber-500" },
  { href: "/planificacion", icon: CalendarIcon, label: "Calendario" },
  { href: "/ordenes-servicio", icon: FileText, label: "Órdenes de Servicio", badgeKey: 'ordenesServicioTotal', badgeColor: "bg-indigo-500" },
  { href: "/informes", icon: FileText, label: "Informes HVAC", badgeKey: 'informesPendientesFirma', badgeColor: "bg-blue-500" },
  { href: "/tickets", icon: Ticket, label: "Tickets", badgeKey: 'ticketsAbiertos' },
  { href: "/reportes", icon: BarChart3, label: "Reportes" },
  { href: "/eficiencia", icon: Zap, label: "Eficiencia Energética" },
  { href: "/administracion", icon: Users, label: "Usuarios", section: "Configuración", adminOnly: true },
  { href: "/biometria", icon: Fingerprint, label: "Acceso Biométrico", section: "Configuración" },
  { href: "/consola", icon: Terminal, label: "Consola", section: "Configuración", adminOnly: true },
  { href: "/configuracion", icon: Settings, label: "Configuración", section: "Configuración", adminOnly: true },
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
  const { logout, user, permisos } = useAuth();
  const [location, setLocation] = useLocation();
  const isAdmin = user?.perfil === "administrador";
  const canChangeClient = isAdmin || user?.perfil === "supervisor" || user?.perfil === "tecnico";
  const visibleNavItems = NAV_ITEMS
    .filter(item => !item.adminOnly || isAdmin)
    .filter(item => {
      if (item.href === "/mantenimientos") return !!permisos?.ver_mantenimientos;
      if (item.href === "/informes") return !!permisos?.ver_informes;
      if (item.href === "/reportes") return !!permisos?.ver_reportes;
      if (item.href === "/administracion") return !!permisos?.gestionar_usuarios;
      return true;
    });

  const handleHeaderLogout = () => {
    logout();
    setLocation("/login");
  };

  const openSyncInspector = () => {
    window.dispatchEvent(new CustomEvent('open-sync-inspector'));
    setIsMobileMenuOpen(false);
  };

  /** Dynamic active client name */
  const activeClientId = localStorage.getItem("active_client");
  const activeClientName = useLiveQuery(async () => {
    if (!activeClientId) {
      return null;
    }
    const client = await db.clients
      .filter(item => item.uuid_sync === activeClientId || item.id === activeClientId)
      .first();
    return client ? client.nombre : null;
  }, [activeClientId, user?.perfil])
    || (isAdmin && !activeClientId
      ? "Vista Global"
      : localStorage.getItem("active_client_name") || activeClientId || "Sin cliente");

  /** Control de apertura del menú lateral en dispositivos móviles */
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  /** Control del drawer de acciones secundarias (Mobile) */
  const [isMoreDrawerOpen, setIsMoreDrawerOpen] = useState(false);
  /** Estado del tema visual (Inicia en modo claro por defecto) */
  const [isDarkMode, setIsDarkMode] = useState(
    () => localStorage.getItem('cmms_theme') === 'dark'
  );
  /** Visibilidad del banner de Progressive Web App */
  const [showPWABanner, setShowPWABanner] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMobileMenuOpen(false);
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isMobileMenuOpen]);

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
  const [menuPosition, setMenuPosition] = useState<'left' | 'right'>(() =>
    localStorage.getItem('mobile_menu_side') === 'left' ? 'left' : 'right'
  );

  useEffect(() => {
    localStorage.setItem('mobile_menu_side', menuPosition);
  }, [menuPosition]);

  // Real-time queries for badges
  const ticketsAbiertos = useLiveQuery(() => 
    db.work_orders.filter(item =>
      (!activeClientId || item.cliente_id === activeClientId) &&
      (item.estado === 'abierto' || item.estado === 'en_proceso')
    ).count()
  , [activeClientId]) ?? 0;

  const mantenimientosPendientes = useLiveQuery(() => 
    db.preventive_maintenance.filter(item =>
      (!activeClientId || item.cliente_id === activeClientId) && item.estado !== 'ejecutado'
    ).count()
  , [activeClientId]) ?? 0;

  const informesTotal = useLiveQuery(() =>
    db.reports.filter(item =>
      item.sync_status !== 'pending_delete' &&
      (!activeClientId || (item.data?.generalData?.cliente || (item as any).cliente_id) === activeClientId)
    ).count()
  , [activeClientId]) ?? 0;
  
  const equiposTotal = useLiveQuery(() => 
    db.assets.filter(a => !a.deleted_at && (!activeClientId || a.cliente_id === activeClientId)).count()
  , [activeClientId]) ?? 0;

  const ordenesServicioTotal = useLiveQuery(() =>
    db.ordenes_servicio.filter(item =>
      item.sync_status !== 'pending_delete' &&
      (!activeClientId || (item.cliente_id || item.data?.generalData?.cliente) === activeClientId)
    ).count()
  , [activeClientId]) ?? 0;

  const equiposEnFalla = useLiveQuery(() => 
    db.assets.filter(a => !a.deleted_at && (!activeClientId || a.cliente_id === activeClientId) && a.estado === 'falla').count()
  , [activeClientId]) ?? 0;

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
    disponibilidadGlobal: equiposTotal > 0
      ? `${(((equiposTotal - equiposEnFalla) / equiposTotal) * 100).toFixed(1)}%`
      : "—"
  };

  const toggleTheme = () => {
    const nextThemeIsDark = !isDarkMode;
    localStorage.setItem('cmms_theme', nextThemeIsDark ? 'dark' : 'light');
    setIsDarkMode(nextThemeIsDark);
  };

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
          {visibleNavItems.map((item, idx) => (
            <div key={item.href}>
              {item.section && (idx === 0 || visibleNavItems[idx-1].section !== item.section) && (
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
          <button
            type="button"
            onClick={openSyncInspector}
            className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-wider transition-colors ${
              isDarkMode
                ? 'border-slate-800 text-slate-300 hover:bg-slate-800'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Activity className="h-4 w-4 text-blue-500" />
            <span className="flex-1 text-left">Sync Inspector</span>
            {stats.offlineOps > 0 && (
              <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-white">{stats.offlineOps}</span>
            )}
          </button>
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
              <div
                className="h-full bg-emerald-500"
                style={{ width: equiposTotal > 0 ? `${((equiposTotal - equiposEnFalla) / equiposTotal) * 100}%` : "0%" }}
              ></div>
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
      <>
        {isMobileMenuOpen && (
          <div
            aria-hidden="true"
            onPointerDown={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] lg:hidden"
          />
        )}
        {isMobileMenuOpen && (
          <motion.aside
            key="mobile-menu-aside"
            initial={{ x: menuPosition === 'right' ? '100%' : '-100%' }}
            animate={{ x: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            role="dialog"
            aria-modal="true"
            aria-label="Menú principal"
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
                type="button"
                aria-label="Cerrar menú"
                onPointerDown={() => setIsMobileMenuOpen(false)}
                className={`p-3 rounded-2xl cursor-pointer active:scale-90 transition-transform border ${
                  isDarkMode ? 'bg-white/5 border-[#39FF14] shadow-[0_0_15px_rgba(57,255,20,0.3)] text-[#39FF14]' : 'bg-slate-100 border-slate-200 text-slate-600'
                }`}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto py-6 space-y-1 custom-scrollbar">
              {visibleNavItems.map((item) => (
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
              <button
                type="button"
                onClick={openSyncInspector}
                className={`mx-4 my-2 flex w-[calc(100%-2rem)] items-center gap-6 rounded-3xl border-2 p-5 text-left transition-all active:scale-95 ${
                  isDarkMode
                    ? 'border-white/10 bg-slate-900/50 text-slate-100'
                    : 'border-slate-200 bg-white text-slate-900 shadow-sm'
                }`}
              >
                <Activity className="h-8 w-8 text-blue-500" />
                <span className="flex-1 text-sm font-black uppercase tracking-[0.1em]">Sync Inspector</span>
                {stats.offlineOps > 0 && (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-amber-500 text-[10px] font-black text-white">
                    {stats.offlineOps}
                  </span>
                )}
              </button>
            </nav>

            <div className={`p-6 border-t ${isDarkMode ? 'bg-slate-950/80 border-white/5' : 'bg-white border-slate-100'} backdrop-blur-md`}>
              <button 
                type="button"
                onPointerDown={() => setIsMobileMenuOpen(false)}
                className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white font-black text-sm rounded-[24px] uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3"
              >
                Continuar
              </button>
            </div>
          </motion.aside>
        )}
      </>

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        
        {/* Header */}
        <header className={`h-16 shrink-0 border-b flex items-center justify-between px-4 lg:px-8 z-30 shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-4">
            <h1 className={`text-xs font-bold uppercase tracking-widest hidden sm:block ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {isAdmin ? "Panel Operativo Global" : "Panel Operativo del Cliente"}
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
            <div
              role="status"
              aria-label={stats.equiposEnFalla > 0
                ? `${stats.equiposEnFalla} equipos con alertas`
                : "Sin alertas de equipos"}
              className="relative group p-2"
            >
              <Bell className={`w-5 h-5 transition-transform group-hover:scale-110 ${stats.equiposEnFalla > 0 ? 'text-red-500 animate-bounce' : isDarkMode ? 'text-slate-400' : 'text-slate-600'}`} />
              {stats.equiposEnFalla > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-600 rounded-full border-2 border-slate-900"></span>
              )}
            </div>

            {/* Theme Toggle */}
            <button 
              type="button"
              aria-label={isDarkMode ? "Activar tema claro" : "Activar tema oscuro"}
              onClick={toggleTheme} 
              className={`p-2 rounded border transition-colors ${isDarkMode ? 'border-slate-800 hover:bg-slate-800 text-slate-400' : 'border-slate-200 hover:bg-slate-100 text-slate-600'}`}
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Active Client Badge (Simple Capsule) */}
            <button
              type="button"
              onClick={() => canChangeClient && setLocation("/client-selector")}
              title={canChangeClient ? "Cambiar contexto de cliente" : undefined}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-black tracking-wider uppercase ${
              isDarkMode 
                ? 'bg-slate-900/60 border-slate-800 text-slate-300' 
                : 'bg-white/80 border-slate-200 text-slate-700 shadow-sm'
            } ${canChangeClient ? "cursor-pointer hover:border-blue-300 hover:text-blue-700" : "cursor-default"}`}>
              <Database className={`w-3.5 h-3.5 shrink-0 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
              <span className="max-w-[120px] sm:max-w-[180px] truncate">{activeClientName}</span>
            </button>

            {/* Profile Badge */}
            <div className={`flex items-center gap-3 border-l pl-4 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="hidden lg:flex flex-col items-end">
                <span className={`text-xs font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{user?.nombre || "Usuario"}</span>
                <span className="text-[9px] text-emerald-500 font-bold uppercase tracking-tight">{user?.perfil || "Sin perfil"}</span>
              </div>
              <div className="relative">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-lg shadow-blue-600/30 ring-2 ring-blue-600/20">
                  NB
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full shadow-sm"></div>
              </div>
            </div>

            {/* Logout Button */}
            <button 
              id="logout_btn_header"
              onClick={handleHeaderLogout}
              className={`p-2.5 rounded-xl border shrink-0 flex items-center gap-1.5 text-[10px] font-black uppercase transition-all duration-300 group cursor-pointer active:scale-95 shadow-sm ${
                isDarkMode 
                  ? 'bg-red-500/10 border-red-500/20 hover:border-red-500/40 text-red-500 hover:bg-red-500/20 shadow-red-950/20' 
                  : 'bg-red-50 border-red-100 hover:border-red-200 text-red-650 hover:bg-red-100/65 shadow-red-100/10'
              }`}
              title="Cerrar Sesión de la Aplicación"
            >
              <LogOut className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
              <span className="hidden xl:inline">Cerrar Sesión</span>
            </button>
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
        <main className={`flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-4 pb-56 lg:p-8 relative ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
          {children}
          <footer
            aria-label="Fin del contenido"
            className={`mt-6 flex min-h-44 items-start justify-center border-t pt-5 lg:hidden ${
              isDarkMode ? 'border-slate-800 text-slate-600' : 'border-slate-200 text-slate-400'
            }`}
          >
            <span className="text-[9px] font-bold uppercase tracking-[0.24em]">
              CMMS HVAC · Fin del contenido
            </span>
          </footer>
        </main>

        {/* Floating Main Menu Trigger (Mobile / Left-handed support) */}
        <button
          type="button"
          aria-label={`Abrir menú principal desde el lado ${menuPosition === 'right' ? 'derecho' : 'izquierdo'}`}
          onClick={() => setIsMobileMenuOpen(true)}
          className={`lg:hidden fixed top-1/2 -translate-y-1/2 z-[55] flex h-16 w-12 items-center justify-center border shadow-xl backdrop-blur-md transition-[left,right,transform,background-color] active:scale-90 ${
            menuPosition === 'right'
              ? 'right-0 rounded-l-2xl border-r-0'
              : 'left-0 rounded-r-2xl border-l-0'
          } ${
            isDarkMode
              ? 'bg-slate-900/95 border-slate-700 text-blue-400'
              : 'bg-white/95 border-slate-200 text-blue-600'
          }`}
        >
          <MenuIcon className="h-7 w-7" />
        </button>

        {/* Mobile Navigation (One-Handed / Ambidiestro) */}
        <nav className={`lg:hidden fixed bottom-6 ${menuPosition === 'right' ? 'right-6' : 'left-6'} z-50 flex items-center gap-3`}>
          {/* Toggle Handness */}
          <button 
            type="button"
            aria-label={`Mover controles al lado ${menuPosition === 'right' ? 'izquierdo' : 'derecho'}`}
            title={`Usar controles al lado ${menuPosition === 'right' ? 'izquierdo' : 'derecho'}`}
            onClick={() => setMenuPosition(menuPosition === 'right' ? 'left' : 'right')}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg border backdrop-blur-md transition-all active:scale-90 ${
              isDarkMode ? 'bg-slate-900/80 border-slate-700 text-slate-400' : 'bg-white/80 border-slate-200 text-slate-600'
            }`}
          >
            {menuPosition === 'right' ? 'D' : 'I'}
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

              {isAdmin && (
                <Link href="/clientes" onClick={() => setIsMoreDrawerOpen(false)}>
                  <div className="flex items-center gap-4 p-5 bg-slate-800/50 border border-slate-700/50 rounded-3xl active:scale-95 transition-all">
                    <div className="w-12 h-12 bg-blue-600/20 rounded-2xl flex items-center justify-center text-blue-400"><Building2 className="w-6 h-6" /></div>
                    <span className="text-xs font-black text-slate-200 uppercase tracking-widest">Clientes</span>
                  </div>
                </Link>
              )}

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

              {isAdmin && (
                <Link href="/administracion" onClick={() => setIsMoreDrawerOpen(false)}>
                  <div className="flex items-center gap-4 p-5 bg-slate-800/50 border border-slate-700/50 rounded-3xl active:scale-95 transition-all">
                    <div className="w-12 h-12 bg-rose-600/20 rounded-2xl flex items-center justify-center text-rose-400"><Users className="w-6 h-6" /></div>
                    <span className="text-xs font-black text-slate-200 uppercase tracking-widest">Usuarios</span>
                  </div>
                </Link>
              )}

              <Link href="/biometria" onClick={() => setIsMoreDrawerOpen(false)}>
                <div className="flex items-center gap-4 p-5 bg-slate-800/50 border border-slate-700/50 rounded-3xl active:scale-95 transition-all">
                  <div className="w-12 h-12 bg-teal-600/20 rounded-2xl flex items-center justify-center text-teal-400"><Fingerprint className="w-6 h-6" /></div>
                  <span className="text-xs font-black text-slate-200 uppercase tracking-widest">Biometría</span>
                </div>
              </Link>

              <div 
                onClick={() => {
                  setIsMoreDrawerOpen(false);
                  handleHeaderLogout();
                }}
                className="flex items-center gap-4 p-5 bg-red-950/20 border border-red-900/30 rounded-3xl active:scale-95 transition-all cursor-pointer"
              >
                <div className="w-12 h-12 bg-red-600/20 rounded-2xl flex items-center justify-center text-red-400"><LogOut className="w-6 h-6" /></div>
                <span className="text-xs font-black text-red-400 uppercase tracking-widest">Cerrar Sesión</span>
              </div>
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

      {/* Floating Draggable Client Selector Widget */}
    </div>
  );
}
