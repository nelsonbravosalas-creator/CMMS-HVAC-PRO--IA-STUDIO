import React, { useState, useMemo, useEffect, useRef } from "react";
import LoadingIndicator from "../components/LoadingIndicator";
import { 
  Map as MapIcon, 
  Filter, 
  RotateCcw, 
  Search, 
  Navigation, 
  MapPin, 
  Box, 
  ChevronRight,
  ExternalLink,
  Settings,
  Bell,
  User,
  ArrowLeft,
  Info,
  Clock,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Maximize2
} from "lucide-react";

// --- Datos de Ejemplo ---
const EQUIPOS_DATA = [
  { tag: "21-STK.AC.001", nombre: "Unidad Aire Acondicionado Central", estado: "operativo", ubicacion: "Piso 2 - Ala Norte", lat: -33.4489, lng: -70.6483 },
  { tag: "Planta-STK.AC.005", nombre: "Compresor de Aire Industrial", estado: "falla", ubicacion: "Subsuelo - Planta 1", lat: -33.4550, lng: -70.6550 },
  { tag: "G-002", nombre: "Generador de Emergencia 500kVA", estado: "mantenimiento", ubicacion: "Exterior - Patio Trasero", lat: -33.4420, lng: -70.6300 },
  { tag: "LIFT-01", nombre: "Ascensor Principal - Bloque A", estado: "operativo", ubicacion: "Hall Central", lat: -33.4460, lng: -70.6620 },
  { tag: "FIRE-04", nombre: "Bomba contra Incendios", estado: "operativo", ubicacion: "Sala de Máquinas", lat: -33.4380, lng: -70.6500 },
  { tag: "TRANS-01", nombre: "Transformador de Potencia T1", estado: "mantenimiento", ubicacion: "Subestación Norte", lat: -33.4600, lng: -70.6450 },
  { tag: "HVAC-09", nombre: "Torre de Enfriamiento B", estado: "falla", ubicacion: "Azotea", lat: -33.4520, lng: -70.6700 },
  { tag: "CHILL-02", nombre: "Chiller Agua Helada", estado: "operativo", ubicacion: "Planta Técnica", lat: -33.4400, lng: -70.6400 }
];

