/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Componente principal de la aplicación que gestiona el enrutamiento global,
 * la persistencia de sesión y la jerarquía de vistas.
 * 
 * @module App
 */

import { Route, Switch, useLocation } from "wouter";
import { lazy, Suspense, useEffect, useState } from "react";
import { AuthProvider } from "./context/AuthContext";
import Layout from "./components/Layout";
import AccessDenied from "./components/AccessDenied";
import { syncEngine } from "./sync/syncEngine";
import { useAppStore } from "./store/useAppStore";
import { useSyncStore } from "./store/useSyncStore";
import { SyncIndicator } from "./components/SyncIndicator";
import { SyncInspectorPanel } from "./components/debug/SyncInspectorPanel";
import { networkMonitor } from "./sync/networkMonitor";
import { logger } from "./lib/logger";
import { GlobalConfirmDialog } from "./components/GlobalConfirmDialog";
import { GlobalAlertDialog } from "./components/GlobalAlertDialog";
import { PwaUpdatePrompt } from "./components/PwaUpdatePrompt";
import { db } from "./db/database";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const ScannerQR = lazy(() => import("./pages/ScannerQR"));
const Equipos = lazy(() => import("./pages/Equipos"));
const DetalleEquipo = lazy(() => import("./pages/DetalleEquipo"));
const Mapa = lazy(() => import("./pages/Mapa"));
const Mantenimientos = lazy(() => import("./pages/Mantenimientos"));
const EditorOrdenServicio = lazy(() => import("./pages/EditorOrdenServicio"));
const OrdenesServicio = lazy(() => import("./pages/OrdenesServicio"));
const EditorInforme = lazy(() => import("./pages/EditorInforme"));
const Tickets = lazy(() => import("./pages/Tickets"));
const Reportes = lazy(() => import("./pages/Reportes"));
const Administracion = lazy(() => import("./pages/Administracion"));
const Clientes = lazy(() => import("./pages/Clientes"));
const Biometria = lazy(() => import("./pages/Biometria"));
const Consola = lazy(() => import("./pages/Consola"));
const Configuracion = lazy(() => import("./pages/Configuracion"));
const Login = lazy(() => import("./pages/Login"));
const Planificacion = lazy(() => import("./pages/Planificacion"));
const ClientSelector = lazy(() => import("./pages/ClientSelector"));
const EFIEnergia = lazy(() => import("./pages/EFIEnergia"));
const InventarioInterno = lazy(() => import("./pages/InventarioInterno"));

function LegacyReportsRedirect() {
  const [, setLocation] = useLocation();
  useEffect(() => setLocation('/ordenes-servicio'), [setLocation]);
  return <div className="p-8 text-center text-sm font-bold text-slate-500">Los informes se abren desde una orden de servicio.</div>;
}

/**
 * Componente funcional App.
 * Controla el acceso basado en el estado de autenticación y selección del cliente (Tenant).
 * 
 * Interacciones:
 * - LocalStorage: Verifica "is_authenticated" y "active_client".
 * - AuthProvider: Provee contexto de Autenticación a toda la aplicación.
 * - Layout: Envuelve las páginas protegidas con la barra lateral y navegación superior.
 * 
 * @returns {JSX.Element} El árbol de componentes de la aplicación.
 */
export default /**
 * =========================================================================
 * ARCHIVO PRINCIPAL: App.tsx (Controlador de Navegación)
 * =========================================================================
 * 
 * FUNCIÓN:
 * Es el cerebro del front-end en Vercel. Decide qué página mostrar según la URL.
 * 
 * INTERACCIONES:
 * - AuthContext: Valida si el usuario inició sesión.
 * - LocalStorage: Recuerda qué cliente seleccionó el usuario.
 * 
 * FLUJO DE ARRANQUE:
 * 1. Verifica si hay sesión. Si no, manda a /login.
 * 2. El administrador elige vista global o cliente.
 * 3. Supervisor y Técnico eligen un cliente asignado para la sesión.
 * 4. Los demás perfiles usan automáticamente su cliente asignado.
 */
