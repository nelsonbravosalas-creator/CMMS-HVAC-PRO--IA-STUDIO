import React, { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/database";
import { 
  X, 
  Calendar as CalendarIcon, 
  User, 
  Package, 
  Clock, 
  Building2, 
  Mail, 
  Briefcase,
  AlertCircle,
  Sparkles,
  Link as LinkIcon
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface CrearActividadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (newActivity: any) => void;
}

export function CrearActividadModal({ isOpen, onClose, onSave }: CrearActividadModalProps) {
  const activeClientId = localStorage.getItem("active_client") || "default";
  
  // Form states
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"preventivo" | "correctivo" | "inspeccion">("preventivo");
  const [tech, setTech] = useState("Nelson Bravo");
  const [assistant, setAssistant] = useState("Luis Torres");
  const [selectedResourceId, setSelectedResourceId] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [startTime, setStartTime] = useState("09:00");
  const [duration, setDuration] = useState("120");
  const [details, setDetails] = useState("");
  
  // Custom notification emails
  const [techEmail, setTechEmail] = useState("tecnico.hvac@empresa.com");
  const [supervisorEmail, setSupervisorEmail] = useState("supervisor.zona@empresa.com");
  const [clientEmail, setClientEmail] = useState("contacto.cliente@empresa.com");

  const [hasChanges, setHasChanges] = useState(false);
  const [showExitPrompt, setShowExitPrompt] = useState(false);

  const ACTIVITY_DRAFT_KEY = "cmms_activity_draft";

  const handleCloseIntent = () => {
    if (hasChanges) {
      setShowExitPrompt(true);
    } else {
      localStorage.removeItem(ACTIVITY_DRAFT_KEY);
      onClose();
    }
  };

  const discardChanges = () => {
    localStorage.removeItem(ACTIVITY_DRAFT_KEY);
    setShowExitPrompt(false);
    onClose();
  };

  React.useEffect(() => {
    const draft = localStorage.getItem(ACTIVITY_DRAFT_KEY);
    if (draft && isOpen) {
      try {
        const parsed = JSON.parse(draft);
        if (parsed.title) setTitle(parsed.title);
        if (parsed.type) setType(parsed.type);
        if (parsed.tech) setTech(parsed.tech);
        if (parsed.assistant) setAssistant(parsed.assistant);
        if (parsed.selectedResourceId) setSelectedResourceId(parsed.selectedResourceId);
        if (parsed.startDate) setStartDate(parsed.startDate);
        if (parsed.startTime) setStartTime(parsed.startTime);
        if (parsed.duration) setDuration(parsed.duration);
        if (parsed.details) setDetails(parsed.details);
        if (parsed.techEmail) setTechEmail(parsed.techEmail);
        if (parsed.supervisorEmail) setSupervisorEmail(parsed.supervisorEmail);
        if (parsed.clientEmail) setClientEmail(parsed.clientEmail);
      } catch (e) {
        console.error("Failed to parse act. draft", e);
      }
    }
  }, [isOpen]);

  React.useEffect(() => {
    if (isOpen) {
      const draft = {
        title, type, tech, assistant, selectedResourceId, startDate, startTime, duration, details, techEmail, supervisorEmail, clientEmail
      };
      localStorage.setItem(ACTIVITY_DRAFT_KEY, JSON.stringify(draft));
      setHasChanges(true);
    }
  }, [title, type, tech, assistant, selectedResourceId, startDate, startTime, duration, details, techEmail, supervisorEmail, clientEmail, isOpen]);

  // Fetch available resources from inventory Dexie table
  const availableResources = useLiveQuery(async () => {
    const list = await db.inventory.toArray();
    return list.filter(item => 
      item.cliente_id === activeClientId && 
      item.estado === "disponible" &&
      item.cantidad > 0 &&
      item.sync_status !== "pending_delete"
    );
  }, [activeClientId]) || [];

  // Clients options
  const clientsList = [
    { id: "datacenter", nombre: "DataCenter Santiago" },
    { id: "bme_la_vara", nombre: "BME La Vara" },
    { id: "iquique_port", nombre: "Iquique Port" },
    { id: "clinica_las_condes", nombre: "Clínica Las Condes" },
    { id: "default", nombre: "Cliente General" }
  ];

  const activeClientName = clientsList.find(c => c.id === activeClientId)?.nombre || "Cliente General";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) {
      alert("Por favor ingrese un título para el mantenimiento.");
      return;
    }

    // Capture selected resource details if any
    const selectedResource = availableResources.find(r => r.uuid_sync === selectedResourceId);
    const resourceText = selectedResource ? `${selectedResource.nombre} (${selectedResource.codigo})` : "Ninguno";

    // Format start time correctly
    const [hours, minutes] = startTime.split(":").map(Number);
    const startDateTime = new Date(`${startDate}T${startTime}:00`);
    const endDateTime = new Date(startDateTime.getTime() + Number(duration) * 60000);

    // Google Calendar Template Link Generation Formula (§5)
    // https://calendar.google.com/calendar/render?action=TEMPLATE&text=...&details=...&dates=...&add=...
    const formatGoogleDate = (date: Date) => {
      return date.toISOString().replace(/-|:|\.\d\d\d/g, "");
    };

    const datesParam = `${formatGoogleDate(startDateTime)}/${formatGoogleDate(endDateTime)}`;
    
    const detailsBody = `Mantenimiento HVAC Programado:
------------------------------------------
Tipo: ${type.toUpperCase()}
Personal Técnico: ${tech}
Ayudante: ${assistant}
Recurso Asignado: ${resourceText}
Cliente Asociado: ${activeClientName}
Detalles de operación: ${details}
------------------------------------------
Sincronizado vía AI Studio CMMS Framework.`;

    const gcalUrlTech = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${datesParam}&details=${encodeURIComponent(detailsBody)}&add=${encodeURIComponent(techEmail)}`;
    const gcalUrlSupervisor = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent("[SUPERVISIÓN] " + title)}&dates=${datesParam}&details=${encodeURIComponent(detailsBody)}&add=${encodeURIComponent(supervisorEmail)}`;
    const gcalUrlClient = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent("[AVISO CLIENTE] Mantenimiento: " + title)}&dates=${datesParam}&details=${encodeURIComponent(detailsBody)}&add=${encodeURIComponent(clientEmail)}`;

    const newActivity = {
      id: `ACT-${Date.now()}`,
      title,
      tech,
      assistant,
      vehicle: selectedResource?.categoria === "vehiculos" ? selectedResource.nombre : "Z-105 (Partner)",
      client: activeClientName,
      branch: "Casa Central",
      tag: selectedResource?.codigo || "HVAC-GEN",
      startTime,
      duration,
      status: "programada",
      type,
      guests: [techEmail, supervisorEmail, clientEmail],
      details,
      resourceText,
      techEmail,
      supervisorEmail,
      clientEmail,
      datesParam,
      gcalUrlTech,
      gcalUrlSupervisor,
      gcalUrlClient,
      start: startDateTime,
      end: endDateTime
    };

    localStorage.removeItem(ACTIVITY_DRAFT_KEY);
    onSave(newActivity);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
          >
            {/* Header */}
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-yellow-400" />
                  Agendar Actividad de Mantenimiento
                </h2>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-0.5">Asignación técnica e integración con Google Calendar</p>
              </div>
              <button 
                onClick={handleCloseIntent}
                className="p-1.5 text-slate-400 hover:text-white transition font-bold"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1 pb-24 lg:pb-6">
              
              {/* Title & Type */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-wider block mb-1">Título de la Actividad *</label>
                  <input 
                    type="text" 
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ej: Mant. Preventivo Chiller #02"
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-slate-500 uppercase tracking-wider block mb-1">Clase *</label>
                  <select 
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="preventivo">Preventivo</option>
                    <option value="correctivo">Correctivo</option>
                    <option value="inspeccion">Inspección</option>
                  </select>
                </div>
              </div>

              {/* Assignments: Tech, Assistant & Real Resources from Inventory */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-100 pt-4">
                <div>
                  <label className="text-xs font-black text-slate-500 uppercase tracking-wider block mb-1">Técnico Líder</label>
                  <select 
                    value={tech}
                    onChange={(e) => setTech(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Nelson Bravo">Nelson Bravo (Senior)</option>
                    <option value="Carlos Soto">Carlos Soto (Senior)</option>
                    <option value="Andrés Pérez">Andrés Pérez (Junior)</option>
                    <option value="Mauricio Silva">Mauricio Silva (Supervisor)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-black text-slate-500 uppercase tracking-wider block mb-1">Ayudante Co-asignado</label>
                  <select 
                    value={assistant}
                    onChange={(e) => setAssistant(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Luis Torres">Luis Torres</option>
                    <option value="Juan Maureira">Juan Maureira</option>
                    <option value="Pedro Castillo">Pedro Castillo</option>
                    <option value="Sin Ayudante">Sin Ayudante</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-black text-slate-500 uppercase tracking-wider block mb-1 text-blue-600 flex items-center gap-1">
                    <Package className="w-3.5 h-3.5" />
                    Asignar Recurso Físico
                  </label>
                  <select 
                    value={selectedResourceId}
                    onChange={(e) => setSelectedResourceId(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-blue-100 bg-blue-50/20 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Ninguno / General --</option>
                    {availableResources.map(res => (
                      <option key={res.uuid_sync} value={res.uuid_sync}>
                        [{res.codigo}] {res.nombre} (Stock: {res.cantidad})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Date & Scheduling */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-100 pt-4">
                <div>
                  <label className="text-xs font-black text-slate-500 uppercase tracking-wider block mb-1">Fecha de Inicio</label>
                  <input 
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-slate-500 uppercase tracking-wider block mb-1">Hora Programada</label>
                  <input 
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-slate-500 uppercase tracking-wider block mb-1">Duración (Minutos)</label>
                  <select 
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="60">60 minutos (1 Hr)</option>
                    <option value="120">120 minutos (2 Hrs)</option>
                    <option value="180">180 minutos (3 Hrs)</option>
                    <option value="240">240 minutos (4 Hrs)</option>
                  </select>
                </div>
              </div>

              {/* Tenant context disclaimer */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-start gap-2 text-[11px] text-slate-500 font-medium">
                <AlertCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <p>
                  Esta actividad quedará particionada bajo el ID Único del cliente activo actual: <span className="font-bold text-slate-700">{activeClientName} ({activeClientId})</span>.
                </p>
              </div>

              {/* Notifications / Google Calendar target emails */}
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-blue-500" />
                  Notificaciones e Integración Calendar (Gmail)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Email Técnico Líder</label>
                    <input 
                      type="email"
                      value={techEmail}
                      onChange={(e) => setTechEmail(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Email Supervisor HVAC</label>
                    <input 
                      type="email"
                      value={supervisorEmail}
                      onChange={(e) => setSupervisorEmail(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Email Contacto Cliente</label>
                    <input 
                      type="email"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Details / Scope of work */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-500 uppercase tracking-wider block">Detalles del Trabajo / Pauta</label>
                <textarea 
                  rows={2}
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Instrucciones específicas previas o checklist de mantenimiento..."
                  className="w-full p-3 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Footer Actions */}
              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 mt-6">
                <button 
                  type="button" 
                  onClick={handleCloseIntent}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold uppercase transition"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase transition shadow-md shadow-blue-600/10 flex items-center gap-1.5"
                >
                  <CalendarIcon className="w-4 h-4" />
                  Agendar y Vincular
                </button>
              </div>
            </form>
          </motion.div>
          
          {/* Exit Prompt */}
          {showExitPrompt && (
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
               <div className="bg-white rounded-[32px] w-full max-w-sm p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                 <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <AlertCircle className="w-8 h-8 text-amber-600" />
                 </div>
                 <h3 className="text-xl font-black text-slate-900 text-center mb-3">¿Cerrar sin guardar?</h3>
                 <p className="text-xs text-slate-500 text-center mb-8 px-4">
                    Tienes cambios sin guardar. Si sales ahora, se perderán y el autoguardado será limpiado.
                 </p>
                 <div className="flex flex-col gap-3">
                    <button 
                      onClick={discardChanges}
                      className="w-full py-4 bg-red-50 text-red-600 hover:bg-red-100 font-black uppercase tracking-widest text-xs rounded-2xl transition-all"
                    >
                       Sí, descartar cambios
                    </button>
                    <button 
                      onClick={() => setShowExitPrompt(false)}
                      className="w-full py-4 bg-slate-900 text-white hover:bg-black font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl transition-all"
                    >
                       Continuar Editando
                    </button>
                 </div>
               </div>
            </div>
          )}
        </div>
      )}
    </AnimatePresence>
  );
}
