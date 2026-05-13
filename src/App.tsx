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
import { useEffect, useState } from "react";
import { AuthProvider } from "./context/AuthContext";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import ScannerQR from "./pages/ScannerQR";
import Equipos from "./pages/Equipos";
import DetalleEquipo from "./pages/DetalleEquipo";
import Mapa from "./pages/Mapa";
import Mantenimientos from "./pages/Mantenimientos";
import EditorOrdenServicio from "./pages/EditorOrdenServicio";
import OrdenesServicio from "./pages/OrdenesServicio";
import InformesHVAC from "./pages/InformesHVAC";
import EditorInforme from "./pages/EditorInforme";
import Tickets from "./pages/Tickets";
import Reportes from "./pages/Reportes";
import Administracion from "./pages/Administracion";
import Consola from "./pages/Consola";
import Configuracion from "./pages/Configuracion";
import Login from "./pages/Login";
import Planificacion from "./pages/Planificacion";
import ClientSelector from "./pages/ClientSelector";
import EFIEnergia from "./pages/EFIEnergia";
import { CLIENTS } from "./data/clientes";
import { initSyncEngine } from "./lib/syncEngine";
import { useAppStore } from "./store/useAppStore";
import { useSyncStore } from "./store/useSyncStore";
import { SyncIndicator } from "./components/SyncIndicator";
import { SyncInspectorPanel } from "./components/debug/SyncInspectorPanel";
import { networkMonitor } from "./lib/network";

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
 * 2. Si hay sesión pero no cliente, intenta mandar a /client-selector.
 * 3. Si no hay clientes (nuevo entorno), salta directo al Dashboard.
 */
function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [hasClientSelected, setHasClientSelected] = useState<boolean>(false);
  const [location, setLocation] = useLocation();

  useEffect(() => {
    // 1. Hidratar datos locales (IndexedDB -> Zustand)
    useAppStore.getState().hydrate();
    
    // 2. Iniciar motor de sincronización
    initSyncEngine();

    // 3. Iniciar monitor de red
    networkMonitor.init();
  }, []);

  useEffect(() => {
    const auth = localStorage.getItem("is_authenticated") === "true";
    const client = !!localStorage.getItem("active_client");
    setIsAuthenticated(auth);
    setHasClientSelected(client);

    // Middleware de Redirección para Código QR (?tag=...)
    const params = new URLSearchParams(window.location.search);
    const tagParam = params.get("tag");

    // Initial routing logic
    if (!auth && location !== "/login") {
      // Store the pending tag scan if any, to redirect after login
      if (tagParam) localStorage.setItem("pending_tag", tagParam);
      setLocation("/login");
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
      if (location !== `/equipos/${tagToRedirect}`) {
        setLocation(`/equipos/${tagToRedirect}`);
      }
      return;
    }

    if (auth && !client && CLIENTS.length > 0 && location !== "/client-selector") {
      setLocation("/client-selector");
    }
  }, [location, setLocation]);

  return (
    <AuthProvider>
      {(!isAuthenticated && location === "/login") ? (
        <Login />
      ) : (isAuthenticated && !hasClientSelected && CLIENTS.length > 0) ? (
        <ClientSelector />
      ) : (
        <>
          <Layout>
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/scanner" component={ScannerQR} />
              <Route path="/equipos" component={Equipos} />
              <Route path="/equipos/:tag" component={DetalleEquipo} />
              <Route path="/EQUIPOS/:tag" component={DetalleEquipo} />
              <Route path="/mapa" component={Mapa} />
              <Route path="/mantenimientos" component={Mantenimientos} />
              <Route path="/ordenes-servicio" component={OrdenesServicio} />
              <Route path="/ordenes-servicio/:id" component={EditorOrdenServicio} />
              <Route path="/planificacion" component={Planificacion} />
              <Route path="/informes" component={InformesHVAC} />
              <Route path="/informes/:id" component={EditorInforme} />
              <Route path="/tickets" component={Tickets} />
              <Route path="/reportes" component={Reportes} />
              <Route path="/eficiencia" component={EFIEnergia} />
              <Route path="/administracion" component={Administracion} />
              <Route path="/consola" component={Consola} />
              <Route path="/configuracion" component={Configuracion} />
              
              {/* Simple fallbacks */}
              <Route path="/client-selector" component={ClientSelector} />
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
    </AuthProvider>
  );
}
