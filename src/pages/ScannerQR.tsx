import { 
  ScanLine, 
  Image as ImageIcon, 
  Type, 
  QrCode, 
  ArrowLeft, 
  Search, 
  Filter,
  Download, 
  Printer, 
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Camera,
  Box,
  Send
} from "lucide-react";
import { useState, useEffect, useRef, useCallback, memo } from "react";
import LoadingIndicator from "../components/LoadingIndicator";

// URL de la librería para carga dinámica
const LIB_URL = "https://unpkg.com/html5-qrcode";

type QRMode = "main" | "camera" | "upload" | "manual" | "generate" | "result";

/**
 * Componente interno para el lector de cámara.
 * Aislarlo permite un control más estricto del ciclo de vida del hardware.
 */
const QRScannerView = memo(({ onScanSuccess, onScannerError, selectedCameraId }: any) => {
  const qrScannerRef = useRef<any>(null);
  const containerId = "qr-reader-internal";

  useEffect(() => {
    let isMounted = true;
    let html5QrCode: any = null;

    const init = async () => {
      // 1. Asegurar que la librería esté cargada
      if (!(window as any).Html5Qrcode) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = LIB_URL;
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      if (!isMounted) return;

      try {
        // 2. Inicializar instancia
        html5QrCode = new (window as any).Html5Qrcode(containerId);
        qrScannerRef.current = html5QrCode;

        // Tamaño agrandado un 50% (250 * 1.5 = 375)
        const config = { 
          fps: 15, 
          qrbox: { width: 375, height: 375 },
          aspectRatio: 1.0 
        };

        // 3. Iniciar cámara
        await html5QrCode.start(
          selectedCameraId, 
          config, 
          (text: string) => onScanSuccess(text)
        );
      } catch (err) {
        if (isMounted) onScannerError(String(err));
      }
    };

    init();

    return () => {
      isMounted = false;
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch((e: any) => console.warn("Cleanup error:", e));
      }
    };
  }, [selectedCameraId, onScanSuccess, onScannerError]);

  return <div id={containerId} className="w-full h-full" />;
});

