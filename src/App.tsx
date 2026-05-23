/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
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

import { DataStore } from "./services/dataStore";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [hasClientSelected, setHasClientSelected] = useState<boolean>(false);
  const [location, setLocation] = useLocation();

  useEffect(() => {
    // Trigger sync on mount
    DataStore.sync();
    
    // Periodically sync every 5 minutes
    const interval = setInterval(() => DataStore.sync(), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const auth = localStorage.getItem("is_authenticated") === "true";
    const client = !!localStorage.getItem("active_client");
    setIsAuthenticated(auth);
    setHasClientSelected(client);

    // Initial routing logic
    if (!auth && location !== "/login") {
      if (location !== "/") {
        localStorage.setItem("intended_route", location);
      }
      setLocation("/login");
    } else if (auth && !client && location !== "/client-selector") {
      setLocation("/client-selector");
    }
  }, [location, setLocation]);

  // Auth pages (no layout)
  if (!isAuthenticated && location === "/login") {
    return (
      <AuthProvider>
        <Login />
      </AuthProvider>
    );
  }

  // Tenant selector (no layout)
  if (isAuthenticated && !hasClientSelected) {
    return (
      <AuthProvider>
        <ClientSelector />
      </AuthProvider>
    );
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