export default function App() {
  const [view, setView] = useState("map");
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [filter, setFilter] = useState("");
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [leafletReady, setLeafletReady] = useState(false);

  // Carga de Leaflet (Costo 0 / Open Source)
  useEffect(() => {
    if (window.L) {
      setLeafletReady(true);
      return;
    }
    // Cargar CSS de Leaflet
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);

    // Cargar JS de Leaflet
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.onload = () => setLeafletReady(true);
    document.head.appendChild(script);
  }, []);

  const stats = useMemo(() => ({
    total: EQUIPOS_DATA.length,
    operativos: EQUIPOS_DATA.filter(e => e.estado === 'operativo').length,
    falla: EQUIPOS_DATA.filter(e => e.estado === 'falla').length,
    mantenimiento: EQUIPOS_DATA.filter(e => e.estado === 'mantenimiento').length,
  }), []);

  const filtered = EQUIPOS_DATA.filter(eq => {
    const matchSearch = eq.nombre.toLowerCase().includes(filter.toLowerCase()) || eq.tag.toLowerCase().includes(filter.toLowerCase());
    const matchStatus = selectedStatus ? eq.estado === selectedStatus : true;
    return matchSearch && matchStatus;
  });

  const handleAssetClick = (asset) => {
    setSelectedAsset(asset);
    setView("detail");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 md:p-8">
      {/* Navbar */}
      <nav className="max-w-7xl mx-auto mb-8 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
            <Box className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight leading-none uppercase">AssetTrack</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Monitor Pro (Open Source Map)</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><Bell className="w-5 h-5" /></button>
          <div className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white shadow-sm overflow-hidden flex items-center justify-center bg-indigo-100 text-indigo-600 font-bold text-xs">JD</div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto">
        {view === "map" ? (
          <div className="flex flex-col gap-6">
            {/* Header Stats */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-4 pr-8 border-r border-slate-100">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 leading-none">{stats.total}</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Activos Georef.</p>
                  </div>
                </div>
                <div className="hidden md:flex flex-wrap gap-4">
                    <StatusChip label="Operativos" count={stats.operativos.toString()} color="emerald" active={selectedStatus === 'operativo'} onClick={() => setSelectedStatus(selectedStatus === 'operativo' ? null : 'operativo')} />
                    <StatusChip label="Falla" count={stats.falla.toString()} color="red" active={selectedStatus === 'falla'} onClick={() => setSelectedStatus(selectedStatus === 'falla' ? null : 'falla')} />
                    <StatusChip label="Mtto" count={stats.mantenimiento.toString()} color="amber" active={selectedStatus === 'mantenimiento'} onClick={() => setSelectedStatus(selectedStatus === 'mantenimiento' ? null : 'mantenimiento')} />
                </div>
              </div>

              <button 
                onClick={() => {setFilter(""); setSelectedStatus(null);}} 
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 text-slate-400 rounded-2xl hover:bg-slate-100 transition-all text-[10px] font-black uppercase"
              >
                <RotateCcw className="w-4 h-4" /> Reset
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-[650px]">
              {/* Contenedor del Mapa Leaflet */}
              <div className="lg:col-span-3 bg-slate-200 rounded-[48px] border-8 border-white shadow-2xl relative overflow-hidden group">
                {leafletReady ? (
                  <LeafletMap 
                    assets={filtered} 
                    onAssetClick={handleAssetClick} 
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
                    <LoadingIndicator size="lg" color="text-indigo-500" label="Inicializando Mapa..." />
                  </div>
                )}

                {/* Overlays UI */}
                <div className="absolute top-6 left-6 z-[1000] pointer-events-none">
                   <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-2xl border border-slate-200 shadow-xl flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">OpenMap Engine Activo</span>
                   </div>
                </div>
              </div>

              {/* Lista Lateral */}
              <div className="lg:col-span-1 flex flex-col gap-6">
                <div className="relative group">
                  <Search className="w-5 h-5 absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                  <input 
                    type="text" 
                    placeholder="Buscar equipo..." 
                    className="w-full pl-14 pr-6 py-4 bg-white border border-slate-200 rounded-3xl text-[11px] font-black uppercase outline-none focus:ring-4 focus:ring-indigo-500/5 shadow-sm transition-all"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  />
                </div>

                <div className="flex-1 bg-white border border-slate-200 rounded-[40px] overflow-hidden shadow-xl flex flex-col">
                  <div className="p-6 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center uppercase italic">
                    <span className="text-[11px] font-black text-slate-400 tracking-widest">{filtered.length} Equipos</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {filtered.map(eq => (
                      <div 
                        key={eq.tag} 
                        onClick={() => handleAssetClick(eq)}
                        className="p-4 rounded-3xl border border-slate-50 hover:border-indigo-100 hover:bg-indigo-50/50 transition-all cursor-pointer group active:scale-95"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-lg">{eq.tag}</span>
                          <div className={`w-2 h-2 rounded-full ${eq.estado === 'falla' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.3)]' : eq.estado === 'mantenimiento' ? 'bg-amber-500' : 'bg-emerald-500'}`}></div>
                        </div>
                        <p className="text-[12px] font-black text-slate-800 uppercase leading-snug line-clamp-2">{eq.nombre}</p>
                        <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 mt-2 uppercase">
                          <MapPin className="w-3 h-3" /> {eq.ubicacion}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Vista de Detalle */
          <div className="bg-white rounded-[48px] shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="flex flex-col md:flex-row h-full min-h-[600px]">
              <div className="md:w-1/2 p-12">
                <button onClick={() => setView("map")} className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 transition-colors mb-10 group">
                  <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                  <span className="text-[11px] font-black uppercase tracking-widest">Volver a Monitor</span>
                </button>

                <div className="space-y-8">
                  <div>
                    <span className="text-xs font-black text-indigo-500 uppercase tracking-widest mb-2 block">{selectedAsset.tag}</span>
                    <h2 className="text-5xl font-black text-slate-900 leading-tight uppercase">{selectedAsset.nombre}</h2>
                  </div>

                  <div className="flex gap-4">
                    <StatusBadge status={selectedAsset.estado} />
                    <div className="px-5 py-3 bg-slate-50 rounded-2xl flex items-center gap-3 text-[11px] font-black uppercase text-slate-500 border border-slate-100">
                      <MapPin className="w-4 h-4 text-indigo-500" /> {selectedAsset.ubicacion}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-8 py-8 border-y border-slate-100">
                    <DetailItem label="Latitud" value={selectedAsset.lat.toFixed(6)} />
                    <DetailItem label="Longitud" value={selectedAsset.lng.toFixed(6)} />
                    <DetailItem label="Última Lectura" value="Hace 2 minutos" />
                    <DetailItem label="Calidad GPS" value="Excelente" />
                  </div>

                  <div className="flex gap-4 pt-6">
                    <button className="flex-1 bg-indigo-600 text-white py-5 rounded-[24px] font-black uppercase text-xs shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95">Inspeccionar</button>
                    <button className="px-8 bg-slate-900 text-white rounded-[24px] font-black uppercase text-xs hover:bg-slate-800 transition-all">Reportes</button>
                  </div>
                </div>
              </div>

              <div className="md:w-1/2 bg-indigo-950 p-8 flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_white_1px,_transparent_1px)] [background-size:24px_24px]"></div>
                <div className="relative z-10 text-center">
                  <div className="w-56 h-56 rounded-full border-[12px] border-indigo-500/10 border-t-indigo-400 animate-[spin_10s_linear_infinite] mb-10 mx-auto flex items-center justify-center">
                    <div className="w-40 h-40 rounded-full border border-indigo-400/20 flex items-center justify-center">
                        <Box className="w-24 h-24 text-indigo-400 animate-pulse" />
                    </div>
                  </div>
                  <h4 className="text-indigo-300 font-mono text-sm tracking-[0.3em] uppercase">Telemetría Localizando...</h4>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// --- Componente de Mapa de Costo 0 (Leaflet) ---
function LeafletMap({ assets, onAssetClick }) {
  const mapContainerRef = useRef(null);
  const mapInstance = useRef(null);
  const markersLayerRef = useRef(null);

  useEffect(() => {
    if (!mapContainerRef.current || !window.L) return;

    // Inicializar mapa centrado en el promedio de los puntos
    const map = window.L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false
    }).setView([-33.4489, -70.6483], 13);

    // Capa de Mapa "Silver/Light" (CartoDB Positron - Costo 0 para uso web razonable)
    (window as any).L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19
    }).addTo(map);

    // Contenedor para marcadores para poder borrarlos fácilmente
    markersLayerRef.current = (window as any).L.layerGroup().addTo(map);
    mapInstance.current = map;

    return () => {
      map.remove();
    };
  }, []);

  useEffect(() => {
    if (!mapInstance.current || !markersLayerRef.current) return;

    // Limpiar marcadores
    markersLayerRef.current.clearLayers();

    // Icono Personalizado que imita la gráfica original
    const createCustomIcon = (status) => {
      const colorClass = status === 'falla' ? '#ef4444' : status === 'mantenimiento' ? '#f59e0b' : '#10b981';
      return (window as any).L.divIcon({
        html: `
          <div class="relative group">
            <div class="absolute -inset-2 rounded-full opacity-20 animate-ping" style="background-color: ${colorClass}"></div>
            <div class="w-8 h-8 rounded-full border-4 border-white shadow-lg flex items-center justify-center text-white" style="background-color: ${colorClass}">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
            </div>
          </div>
        `,
        className: 'custom-leaflet-icon',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });
    };

    const latlngs = [];

    assets.forEach(asset => {
      const marker = (window as any).L.marker([asset.lat, asset.lng], {
        icon: createCustomIcon(asset.estado)
      });
      
      marker.on('click', () => onAssetClick(asset));
      marker.addTo(markersLayerRef.current);
      latlngs.push([asset.lat, asset.lng]);
    });

    // Ajustar zoom para ver todos los activos si hay más de uno
    if (latlngs.length > 0) {
      const bounds = (window as any).L.latLngBounds(latlngs);
      mapInstance.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [assets]);

  return <div ref={mapContainerRef} className="w-full h-full z-0" />;
}

// --- Sub-componentes UI ---

function StatusChip({ label, count, color, active, onClick }) {
  const colors = {
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    red: "bg-red-50 text-red-600 border-red-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100"
  };
  const activeClass = active ? "ring-4 ring-indigo-500/20 border-indigo-500 bg-indigo-50 text-indigo-700" : "";

  return (
    <button onClick={onClick} className={`px-5 py-2.5 rounded-2xl border text-[10px] font-black uppercase flex items-center gap-3 transition-all shadow-sm ${colors[color]} ${activeClass}`}>
       {label} <span className="opacity-40">{count}</span>
    </button>
  );
}

function StatusBadge({ status }) {
    const config = {
        operativo: { icon: CheckCircle2, class: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
        falla: { icon: AlertTriangle, class: 'bg-red-50 text-red-600 border-red-100' },
        mantenimiento: { icon: Wrench, class: 'bg-amber-50 text-amber-600 border-amber-100' }
    };
    const { icon: Icon, class: className } = config[status];
    return (
        <div className={`px-5 py-3 rounded-2xl flex items-center gap-3 text-[11px] font-black uppercase border ${className}`}>
            <Icon className="w-4 h-4" /> {status}
        </div>
    );
}

function DetailItem({ label, value }) {
    return (
        <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
            <p className="font-bold text-slate-800">{value}</p>
        </div>
    );
}