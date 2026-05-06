
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Printer, 
  ExternalLink, 
  Download, 
  QrCode, 
  Box,
  Share2
} from 'lucide-react';
import { Link } from 'wouter';

interface QRLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipment: {
    tag: string;
    desc: string;
  } | null;
}

export function QRLabelModal({ isOpen, onClose, equipment }: QRLabelModalProps) {
  if (!equipment) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-2xl">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 30 }}
            className="w-full max-w-lg space-y-8"
          >
            {/* Modal Title */}
            <div className="text-center space-y-3">
              <h3 
                className="text-blue-100 uppercase tracking-[0.4em] drop-shadow-sm"
                style={{
                  fontSize: '13px',
                  fontWeight: 'bold',
                  fontStyle: 'italic',
                  fontFamily: 'Arial, sans-serif'
                }}
              >
                Previsualización de Etiqueta
              </h3>
              <div className="w-20 h-1.5 bg-blue-600 mx-auto rounded-full shadow-[0_0_25px_rgba(37,99,235,0.6)]"></div>
            </div>

            {/* The Tag Card (Physical Mockup) */}
            <div 
              style={{ height: '333.98px' }}
              className="bg-white rounded-[40px] overflow-hidden shadow-[0_50px_100px_rgba(0,0,0,0.5)] flex relative border border-white/20 select-none"
            >
              {/* Left Section: QR Code */}
              <div 
                style={{ width: '165.899px' }}
                className="p-10 flex flex-col items-center justify-center border-r-4 border-slate-50 relative bg-slate-50/50 flex-shrink-0"
              >
                <div className="bg-white p-4 rounded-[32px] shadow-2xl border border-slate-100 transform -rotate-1">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=https://hvac-cmms.app/asset/${equipment.tag}`} 
                    alt="QR Code" 
                    className="w-full h-full mix-blend-multiply"
                  />
                </div>
                <div className="mt-6 text-center">
                  <p className="text-[10px] font-black text-slate-800 uppercase tracking-[0.2em] leading-tight">
                    Escaneo Directo
                  </p>
                  <p className="text-[9px] font-bold text-blue-600 uppercase tracking-widest mt-1">
                    HVAC CMMS
                  </p>
                </div>
              </div>

              {/* Right Section: Data & Branding */}
              <div className="flex-1 p-12 flex flex-col justify-between bg-white relative">
                {/* Corporate Logo (Styled Shield/Cube) */}
                <div className="absolute top-10 right-10 group">
                   <div className="relative w-16 h-16 transform transition-transform duration-700 group-hover:rotate-45">
                      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-blue-900 rounded-2xl rotate-12 shadow-xl shadow-blue-900/20"></div>
                      <div className="absolute inset-0 bg-blue-600/20 rounded-2xl -rotate-6 backdrop-blur-[2px] border border-white/10"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Box className="text-white w-8 h-8 filter drop-shadow-lg" />
                      </div>
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full animate-pulse border-2 border-white"></div>
                   </div>
                </div>

                <div className="flex flex-col gap-1 pr-20">
                   <span className="text-[14px] font-black text-slate-950 uppercase tracking-wider">NBYB SPA</span>
                   <div className="flex items-center gap-2">
                     <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">REF ID: V.1.2024</p>
                   </div>
                </div>

                <div className="space-y-2 py-6 border-y border-slate-50 overflow-hidden">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">TAG Identificador</p>
                  <p 
                    style={{ 
                      fontFamily: 'Courier New, Courier, monospace', 
                      fontStyle: 'italic',
                      fontSize: '35px',
                      lineHeight: '33px',
                      width: '219.5px'
                    }}
                    className="font-black text-slate-900 tracking-tighter truncate"
                  >
                    {equipment.tag}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Descripción de Activo</p>
                  <p className="text-[13px] font-black text-slate-700 uppercase leading-snug tracking-tight">
                    {equipment.desc}
                  </p>
                </div>
              </div>
            </div>

            {/* Interface Actions */}
            <div className="space-y-6">
              {/* URL Box */}
              <div className="bg-slate-900/60 p-6 rounded-[36px] border border-white/5 space-y-4 backdrop-blur-md shadow-2xl">
                <div className="flex justify-between items-center px-2">
                  <label className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em]">URL de Destino (Vínculo CMMS)</label>
                  <Share2 className="w-4 h-4 text-slate-600 hover:text-white cursor-pointer transition-colors" />
                </div>
                <div className="bg-black/40 p-5 rounded-2xl border border-white/5 flex items-center justify-between group shadow-inner">
                  <span className="text-[11px] font-bold text-slate-400 truncate pr-8 uppercase tracking-tighter italic">
                    https://nelsonbravosalas-creator.github.io/APP.-ACTIVOS/EQUIPOS/{equipment.tag}
                  </span>
                  <Link href={`/equipos/${equipment.tag}`}>
                    <ExternalLink className="w-5 h-5 text-blue-500 hover:text-blue-400 cursor-pointer transition-all transform hover:scale-110" />
                  </Link>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-5">
                <button 
                  className="group flex items-center justify-center gap-4 py-7 bg-slate-900 hover:bg-slate-800 border border-white/10 rounded-[40px] text-white text-[12px] font-black uppercase tracking-[0.25em] shadow-2xl transition-all active:scale-95"
                >
                  <Download className="w-6 h-6 text-slate-600 group-hover:text-blue-500 transition-colors" /> 
                  Exportar
                </button>
                <button 
                   onClick={() => window.print()}
                   className="group flex items-center justify-center gap-4 py-7 bg-slate-900 hover:bg-slate-800 border border-white/10 rounded-[40px] text-white text-[12px] font-black uppercase tracking-[0.25em] shadow-2xl transition-all active:scale-95"
                >
                   <QrCode className="w-6 h-6 text-slate-600 group-hover:text-amber-500 transition-colors" /> 
                   Imprimir
                </button>
              </div>

              {/* Footer text */}
              <div className="flex flex-col items-center gap-6">
                <p className="text-center text-[10px] text-slate-500 font-bold italic uppercase tracking-[0.2em] opacity-80 border-b border-blue-500/20 pb-1">
                  La etiqueta cumple con el estándar de codificación NBYB CMMS.
                </p>
                <button 
                  onClick={onClose}
                  className="px-10 py-4 bg-white/5 hover:bg-white/10 rounded-full text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] transition-all hover:text-white active:scale-90 border border-white/5"
                >
                  Cerrar Vista
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
