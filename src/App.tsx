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

/**
 * Componente funcional App.
 * Controla el acceso basado en el estado de autenticación y selección del cliente (Tenant).
 * 
 * Interacciones:
 * - LocalStorage: Verifica "is_authenticated" y "active_client".
 * - AuthProvider: Provee contexto de Firebase Auth a toda la aplicación.
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
 * - AuthContext: Valida si el usuario inició sesión en Firebase.
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
    const auth = localStorage.getItem("is_authenticated") === "true";
    const client = !!localStorage.getItem("active_client");
    setIsAuthenticated(auth);
    setHasClientSelected(client);

    // Initial routing logic
    if (!auth && location !== "/login") {
      setLocation("/login");
    } else if (auth && !client && CLIENTS.length > 0 && location !== "/client-selector") {
      setLocation("/client-selector");
    }
  }, [location, setLocation]);

  // Auth pages (no layout)
  if (!isAuthenticated && location === "/login") {
    return <Login />;
  }

  // Tenant selector (no layout)
  if (isAuthenticated && !hasClientSelected && CLIENTS.length > 0) {
    return <ClientSelector />;
  }

  return (
    <AuthProvider>
      <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/scanner" component={ScannerQR} />
        <Route path="/equipos" component={Equipos} />
        <Route path="/equipos/:tag" component={DetalleEquipo} />
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
    </AuthProvider>
  );
}
