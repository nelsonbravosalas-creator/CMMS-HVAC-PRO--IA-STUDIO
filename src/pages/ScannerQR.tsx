/**
 * Vista de Terminal Scanner y Generador de Etiquetas QR.
 * Es el punto de interacción física con los activos técnicos en terreno.
 * 
 * @module pages/ScannerQR
 */

import { 
  Camera, 
  ArrowLeft, 
  QrCode, 
  Box, 
  Printer, 
  Share2,
  Image as ImageIcon,
  ExternalLink,
  ChevronLeft,
  ScanLine,
  X,
  Save
} from "lucide-react";
import { useState, useRef } from "react";
import { useLocation } from "wouter";
import LoadingIndicator from "../components/LoadingIndicator";
import * as htmlToImage from 'html-to-image';
import { EQUIPOS_DATA } from "../data/equipos";
import { SUCURSALES } from "../data/sucursales";
import { useEffect } from "react";
import { Scanner } from '@yudiel/react-qr-scanner';

/**
 * Componente ScannerQR.
 * 
 * Modos de operación:
 * 1. Scanner: Utiliza la cámara para detectar tags y redirigir al historial del equipo.
 * 2. Generator: Crea una etiqueta física estandarizada con branding de NBYB SPA.
 * 
 * Funcionalidades técnicas:
 * - Exportación: Captura el DOM de la etiqueta y genera un PNG descargable (html2canvas).
 * - Impresión: Aplica una hoja de estilos CSS específica (@media print) para formato 100mm x 50mm.
 * - Validación de TAG: Genera identificadores únicos siguiendo el esquema Almacen.Tipo.Correlativo.
 * 
 * @returns {JSX.Element} Interfaz de captura y generación de activos.
 */
/**
 * =========================================================================
 * COMPONENTE: ScannerQR.tsx (Lógica de Interacción Física-Digital)
 * =========================================================================
 * 
 * FUNCIONAMIENTO:
 * Este componente es el puente entre el código QR físico y la base de datos.
 * 
 * FLUJO DE DOCUMENTACIÓN:
 * 1. El usuario escanea un QR que apunta a la URL de Vercel (ej: .../scanner?tag=XXX).
 * 2. Al cargar, el useEffect lee el parámetro 'tag' de la URL.
 * 3. Se realiza un "llamado a la base de datos" (actualmente a EQUIPOS_DATA) para recuperar la ficha técnica.
 * 
 * INTERACCIONES:
 * - data/equipos.ts: Provee la información del equipo tras el escaneo.
 * - react-qr-scanner: Maneja la interfaz de cámara.
 */