function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => (
    localStorage.getItem("is_authenticated") === "true"
    && !!sessionStorage.getItem("auth_token")
  ));
  const [hasClientSelected, setHasClientSelected] = useState<boolean>(() => (
    !!localStorage.getItem("active_client")
  ));
  const [location] = useLocation();
  const clients = useAppStore(state => state.clients);
  const savedUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("auth_user") || "null");
    } catch {
      return null;
    }
  })();
  const isAdmin = savedUser?.perfil === "administrador";
  const selectsClient = savedUser?.perfil === "supervisor" || savedUser?.perfil === "tecnico";
  const isAdminGlobalView = isAdmin && localStorage.getItem("admin_global_view") === "true";
  const isMissingAssignedClient = !!savedUser && !isAdmin && !selectsClient && !hasClientSelected;
  const requiresPinChange = localStorage.getItem('requires_pin_change') === 'true';

  useEffect(() => {
    // 1. Hidratar datos locales (IndexedDB -> Zustand)
    useAppStore.getState().hydrate();
    
    // 2. Iniciar motor de sincronización
    syncEngine.init();

    // 3. Monitor de red se inicia dentro de syncEngine.init() o manualmente si se prefiere
    // networkMonitor.init(); // networkMonitor.init() ya es llamado por syncEngine.init()
  }, []);

  useEffect(() => {
    const handleInvalidSession = () => {
      localStorage.removeItem("auth_user");
      localStorage.removeItem("auth_token");
      localStorage.removeItem("is_authenticated");
      localStorage.removeItem("active_client");
      localStorage.removeItem("admin_global_view");
      sessionStorage.removeItem("auth_token");
      localStorage.removeItem("cmms-auth-storage");
      void db.delete().catch((error) => console.warn('No fue posible purgar IndexedDB tras invalidar la sesión.', error));
      useAppStore.getState().clearSessionState();
      setIsAuthenticated(false);
      setHasClientSelected(false);
      window.location.replace("/login");
    };

    window.addEventListener("auth-session-invalid", handleInvalidSession);
    window.addEventListener("auth-session-ended", handleInvalidSession);
    return () => {
      window.removeEventListener("auth-session-invalid", handleInvalidSession);
      window.removeEventListener("auth-session-ended", handleInvalidSession);
    };
  }, []);

  // 30-Minute Inactivity Session Disconnection Rule (§1)
  useEffect(() => {
    if (!isAuthenticated) return;

    let timeoutId: any;
    const INACTIVITY_LIMIT = 30 * 60 * 1000; // 30 minutes

    const handleLogout = () => {
      logger.info("Session", "Session disconnected due to 30 minutes of inactivity.");
      void fetch('/api/logout', { method: 'POST' }).finally(() => {
        window.dispatchEvent(new Event('auth-session-invalid'));
      });
    };

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(handleLogout, INACTIVITY_LIMIT);
    };

    // Events to track user interaction/activity
    const activityEvents = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    activityEvents.forEach((event) => {
      window.addEventListener(event, resetTimer);
    });

    // Start initial timer
    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      activityEvents.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [isAuthenticated]);

  useEffect(() => {
    const auth = localStorage.getItem("is_authenticated") === "true" && !!sessionStorage.getItem("auth_token");
    const client = !!localStorage.getItem("active_client");
    // Wouter puede entregar una nueva referencia de navegación después de un
    // cambio de ruta. Evitar setters incondicionales aquí impide ciclos de
    // render durante el redireccionamiento obligatorio de PIN.
    if (auth !== isAuthenticated) setIsAuthenticated(auth);
    if (client !== hasClientSelected) setHasClientSelected(client);

    // Compatibilidad temporal con códigos QR legados que usan ?tag=...
    const params = new URLSearchParams(window.location.search);
    const tagParam = params.get("tag");

    // Initial routing logic
    const currentPath = window.location.pathname;

    if (!auth && currentPath !== "/login") {
      // Store the pending tag scan if any, to redirect after login
      if (tagParam) localStorage.setItem("pending_tag", tagParam);
      window.location.replace("/login");
      return;
    } 

    if (auth && requiresPinChange && currentPath !== '/biometria') {
      window.location.replace('/biometria');
      return;
    }
    
    // Si acaba de iniciar sesión y hay un tag pendiente
    const pendingTag = localStorage.getItem("pending_tag");
    if (auth && (tagParam || pendingTag)) {
      const tagToRedirect = tagParam || pendingTag;
      if (pendingTag) localStorage.removeItem("pending_tag");
      
      // Limpiar query params de la visualización
      if (tagParam) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      
      // Redirigir a Ficha de Equipo
      if (currentPath !== `/equipos/${tagToRedirect}`) {
        window.location.replace(`/equipos/${tagToRedirect}`);
      }
      return;
    }

    if (
      auth
      && ((isAdmin && !isAdminGlobalView) || selectsClient)
      && !client
      && currentPath !== "/client-selector"
    ) {
      window.location.replace("/client-selector");
    }
  }, [location, isAuthenticated, hasClientSelected, isAdmin, selectsClient, isAdminGlobalView, requiresPinChange]);

  return (
    <AuthProvider>
      <GlobalConfirmDialog />
      <GlobalAlertDialog />
      <PwaUpdatePrompt />
      <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-slate-500">Cargando módulo…</div>}>
      {!isAuthenticated ? (
        <Login />
      ) : requiresPinChange ? (
        <Biometria />
      ) : (isAuthenticated && ((isAdmin && !isAdminGlobalView) || selectsClient) && !hasClientSelected) ? (
        <ClientSelector />
      ) : isMissingAssignedClient ? (
        <AccessDenied requiredPermission="Cliente asignado por el administrador" />
      ) : (
        <>
          <Layout>
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/scanner" component={ScannerQR} />
              <Route path="/equipos" component={Equipos} />
              <Route path="/equipos/:assetId" component={DetalleEquipo} />
              <Route path="/EQUIPOS/:assetId" component={DetalleEquipo} />
              <Route path="/mapa" component={Mapa} />
              <Route path="/mantenimientos" component={Mantenimientos} />
              <Route path="/ordenes-servicio" component={OrdenesServicio} />
              <Route path="/ordenes-servicio/:orderId/informes/:id" component={EditorInforme} />
              <Route path="/ordenes-servicio/:id" component={EditorOrdenServicio} />
              <Route path="/planificacion" component={Planificacion} />
              <Route path="/informes" component={LegacyReportsRedirect} />
              <Route path="/informes/:id" component={LegacyReportsRedirect} />
              <Route path="/tickets" component={Tickets} />
              <Route path="/reportes" component={Reportes} />
              <Route path="/eficiencia" component={EFIEnergia} />
              <Route path="/inventario" component={InventarioInterno} />
              <Route path="/administracion">
                {isAdmin ? <Administracion /> : <AccessDenied requiredPermission="Gestionar usuarios" />}
              </Route>
              <Route path="/clientes">
                {isAdmin ? <Clientes /> : <AccessDenied requiredPermission="Administrar clientes" />}
              </Route>
              <Route path="/biometria" component={Biometria} />
              <Route path="/consola">
                {isAdmin ? <Consola /> : <AccessDenied requiredPermission="Consultar la consola de auditoría" />}
              </Route>
              <Route path="/configuracion">
                {isAdmin ? <Configuracion /> : <AccessDenied requiredPermission="Configurar el sistema" />}
              </Route>
              
              {/* Simple fallbacks */}
              <Route path="/client-selector">
                {isAdmin || selectsClient
                  ? <ClientSelector />
                  : <AccessDenied requiredPermission="Cambiar contexto de clientes" />}
              </Route>
              <Route path="/login" component={Login} />

              <Route>
                <div className="flex items-center justify-center flex-1 h-full min-h-[400px]">
                  <p className="text-slate-500 font-medium italic text-left">Módulo no encontrado o en construcción.</p>
                </div>
              </Route>
            </Switch>
          </Layout>
          <SyncIndicator />
          <SyncInspectorPanel />
        </>
      )}
      </Suspense>
    </AuthProvider>
  );
}
