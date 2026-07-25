import React, { useState, useRef, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { 
  FileText, 
  Save, 
  Send,
  Camera,
  Trash2,
  PenTool,
  UploadCloud,
  ChevronLeft,
  CheckSquare,
  AlertTriangle,
  ClipboardList,
  MapPin,
  Search,
  Maximize,
  CheckCircle2,
  ChevronDown,
  Plus,
  Layout,
  List,
  ClipboardCheck
} from "lucide-react";
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import DictationTextarea from "../components/DictationTextarea";
import LoadingIndicator from "../components/LoadingIndicator";
import { SearchableSelect } from "../components/SearchableSelect";
import { AssetSearchModal } from "../components/modals/AssetSearchModal";
import { FullscreenSignatureModal } from "../components/modals/FullscreenSignatureModal";
import { db } from "../db/database";
import { syncEngine } from "../sync/syncEngine";
import { useAppStore } from "../store/useAppStore";

export interface ChecklistItemData {
  status?: 'ok' | 'obs' | 'falla';
  findings: string;
  photos: string[];
  expanded?: boolean;
}

const OS_CHECKLIST_ITEMS = [
  { key: "inspeccionVisual", label: "Inspección visual general" },
  { key: "limpiezaExterior", label: "Limpieza Exterior" },
  { key: "tomaDatos", label: "Toma de datos de condicion" },
  { key: "revisionFuncionamiento", label: "Revision de funcionamiento" },
  { key: "conexionesElectricas", label: "Conexiones eléctricas" },
  { key: "medicionConsumos", label: "Medición de consumos" },
  { key: "funcionamientoGeneral", label: "Funcionamiento general" }
];

type Section = 'general' | 'checklist' | 'hallazgos' | 'galeria' | 'firma';

export default function EditorOrdenServicio() {
  const [, params] = useRoute<{ id: string }>("/ordenes-servicio/:id");
  const [, setLocation] = useLocation();
  const rawId = params?.id;
  const isNew = rawId === "nuevo";
  const [uuid, setUuid] = useState(isNew ? crypto.randomUUID() : rawId || crypto.randomUUID());
  
  const clients = useAppStore(state => state.clients);
  const branches = useAppStore(state => state.branches);
  const activeClientId = localStorage.getItem("active_client") || "";
  const activeClient = clients.find(c => c.uuid_sync === activeClientId || c.id === activeClientId);

  const OS_DRAFT_KEY = `OS_DRAFT_${uuid}`;

  const handleBack = () => {
    // A new order receives a fresh UUID on every mount, so its draft key
    // cannot be resumed after leaving this screen. Remove the orphaned draft
    // instead of accumulating abandoned QA/user data in localStorage.
    if (isNew) {
      localStorage.removeItem(OS_DRAFT_KEY);
    }
    setLocation("/ordenes-servicio");
  };

  const [activeSection, setActiveSection] = useState<Section>('general');
  const [viewMode, setViewMode] = useState<'normal' | 'industrial'>('industrial');
  const [appLogo] = useState<string | null>(() => localStorage.getItem("system_logo"));
  const [isSyncing, setIsSyncing] = useState(false);
  const [status, setStatus] = useState<'abierto'|'en_progreso'|'completado'|'firmado'|'cerrado'>('abierto');
  const [showFullscreenSignature, setShowFullscreenSignature] = useState(false);
  const [signatureType, setSignatureType] = useState<'tecnico' | 'cliente'>('tecnico');
  const [activePhotoField, setActivePhotoField] = useState<string | null>(null);

  const [ubicacionGeografica, setUbicacionGeografica] = useState<{lat: number, lng: number} | undefined>();
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState("");
  const [showAssetSearch, setShowAssetSearch] = useState(false);

  const captureGPS = () => {
    setGpsLoading(true);
    setGpsError("");
    if (!navigator.geolocation) {
      setGpsError("Tu navegador no soporta geolocalización.");
      setGpsLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUbicacionGeografica({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
        setGpsLoading(false);
      },
      (err) => {
        console.error("GPS error", err);
        setGpsError("No se pudo obtener la ubicación GPS.");
        setGpsLoading(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const canvasTecRef = useRef<HTMLCanvasElement>(null);
  const canvasCliRef = useRef<HTMLCanvasElement>(null);

  const [generalData, setGeneralData] = useState({
    cliente: "",
    sucursal: "",
    edificio: "",
    region: "",
    tecnico: "Nelson Bravo",
    nombreCliente: "",
    fecha: new Date().toISOString().split('T')[0],
    equipoTag: "",
    descripcionEquipo: "",
    tipoServicio: "Preventivo",
    fotoPlaca: "",
  });

  const [checklist, setChecklist] = useState<Record<string, ChecklistItemData>>({
    inspeccionVisual: { findings: "", photos: [] },
    limpiezaExterior: { findings: "", photos: [] },
    tomaDatos: { findings: "", photos: [] },
    revisionFuncionamiento: { findings: "", photos: [] },
    conexionesElectricas: { findings: "", photos: [] },
    medicionConsumos: { findings: "", photos: [] },
    funcionamientoGeneral: { findings: "", photos: [] }
  });

  const [hallazgos, setHallazgos] = useState({
    condicionInicial: "",
    condicionFinal: "",
    observaciones: "",
    conclusiones: "",
    recomendaciones: ""
  });

  const [galeria, setGaleria] = useState<{src: string, desc: string}[]>([]);

  const normalizeChecklist = (rawChecklist: any) => {
    const normalized: Record<string, ChecklistItemData> = {};
    const keys = ['inspeccionVisual', 'limpiezaExterior', 'tomaDatos', 'revisionFuncionamiento', 'conexionesElectricas', 'medicionConsumos', 'funcionamientoGeneral'];
    keys.forEach(k => {
      const rawVal = rawChecklist?.[k];
      if (!rawVal) {
        normalized[k] = { findings: "", photos: [] };
      } else if (typeof rawVal === 'string') {
        let status: 'ok' | 'obs' | 'falla' | undefined = undefined;
        if (rawVal === 'OK') status = 'ok';
        else if (rawVal === 'NOK') status = 'falla';
        else if (rawVal === 'N/A') status = 'obs';
        normalized[k] = { status, findings: "", photos: [] };
      } else {
        normalized[k] = {
          status: rawVal.status,
          findings: rawVal.findings || "",
          photos: rawVal.photos || [],
          expanded: rawVal.expanded || false
        };
      }
    });
    return normalized;
  };

  // Load from local storage draft or DB
  useEffect(() => {
    if (isNew) {
      const saved = localStorage.getItem(OS_DRAFT_KEY);
      if (saved) {
        try {
          const data = JSON.parse(saved);
          if (data.generalData) setGeneralData(data.generalData);
          if (data.checklist) setChecklist(normalizeChecklist(data.checklist));
          if (data.hallazgos) setHallazgos(data.hallazgos);
          if (data.galeria) setGaleria(data.galeria);
          if (data.status) setStatus(data.status);
          if (data.ubicacionGeografica) setUbicacionGeografica(data.ubicacionGeografica);
        } catch (e) {
          console.error("Error parsing OS draft", e);
        }
      } else {
        const activeClient = localStorage.getItem("active_client");
        if (activeClient) {
          setGeneralData(prev => ({ ...prev, cliente: activeClient }));
        }
      }
    } else if (uuid) {
      db.ordenes_servicio.get(uuid).then(existing => {
        if (existing && existing.data) {
          const data = existing.data;
          const orderClient = data.generalData?.cliente || existing.cliente_id;
          if (activeClientId && orderClient && orderClient !== activeClientId && orderClient !== activeClient?.id) {
            alert("Esta orden pertenece a otro cliente. Cambie de cliente desde el selector para abrirla.");
            setLocation("/ordenes-servicio");
            return;
          }
          if (data.generalData) setGeneralData(data.generalData);
          if (data.checklist) setChecklist(normalizeChecklist(data.checklist));
          if (data.hallazgos) setHallazgos(data.hallazgos);
          if (data.galeria) setGaleria(data.galeria);
          if (existing.estado) setStatus(existing.estado as any);
          if (data.ubicacionGeografica) setUbicacionGeografica(data.ubicacionGeografica);
        }
      }).catch(console.error);
    }
  }, [isNew, uuid, activeClientId, activeClient?.id, setLocation]);

  useEffect(() => {
    if (!activeClientId || status === 'firmado' || status === 'cerrado') return;
    setGeneralData(prev => prev.cliente === activeClientId ? prev : {
      ...prev,
      cliente: activeClientId,
      sucursal: prev.cliente && prev.cliente !== activeClientId ? '' : prev.sucursal
    });
  }, [activeClientId, status]);

  // Save to local storage auto
  useEffect(() => {
    if (isNew) {
      const draft = { generalData, checklist, hallazgos, galeria, status, ubicacionGeografica };
      localStorage.setItem(OS_DRAFT_KEY, JSON.stringify(draft));
    }
  }, [generalData, checklist, hallazgos, galeria, status, ubicacionGeografica, isNew]);

  useEffect(() => {
    if (activeSection === 'firma') {
      setupCanvas(canvasTecRef.current);
      setupCanvas(canvasCliRef.current);
    }
  }, [activeSection]);

  const addImageToGallery = async (file: File) => {
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve) => {
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
    const base64 = await base64Promise;
    setGaleria(prev => [...prev, { src: base64, desc: "" }]);
  };

  const generateClimasolPDF = async () => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF('p', 'mm', 'a4');
    
    // Resolve dynamic labels
    const clientName = clients.find(c => c.uuid_sync === generalData.cliente || c.id === generalData.cliente)?.nombre || generalData.cliente || "EECOL ELECTRIC";
    const selectedSuc = branches.find(b => b.uuid_sync === generalData.sucursal || b.id === generalData.sucursal);
    const branchName = selectedSuc?.nombre || generalData.sucursal || "Vitacura Base";
    const branchAddress = selectedSuc?.direccion || "Av. Vitacura 2670, Santiago, Chile";
    const reportFolio = `OS-${uuid.substring(0, 8).toUpperCase()}`;
    const docDate = generalData.fecha || new Date().toLocaleDateString('es-CL');

    // Helper to draw status circle
    const drawStatusCircle = (x: number, y: number, statusItem?: 'ok' | 'obs' | 'falla') => {
      if (statusItem === 'ok') {
        doc.setFillColor(16, 185, 129); // green
        doc.circle(x, y, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(4);
        doc.setFont("helvetica", "bold");
        doc.text("OK", x - 1.2, y + 0.65);
      } else if (statusItem === 'obs') {
        doc.setFillColor(245, 158, 11); // amber
        doc.circle(x, y, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(4);
        doc.setFont("helvetica", "bold");
        doc.text("OB", x - 1.2, y + 0.65);
      } else if (statusItem === 'falla') {
        doc.setFillColor(239, 68, 68); // rose
        doc.circle(x, y, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(4);
        doc.setFont("helvetica", "bold");
        doc.text("NG", x - 1.2, y + 0.65);
      } else {
        doc.setFillColor(226, 232, 240);
        doc.circle(x, y, 2, 'F');
        doc.setTextColor(148, 163, 184);
        doc.setFontSize(4);
        doc.setFont("helvetica", "bold");
        doc.text("NA", x - 1.2, y + 0.65);
      }
    };

    // ----- PAGE 1 -----
    doc.setDrawColor(11, 47, 100);
    doc.setLineWidth(0.5);
    doc.line(10, 24, 200, 24);

    if (appLogo) {
      try {
        let format = "PNG";
        if (appLogo.startsWith("data:image/jpeg") || appLogo.startsWith("data:image/jpg")) {
          format = "JPEG";
        } else if (appLogo.startsWith("data:image/webp")) {
          format = "WEBP";
        }
        doc.addImage(appLogo, format, 13, 8, 10, 10);
      } catch (e) {
        console.error("Error drawing logo to PDF page 1:", e);
        doc.setDrawColor(11, 47, 100);
        doc.setLineWidth(0.6);
        const cx = 18, cy = 14;
        for (let a = 0; a < 360; a += 45) {
          const rad = a * Math.PI / 180;
          doc.line(cx, cy, cx + Math.cos(rad) * 4.5, cy + Math.sin(rad) * 4.5);
        }
      }
    } else {
      doc.setDrawColor(11, 47, 100);
      doc.setLineWidth(0.6);
      const cx = 18, cy = 14;
      for (let a = 0; a < 360; a += 45) {
        const rad = a * Math.PI / 180;
        doc.line(cx, cy, cx + Math.cos(rad) * 4.5, cy + Math.sin(rad) * 4.5);
        const rx = cx + Math.cos(rad) * 3;
        const ry = cy + Math.sin(rad) * 3;
        doc.line(rx, ry, rx + Math.cos(rad + 0.4) * 1.5, ry + Math.sin(rad + 0.4) * 1.5);
        doc.line(rx, ry, rx + Math.cos(rad - 0.4) * 1.5, ry + Math.sin(rad - 0.4) * 1.5);
      }
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(11, 47, 100); // Climasol Blue
    doc.text("CLIMASOL", 26, 13);
    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    doc.text("SOLUCIONES EN CLIMATIZACIÓN", 26, 17);

    // Center Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(11, 47, 100);
    doc.text("ORDEN DE SERVICIO TÉCNICO", 62, 12);
    doc.text("REPORTE DE INTERVENCIÓN", 64, 16);

    // Right Inform Info box
    doc.setFillColor(11, 47, 100);
    doc.roundedRect(150, 6, 50, 14, 1.5, 1.5, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(6.5);
    doc.text("ORDEN DE SERVICIO", 158, 10);
    doc.setFontSize(7.5);
    doc.text(reportFolio, 158, 14);

    doc.setFillColor(241, 245, 249);
    doc.rect(150, 20, 50, 5, 'F');
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(6);
    doc.text("FECHA:", 154, 23.5);
    doc.setFontSize(7);
    doc.setTextColor(11, 47, 100);
    doc.text(docDate, 172, 23.5);

    // --- SECTION 1: INFORMACIÓN GENERAL ---
    let y = 29;
    doc.setFillColor(11, 47, 100);
    doc.roundedRect(10, y, 70, 5.5, 1, 1, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7.5);
    doc.text("1. INFORMACIÓN GENERAL", 14, y + 4);

    y += 7.5;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.setFillColor(255, 255, 255);
    doc.rect(10, y, 190, 29, "D");

    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.setFont("helvetica", "bold");
    doc.text("Cliente / Instalación:", 14, y + 5);
    doc.text("Sucursal / Dirección:", 14, y + 10);
    doc.text("Edificio / Sector:", 14, y + 15);
    doc.text("Región:", 14, y + 20);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    doc.text(clientName, 42, y + 5);
    const splitAddr = doc.splitTextToSize(branchAddress, 50);
    doc.text(splitAddr, 42, y + 10);
    doc.text(generalData.edificio || "—", 42, y + 15);
    doc.text(generalData.region || "—", 42, y + 20);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(71, 85, 105);
    doc.text("Técnico responsable:", 100, y + 5);
    doc.text("Contacto cliente:", 100, y + 10);
    doc.text("Equipo (TAG):", 100, y + 15);
    doc.text("Descripción equipo:", 100, y + 20);
    doc.text("Tipo de Servicio:", 100, y + 25);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    doc.text(generalData.tecnico || "—", 130, y + 5);
    doc.text(generalData.nombreCliente || "—", 130, y + 10);
    doc.text(generalData.equipoTag || "—", 130, y + 15);
    
    const splitDesc = doc.splitTextToSize(generalData.descripcionEquipo || "—", generalData.fotoPlaca ? 30 : 65);
    doc.text(splitDesc, 130, y + 20);
    doc.text(generalData.tipoServicio || "—", 130, y + 25);

    if (generalData.fotoPlaca) {
      // Draw vertical divider in Section 1 box
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(163, y, 163, y + 29);

      try {
        let format = "JPEG";
        if (generalData.fotoPlaca.startsWith("data:image/png")) format = "PNG";
        doc.addImage(generalData.fotoPlaca, format, 165, y + 1.5, 33, 22);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(4);
        doc.setTextColor(100, 116, 139);
        doc.text("PLACA CARACTERÍSTICAS", 166, y + 26.5);
      } catch (err) {
        console.error("PDF plate render error:", err);
      }
    }

    // --- SECTION 2: CHECKLIST DE INTERVENCIÓN ---
    y += 33;
    doc.setFillColor(11, 47, 100);
    doc.roundedRect(10, y, 190, 5.5, 1, 1, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.text("2. CHECKLIST DE INTERVENCIÓN Y PRUEBAS", 14, y + 4);

    y += 7.5;
    doc.setDrawColor(226, 232, 240);
    doc.rect(10, y, 190, 75, "D");

    doc.setFillColor(241, 245, 249);
    doc.rect(10, y, 190, 5, "F");
    doc.setTextColor(11, 47, 100);
    doc.setFontSize(7);
    doc.text("ACTIVIDAD / TAREA TÉCNICA", 14, y + 3.5);
    doc.text("ESTADO", 175, y + 3.5);

    y += 5;
    doc.setFontSize(6.5);
    doc.setTextColor(30, 41, 59);

    const items = OS_CHECKLIST_ITEMS;
    items.forEach((item, idx) => {
      const cyLocal = y + 4.5 + (idx * 9);
      doc.setFont("helvetica", "bold");
      doc.text(`${idx + 1}. ${item.label}`, 14, cyLocal + 1);
      
      const details = checklist[item.key]?.findings;
      if (details) {
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.text(`— Obs: ${details}`, 14, cyLocal + 4.5);
        doc.setTextColor(30, 41, 59);
      }
      
      drawStatusCircle(181, cyLocal + 1.5, checklist[item.key]?.status);
      
      doc.setDrawColor(241, 245, 249);
      doc.setLineWidth(0.2);
      doc.line(10, cyLocal + 7.5, 200, cyLocal + 7.5);
    });

    // --- FOOTER PAGE 1 ---
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(6);
    doc.text(`Uso Técnico Oficial CLIMASOL - Folio ${reportFolio}`, 10, 287);
    doc.text("Página 1 de 2", 185, 287);

    // ----- PAGE 2 -----
    doc.addPage();
    doc.setDrawColor(11, 47, 100);
    doc.setLineWidth(0.4);
    doc.line(10, 21, 200, 21);

    if (appLogo) {
      try {
        let format = "PNG";
        if (appLogo.startsWith("data:image/jpeg") || appLogo.startsWith("data:image/jpg")) {
          format = "JPEG";
        } else if (appLogo.startsWith("data:image/webp")) {
          format = "WEBP";
        }
        doc.addImage(appLogo, format, 15, 9, 6, 6);
      } catch (e) {
        console.error("Error drawing logo to PDF page 2:", e);
        doc.setDrawColor(11, 47, 100);
        doc.setLineWidth(0.5);
        doc.line(15, 12, 21, 12);
      }
    } else {
      doc.setDrawColor(11, 47, 100);
      doc.setLineWidth(0.5);
      for (let a = 0; a < 360; a += 45) {
        const rad = a * Math.PI / 180;
        doc.line(18, 12, 18 + Math.cos(rad) * 3, 12 + Math.sin(rad) * 3);
      }
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(11, 47, 100);
    doc.text("CLIMASOL", 24, 13);
    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    doc.text("REPORTE COMPLEMENTARIO", 24, 16.5);

    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`ORDEN DE SERVICIO N°: ${reportFolio}`, 130, 15);

    // --- SECTION 3: RECOMENDACIONES Y DIAGNÓSTICO ---
    y = 26;
    doc.setFillColor(11, 47, 100);
    doc.roundedRect(10, y, 190, 5.5, 1, 1, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7.5);
    doc.text("3. HALLAZGOS Y DIRECCIÓN TÉCNICA", 14, y + 4);

    y += 7.5;
    doc.setDrawColor(226, 232, 240);
    doc.rect(10, y, 190, 48, "D");

    doc.setFontSize(7);
    doc.setTextColor(11, 47, 100);
    doc.setFont("helvetica", "bold");
    doc.text("CONDICIÓN INICIAL DE INGRESO:", 14, y + 5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 65, 85);
    const condInit = doc.splitTextToSize(hallazgos.condicionInicial || "Se ingresa equipo para intervención protocolar. Estado inicial reporta desempeño parcial.", 182);
    doc.text(condInit, 14, y + 9);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(11, 47, 100);
    doc.text("CONDICIÓN FINAL DE ENTREGA Y OPERACIÓN:", 14, y + 18);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 65, 85);
    const condFin = doc.splitTextToSize(hallazgos.condicionFinal || "Equipo queda verificado, con parámetros termodinámicos estabilizados y flujos de aire óptimos.", 182);
    doc.text(condFin, 14, y + 22);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(11, 47, 100);
    doc.text("DIAGNÓSTICO Y CONCLUSIONES:", 14, y + 31);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 65, 85);
    const concl = doc.splitTextToSize(hallazgos.conclusiones || "Intervención ejecutada con éxito. Cumplimiento de pauta de mantenimiento sin observaciones restrictivas.", 182);
    doc.text(concl, 14, y + 35);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(11, 47, 100);
    doc.text("RECOMENDACIONES:", 14, y + 41);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 65, 85);
    const recom = doc.splitTextToSize(hallazgos.recomendaciones || "Monitorear flujos periódicamente y mantener despejada ventilación periférica.", 182);
    doc.text(recom, 14, y + 45);

    // --- SECTION 4: EVOLUCIÓN FOTOGRÁFICA DE CAMPO ---
    y += 53;
    doc.setFillColor(11, 47, 100);
    doc.roundedRect(10, y, 190, 5.5, 1, 1, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.text("4. REGISTRO FOTOGRÁFICO DE INTERVENCIÓN", 14, y + 4);

    y += 7.5;
    for (let i = 0; i < 4; i++) {
      const item = galeria[i];
      const px = 10 + (i * 47);
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(px, y, 44, 34, 1.5, 1.5, "DF");
      
      if (item && item.src) {
        try {
          let format = "JPEG";
          if (item.src.startsWith("data:image/png")) format = "PNG";
          doc.addImage(item.src, format, px + 1, y + 1, 42, 26);
          
          doc.setFillColor(0, 0, 0, 0.6);
          doc.rect(px + 1, y + 27, 42, 6, "F");
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(5);
          doc.text(item.desc ? item.desc.substring(0, 32) : `Evidencia ${i + 1}`, px + 2, y + 31);
        } catch (err) {
          console.error("Gallery img err:", err);
        }
      } else {
        doc.setFontSize(6);
        doc.setTextColor(203, 213, 225);
        doc.text("SIN REGISTRO", px + 12, y + 18);
      }
    }

    // --- SECTION 5: CONFORMIDAD Y FIRMAS ---
    y += 39;
    doc.setFillColor(11, 47, 100);
    doc.roundedRect(10, y, 190, 5.5, 1, 1, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7.5);
    doc.text("5. PROTOCOLO DE CONFORMIDAD Y VALIDACIÓN", 14, y + 4);

    y += 7.5;
    // Técnico
    doc.setDrawColor(241, 245, 249);
    doc.setFillColor(248, 250, 252);
    doc.rect(10, y, 92, 35, "DF");
    doc.setDrawColor(226, 232, 240);
    doc.rect(14, y + 3, 84, 20);

    const sigTec = canvasTecRef.current?.toDataURL();
    if (sigTec) {
      try {
        doc.addImage(sigTec, "PNG", 15, y + 4, 82, 18);
      } catch (err) {
        console.warn("Firma tec error:", err);
      }
    } else {
      doc.setFontSize(6);
      doc.setTextColor(148, 163, 184);
      doc.text("REPORTE DIGITAL SIN FIRMA TÉCNICA", 28, y + 13);
    }
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.text(`Técnico de Servicio: ${generalData.tecnico || "Nelson Bravo"}`, 14, y + 27);
    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    doc.text("VALIDADOR E INTERVENTOR AUTORIZADO", 14, y + 31);

    // Cliente
    doc.setDrawColor(241, 245, 249);
    doc.setFillColor(248, 250, 252);
    doc.rect(108, y, 92, 35, "DF");
    doc.setDrawColor(226, 232, 240);
    doc.rect(112, y + 3, 84, 20);

    const sigCli = canvasCliRef.current?.toDataURL();
    if (sigCli) {
      try {
        doc.addImage(sigCli, "PNG", 113, y + 4, 82, 18);
      } catch (err) {
        console.warn("Firma cli error:", err);
      }
    } else {
      doc.setFontSize(6);
      doc.setTextColor(148, 163, 184);
      doc.text("REPORTE DIGITAL SIN CONTROL CLIENTE", 126, y + 13);
    }
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.text(`Cliente Receptor: ${generalData.nombreCliente || "—"}`, 112, y + 27);
    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    doc.text("APROBACIÓN DE EJECUCIÓN Y RECEPCIÓN", 112, y + 31);

    // Footer
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(6);
    doc.text(`Uso Técnico Oficial CLIMASOL - Folio ${reportFolio}`, 10, 287);
    doc.text("Página 2 de 2", 185, 287);

    return doc;
  };

  const handleSyncAndFinalize = async () => {
    setIsSyncing(true);

    if (!generalData.cliente || !generalData.sucursal || !generalData.equipoTag?.trim()) {
      alert("Error: Seleccione cliente, sucursal y un equipo antes de finalizar la orden.");
      setIsSyncing(false);
      return;
    }

    const selectedAsset = await db.assets.where('tag').equals(generalData.equipoTag.trim()).first();
    const validClientIds = new Set(
      [generalData.cliente, activeClient?.id, activeClient?.uuid_sync].filter(Boolean)
    );
    if (
      !selectedAsset
      || selectedAsset.deleted_at
      || selectedAsset.estado === 'baja'
      || !validClientIds.has(selectedAsset.cliente_id)
    ) {
      alert("Error: El equipo no existe, está dado de baja o pertenece a otro cliente.");
      setIsSyncing(false);
      return;
    }

    const isCanvasEmpty = (canvas: HTMLCanvasElement | null) => {
      if (!canvas) return true;
      const blank = document.createElement('canvas');
      blank.width = canvas.width;
      blank.height = canvas.height;
      return canvas.toDataURL() === blank.toDataURL();
    };

    if (isCanvasEmpty(canvasTecRef.current)) {
      alert("Error: No es posible finalizar: falta la firma del técnico.");
      setIsSyncing(false);
      return;
    }

    if (isCanvasEmpty(canvasCliRef.current)) {
      alert("Error: No es posible finalizar: falta la firma del cliente.");
      setIsSyncing(false);
      return;
    }

    const dataPayload = {
      generalData,
      checklist,
      hallazgos,
      galeria,
      ubicacionGeografica,
      status: 'firmado',
      estadoHistorial: [
        { estado: 'abierto', at: new Date().toISOString() },
        { estado: 'en_progreso', at: new Date().toISOString() },
        { estado: 'completado', at: new Date().toISOString() },
        { estado: 'firmado', at: new Date().toISOString() }
      ],
      firmas: {
        tecnico: canvasTecRef.current?.toDataURL() || '',
        cliente: canvasCliRef.current?.toDataURL() || ''
      },
      fechaSincronizacionLocal: new Date().toISOString()
    };

    // 1. Guardado Local en Dexie
    const record = {
      uuid_sync: uuid,
      id: rawId && rawId !== 'nuevo' ? rawId : `OS-${Date.now()}`,
      draft_key: OS_DRAFT_KEY,
      estado: 'firmado',
      cliente_id: generalData.cliente,
      sync_status: 'pending_insert' as const,
      updated_at: Date.now(),
      data: dataPayload
    };

    try {
      if (isNew) {
        await db.ordenes_servicio.put(record);
        await db.sync_queue.add({
          table: 'ordenes_servicio',
          uuid_sync: uuid,
          operation: 'insert',
          timestamp: Date.now(),
          data: record
        });
      } else {
        const existing = await db.ordenes_servicio.get(uuid);
        await db.ordenes_servicio.put({ ...existing, ...record, sync_status: 'pending_update' });
        await db.sync_queue.add({
          table: 'ordenes_servicio',
          uuid_sync: uuid,
          operation: 'update',
          timestamp: Date.now(),
          data: { ...existing, ...record }
        });
      }

      // Triggers background sync to Neon
      syncEngine.triggerSync().catch(console.error);

      setStatus('firmado');
      localStorage.removeItem(OS_DRAFT_KEY);
      
      // Export PDF via Email Automáticamente
      try {
        const doc = await generateClimasolPDF();
        const pdfBase64 = doc.output('datauristring');
        const { DocumentExportService } = await import('../lib/DocumentExportService');
        const exportResult = await DocumentExportService.exportDocument({
          documentId: record.id,
          documentType: 'work_order', 
          method: 'email',
          clientId: dataPayload.generalData.cliente, // We have the clientId saved here hopefully
          pdfBase64
        });
        alert(`Orden de Servicio guardada y firmada exitosamente.\n${exportResult.message}`);
      } catch (exportError: any) {
         console.warn("Export fallido", exportError);
         alert("Orden de Servicio guardada exitosamente.\nLa notificación por correo no está disponible en este entorno.");
      }

      setLocation("/ordenes-servicio");
    } catch (error) {
      console.error("Error saving OS:", error);
      alert("Hubo un error guardando localmente.");
    } finally {
      setIsSyncing(false);
    }
  };

  const menu: { id: Section, label: string, icon: any }[] = [
    { id: 'general', label: 'Inf. General', icon: <FileText className="w-4 h-4" /> },
    { id: 'checklist', label: 'Checklist', icon: <CheckSquare className="w-4 h-4" /> },
    { id: 'hallazgos', label: 'Hallazgos', icon: <ClipboardList className="w-4 h-4" /> },
    { id: 'galeria', label: 'Evidencia', icon: <Camera className="w-4 h-4" /> },
    { id: 'firma', label: 'Firmas', icon: <PenTool className="w-4 h-4" /> }
  ];

  const handleGeneralChange = (field: string, value: string) => {
    setGeneralData(prev => ({ ...prev, [field]: value }));
  };

  const handleChecklistChange = (field: string, value: ChecklistItemData) => {
    setChecklist(prev => ({ ...prev, [field]: value }));
  };

  const handleHallazgosChange = (field: string, value: string) => {
    setHallazgos(prev => ({ ...prev, [field]: value }));
  };

  const isReadOnly = status === 'firmado' || status === 'cerrado';

  const renderSection = () => {
    switch (activeSection) {
      case 'general':
        return (
          <SectionBox title="Información General del Servicio">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div>
                  <label className="text-[10px] font-black uppercase text-slate-400">Cliente / Instalación</label>
                  <SearchableSelect
                    options={[
                      ...(activeClient ? [{
                        value: activeClient.uuid_sync,
                        label: activeClient.nombre
                      }] : [])
                    ]}
                    value={activeClient?.uuid_sync || activeClientId}
                    onChange={() => undefined}
                    disabled
                    placeholder="Cliente seleccionado en la sesión"
                  />
               </div>
               <div>
                  <label className="text-[10px] font-black uppercase text-slate-400">Sucursal / Proyecto</label>
                  <SearchableSelect
                    options={[
                      { value: "", label: "Seleccione una sucursal..." },
                      ...branches
                        .filter(b => b.cliente_id === generalData.cliente && !b.deleted_at)
                        .map(b => ({
                          value: b.uuid_sync,
                          label: b.nombre,
                          subtitle: b.codigo
                        }))
                    ]}
                    value={generalData.sucursal}
                    onChange={val => {
                      const selectedSuc = branches.find(b => b.uuid_sync === val);
                      const regionVal = selectedSuc?.region || '';
                      handleGeneralChange('sucursal', val);
                      handleGeneralChange('region', regionVal);
                    }}
                    disabled={isReadOnly || !generalData.cliente}
                    placeholder="Seleccione una sucursal..."
                  />
               </div>
               <div>
                  <label className="text-[10px] font-black uppercase text-slate-400">Edificio, Planta, Sector</label>
                  <input type="text" value={generalData.edificio} onChange={e => handleGeneralChange('edificio', e.target.value)} disabled={isReadOnly} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold mt-1 outline-none focus:ring-2 focus:ring-blue-500/20" />
               </div>
               <div>
                  <label className="text-[10px] font-black uppercase text-slate-400">Región</label>
                  <input type="text" value={generalData.region} onChange={e => handleGeneralChange('region', e.target.value)} disabled={isReadOnly} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold mt-1 outline-none focus:ring-2 focus:ring-blue-500/20" />
               </div>
               <div>
                  <label className="text-[10px] font-black uppercase text-slate-400">Técnico Responsable</label>
                  <input type="text" value={generalData.tecnico} onChange={e => handleGeneralChange('tecnico', e.target.value)} disabled={isReadOnly} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold mt-1 outline-none focus:ring-2 focus:ring-blue-500/20" />
               </div>
               <div>
                  <label className="text-[10px] font-black uppercase text-slate-400">Nombre Cliente</label>
                  <input type="text" value={generalData.nombreCliente} onChange={e => handleGeneralChange('nombreCliente', e.target.value)} disabled={isReadOnly} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold mt-1 outline-none focus:ring-2 focus:ring-blue-500/20" />
               </div>
               <div>
                  <label className="text-[10px] font-black uppercase text-slate-400">Fecha del Servicio</label>
                  <input type="date" value={generalData.fecha} onChange={e => handleGeneralChange('fecha', e.target.value)} disabled={isReadOnly} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold mt-1 outline-none focus:ring-2 focus:ring-blue-500/20" />
               </div>
               <div>
                  <label className="text-[10px] font-black uppercase text-slate-400">Equipo (TAG)</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input 
                      type="text" 
                      value={generalData.equipoTag} 
                      onChange={e => handleGeneralChange('equipoTag', e.target.value)} 
                      disabled={isReadOnly} 
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20" 
                      placeholder="Ej. 21-STK.AC.001"
                    />
                    {!isReadOnly && (
                      <button 
                        type="button" 
                        onClick={() => setShowAssetSearch(true)}
                        className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 hover:bg-blue-100 transition-colors"
                        title="Buscar Equipo"
                      >
                        <Search className="w-5 h-5" />
                      </button>
                    )}
                  </div>
               </div>
               <div>
                  <label className="text-[10px] font-black uppercase text-slate-400">Descripción Equipo</label>
                  <input type="text" value={generalData.descripcionEquipo} onChange={e => handleGeneralChange('descripcionEquipo', e.target.value)} disabled={isReadOnly} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold mt-1 outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
                <div className="md:col-span-2 bg-[#F8FAFC] border-2 border-dashed border-[#E2E8F0] hover:border-[#CBD5E1] transition-colors rounded-3xl p-6 mt-2">
                   <div className="flex flex-col md:flex-row gap-6 items-center">
                     <div className="shrink-0 flex flex-col items-center">
                       {generalData.fotoPlaca ? (
                         <div className="relative group w-32 h-32 rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-md flex items-center justify-center">
                           <img src={generalData.fotoPlaca} className="w-full h-full object-cover" alt="Placa de Características" referrerPolicy="no-referrer" />
                           {!isReadOnly && (
                             <button
                               type="button"
                               onClick={() => handleGeneralChange('fotoPlaca', '')}
                               className="absolute inset-0 bg-rose-600/90 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-black uppercase tracking-wider gap-1 cursor-pointer"
                             >
                               <Trash2 className="w-5 h-5" />
                               <span>Eliminar</span>
                             </button>
                           )}
                         </div>
                       ) : (
                         <button
                           type="button"
                           disabled={isReadOnly}
                           onClick={() => document.getElementById('nameplate_photo_input')?.click()}
                           className="flex flex-col items-center justify-center w-32 h-32 rounded-2xl border-2 border-dashed border-slate-300 bg-white text-slate-500 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-600 transition-all gap-2 group cursor-pointer"
                         >
                           <Camera className="w-6 h-6 text-slate-400 group-hover:text-blue-600 transition-colors" />
                           <span className="text-[9px] font-black uppercase tracking-wider text-center">Capturar Placa</span>
                         </button>
                       )}
                       <input
                         id="nameplate_photo_input"
                         type="file"
                         accept="image/*"
                         className="hidden"
                         disabled={isReadOnly}
                         onChange={async (e) => {
                           const file = e.target.files?.[0];
                           if (!file) return;
                           const reader = new FileReader();
                           const base64Promise = new Promise<string>((resolve) => {
                             reader.onload = () => resolve(reader.result as string);
                             reader.readAsDataURL(file);
                           });
                           const base64 = await base64Promise;
                           handleGeneralChange('fotoPlaca', base64);
                         }}
                       />
                     </div>
                     <div className="flex-1 text-center md:text-left space-y-1">
                       <h4 className="text-xs font-black text-[#0B2F64] uppercase tracking-wider">Foto de la Placa de Características</h4>
                       <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                         Registre fotográficamente la chapa de especificaciones técnicas del equipo. Esta información es fundamental para auditorías, repuestos y control de garantías de climatización oficiales de Climasol.
                       </p>
                       <div className="flex flex-wrap gap-2 pt-2 justify-center md:justify-start">
                         <span className="text-[9px] font-extrabold bg-[#E2E8F0] text-slate-600 px-2 py-0.5 rounded-full uppercase tracking-wider">Altamente Recomendado</span>
                         <span className="text-[9px] font-extrabold bg-blue-50 text-[#0B2F64] px-2 py-0.5 rounded-full uppercase tracking-wider font-mono">JPG / PNG</span>
                       </div>
                     </div>
                   </div>
                </div>
               <div className="md:col-span-2">
                  <label className="text-[10px] font-black uppercase text-slate-400">Tipo de Servicio</label>
                  <select value={generalData.tipoServicio} onChange={e => handleGeneralChange('tipoServicio', e.target.value)} disabled={isReadOnly} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold mt-1 outline-none focus:ring-2 focus:ring-blue-500/20">
                     <option value="Preventivo">Preventivo</option>
                     <option value="Correctivo">Correctivo</option>
                     <option value="Instalación">Instalación</option>
                     <option value="Diagnóstico">Diagnóstico</option>
                     <option value="Mejora">Mejora</option>
                     <option value="Emergencia">Emergencia</option>
                  </select>
               </div>
            </div>

            <div className="mt-6 flex flex-col gap-4">
              {!isReadOnly && (
                <button 
                  type="button" 
                  onClick={captureGPS}
                  disabled={gpsLoading}
                  className="w-full py-4 bg-slate-50 text-slate-400 rounded-[24px] border border-slate-100 flex flex-col items-center justify-center gap-2 hover:bg-emerald-50 hover:text-emerald-600 transition-all group hover:border-emerald-100"
                >
                    <MapPin className={`w-6 h-6 ${gpsLoading ? 'animate-pulse text-emerald-500' : (ubicacionGeografica ? 'text-emerald-500' : '')}`} />
                    <span className="text-[9px] font-black uppercase">
                      {gpsLoading ? 'Obteniendo GPS...' : (ubicacionGeografica ? 'Ubicación Capturada' : 'Marcar Ubicación GPS')}
                    </span>
                </button>
              )}
              {gpsError && (
                <p className="text-xs text-rose-500 font-bold text-center">{gpsError}</p>
              )}
              {ubicacionGeografica && import.meta.env.VITE_GOOGLE_MAPS_PLATFORM_KEY && (
                <div className="w-full h-64 rounded-2xl overflow-hidden border border-slate-200 mt-2">
                  <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_PLATFORM_KEY}>
                    <Map 
                      defaultZoom={15} 
                      defaultCenter={ubicacionGeografica}
                      mapId="os_map_id"
                      disableDefaultUI
                    >
                      <AdvancedMarker position={ubicacionGeografica}>
                        <Pin background={'#10b981'} borderColor={'#047857'} glyphColor={'#047857'} />
                      </AdvancedMarker>
                    </Map>
                  </APIProvider>
                </div>
              )}
            </div>
          </SectionBox>
        );
      case 'checklist':
        return (
          <SectionBox title="Checklist de Inspección">
             <div className="space-y-4">
                {OS_CHECKLIST_ITEMS.map((item) => {
                  const key = item.key;
                  const currentItem = checklist[key] || { findings: '', photos: [] };
                  return (
                    <div key={key} className="space-y-2">
                      <div className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group transition-all hover:bg-slate-100 gap-4">
                         <div className="flex flex-col xl:flex-row xl:items-center gap-4 flex-1">
                            <span className="text-xs font-black uppercase text-slate-700 min-w-[200px]">{item.label}</span>
                            <div className="flex flex-wrap items-center gap-1.5">
                               <button 
                                 type="button"
                                 disabled={isReadOnly}
                                 onClick={() => setChecklist({...checklist, [key]: {...currentItem, status: 'ok'}})}
                                 className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all border ${
                                   currentItem.status === 'ok' 
                                     ? 'bg-emerald-500 text-white border-emerald-600 shadow-md shadow-emerald-500/20' 
                                     : 'bg-white text-slate-400 border-slate-200 hover:border-emerald-300 hover:text-emerald-500'
                                 }`}
                               >
                                 Ok
                               </button>
                               <button 
                                 type="button"
                                 disabled={isReadOnly}
                                 onClick={() => setChecklist({...checklist, [key]: {...currentItem, status: 'obs', expanded: true}})}
                                 className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all border ${
                                   currentItem.status === 'obs' 
                                     ? 'bg-amber-500 text-white border-amber-600 shadow-md shadow-amber-500/20' 
                                     : 'bg-white text-slate-400 border-slate-200 hover:border-amber-300 hover:text-amber-500'
                                 }`}
                               >
                                 Observación
                               </button>
                               <button 
                                 type="button"
                                 disabled={isReadOnly}
                                 onClick={() => setChecklist({...checklist, [key]: {...currentItem, status: 'falla', expanded: true}})}
                                 className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all border ${
                                   currentItem.status === 'falla' 
                                     ? 'bg-rose-500 text-white border-rose-600 shadow-md shadow-rose-500/20' 
                                     : 'bg-white text-slate-400 border-slate-200 hover:border-rose-300 hover:text-rose-500'
                                 }`}
                               >
                                 Falla
                               </button>
                            </div>
                         </div>
                         <button type="button" onClick={() => setChecklist({...checklist, [key]: {...currentItem, expanded: !currentItem.expanded}})} className="p-2 w-full md:w-auto hover:bg-white rounded-xl transition-all shadow-sm md:ml-4 flex justify-center">
                            <ChevronDown className={`w-4 h-4 transition-transform duration-300 text-slate-400 ${currentItem.expanded ? 'rotate-180 text-blue-600' : ''}`} />
                         </button>
                      </div>
                      {currentItem.expanded && (
                        <div className="p-4 md:p-6 bg-white border border-slate-100 rounded-3xl mx-2 shadow-inner space-y-4 animate-in slide-in-from-top-2 duration-200">
                           <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase text-blue-600 tracking-widest">Hallazgos y Observaciones</label>
                              <DictationTextarea 
                                value={currentItem.findings || ''}
                                onChange={(v) => setChecklist({...checklist, [key]: {...currentItem, findings: v}})}
                                placeholder="Detalle el estado o anomalía detectada..."
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 pr-12 text-slate-800" 
                                rows={3} 
                                disabled={isReadOnly}
                              />
                           </div>
                           <div>
                              <label className="text-[10px] font-black uppercase text-blue-600 tracking-widest block mb-2">Evidencias Focalizadas</label>
                              <div className="flex flex-wrap gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                 {currentItem.photos?.map((img, picIdx) => (
                                   <div key={picIdx} className="w-20 h-20 bg-slate-50 border border-slate-100 rounded-2xl overflow-hidden relative group shrink-0">
                                      <img src={img} alt={`Focalizada ${picIdx}`} className="w-full h-full object-cover" />
                                      {!isReadOnly && (
                                        <button 
                                          type="button"
                                          onClick={() => {
                                            const updatedPhotos = currentItem.photos.filter((_, pIdx) => pIdx !== picIdx);
                                            setChecklist({ ...checklist, [key]: { ...currentItem, photos: updatedPhotos } });
                                          }}
                                          className="absolute inset-0 bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      )}
                                   </div>
                                 ))}
                                 {!isReadOnly && (
                                    <button 
                                      type="button"
                                      onClick={() => {
                                        setActivePhotoField(key);
                                        setTimeout(() => {
                                          document.getElementById('checklist_photo_input')?.click();
                                        }, 50);
                                      }}
                                      className="min-w-[80px] h-20 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors"
                                    >
                                       <Plus className="w-4 h-4" />
                                       <span className="text-[9px] font-black uppercase mt-1">Cámara</span>
                                    </button>
                                 )}
                              </div>
                           </div>
                        </div>
                      )}
                    </div>
                  );
                })}
             </div>
             <input 
               id="checklist_photo_input" 
               type="file" 
               accept="image/*" 
               className="hidden" 
               onChange={async (e) => {
                 const file = e.target.files?.[0];
                 if (!file || !activePhotoField) return;
                 const reader = new FileReader();
                 const base64Promise = new Promise<string>((resolve) => {
                   reader.onload = () => resolve(reader.result as string);
                   reader.readAsDataURL(file);
                 });
                 const base64 = await base64Promise;
                 
                 setChecklist(prev => {
                   const item = prev[activePhotoField] || { findings: "", photos: [] };
                   return {
                     ...prev,
                     [activePhotoField]: {
                       ...item,
                       photos: [...(item.photos || []), base64]
                     }
                   };
                 });
                 e.target.value = '';
               }} 
             />
          </SectionBox>
        );
      case 'hallazgos':
        return (
          <SectionBox title="Resumen de Hallazgos">
            <div className="space-y-4">
              <div>
                 <label className="text-[10px] font-black uppercase text-slate-400">Condicion inicial / Final</label>
                 <DictationTextarea rows={3} value={hallazgos.condicionInicial} onChange={v => handleHallazgosChange('condicionInicial', v)} disabled={isReadOnly} />
              </div>
              <div>
                 <label className="text-[10px] font-black uppercase text-slate-400">Observaciones</label>
                 <DictationTextarea rows={3} value={hallazgos.observaciones} onChange={v => handleHallazgosChange('observaciones', v)} disabled={isReadOnly} />
              </div>
              <div>
                 <label className="text-[10px] font-black uppercase text-slate-400">Conclusiones</label>
                 <DictationTextarea rows={3} value={hallazgos.conclusiones} onChange={v => handleHallazgosChange('conclusiones', v)} disabled={isReadOnly} />
              </div>
              <div>
                 <label className="text-[10px] font-black uppercase text-slate-400">Recomendaciones</label>
                 <DictationTextarea rows={3} value={hallazgos.recomendaciones} onChange={v => handleHallazgosChange('recomendaciones', v)} disabled={isReadOnly} />
              </div>
            </div>
          </SectionBox>
        );
      case 'galeria':
        return (
          <SectionBox title="Evidencia Fotográfica">
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {galeria.map((img, i) => (
                  <div key={i} className="flex flex-col gap-2">
                    <div className="aspect-square bg-slate-50 border border-slate-100 rounded-3xl overflow-hidden relative group">
                       <img src={img.src} alt={`Evidencia ${i}`} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                       {!isReadOnly && (
                         <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                            <button onClick={() => setGaleria(galeria.filter((_, idx) => idx !== i))} className="p-2 bg-red-500 text-white rounded-xl"><Trash2 className="w-4 h-4" /></button>
                         </div>
                       )}
                    </div>
                    {!isReadOnly ? (
                      <input 
                        type="text" 
                        value={img.desc}
                        onChange={(e) => {
                           const newGaleria = [...galeria];
                           newGaleria[i].desc = e.target.value;
                           setGaleria(newGaleria);
                        }}
                        placeholder="Descripción de la imagen..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500/10 placeholder:text-slate-400"
                      />
                    ) : (
                      <p className="text-xs text-slate-600 font-medium px-2 text-center">{img.desc || "Sin descripción"}</p>
                    )}
                  </div>
                ))}
                {!isReadOnly && (
                   <button 
                     onClick={() => document.getElementById('gallery_input')?.click()}
                     className="aspect-square border-2 border-dashed border-slate-300 rounded-3xl flex flex-col items-center justify-center text-slate-400 hover:text-blue-500 hover:border-blue-500 hover:bg-blue-50/50 transition-all cursor-pointer"
                   >
                      <UploadCloud className="w-8 h-8 mb-2" />
                      <span className="text-xs font-bold uppercase">Añadir Foto</span>
                   </button>
                )}
             </div>
             <input id="gallery_input" type="file" multiple accept="image/*" className="hidden" onChange={(e) => {
               const files = Array.from(e.target.files || []);
               files.forEach(addImageToGallery);
             }} />
          </SectionBox>
        );
      case 'firma':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-8">
               <SectionBox title="Firma Técnica de Ejecución">
                  <div className="space-y-4">
                     <canvas ref={canvasTecRef} className="w-full h-48 bg-slate-50 border border-slate-200 rounded-3xl touch-none shadow-inner" />
                     <div className="flex justify-between items-center mt-2">
                        <div className="flex items-center gap-2">
                           <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                           <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{generalData.tecnico}</span>
                        </div>
                        <div className="flex gap-2">
                           {!isReadOnly && (
                             <button className="text-[10px] font-black uppercase text-blue-500 hover:text-blue-600 transition-colors bg-blue-50 px-3 py-1.5 rounded-lg flex items-center gap-1" onClick={() => {
                                 setSignatureType('tecnico');
                                 setShowFullscreenSignature(true);
                             }}>
                                <Maximize className="w-3 h-3" /> Pantalla Completa
                             </button>
                           )}
                           {!isReadOnly && <button className="text-[10px] font-black uppercase text-slate-400 hover:text-red-500 transition-colors bg-slate-100 px-3 py-1.5 rounded-lg flex items-center" onClick={() => {
                               const ctx = canvasTecRef.current?.getContext('2d');
                               ctx?.clearRect(0, 0, canvasTecRef.current?.width || 0, canvasTecRef.current?.height || 0);
                           }}>Borrar</button>}
                        </div>
                     </div>
                  </div>
               </SectionBox>
               <SectionBox title="Conformidad del Cliente">
                  <div className="space-y-4">
                     <canvas ref={canvasCliRef} className={`w-full h-48 bg-slate-50 border border-slate-200 rounded-3xl touch-none shadow-inner ${isReadOnly ? 'opacity-40' : ''}`} />
                    <div className="flex justify-between items-center mt-2">
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Área de Firma Cliente</span>
                       <div className="flex gap-2">
                           {!isReadOnly && (
                             <button className="text-[10px] font-black uppercase text-blue-500 hover:text-blue-600 transition-colors bg-blue-50 px-3 py-1.5 rounded-lg flex items-center gap-1" onClick={() => {
                                 setSignatureType('cliente');
                                 setShowFullscreenSignature(true);
                             }}>
                                <Maximize className="w-3 h-3" /> Pantalla Completa
                             </button>
                           )}
                           {!isReadOnly && <button className="text-[10px] font-black uppercase text-slate-400 hover:text-red-500 transition-colors bg-slate-100 px-3 py-1.5 rounded-lg flex items-center" onClick={() => {
                               const ctx = canvasCliRef.current?.getContext('2d');
                               ctx?.clearRect(0, 0, canvasCliRef.current?.width || 0, canvasCliRef.current?.height || 0);
                           }}>Borrar</button>}
                       </div>
                    </div>
                     <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Nombre de quien recibe</label>
                        <input 
                          type="text" 
                          value={generalData.nombreCliente || ""}
                          onChange={(e) => handleGeneralChange('nombreCliente', e.target.value)}
                          disabled={isReadOnly}
                          className={`w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold uppercase transition-all outline-none ${isReadOnly ? 'opacity-60 cursor-not-allowed' : 'focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500'}`} 
                        />
                     </div>
                  </div>
               </SectionBox>
            </div>

            {!isReadOnly && (
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center">
                 <AlertTriangle className="w-12 h-12 text-amber-500 mb-4" />
                 <h3 className="text-lg font-black text-slate-900 uppercase mb-2">Finalizar Orden de Servicio</h3>
                 <p className="text-sm text-slate-500 mb-6 max-w-md">
                    Al firmar y sincronizar esta orden, se generará el documento final y su estado pasará a Solo Lectura. No podrá ser modificado.
                 </p>
                 <button 
                   onClick={handleSyncAndFinalize}
                   disabled={isSyncing}
                   className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-black uppercase tracking-widest flex items-center gap-3 transition-colors shadow-lg shadow-blue-600/20 disabled:opacity-50"
                 >
                   {isSyncing ? <LoadingIndicator size="sm" color="white" /> : <Save className="w-5 h-5" />}
                   {isSyncing ? "Sincronizando..." : "Guardar y Finalizar O.S."}
                 </button>
              </div>
            )}
          </div>
        );
    }
  };

  const renderIndustrialPreview = () => {
    const clientName = clients.find(c => c.uuid_sync === generalData.cliente || c.id === generalData.cliente)?.nombre || generalData.cliente || "EECOL ELECTRIC";
    const selectedSuc = branches.find(b => b.uuid_sync === generalData.sucursal || b.id === generalData.sucursal);
    const branchAddress = selectedSuc?.direccion || "Av. Vitacura 2670, Santiago, Chile";
    const reportFolio = `OS-${uuid.substring(0, 8).toUpperCase()}`;

    const renderBadge = (statusVal?: string) => {
      switch (statusVal) {
        case 'ok':
          return <span className="inline-flex items-center gap-1 text-[8px] font-black px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 uppercase">✔ OK</span>;
        case 'obs':
          return <span className="inline-flex items-center gap-1 text-[8px] font-black px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 uppercase font-bold">⚠ OB</span>;
        case 'falla':
          return <span className="inline-flex items-center gap-1 text-[8px] font-black px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 uppercase">✖ NG</span>;
        default:
          return <span className="inline-flex items-center gap-1 text-[8px] font-black px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 uppercase">➖ NA</span>;
      }
    };

    const handleExportPDF = async () => {
      try {
        const doc = await generateClimasolPDF();
        doc.save(`${reportFolio}.pdf`);
      } catch (err) {
        console.error("Error exporting PDF Climasol:", err);
        alert("Ocurrió un error al generar PDF: " + err);
      }
    };

    return (
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300 pb-20">
        {/* Banner Informative */}
        <div className="bg-blue-50 border border-blue-200 rounded-3xl p-6 flex flex-col sm:flex-row items-center gap-4 text-blue-900 shadow-sm">
          <div className="p-3 bg-blue-600 text-white rounded-2xl">
            <ClipboardCheck className="w-6 h-6" />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h4 className="font-black uppercase text-sm tracking-wide">Vista Previa Norma Climasol (OS)</h4>
            <p className="text-xs text-blue-700 mt-1">Este panel reproduce fielmente la estructura visual reglamentaria e industrial requerida en las órdenes de servicio oficiales.</p>
          </div>
          <button onClick={handleExportPDF} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-blue-700 shadow-md transition-all shrink-0">
            Exportar PDF Climasol
          </button>
        </div>

        {/* PAGE 1 WORKSPACE PREVIEW */}
        <div className="bg-white border select-none border-slate-200 rounded-[32px] shadow-2xl overflow-hidden p-6 md:p-12 relative min-h-[1100px] flex flex-col justify-between text-left">
          <div>
            {/* Header Plate */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-6 border-b-2 border-[#0B2F64] gap-4">
              <div className="flex items-center gap-3">
                {appLogo ? (
                  <img src={appLogo} className="w-10 h-10 rounded-xl object-contain shadow-md shadow-blue-900/10" alt="Logo" />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#0B2F64] to-blue-800 flex items-center justify-center text-white font-extrabold shadow-md shadow-blue-900/20">
                    ❄
                  </div>
                )}
                <div>
                  <h3 className="text-xl font-black text-[#0B2F64] tracking-tight leading-none text-left">CLIMASOL</h3>
                  <span className="text-[8px] text-slate-400 font-extrabold tracking-widest uppercase block mt-1">Soluciones en Climatización</span>
                </div>
              </div>
              <div className="text-left md:text-center">
                <h4 className="text-sm font-black text-[#0B2F64] tracking-wider uppercase">Orden de Servicio Técnico</h4>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Reporte de Intervención</p>
              </div>
              <div className="flex items-stretch gap-2">
                <div className="bg-[#0B2F64] px-4 py-2 rounded-xl text-white text-center">
                  <span className="block text-[8px] font-black uppercase text-blue-200 tracking-widest">N° Orden</span>
                  <span className="font-mono text-xs font-black">{reportFolio}</span>
                </div>
                <div className="bg-slate-100 px-4 py-2 rounded-xl text-slate-700 text-center border border-slate-200">
                  <span className="block text-[8px] font-black uppercase text-slate-400 tracking-widest">Fecha</span>
                  <span className="font-mono text-xs font-bold">{generalData.fecha || "PENDIENTE"}</span>
                </div>
              </div>
            </div>

            {/* Section 1 General Information */}
            <div className="mt-8">
              <div className="inline-block bg-[#0B2F64] text-white px-6 py-1.5 rounded-full text-xs font-black tracking-wider uppercase mb-3">
                1. INFORMACIÓN GENERAL
              </div>
              <div className={`bg-slate-50 border border-slate-200 rounded-2xl p-6 grid grid-cols-1 ${generalData.fotoPlaca ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-y-4 gap-x-8 text-xs text-slate-700`}>
                <div className="space-y-2">
                  <p><strong className="text-slate-400 uppercase tracking-wider text-[10px] block">Cliente / Instalación</strong> <span className="text-slate-950 font-black">{clientName}</span></p>
                  <p><strong className="text-slate-400 uppercase tracking-wider text-[10px] block">Sucursal / Dirección</strong> <span className="text-slate-950 font-medium">{branchAddress}</span></p>
                  <p><strong className="text-slate-400 uppercase tracking-wider text-[10px] block">Edificio / Planta / Sector</strong> <span className="text-slate-950 font-medium">{generalData.edificio || "—"}</span></p>
                  <p><strong className="text-slate-400 uppercase tracking-wider text-[10px] block">Región</strong> <span className="text-slate-950 font-medium">{generalData.region || "—"}</span></p>
                </div>
                <div className="space-y-2">
                  <p><strong className="text-slate-400 uppercase tracking-wider text-[10px] block">Técnico Responsable</strong> <span className="text-slate-950 font-black">{generalData.tecnico || "—"}</span></p>
                  <p><strong className="text-slate-400 uppercase tracking-wider text-[10px] block">Contacto Cliente / Recibe</strong> <span className="text-slate-950 font-medium">{generalData.nombreCliente || "—"}</span></p>
                  <p><strong className="text-slate-400 uppercase tracking-wider text-[10px] block">Equipo (TAG)</strong> <span className="text-slate-950 font-mono font-bold text-blue-900">{generalData.equipoTag || "—"}</span></p>
                  <p><strong className="text-slate-400 uppercase tracking-wider text-[10px] block">Descripción Equipo</strong> <span className="text-slate-950 font-medium">{generalData.descripcionEquipo || "—"}</span></p>
                  <p><strong className="text-slate-400 uppercase tracking-wider text-[10px] block">Tipo de Servicio</strong> <span className="text-slate-950 font-medium">{generalData.tipoServicio || "—"}</span></p>
                </div>
                {generalData.fotoPlaca && (
                  <div className="flex flex-col justify-between h-full bg-white p-3 rounded-xl border border-slate-200">
                    <div>
                      <strong className="text-slate-400 uppercase tracking-wider text-[10px] block mb-1.5">Placa de Características</strong>
                      <div className="relative aspect-[4/3] rounded-lg overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center">
                        <img src={generalData.fotoPlaca} className="w-full h-full object-cover" alt="Placa" referrerPolicy="no-referrer" />
                      </div>
                    </div>
                    <span className="text-[8px] text-slate-400 font-extrabold tracking-wider uppercase block mt-2 text-center">Registro de Campo Oficial</span>
                  </div>
                )}
              </div>
            </div>

            {/* Checklist items table */}
            <div className="mt-8">
              <div className="inline-block bg-[#0B2F64] text-white px-6 py-1.5 rounded-full text-xs font-black tracking-wider uppercase mb-3">
                2. CHECKLIST DE INTERVENCIÓN Y PRUEBAS
              </div>
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-black tracking-widest text-[#0B2F64] uppercase border-b border-slate-200">
                      <th className="py-2.5 px-4">ITEM / ACTIVIDAD TÉCNICA</th>
                      <th className="py-2.5 px-4">COMENTARIOS / HALLAZGOS</th>
                      <th className="py-2.5 px-4 text-right">ESTADO</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {OS_CHECKLIST_ITEMS.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 text-[11px] font-black text-slate-800">{idx + 1}. {item.label}</td>
                        <td className="py-3 px-4 text-[11px] text-slate-500 italic font-medium">
                          {checklist[item.key]?.findings || "Verificación nominal sin novedad."}
                        </td>
                        <td className="py-3 px-4 text-right">{renderBadge(checklist[item.key]?.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 mt-8 flex justify-between items-center text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
            <span>Uso Técnico Oficial CLIMASOL - Folio {reportFolio}</span>
            <span>Página 1 de 2</span>
          </div>
        </div>

        {/* PAGE 2 WORKSPACE PREVIEW */}
        <div className="bg-white border border-slate-200 rounded-[32px] shadow-2xl overflow-hidden p-6 md:p-12 relative min-h-[1100px] flex flex-col justify-between text-left">
          <div>
            {/* Header Plate Page 2 */}
            <div className="flex justify-between items-center pb-6 border-b-2 border-[#0B2F64]">
              <div className="flex items-center gap-2">
                {appLogo ? (
                  <img src={appLogo} className="w-6 h-6 object-contain rounded shadow-sm shadow-blue-900/10" alt="Logo" />
                ) : (
                  <div className="text-[#0B2F64] font-extrabold text-lg">❄</div>
                )}
                <span className="text-sm font-black text-[#0B2F64]">CLIMASOL</span>
              </div>
              <span className="text-[9px] text-slate-400 font-extrabold tracking-wider uppercase">ORDEN DE SERVICIO TÉCNICO - FOLIO: {reportFolio}</span>
            </div>

            {/* Section 3 Recommendations & Diagnostic */}
            <div className="mt-8">
              <div className="inline-block bg-[#0B2F64] text-white px-6 py-1.5 rounded-full text-xs font-black tracking-wider uppercase mb-3">
                3. HALLAZGOS Y DIRECCIÓN TÉCNICA
              </div>
              <div className="flex flex-col md:flex-row gap-6 mt-1">
                <div className="flex-1 bg-slate-50 border border-slate-200 rounded-3xl p-6 space-y-4">
                  <div>
                    <strong className="text-[10px] font-black uppercase text-[#0B2F64] tracking-wider block">Condición Inicial de Ingreso:</strong>
                    <p className="text-xs text-slate-600 mt-1">{hallazgos.condicionInicial || "Se ingresa equipo para intervención protocolar. Estado inicial reporta desempeño parcial."}</p>
                  </div>
                  <div>
                    <strong className="text-[10px] font-black uppercase text-[#0B2F64] tracking-wider block">Condición Final de Entrega:</strong>
                    <p className="text-xs text-slate-600 mt-1">{hallazgos.condicionFinal || "Equipo queda verificado, con parámetros termodinámicos estabilizados y flujos de aire óptimos."}</p>
                  </div>
                  <div>
                    <strong className="text-[10px] font-black uppercase text-[#0B2F64] tracking-wider block">Diagnóstico y Conclusiones:</strong>
                    <p className="text-xs text-slate-600 mt-1">{hallazgos.conclusiones || "Intervención ejecutada con éxito. Cumplimiento de pauta de mantenimiento sin observaciones restrictivas."}</p>
                  </div>
                  <div>
                    <strong className="text-[10px] font-black uppercase text-[#0B2F64] tracking-wider block">Recomendaciones:</strong>
                    <p className="text-xs text-slate-600 mt-1">{hallazgos.recomendaciones || "Monitorear flujos periódicamente y mantener despejada ventilación periférica."}</p>
                  </div>
                </div>
                {/* Conformity seal card */}
                <div className="w-full md:w-[240px] shrink-0 border-2 border-emerald-500 bg-emerald-50 rounded-3xl p-6 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xl font-bold shadow-lg shadow-emerald-500/20 mb-3">
                    ✔
                  </div>
                  <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Estado Servicio</span>
                  <p className="text-sm font-black text-emerald-950 uppercase mt-1">Servicio Conforme</p>
                  <p className="text-[9px] text-emerald-700 mt-2 font-medium">Cumple directivas y pruebas operacionales de puesta en marcha.</p>
                </div>
              </div>
            </div>

            {/* Section 4 Photo gallery */}
            <div className="mt-8">
              <div className="inline-block bg-[#0B2F64] text-white px-6 py-1.5 rounded-full text-xs font-black tracking-wider uppercase mb-3">
                4. REGISTRO FOTOGRÁFICO DE INTERVENCIÓN
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-1">
                {Array.from({ length: 4 }).map((_, i) => {
                  const photoItem = galeria[i];
                  return (
                    <div key={i} className="border border-slate-200 bg-slate-50 rounded-2xl overflow-hidden shadow-sm aspect-video flex flex-col items-center justify-center text-center relative group min-h-[140px]">
                      {photoItem?.src ? (
                        <>
                          <img src={photoItem.src} alt={photoItem.desc || `Evidencia ${i + 1}`} className="w-full h-full object-cover" />
                          <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-2 text-white text-[9px] font-medium truncate">
                            {photoItem.desc || `Evidencia ${i + 1}`}
                          </div>
                        </>
                      ) : (
                        <div className="p-4 text-slate-300 flex flex-col items-center">
                          <span className="text-2xl">📸</span>
                          <span className="text-[9px] font-bold uppercase mt-1 text-slate-400">Sin Registro</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section 5 Protocol and signatures */}
            <div className="mt-8">
              <div className="inline-block bg-[#0B2F64] text-white px-6 py-1.5 rounded-full text-xs font-black tracking-wider uppercase mb-3">
                5. PROTOCOLO DE CONFORMIDAD Y FIRMAS
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-1">
                {/* Tech */}
                <div className="border border-slate-200 bg-slate-50 rounded-2xl p-4 flex flex-col justify-between min-h-[120px]">
                  <div className="h-16 flex items-center justify-center bg-white border border-slate-100 rounded-xl overflow-hidden p-2">
                    {canvasTecRef.current?.toDataURL() ? (
                      <img src={canvasTecRef.current.toDataURL()} alt="Firma Técnico" className="h-full object-contain" />
                    ) : (
                      <span className="text-[10px] text-slate-400 font-bold italic">Firme en sección firmas</span>
                    )}
                  </div>
                  <div className="mt-2 text-xs">
                    <span className="font-black text-slate-800 block">Firma Técnico: {generalData.tecnico || "Nelson Bravo"}</span>
                    <span className="text-[10px] text-slate-400 font-medium uppercase">Validador Técnico Autorizado</span>
                  </div>
                </div>

                {/* Client */}
                <div className="border border-slate-200 bg-slate-50 rounded-2xl p-4 flex flex-col justify-between min-h-[120px]">
                  <div className="h-16 flex items-center justify-center bg-white border border-slate-100 rounded-xl overflow-hidden p-2">
                    {canvasCliRef.current?.toDataURL() ? (
                      <img src={canvasCliRef.current.toDataURL()} alt="Firma Cliente" className="h-full object-contain" />
                    ) : (
                      <span className="text-[10px] text-slate-400 font-bold italic">Firme en sección firmas</span>
                    )}
                  </div>
                  <div className="mt-2 text-xs">
                    <span className="font-black text-slate-800 block font-bold">Cliente Receptor: {generalData.nombreCliente || "—"}</span>
                    <span className="text-[10px] text-slate-400 font-medium uppercase">Aprobación de Ejecución</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 mt-8 flex justify-between items-center text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
            <span>Uso Técnico Oficial CLIMASOL - Folio {reportFolio}</span>
            <span>Página 2 de 2</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 text-left h-[calc(100vh-8rem)]">
      {/* Top Header Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
         <div className="flex items-center gap-4">
            <button 
              onClick={handleBack}
              className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
               <h2 className="text-lg md:text-xl font-black text-slate-900 uppercase truncate">
                 {isNew ? 'Nueva Orden de Servicio' : `Orden de Servicio ${uuid}`}
               </h2>
               <div className="flex items-center gap-2 mt-1">
                 <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${
                   status === 'firmado' ? 'bg-emerald-100 text-emerald-700' :
                   status === 'cerrado' ? 'bg-slate-300 text-slate-700' :
                   status === 'completado' ? 'bg-blue-100 text-blue-700' :
                   status === 'en_progreso' ? 'bg-amber-100 text-amber-700' :
                   'bg-slate-200 text-slate-600'
                 }`}>
                   {status}
                 </span>
               </div>
            </div>
         </div>

         {/* Layout View Mode Swapper */}
         <div className="flex items-center bg-slate-50 border border-slate-200 p-1 rounded-2xl gap-1">
           <button 
             onClick={() => setViewMode('normal')}
             className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${
               viewMode === 'normal' 
                 ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10' 
                 : 'text-slate-500 hover:text-slate-850 hover:bg-slate-150 animate-none'
             }`}
           >
             <List className="w-3.5 h-3.5" /> Edición Estándar
           </button>
           <button 
             onClick={() => setViewMode('industrial')}
             className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${
               viewMode === 'industrial' 
                 ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10' 
                 : 'text-slate-500 hover:text-slate-850 hover:bg-slate-150 animate-none'
             }`}
           >
             <Layout className="w-3.5 h-3.5" /> Vista Climasol
           </button>
         </div>
      </div>

      {viewMode === 'industrial' ? (
        <div className="flex-1 overflow-y-auto">
          {renderIndustrialPreview()}
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6 h-full min-h-0">
        {/* Navigation Sidebar */}
        <div className="w-full lg:w-64 shrink-0 flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto pb-2 lg:pb-0 scrollbar-hide">
          {menu.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`flex items-center gap-3 px-4 py-3 xl:py-4 rounded-2xl text-sm font-bold uppercase tracking-widest transition-all whitespace-nowrap lg:whitespace-normal text-left ${
                activeSection === item.id 
                  ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' 
                  : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900 shadow-sm'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto rounded-3xl pb-12">
           {renderSection()}
        </div>
      </div>
      )}
      
      {showAssetSearch && (
        <AssetSearchModal 
          onClose={() => setShowAssetSearch(false)}
          onSelect={(asset) => {
            handleGeneralChange('equipoTag', asset.tag);
            handleGeneralChange('descripcionEquipo', `${asset.tipo} ${asset.marca || ''} ${asset.modelo || ''}`);
            setShowAssetSearch(false);
          }}
        />
      )}
      <FullscreenSignatureModal
          isOpen={showFullscreenSignature}
          onClose={() => setShowFullscreenSignature(false)}
          title={signatureType === 'tecnico' ? "Firma Técnico de Ejecución" : "Firma Cliente"}
          onSave={(dataUrl) => {
            const canvas = signatureType === 'tecnico' ? canvasTecRef.current : canvasCliRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            const img = new Image();
            img.onload = () => {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            };
            img.src = dataUrl;
            setShowFullscreenSignature(false);
          }}
       />
    </div>
  );
}

function SectionBox({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-[32px] p-6 lg:p-10 border border-slate-200 shadow-sm mb-6">
      <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-8 flex items-center gap-3">
        <span className="w-2 h-8 bg-blue-600 rounded-full inline-block"></span>
        {title}
      </h3>
      {children}
    </div>
  );
}



// Simple canvas setup for drawing signatures
function setupCanvas(canvas: HTMLCanvasElement | null) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Handle high-dpi displays
  const rect = canvas.parentElement?.getBoundingClientRect() || { width: 400, height: 200 };
  canvas.width = rect.width;
  canvas.height = rect.height;

  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#0f172a';

  let isDrawing = false;
  let lastX = 0;
  let lastY = 0;

  const getPos = (e: MouseEvent | TouchEvent) => {
    const r = canvas.getBoundingClientRect();
    if (e instanceof MouseEvent) {
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    } else {
      return { x: e.touches[0].clientX - r.left, y: e.touches[0].clientY - r.top };
    }
  };

  const draw = (e: MouseEvent | TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.stroke();
    lastX = x;
    lastY = y;
  };

  canvas.onmousedown = (e) => { isDrawing = true; const { x, y } = getPos(e); lastX = x; lastY = y; };
  canvas.ontouchstart = (e) => { isDrawing = true; const { x, y } = getPos(e); lastX = x; lastY = y; draw(e); };
  
  canvas.onmousemove = draw;
  canvas.ontouchmove = draw;
  
  window.addEventListener('mouseup', () => isDrawing = false);
  canvas.ontouchend = () => isDrawing = false;
}
