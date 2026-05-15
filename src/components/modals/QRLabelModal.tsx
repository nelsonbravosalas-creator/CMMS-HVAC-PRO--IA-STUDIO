import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import * as htmlToImage from 'html-to-image';
import { 
  X, 
  Printer, 
  ExternalLink, 
  Download, 
  QrCode, 
  Box,
  Share2,
  Image as ImageIcon
} from 'lucide-react';

interface QRLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipment: {
    tag: string;
    desc: string;
  } | null;
}

/**
 * QRLabelModal - Componente para previsualizar, imprimir y exportar etiquetas de assets.
 * Utiliza html2canvas para la generación de imágenes de alta fidelidad y 
 * estilos de impresión optimizados para etiquetas de 10x5cm.
 */
export function QRLabelModal({ isOpen, onClose, equipment }: QRLabelModalProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  if (!equipment) return null;

  // URL centralizada para el CMMS (Coincide con el URL Box)
  const assetUrl = `https://nelsonbravosalas-creator.github.io/APP.-ACTIVOS/EQUIPOS/${equipment.tag}`;
  // API para generar el código QR
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(assetUrl)}&margin=10`;

  const handlePrint = () => {
    window.print();
  };

  const handleExport = async () => {
    if (!printRef.current) return;
    setIsExporting(true);
    
    try {
      // Configuramos html-to-image para alta calidad (escala 2x o 3x para que no se vea pixelado)
      const dataUrl = await htmlToImage.toPng(printRef.current, {
        pixelRatio: 3,
        backgroundColor: '#ffffff',
      });

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `Etiqueta_${equipment.tag}.png`;
      link.click();
    } catch (err) {
      console.error("Error al exportar la etiqueta:", err);
      // Fallback: solo descargar el QR
      const link = document.createElement('a');
      link.href = qrApiUrl;
      link.download = `QR_${equipment.tag}.png`;
      link.click();
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-2xl overflow-y-auto">
          {/* Estilos específicos para impresión: Aísla el elemento #printable-tag */}
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              @page {
                size: 100mm 50mm;
                margin: 0;
              }
              body * { visibility: hidden !important; }
              #printable-tag, #printable-tag * { visibility: visible !important; }
              #printable-tag { 
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

          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 30 }}
            className="w-full max-w-lg space-y-8 my-auto"
          >
            {/* Header Modal */}
            <div className="text-center space-y-3 no-print relative">
              <button 
                onClick={onClose}
                className="absolute -right-2 -top-2 p-2 bg-white/5 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <h3 
                className="text-blue-100 uppercase tracking-[0.4em] drop-shadow-sm font-bold italic text-[13px]"
              >
                Previsualización de Etiqueta
              </h3>
              <div className="w-20 h-1.5 bg-blue-600 mx-auto rounded-full shadow-[0_0_25px_rgba(37,99,235,0.6)]"></div>
            </div>

            {/* Mockup Físico de Etiqueta (Printable Target) */}
            <div 
              id="printable-tag"
              ref={printRef}
              className="bg-white rounded-[24px] overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.4)] flex relative border border-slate-200 select-none mx-auto w-full aspect-[2/1] min-h-[250px] max-h-[340px]"
            >
              {/* Sección QR */}
              <div 
                className="w-[45%] p-6 lg:p-8 flex flex-col items-center justify-center border-r border-slate-100 bg-white flex-shrink-0"
              >
                <div className="w-full max-w-[160px] aspect-square flex items-center justify-center">
                  <img 
                    src={qrApiUrl} 
                    alt="QR Code" 
                    crossOrigin="anonymous"
                    className="w-full h-full mix-blend-multiply"
                  />
                </div>
                <p className="mt-3 text-[8px] lg:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-tight text-center">
                  Escaneo Directo CMMS
                </p>
              </div>

              {/* Sección Datos */}
              <div className="flex-1 p-6 lg:p-10 flex flex-col justify-between bg-white relative min-w-0">
                {/* Logo Superior Derecho */}
                <div className="flex justify-end">
                   <div className="bg-black text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-lg">
                      <span className="text-[11px] lg:text-[13px] font-black italic tracking-tighter">NβyB</span>
                      <span className="text-[7px] lg:text-[9px] font-bold opacity-80">SPA</span>
                   </div>
                </div>

                {/* ID de Tag */}
                <div className="space-y-1">
                  <p className="text-[8px] lg:text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">Tag Identificador</p>
                  <p 
                    className="font-black text-slate-900 tracking-tighter truncate text-[22px] lg:text-[30px] font-mono leading-[0.9] italic"
                  >
                    {equipment.tag.split('.').length > 1 
                      ? <>{equipment.tag.split('.')[0]} -<br/>{equipment.tag.split('.').slice(1).join('.')}</>
                      : equipment.tag
                    }
                  </p>
                </div>

                {/* Descripción */}
                <div className="space-y-1 pt-3 lg:py-4 border-t border-slate-50">
                  <p className="text-[8px] lg:text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">Descripción de Activo</p>
                  <p className="text-[10px] lg:text-[12px] font-black text-slate-700 uppercase leading-snug line-clamp-2 italic">
                    {equipment.desc}
                  </p>
                </div>
              </div>
            </div>

            {/* Panel de Control */}
            <div className="space-y-6 no-print">
              <div className="bg-slate-900/60 p-6 rounded-[36px] border border-white/5 space-y-4 backdrop-blur-md">
                <div className="flex justify-between items-center px-2">
                  <label className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em]">URL de Destino</label>
                  <Share2 className="w-4 h-4 text-slate-600 cursor-pointer hover:text-white transition-colors" />
                </div>
                <div className="bg-black/40 p-4 rounded-2xl border border-white/5 flex items-center justify-between shadow-inner overflow-hidden">
                  <span className="text-[10px] font-bold text-slate-400 truncate pr-4 italic">
                    {assetUrl}
                  </span>
                  <a href={assetUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-5 h-5 text-blue-500 hover:text-blue-400 cursor-pointer transition-transform hover:scale-110" />
                  </a>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <button 
                  onClick={handleExport}
                  disabled={isExporting}
                  className="group flex items-center justify-center gap-4 py-6 bg-slate-900 hover:bg-slate-800 border border-white/10 rounded-[35px] text-white text-[11px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 shadow-xl disabled:opacity-50"
                >
                  {isExporting ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      <span>Generando...</span>
                    </div>
                  ) : (
                    <>
                      <ImageIcon className="w-5 h-5 text-slate-600 group-hover:text-blue-500 transition-colors" /> 
                      Exportar Imagen
                    </>
                  )}
                </button>
                <button 
                   onClick={handlePrint}
                   className="group flex items-center justify-center gap-4 py-6 bg-slate-900 hover:bg-slate-800 border border-white/10 rounded-[35px] text-white text-[11px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 shadow-xl"
                >
                   <Printer className="w-5 h-5 text-slate-600 group-hover:text-amber-500 transition-colors" /> 
                   Imprimir Etiqueta
                </button>
              </div>

              <div className="flex flex-col items-center gap-6">
                <button 
                  onClick={onClose}
                  className="px-10 py-3 bg-white/5 hover:bg-white/10 rounded-full text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] transition-colors border border-white/5 hover:text-white"
                >
                  Finalizar Revisión
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
