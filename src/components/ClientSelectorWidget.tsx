import { useState, useEffect, useRef } from "react";
import { Database, GripHorizontal, ChevronDown, Check, UserPlus, Layers } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/database";

interface ClientSelectorWidgetProps {
  isDarkMode: boolean;
}

export default function ClientSelectorWidget({ isDarkMode }: ClientSelectorWidgetProps) {
  const activeClientId = localStorage.getItem("active_client");
  
  const activeClients = useLiveQuery(async () => {
    const clients = await db.clients.toArray();
    return clients.filter(c => c.activo !== false);
  }) || [];

  const activeClientName = useLiveQuery(async () => {
    if (!activeClientId) return null;
    const client = await db.clients.get(activeClientId);
    return client ? client.nombre : null;
  }, [activeClientId]) || "Entorno General";

  // Position coordinates of the floating widget
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<HTMLDivElement>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Load a reasonable starting position based on screen width
  useEffect(() => {
    const screenWidth = window.innerWidth;
    // Set initial position: bottom right floating area on mobile or top right on desktop
    if (screenWidth < 1024) {
      setPosition({ x: screenWidth - 190, y: 80 }); // top-right side
    } else {
      setPosition({ x: screenWidth - 280, y: 90 }); // top-right side below header
    }
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Prevent dragging if the user interacts with standard form controls
    const target = e.target as HTMLElement;
    if (target.closest(".no-drag") || target.tagName === "SELECT" || target.tagName === "BUTTON") {
      return;
    }

    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
    
    // Capture pointer to track dragging out of bounding container
    const elem = dragRef.current;
    if (elem) {
      elem.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;

    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;

    // Boundaries constraints
    const widgetWidth = isMinimized ? 64 : 260;
    const widgetHeight = isMinimized ? 64 : 140;
    const maxX = window.innerWidth - widgetWidth - 10;
    const maxY = window.innerHeight - widgetHeight - 10;

    setPosition({
      x: Math.max(10, Math.min(newX, maxX)),
      y: Math.max(10, Math.min(newY, maxY)),
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    const elem = dragRef.current;
    if (elem) {
      elem.releasePointerCapture(e.pointerId);
    }
  };

  // Switch client session
  const selectClient = (clientId: string) => {
    if (clientId) {
      localStorage.setItem("active_client", clientId);
      window.location.reload();
    }
  };

  return (
    <div
      ref={dragRef}
      id="floating-client-selector"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        touchAction: "none",
      }}
      className={`fixed top-0 left-0 z-[999] transition-shadow select-none duration-150 ${
        isDragging ? "shadow-2xl scale-[1.02] cursor-grabbing" : "shadow-xl cursor-grab"
      } ${
        isMinimized 
          ? "w-16 h-16 rounded-full flex items-center justify-center" 
          : "w-[245px] rounded-2xl p-3"
      } ${
        isDarkMode 
          ? "bg-slate-900/95 border border-slate-700/60 text-slate-100 backdrop-blur-xl" 
          : "bg-white/95 border border-slate-200/85 text-slate-800 backdrop-blur-xl"
      }`}
    >
      {isMinimized ? (
        <div 
          onClick={() => setIsMinimized(false)}
          className="relative group w-full h-full flex items-center justify-center rounded-full transition-all duration-300 pointer-events-auto cursor-pointer no-drag active:scale-95"
          title={`Sesión: ${activeClientName}`}
        >
          {/* Subtle pulse for current active client */}
          <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <Database className={`w-6 h-6 ${isDarkMode ? "text-blue-400" : "text-blue-600"}`} />
          
          {/* Popover label on hover */}
          <div className="absolute right-full mr-3 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded border hidden group-hover:block whitespace-nowrap bg-slate-900 text-slate-100 border-slate-800">
            {activeClientName}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {/* Drag Handle & Header */}
          <div className="flex items-center justify-between border-b pb-1.5 border-slate-100/10 dark:border-slate-800/60">
            <div className="flex items-center gap-1.5">
              <GripHorizontal className="w-3.5 h-3.5 text-slate-400 opacity-70 cursor-move" />
              <div className="flex flex-col">
                <span className="text-[9px] font-black tracking-widest text-slate-400 uppercase">SESIÓN ACTIVA</span>
                <span className="text-[10px] font-extrabold max-w-[140px] truncate text-[#22c55e]">
                  ● {activeClientName}
                </span>
              </div>
            </div>
            
            {/* Collapse view */}
            <button
              onClick={() => setIsMinimized(true)}
              className="p-1 rounded-md transition-colors hover:bg-slate-200/50 dark:hover:bg-slate-800/80 text-slate-400 hover:text-slate-200 cursor-pointer no-drag"
              title="Minimizar Selector"
            >
              <span className="block w-2.5 h-0.5 bg-slate-400 rounded-full"></span>
            </button>
          </div>

          {/* Client select dropdowm wrapper */}
          <div className="flex flex-col gap-1.5 no-drag">
            <label htmlFor="widget-client-select" className="text-[8px] font-bold tracking-wider text-slate-400 uppercase">
              Seleccionar Cliente
            </label>
            <div className={`relative flex items-center gap-2 px-2.5 py-2 rounded-lg border text-[10px] font-black transition-all ${
              isDarkMode 
                ? 'bg-slate-950 border-slate-700 hover:border-slate-500 hover:bg-slate-900 text-slate-100' 
                : 'bg-slate-50 border-slate-300 hover:border-slate-400 hover:bg-white text-slate-800'
            }`}>
              <Database className={`w-3.5 h-3.5 shrink-0 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
              <div className="relative flex items-center flex-1">
                <select
                  id="widget-client-select"
                  value={activeClientId || ""}
                  onChange={(e) => selectClient(e.target.value)}
                  className="w-full bg-transparent border-none pr-5 text-[9px] uppercase tracking-wider font-extrabold cursor-pointer appearance-none focus:outline-none text-ellipsis overflow-hidden"
                >
                  <option value="" disabled className={isDarkMode ? 'bg-slate-950 text-slate-400' : 'bg-white text-slate-500'}>
                    No seleccionado
                  </option>
                  {activeClients.map((c) => (
                    <option key={c.uuid_sync} value={c.uuid_sync} className={isDarkMode ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-900'}>
                      {c.nombre || "Cliente Sin Nombre"}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-slate-400 absolute right-0 pointer-events-none opacity-60" />
              </div>
            </div>
            
            {/* Context/Profile Badge helper info inside widget */}
            <div className="flex items-center justify-between text-[8px] tracking-wide text-slate-500 dark:text-slate-400 pt-1">
              <div className="flex items-center gap-1">
                <Layers className="w-2.5 h-2.5 text-blue-500" />
                <span>Modo Multi-Cliente</span>
              </div>
              <span className="font-semibold text-emerald-500 uppercase tracking-tighter">Autorizado</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
