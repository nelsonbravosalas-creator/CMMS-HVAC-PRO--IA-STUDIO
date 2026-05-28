import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Eraser, CheckSquare } from 'lucide-react';

interface FullscreenSignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (dataUrl: string) => void;
  title: string;
}

export function FullscreenSignatureModal({ isOpen, onClose, onSave, title }: FullscreenSignatureModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize canvas to match its rotated container's actual screen pixels
    const resizeCanvas = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      
      // Because we rotate the content by 90deg, the visual width is the DOM height, 
      // but the actual canvas layout matches the rotated dimensions.
      // Easiest is to set canvas width/height to its clientWidth/clientHeight
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    };

    // Initial resize
    setTimeout(resizeCanvas, 100);
    window.addEventListener('resize', resizeCanvas);

    let drawing = false;

    const move = (e: PointerEvent) => {
      if (!drawing) return;
      e.preventDefault();
      ctx.lineTo(e.offsetX, e.offsetY);
      ctx.stroke();
    };

    const start = (e: PointerEvent) => {
      drawing = true;
      ctx.beginPath();
      ctx.moveTo(e.offsetX, e.offsetY);
    };

    const end = () => drawing = false;

    // Use PointerEvents which inherently support CSS transforms in offsetX/Y
    canvas.addEventListener('pointerdown', start);
    canvas.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);

    return () => {
      window.removeEventListener('pointerup', end);
      canvas.removeEventListener('pointerdown', start);
      canvas.removeEventListener('pointermove', move);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [isOpen]);

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSave(canvas.toDataURL());
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-slate-900 flex items-center justify-center p-4 overflow-hidden touch-none"
        >
          {/* Rotate the entire container so it's landscape on mobile */}
          <div 
            ref={containerRef}
            className="w-full max-w-4xl h-[70vh] sm:h-[80vh] bg-white rounded-3xl overflow-hidden flex flex-col shadow-2xl relative touch-none"
          >
            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
              <span className="font-black text-xs uppercase tracking-widest text-slate-700">{title}</span>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 relative bg-white touch-none">
              <canvas 
                ref={canvasRef} 
                className="absolute inset-0 w-full h-full touch-none cursor-crosshair signature-canvas"
                style={{ width: '100% !important', maxWidth: '100%', height: 'auto' }}
              />
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-5">
                <span className="font-black text-6xl uppercase tracking-widest text-slate-900">FIRMAR</span>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-4">
               <button 
                  onClick={handleClear}
                  className="flex-1 py-4 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95"
               >
                 <Eraser className="w-4 h-4" /> Borrar Firma (Intentar de nuevo)
               </button>
               <button 
                  onClick={handleSave}
                  className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
               >
                 <CheckSquare className="w-4 h-4" /> OK (Continuar)
               </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
