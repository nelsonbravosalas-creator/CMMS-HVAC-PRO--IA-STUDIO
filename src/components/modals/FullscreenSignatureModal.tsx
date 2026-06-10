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
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    };

    // Initial resize with longer delay to allow modal animation to complete
    setTimeout(resizeCanvas, 300);
    setTimeout(resizeCanvas, 50);
    window.addEventListener('resize', resizeCanvas);

    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;

    const getPos = (e: MouseEvent | TouchEvent) => {
      const r = canvas.getBoundingClientRect();
      if ('touches' in e) {
        return {
          x: e.touches[0].clientX - r.left,
          y: e.touches[0].clientY - r.top
        };
      }
      return {
        x: (e as MouseEvent).clientX - r.left,
        y: (e as MouseEvent).clientY - r.top
      };
    };

    const start = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      isDrawing = true;
      const pos = getPos(e);
      lastX = pos.x;
      lastY = pos.y;
    };

    const move = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      if (!isDrawing) return;
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      lastX = pos.x;
      lastY = pos.y;
    };

    const end = (e: MouseEvent | TouchEvent | Event) => {
      e.preventDefault();
      isDrawing = false;
    };

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
    
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', end, { passive: false });

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      canvas.removeEventListener('mousedown', start);
      canvas.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', end);
      canvas.removeEventListener('touchstart', start);
      canvas.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', end);
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