export default function ScannerQR() {
  const [mode, setMode] = useState<QRMode>("main");
  const [resultTag, setResultTag] = useState<string>("");
  const [cameras, setCameras] = useState<any[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  // Carga inicial de cámaras
  useEffect(() => {
    if (mode === "camera") {
      setIsInitializing(true);
      const loadCameras = async () => {
        try {
          if (!(window as any).Html5Qrcode) {
            await new Promise((resolve) => {
              const script = document.createElement('script');
              script.src = LIB_URL;
              script.onload = resolve;
              document.head.appendChild(script);
            });
          }

          const devices = await (window as any).Html5Qrcode.getCameras();
          if (devices && devices.length > 0) {
            setCameras(devices);
            const backCam = devices.find((d: any) => /back|rear|trasera|environment/i.test(d.label));
            setSelectedCameraId(backCam ? backCam.id : devices[0].id);
          } else {
            setScannerError("No se detectaron cámaras en el dispositivo.");
          }
        } catch (err) {
          setScannerError("Error al acceder al hardware de cámara.");
        } finally {
          setIsInitializing(false);
        }
      };
      loadCameras();
    }
  }, [mode]);

  const handleScanSuccess = useCallback((tag: string) => {
    // Detectar si el contenido es una URL
    const isUrl = tag.toLowerCase().startsWith('http://') || tag.toLowerCase().startsWith('https://');
    
    if (isUrl) {
      // Redirección inmediata
      window.location.href = tag;
      return;
    }

    // Si no es URL, procesar como TAG interno
    let cleanTag = String(tag);
    if (cleanTag.includes('/')) {
      cleanTag = cleanTag.split('/').pop() || cleanTag;
    }
    setResultTag(cleanTag.trim().toUpperCase());
    setMode("result");
  }, []);

  const handleScannerError = useCallback((err: string) => {
    if (!err.includes("interrupted") && !err.includes("Node")) {
      setScannerError("Fallo al iniciar el sensor de imagen.");
    }
  }, []);

  const switchCamera = () => {
    if (cameras.length <= 1) return;
    const idx = cameras.findIndex(c => c.id === selectedCameraId);
    setSelectedCameraId(cameras[(idx + 1) % cameras.length].id);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans text-slate-900">
      <div className="max-w-4xl mx-auto flex flex-col gap-8 pb-20">
        
        {/* Encabezado Navegable */}
        <div className="flex items-center gap-4">
          {mode !== "main" && (
            <button 
              onClick={() => { setMode("main"); setScannerError(null); }}
              className="p-2 bg-white hover:bg-slate-100 rounded-xl shadow-sm border border-slate-200 transition-all active:scale-95"
            >
              <ArrowLeft className="w-5 h-5 text-slate-500" />
            </button>
          )}
          <div className="text-left">
            <h2 className="text-2xl font-black tracking-tight uppercase leading-none">
              {mode === "main" && "Centro de Escaneo"}
              {mode === "camera" && "Cámara en Vivo"}
              {mode === "upload" && "Cargar Imagen"}
              {mode === "manual" && "Ingresar TAG"}
              {mode === "generate" && "Generar QR"}
              {mode === "result" && "Validación"}
            </h2>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1 opacity-70">
              Operaciones NBYB SPA • 2024
            </p>
          </div>
        </div>

        {/* Menú Principal */}
        {mode === "main" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <ModeCard icon={ScanLine} label="Cámara" color="bg-blue-600 text-white" onClick={() => setMode("camera")} />
            <ModeCard icon={ImageIcon} label="Imagen" color="bg-emerald-500 text-white" onClick={() => setMode("upload")} />
            <ModeCard icon={Type} label="Manual" color="bg-amber-500 text-white" onClick={() => setMode("manual")} />
            <ModeCard icon={QrCode} label="Generar" color="bg-slate-900 text-white" onClick={() => setMode("generate")} />
          </div>
        )}

        {/* Modo Cámara */}
        {mode === "camera" && (
          <div className="max-w-2xl mx-auto w-full space-y-6">
            <div className="bg-white p-3 rounded-[40px] border border-slate-200 shadow-2xl overflow-hidden relative">
              <div className="w-full aspect-square rounded-[32px] overflow-hidden bg-slate-900 relative">
                
                {selectedCameraId && !scannerError && (
                  <QRScannerView 
                    selectedCameraId={selectedCameraId}
                    onScanSuccess={handleScanSuccess}
                    onScannerError={handleScannerError}
                  />
                )}

                {!scannerError && (
                  <div className="absolute inset-0 pointer-events-none z-10">
                    <div className="absolute inset-0 border-[60px] border-slate-950/40"></div>
                    {/* Ventana de visor agrandada a 375px (+50%) */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[375px] h-[375px] border-2 border-blue-500/50 rounded-3xl">
                       <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-lg"></div>
                       <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-lg"></div>
                       <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-lg"></div>
                       <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-lg"></div>
                       <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent shadow-[0_0_15px_#3b82f6] animate-[scan_2s_linear_infinite]"></div>
                    </div>
                  </div>
                )}

                {isInitializing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-4 bg-slate-900 z-20">
                    <LoadingIndicator size="lg" color="text-blue-500" label="Cargando Lente..." />
                  </div>
                )}

                {scannerError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-rose-500 px-8 text-center gap-4 bg-slate-900 z-30">
                    <AlertCircle className="w-12 h-12" />
                    <p className="text-sm font-bold uppercase tracking-tight">{scannerError}</p>
                    <button 
                      onClick={() => setMode("manual")} 
                      className="mt-2 bg-white text-slate-900 px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl"
                    >
                      Ingreso Manual
                    </button>
                  </div>
                )}
              </div>

              <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-3 z-20">
                {cameras.length > 1 && (
                  <button 
                    onClick={switchCamera} 
                    className="bg-white/20 backdrop-blur-xl border border-white/30 p-4 rounded-full text-white hover:bg-white/40 transition-all active:scale-90"
                  >
                    <RefreshCw className="w-5 h-5" />
                  </button>
                )}
                <div className="bg-slate-900/80 backdrop-blur-md px-8 py-3 rounded-full text-[10px] font-black text-white uppercase tracking-[0.2em] border border-white/10 shadow-xl">
                  Enfoque el código QR
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between bg-white p-5 rounded-[24px] border border-slate-200 shadow-sm">
              <div className="flex items-center gap-4 text-left">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                  <Camera className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Hardware</p>
                  <p className="text-xs font-bold text-slate-900 truncate max-w-[180px]">
                    {cameras.find(c => c.id === selectedCameraId)?.label || "Iniciando..."}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setMode("manual")} 
                className="text-[10px] font-black text-blue-600 uppercase bg-blue-50 px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors"
              >
                TAG Manual
              </button>
            </div>
          </div>
        )}

        {/* Pantalla de Resultados */}
        {mode === "result" && resultTag && (
          <div className="max-w-xl mx-auto w-full animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="bg-white rounded-[40px] border border-slate-200 shadow-2xl overflow-hidden">
              <div className="bg-emerald-500 p-10 flex flex-col items-center text-center gap-6">
                <div className="w-20 h-20 bg-white text-emerald-500 rounded-full flex items-center justify-center shadow-2xl">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div>
                  <h3 className="text-white text-2xl font-black uppercase tracking-tight leading-none">Activo Validado</h3>
                  <div className="mt-4 inline-block px-4 py-1 bg-emerald-600/50 rounded-full text-white text-[11px] font-bold tracking-widest border border-white/20 uppercase">
                    {resultTag}
                  </div>
                </div>
              </div>

              <div className="p-10 text-left space-y-8">
                <div className="grid grid-cols-2 gap-8 items-end">
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Identificador</span>
                    <p className="text-lg font-black text-slate-900 font-mono italic">#{resultTag}</p>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</span>
                    <div className="text-emerald-500 font-black text-lg uppercase flex items-center gap-2">
                       <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                       Operativo
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Equipo</span>
                    <p className="font-bold text-slate-800 uppercase tracking-tighter">Unidad de Climatización Industrial</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Mantenimiento</span>
                    <p className="font-bold text-slate-800">Abril 2024</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button className="flex items-center justify-center gap-3 py-5 bg-blue-600 text-white font-black text-xs uppercase tracking-[0.2em] rounded-3xl shadow-xl active:scale-95 transition-all">
                    <ExternalLink className="w-4 h-4" /> Ver Ficha
                  </button>
                  <button 
                    onClick={() => setMode("camera")} 
                    className="flex items-center justify-center gap-3 py-5 bg-slate-900 text-white font-black text-xs uppercase tracking-[0.2em] rounded-3xl active:scale-95 transition-all"
                  >
                    <Send className="w-4 h-4 rotate-180" /> Nuevo Escaneo
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <style>{`
          @keyframes scan {
            0% { top: 0; opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { top: 100%; opacity: 0; }
          }
        `}</style>
      </div>
    </div>
  );
}

function ModeCard({ icon: Icon, label, color, onClick }: any) {
  return (
    <div 
      onClick={onClick} 
      className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all cursor-pointer flex flex-col items-center gap-5 group"
    >
      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110 shadow-lg ${color}`}>
        <Icon className="w-8 h-8" />
      </div>
      <span className="font-black text-slate-900 text-[11px] uppercase tracking-[0.2em]">{label}</span>
    </div>
  );
}