export default function ScannerQR() {
  const [, setLocation] = useLocation();

  /** Modos de la vista: scanner (captura) o generator (creación) */
  const [mode, setMode] = useState<"scanner" | "generator">("scanner");
  /** Estado de carga durante la exportación de imagen o registro en BD */
  const [isExporting, setIsExporting] = useState(false);
  /** Estado de activación del sensor de cámara */
  const [isScannerActive, setIsScannerActive] = useState(false);
  /** Almacena el último resultado de escaneo exitoso */
  const [lastResult, setLastResult] = useState<string | null>(null);
  /** Datos del equipo encontrado en la base de datos */
  const [equipoEscaneado, setEquipoEscaneado] = useState<any>(null);

  /** Referencia al elemento DOM de la etiqueta para html2canvas */
  const tagRef = useRef<HTMLDivElement>(null);

  /** Hook de efecto para leer los parámetros al cargar la página si viene desde un QR */
  useEffect(() => {
    // Leemos la URL para ver si la aplicación fue abierta escaneando un código QR
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tagParam = params.get("tag");
      if (tagParam) {
        setLastResult(tagParam);
        // Hacemos el "llamado a la base de datos" local (EQUIPOS_DATA mock por ahora)
        const equipo = EQUIPOS_DATA.find(eq => eq.tag === tagParam);
        if (equipo) {
          setEquipoEscaneado(equipo);
        } else {
          setEquipoEscaneado({ error: "Equipo no encontrado en la base de datos." });
        }
      }
    }
  }, []);

  /** Datos para pre-poblar el generador de etiquetas */
  const [tagData, setTagData] = useState({
    almacen: '21-STK',
    tipo: 'AC',
    correlativo: '012',
    nombreEquipo: '1-4 SALA SERVIDORES'
  });
  
  /** 
   * URL base para los códigos QR.
   * Se utiliza window.location.origin para asegurar que el QR apunte siempre al dominio correcto,
   * ya sea en desarrollo local o en producción (Vercel).
   */
  const [baseUrl, setBaseUrl] = useState(typeof window !== 'undefined' ? window.location.origin : "");

  /** TAG completo calculado (ej: 21-STK.AC.012) */
  const fullTag = `${tagData.almacen}.${tagData.tipo}.${tagData.correlativo.padStart(3, '0')}`;
  
  /** 
   * URL final incrustada en el código QR.
   */
  const qrUrl = `${baseUrl}/?tag=${encodeURIComponent(fullTag)}`;
  /** Endpoint externo para la generación del código QR */
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(qrUrl)}&bgcolor=ffffff&color=0f172a&margin=10`;

  /**
   * Inicia el proceso de escaneo.
   */
  const handleStartScanner = () => {
    setIsScannerActive(true);
    setLastResult(null);
    setEquipoEscaneado(null);
  };

  /** 
   * Función que se ejecuta cuando el sensor de la cámara detecta un código.
   * Procesa el texto (que puede ser una URL o solo el TAG) y busca en la base de datos.
   */
  const handleScanSuccess = (text: string) => {
    if (text) {
      // Detenemos el scanner para evitar múltiples lecturas seguidas
      setIsScannerActive(false);

      // LÓGICA DE EXTRACCIÓN DE TAG:
      // El QR puede contener una URL completa como "https://dominio.com/scanner?tag=21-STK.AC.002"
      // o un formato antiguo "https://.../EQUIPOS/21-STK.AC.002".
      // Esta lógica "limpia" la entrada para obtener solo el identificador "21-STK.AC.002".
      let tagValue = text;
      try {
        if (text.includes('?tag=')) {
          // Extraemos el valor del parámetro 'tag'
          const urlObj = new URL(text);
          tagValue = urlObj.searchParams.get('tag') || text;
        } else if (text.includes('/EQUIPOS/')) {
          // Si es formato de ruta, tomamos lo que viene después de /EQUIPOS/
          tagValue = text.split('/EQUIPOS/').pop() || text;
        } else if (text.includes('/scanner/')) {
          // Caso genérico de ruta /scanner/TAG
          tagValue = text.split('/scanner/').pop() || text;
        }
      } catch (e) {
        // Si no es una URL (es decir, el QR solo contiene el texto del TAG), lo usamos directo
      }

      // Guardamos el resultado "limpio" en el estado para mostrarlo en pantalla
      setLastResult(tagValue);
      
      // BÚSQUEDA EN BASE DE DATOS:
      fetch(`/api/equipos?tag=${tagValue}`)
        .then(r => r.json())
        .then(data => {
           if (data.success && data.data) {
             setEquipoEscaneado({
               tag: data.data.tag,
               nombre: data.data.nombre,
               ubicacion: "Ubicación en BD" // Fallback if not available at root
             });
           } else {
             const localFallback = EQUIPOS_DATA.find(eq => eq.tag === tagValue);
             if (localFallback) {
               setEquipoEscaneado(localFallback);
             } else {
               setEquipoEscaneado({ error: `TAG "${tagValue}" no registrado en el sistema.` });
             }
           }
        })
        .catch(err => {
           setEquipoEscaneado({ error: `Error de conexión con Neon DB.` });
        })
    }
  };

  const handleExport = async () => {
    if (!tagRef.current) return;
    setIsExporting(true);
    try {
      const dataUrl = await htmlToImage.toPng(tagRef.current, {
        pixelRatio: 3,
        backgroundColor: '#ffffff'
      });
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `QR_Etiqueta_${fullTag}.png`;
      link.click();
    } catch (err) {
      console.error("Export failed", err);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleRegister = () => {
    setIsExporting(true);

    const assetData = {
      tag: fullTag,
      nombre: tagData.nombreEquipo,
      almacen: tagData.almacen,
      tipo: tagData.tipo,
      correlativo: tagData.correlativo,
      ubicacion: tagData.almacen,
      estado: "OPERATIVO",
      statusSincronizacion: "pendiente",
      fechaSincronizacionLocal: new Date().toISOString()
    };

    // 1. Guardado Local (Feedback Inmediato)
    localStorage.setItem(`registro_${fullTag}`, JSON.stringify(assetData));

    // 2. Ejecución diferida para la Nube
    setTimeout(async () => {
      try {
        const response = await fetch('/api/equipos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tag: fullTag,
            nombre: tagData.nombreEquipo,
            estado: "operativo",
            tipo: tagData.tipo,
            ubicacion: tagData.almacen,
            tecnicos: []
          })
        });

        if (!response.ok) {
          throw new Error('Error al guardar en la base de datos');
        }

        console.log("Sincronizado con Neon DB exitosamente");
        alert(`Activo ${fullTag} registrado con éxito en el CMMS.`);
      } catch (error) {
        console.error("Error en la nube, se mantiene solo local:", error);
        alert("El activo se guardó localmente. Se sincronizará cuando haya conexión.");
      } finally {
        setIsExporting(false);
      }
    }, 0);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 lg:p-8 overflow-x-hidden">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: 100mm 50mm; margin: 0; }
          body * { visibility: hidden !important; }
          #printable-tag-preview, #printable-tag-preview * { visibility: visible !important; }
          #printable-tag-preview { 
            position: fixed !important; 
            left: 0 !important; 
            top: 0 !important; 
            width: 100mm !important; 
            height: 50mm !important;
            border: none !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            border-radius: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print { display: none !important; }
        }
      `}} />

      <div className="max-w-6xl mx-auto space-y-8 no-print pb-20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setLocation("/")}
              className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all active:scale-90 border border-white/5 shadow-2xl"
            >
              <X className="w-6 h-6" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                 <h2 className="text-2xl font-black uppercase tracking-tight text-white italic">
                   {mode === "scanner" ? "Terminal Scanner" : "Generador de QR"}
                 </h2>
                 <div className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest ${mode === 'scanner' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}>
                    V.3.1
                 </div>
              </div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mt-1">
                OPERACIONES NBYB SPA • CMMS CONTROL 2024
              </p>
            </div>
          </div>

          <div className="bg-slate-900/50 p-1.5 rounded-3xl border border-white/5 flex items-center shadow-inner backdrop-blur-3xl">
             <button 
                onClick={() => setMode("scanner")}
                className={`flex items-center gap-3 px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'scanner' ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/30 font-black' : 'text-slate-400 hover:text-white'}`}
             >
                <ScanLine className="w-4 h-4" /> Scanner
             </button>
             <button 
                onClick={() => setMode("generator")}
                className={`flex items-center gap-3 px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'generator' ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/30 font-black' : 'text-slate-400 hover:text-white'}`}
             >
                <QrCode className="w-4 h-4" /> Generar
             </button>
          </div>
        </div>

        {mode === "scanner" ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-in fade-in duration-500">
             <div className="lg:col-span-8 space-y-6">
                <div className="relative aspect-[4/3] bg-slate-900 rounded-[40px] border border-white/5 overflow-hidden shadow-2xl group">
                   <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                      {isScannerActive ? (
                        <div className="absolute inset-0 z-10 w-full h-full bg-black">
                             <Scanner 
                             onScan={(detectedCodes) => {
                               if (detectedCodes.length > 0) {
                                 handleScanSuccess(detectedCodes[0].rawValue);
                               }
                             }}
                             components={{
                               torch: true,
                               zoom: true,
                               finder: true
                             }}
                           />
                           <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
                             <button 
                               onClick={() => setIsScannerActive(false)}
                               className="px-6 py-2 bg-red-600/80 hover:bg-red-600 text-white rounded-full text-[10px] font-bold uppercase tracking-widest transition-all shadow-xl backdrop-blur-md"
                             >
                               Detener Cámara
                             </button>
                           </div>
                        </div>
                      ) : (
                        <>
                          <div className="w-20 h-20 bg-blue-600/10 rounded-full flex items-center justify-center border border-blue-600/20 animate-pulse">
                             <Camera className="w-10 h-10 text-blue-500" />
                          </div>
                          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-500 text-center px-6">Sensor de Imagen Listo</p>
                          <button 
                            onClick={handleStartScanner}
                            className="px-10 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-blue-600/30 transition-all active:scale-95"
                          >
                             Activar Scanner
                          </button>
                        </>
                      )}
                   </div>
                   
                   <div className="absolute inset-0 pointer-events-none opacity-40">
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 border-2 border-white/30 rounded-3xl">
                         <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl-xl"></div>
                         <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr-xl"></div>
                         <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl-xl"></div>
                         <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br-xl"></div>
                      </div>
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   <div className="bg-white/5 p-6 rounded-3xl border border-white/5 flex flex-col items-center gap-3 cursor-pointer hover:bg-white/10 transition-all">
                      <ImageIcon className="w-6 h-6 text-emerald-500" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Cargar Archivo</span>
                   </div>
                   <div className="bg-white/5 p-6 rounded-3xl border border-white/5 flex flex-col items-center gap-3 cursor-pointer hover:bg-white/10 transition-all">
                      <ScanLine className="w-6 h-6 text-blue-500" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Escaneo Lento</span>
                   </div>
                   <div className="bg-white/5 p-6 rounded-3xl border border-white/5 flex flex-col items-center gap-3 cursor-pointer hover:bg-white/10 transition-all">
                      <Box className="w-6 h-6 text-amber-500" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Historial</span>
                   </div>
                </div>
             </div>

             <div className="lg:col-span-4 space-y-6">
                <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-8 rounded-[40px] shadow-2xl relative overflow-hidden">
                   <div className="absolute -right-4 -bottom-4 opacity-10 rotate-12">
                      <QrCode className="w-32 h-32" />
                   </div>
                   <h4 className="text-xl font-black uppercase italic leading-none mb-1">Detección Inteligente</h4>
                   <p className="text-[10px] font-bold text-white/60 mb-6 uppercase tracking-widest">IA Powered Recognition</p>
                   <p className="text-sm font-medium text-blue-100/80 leading-relaxed mb-8">
                      Posicione el código QR dentro del recuadro para el reconocimiento automático del TAG identificador.
                   </p>
                   <div className="flex gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>
                      <div className="w-1.5 h-1.5 rounded-full bg-white/40"></div>
                      <div className="w-1.5 h-1.5 rounded-full bg-white/40"></div>
                   </div>
                </div>
                <div className="bg-white/5 p-8 rounded-[40px] border border-white/5 space-y-4">
                   <h5 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Última Lectura</h5>
                   <div className="p-5 bg-black/40 rounded-2xl border border-white/5 flex flex-col items-center gap-2">
                      <span className="text-xs font-mono text-slate-400 break-all text-center">
                        {lastResult ? (
                          <>
                            <div className="mb-2 text-blue-400 font-bold">DETECTADO: {lastResult}</div>
                            {equipoEscaneado && equipoEscaneado.tag ? (
                               <div className="text-[10px] text-white">
                                 <div><strong className="text-slate-500">Equipo:</strong> {equipoEscaneado.nombre}</div>
                                 <div className="mt-1"><strong className="text-slate-500">Ubicación:</strong> {equipoEscaneado.ubicacion}</div>
                                 <button 
                                   onClick={() => setLocation(`/equipos/${equipoEscaneado.tag}`)}
                                   className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                                 >
                                   Ver Ficha Completa
                                 </button>
                               </div>
                            ) : equipoEscaneado && equipoEscaneado.error ? (
                               <div className="text-red-400 text-[10px]">{equipoEscaneado.error}</div>
                            ) : (
                               <div className="text-amber-400 text-[10px]">Buscando en base de datos...</div>
                            )}
                          </>
                        ) : "Esperando datos..."}
                      </span>
                   </div>
                </div>
             </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch animate-in fade-in slide-in-from-right-10 duration-500">
             <div className="lg:col-span-5 bg-white/5 rounded-[48px] border border-white/10 p-10 flex flex-col items-center justify-between gap-10 shadow-3xl backdrop-blur-sm">
                <div className="w-full space-y-6">
                   <div className="flex items-center justify-center gap-4">
                      <div className="h-0.5 w-8 bg-blue-600/30"></div>
                      <h3 className="text-[11px] font-black text-blue-400 uppercase tracking-[0.4em] italic text-center">Mockup Físico de Etiqueta</h3>
                      <div className="h-0.5 w-8 bg-blue-600/30"></div>
                   </div>
                   
                   <div 
                     id="printable-tag-preview" 
                     ref={tagRef}
                     className="w-full aspect-[2/1] bg-white rounded-[24px] shadow-[0_40px_80px_rgba(0,0,0,0.4)] flex relative border border-slate-200 select-none mx-auto overflow-hidden min-h-[250px]"
                   >
                     <div className="w-[45%] flex flex-col items-center justify-center p-6 border-r border-slate-100 bg-white">
                        <div className="w-full max-w-[160px] aspect-square flex items-center justify-center">
                           <img 
                             src={qrImageUrl} 
                             alt="Generated QR" 
                             crossOrigin="anonymous"
                             className="w-full h-full mix-blend-multiply"
                           />
                        </div>
                        <p className="mt-3 text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Escaneo Directo CMMS</p>
                     </div>

                     <div className="flex-1 p-8 flex flex-col justify-between bg-white text-slate-900 text-left">
                        <div className="flex justify-end">
                           <div className="bg-black text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-lg">
                              <span className="text-[12px] font-black italic tracking-tighter">NβyB</span>
                              <span className="text-[8px] font-bold opacity-80">SPA</span>
                           </div>
                        </div>

                        <div className="space-y-1">
                           <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.3em]">Tag Identificador</p>
                           <div className="text-[24px] lg:text-[28px] font-mono font-black text-slate-950 tracking-tighter leading-[0.9] italic">
                             {tagData.almacen} -<br />
                             {tagData.tipo}.{tagData.correlativo.padStart(3, '0')}
                           </div>
                        </div>

                        <div className="space-y-1 pt-4 border-t border-slate-50 text-left">
                           <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.3em]">Descripción de Activo</p>
                           <p className="text-[11px] font-black text-slate-800 uppercase leading-snug line-clamp-2 italic">
                             {tagData.nombreEquipo}
                           </p>
                        </div>
                     </div>
                   </div>
                </div>

                <div className="w-full grid grid-cols-2 gap-6">
                   <button 
                     onClick={handleExport}
                     disabled={isExporting}
                     className="group flex flex-col items-center justify-center gap-3 py-8 bg-slate-900 hover:bg-slate-800 rounded-[40px] border border-white/5 transition-all active:scale-95 shadow-2xl disabled:opacity-50"
                   >
                     {isExporting ? <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div> : <ImageIcon className="w-6 h-6 text-slate-600 group-hover:text-blue-500 transition-colors" />}
                     <span className="text-[10px] font-black uppercase tracking-[0.2em] group-hover:text-white transition-colors">Exportar Imagen</span>
                   </button>
                   <button 
                     onClick={handlePrint}
                     className="group flex flex-col items-center justify-center gap-3 py-8 bg-slate-900 hover:bg-slate-800 rounded-[40px] border border-white/5 transition-all active:scale-95 shadow-2xl"
                   >
                     <Printer className="w-6 h-6 text-slate-600 group-hover:text-amber-500 transition-colors" />
                     <span className="text-[10px] font-black uppercase tracking-[0.2em] group-hover:text-white transition-colors">Imprimir Etiqueta</span>
                   </button>
                </div>
             </div>

             <div className="lg:col-span-7 bg-white/5 rounded-[48px] border border-white/10 p-12 space-y-10 shadow-3xl backdrop-blur-sm">
                <div>
                   <h3 className="text-3xl font-black uppercase italic text-white flex items-center gap-4 text-left">
                      Editor de Identidad <Box className="w-8 h-8 text-blue-500" />
                   </h3>
                   <p className="text-xs font-bold text-slate-500 uppercase tracking-[0.4em] mt-2 text-left">Configuración Estándar NBYB SPA</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="space-y-3">
                      <label className="text-[11px] font-black uppercase text-blue-500 tracking-[0.3em] block text-left">Sucursal / Instalación</label>
                      <select 
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-xs font-bold uppercase outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-white"
                        value={tagData.almacen}
                        onChange={(e) => setTagData({...tagData, almacen: e.target.value})}
                      >
                         {SUCURSALES.map(s => (
                           <option key={s.id} value={s.id}>{s.nombre}</option>
                         ))}
                      </select>
                   </div>
                   <div className="space-y-3">
                      <label className="text-[11px] font-black uppercase text-blue-500 tracking-[0.3em] block text-left">Tipo de Activo técnico</label>
                      <select 
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-xs font-bold uppercase outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-white"
                        value={tagData.tipo}
                        onChange={(e) => setTagData({...tagData, tipo: e.target.value})}
                      >
                         <option value="AC">Aire Acondicionado (AC)</option>
                         <option value="VH">Vehículo (VH)</option>
                         <option value="GE">Grupo Electrógeno (GE)</option>
                         <option value="EB">Equipo Bodega (EB)</option>
                         <option value="GO">Grúa Horquilla (GO)</option>
                      </select>
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                   <div className="md:col-span-4 space-y-3">
                      <div className="flex justify-between items-center">
                         <label className="text-[11px] font-black uppercase text-blue-500 tracking-[0.3em]">Correlativo</label>
                         <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                      </div>
                      <input 
                         type="text"
                         className="w-full bg-blue-600/5 border border-blue-600/20 rounded-2xl px-6 py-4 text-base font-black text-blue-400 font-mono outline-none text-center shadow-inner"
                         value={tagData.correlativo}
                         onChange={(e) => setTagData({...tagData, correlativo: e.target.value.replace(/\D/g, '').slice(0,3)})}
                      />
                   </div>
                   <div className="md:col-span-8 space-y-3">
                      <label className="text-[11px] font-black uppercase text-blue-500 tracking-[0.3em] block text-left">Nombre del Activo</label>
                      <input 
                         type="text"
                         placeholder="EJ: UNIDAD EXTERNA PISO 4"
                         className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-xs font-black uppercase outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-white"
                         value={tagData.nombreEquipo}
                         onChange={(e) => setTagData({...tagData, nombreEquipo: e.target.value})}
                      />
                   </div>
                </div>

                <div className="bg-slate-900/60 rounded-[40px] p-8 space-y-6 shadow-inner border border-white/5 backdrop-blur-xl">
                   <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center">
                            <Share2 className="w-4 h-4 text-blue-500" />
                         </div>
                         <label className="text-[11px] font-black uppercase text-slate-400 tracking-[0.3em]">Protocolo de Enlace Automático</label>
                      </div>
                   </div>
                   <div className="bg-black/60 p-5 rounded-2xl flex items-center justify-between border border-white/5 group">
                      <span className="text-[10px] font-mono text-slate-500 truncate pr-6 italic group-hover:text-blue-400 transition-colors">{qrUrl}</span>
                      <ExternalLink className="w-5 h-5 text-blue-600 opacity-50 group-hover:opacity-100 cursor-pointer" />
                   </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-6 pt-6 text-left">
                   <button 
                     onClick={handleRegister}
                     disabled={isExporting}
                     className="flex-1 py-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-[32px] font-black text-xs uppercase tracking-[0.3em] shadow-[0_20px_50px_rgba(37,99,235,0.4)] hover:shadow-[0_20px_60px_rgba(37,99,235,0.6)] active:scale-95 transition-all flex items-center justify-center gap-4 group disabled:opacity-50"
                   >
                      {isExporting ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Save className="w-6 h-6 group-hover:rotate-12 transition-transform" />}
                      {isExporting ? "Guardando..." : "Guardar los cambios y crear en BD"}
                   </button>
                   <button 
                     onClick={() => setMode("scanner")}
                     className="px-8 py-6 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-[32px] font-bold text-xs uppercase tracking-[0.3em] border border-white/5 transition-all flex items-center justify-center gap-4"
                   >
                     <ChevronLeft className="w-5 h-5" /> Volver Atrás
                   </button>
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
