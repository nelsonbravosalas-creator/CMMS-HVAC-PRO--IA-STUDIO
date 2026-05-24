import React, { useState, useEffect, useRef } from 'react';
import LoadingIndicator from '../LoadingIndicator';
import { SearchableSelect } from '../SearchableSelect';
import * as htmlToImage from 'html-to-image';
import { useAssets } from '../../hooks/useAssets';
import { CodificacionModal } from './CodificacionModal';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';

import { 
  X, QrCode, Download, Save, Zap, AlertCircle, Info, Calculator, Image as ImageIcon, Printer, Camera, Sparkles, ChevronLeft, ChevronDown
} from 'lucide-react';
import { EQUIPOS_DATA } from '../../data/assets';
import { SUCURSALES } from '../../data/branches';

interface CreateAssetModalProps {
  onClose: () => void;
}

export const CreateAssetModal: React.FC<CreateAssetModalProps> = ({ onClose }) => {
  const { createAsset } = useAssets();
  const [tagData, setTagData] = useState({
    almacen: '21-STK',
    tipo: 'AC',
    correlativo: '001',
    nombreEquipo: 'Compresor de Aire Industrial',
    marca: '',
    modelo: '',
    serie: ''
  });
  /** 
   * URL dinámico para los códigos QR. 
   * Al estar en Vercel, window.location.origin detectará automáticamente el dominio de producción. 
   */
  const [baseUrl, setBaseUrl] = useState(typeof window !== 'undefined' ? window.location.origin + '/scanner' : "https://cmms-hvac-pro-ia-studio.vercel.app/scanner");
  
  const [voltaje, setVoltaje] = useState<number>(220);
  const [corriente, setCorriente] = useState<number>(10);
  const [isScanning, setIsScanning] = useState(false);
  const potencia = (voltaje * corriente) / 1000;
  
  const [ultimoMantenimiento, setUltimoMantenimiento] = useState(new Date().toISOString().split('T')[0]);
  const [frecuenciaMantenimiento, setFrecuenciaMantenimiento] = useState("Semestral");
  
  const [isExporting, setIsExporting] = useState(false);
  const [isCodificacionModalOpen, setIsCodificacionModalOpen] = useState(false);
  const [showTagPreview, setShowTagPreview] = useState(false);
  const tagRef = useRef<HTMLDivElement>(null);

  const localSucursales = useLiveQuery(() => db.branches.toArray()) || [];
  const localCatalogAssetTypes = useLiveQuery(() => db.catalog_asset_types.toArray()) || [];

  useEffect(() => {
    const matches = EQUIPOS_DATA.filter(eq => {
      const parts = eq.tag.split('.');
      return parts[0] === tagData.almacen && parts[1] === tagData.tipo;
    });

    if (matches.length > 0) {
      const correlatives = matches.map(m => parseInt(m.tag.split('.')[2] || '0', 10));
      const max = Math.max(...correlatives);
      const next = (max + 1).toString().padStart(3, '0');
      setTagData(prev => ({ ...prev, correlativo: next }));
    } else {
      setTagData(prev => ({ ...prev, correlativo: '001' }));
    }
  }, [tagData.almacen, tagData.tipo]);

  const fullTag = `${tagData.almacen}.${tagData.tipo}.${tagData.correlativo.padStart(3, '0')}`;
  const qrUrl = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}tag=${encodeURIComponent(fullTag)}`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(qrUrl)}&bgcolor=ffffff&color=0f172a&margin=10`;

  const handleOCR = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    try {
      // Convert file to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
      });
      const base64Data = await base64Promise;

      const response = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          image: base64Data,
          mimeType: file.type 
        })
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || "Error al procesar la imagen");
      }

      const result = data.data;
      
      setTagData(prev => ({
        ...prev,
        marca: result.marca || prev.marca,
        modelo: result.modelo || prev.modelo,
        serie: result.serie || prev.serie,
        nombreEquipo: `${result.marca || ""} ${result.modelo || ""}`.trim() || prev.nombreEquipo
      }));

      if (result.voltaje) {
        setVoltaje(result.voltaje);
      }

    } catch (error) {
      console.error("OCR Error:", error);
      alert("No se pudo procesar la placa. Por favor, ingresa los datos manualmente.");
    } finally {
      setIsScanning(false);
      // Reset input
      e.target.value = '';
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
      link.download = `Nueva_Etiqueta_${fullTag}.png`;
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

  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      if (!fullTag || fullTag.trim() === '') {
        throw new Error('El tag del equipo es obligatorio');
      }

      // 1. Verify locally in Dexie if the tag exists
      try {
        const existingAsset = await db.assets.where('tag').equals(fullTag).first();
        if (existingAsset) {
          alert("Alerta: El Tag ya se encuentra registrado localmente. Por favor, selecciona otro.");
          setIsSaving(false);
          return;
        }
      } catch (err) {
         // ignore error
      }

      const branch = localSucursales.find(s => (s.codigo || s.id) === tagData.almacen);
      if (!branch) {
        throw new Error('Debe seleccionar una sucursal válida asociada a un cliente.');
      }
      if (!branch.cliente_id) {
        throw new Error('La sucursal seleccionada no tiene un cliente asociado valid.');
      }

      let proximoDate = "";
      try {
        const lastParts = ultimoMantenimiento.split('-');
        if (lastParts.length === 3) {
          const lastD = new Date(parseInt(lastParts[0]), parseInt(lastParts[1]) - 1, parseInt(lastParts[2]));
          let monthsToAdd = 6;
          const freq = frecuenciaMantenimiento.toLowerCase();
          if (freq.includes("mensual")) monthsToAdd = 1;
          else if (freq.includes("bi") || freq.includes("2")) monthsToAdd = 2;
          else if (freq.includes("tri") || freq.includes("3") || freq.includes("quarter")) monthsToAdd = 3;
          else if (freq.includes("cuatri") || freq.includes("4")) monthsToAdd = 4;
          else if (freq.includes("semes") || freq.includes("6") || freq.includes("half")) monthsToAdd = 6;
          else if (freq.includes("anual") || freq.includes("12") || freq.includes("year")) monthsToAdd = 12;
          
          lastD.setMonth(lastD.getMonth() + monthsToAdd);
          const y = lastD.getFullYear();
          const m = String(lastD.getMonth() + 1).padStart(2, '0');
          const d = String(lastD.getDate()).padStart(2, '0');
          proximoDate = `${y}-${m}-${d}`;
        }
      } catch (err) {
        console.error("Error setting proximo", err);
      }

      await createAsset({
        uuid_sync: crypto.randomUUID(),
        tag: fullTag || `EQUIPO-${Date.now()}`,
        nombre: tagData.nombreEquipo,
        tipo: tagData.tipo,
        marca: tagData.marca,
        modelo: tagData.modelo,
        serie: tagData.serie,
        ubicacion: branch.nombre || tagData.almacen,
        area: branch.nombre || tagData.almacen,
        capacidad: potencia.toString(),
        voltaje: voltaje.toString(),
        corriente: corriente.toString(),
        fecha_instalacion: new Date().toISOString(),
        vida_util: 10,
        estado: "operativo",
        ultimo_mantenimiento: ultimoMantenimiento,
        frecuencia_mantenimiento: frecuenciaMantenimiento,
        proximo_mantenimiento: proximoDate || new Date().toISOString().split('T')[0],
        cliente_id: branch.cliente_id,
        sucursal_id: branch.uuid_sync
      });
      
      onClose();
    } catch (error: any) {
      console.error("Error guardando activo:", error);
      alert(`No se pudo crear el equipo: ${error.message || error}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: 100mm 50mm; margin: 0; }
          body * { visibility: hidden !important; }
          #preview-tag-box, #preview-tag-box * { visibility: visible !important; }
          #preview-tag-box { 
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

      <div className="bg-white w-full max-w-5xl rounded-t-3xl sm:rounded-[40px] shadow-2xl overflow-y-auto overflow-x-hidden animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-200 flex flex-col md:grid md:grid-cols-12 h-[100dvh] sm:h-auto max-h-[100dvh] sm:max-h-[95vh]">
        
        {/* Left Panel: TAG & QR Rendering */}
        <div className="md:col-span-5 bg-slate-50 p-6 lg:p-8 flex flex-col gap-6 lg:gap-8 border-b md:border-b-0 md:border-r border-slate-200 no-print relative">
           <button 
             onClick={() => setShowTagPreview(!showTagPreview)}
             className="w-full flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl hover:border-blue-500 transition-colors shadow-sm"
           >
             <div className="flex items-center gap-3">
               <QrCode className="w-5 h-5 text-blue-500" />
               <div className="text-left">
                 <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-widest leading-none mb-1">Renderizado de Etiqueta</h3>
                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Generar QR y Exportar</p>
               </div>
             </div>
             <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showTagPreview ? 'rotate-180' : ''}`} />
           </button>

           {showTagPreview && (
             <div className="flex flex-col items-center gap-6 lg:gap-8 animate-in fade-in slide-in-from-top-4 duration-300">
               <div className="w-full space-y-4">
                  
                  {/* Etiqueta Visual Pro */}
                  <div 
                    id="preview-tag-box" 
                    ref={tagRef}
                    className="w-full aspect-[2/1] bg-white rounded-xl shadow-xl border border-slate-200 flex overflow-hidden min-h-[200px]"
                  >
                  {/* Sección QR */}
                  <div className="w-[45%] flex flex-col items-center justify-center p-4 border-r border-slate-100 bg-white">
                      <div className="w-full max-w-[120px] aspect-square flex items-center justify-center">
                        <img src={qrImageUrl} crossOrigin="anonymous" className="w-full h-full mix-blend-multiply" alt="QR" />
                      </div>
                      <div className="mt-2 text-[6px] font-black uppercase tracking-tighter text-slate-400">Escaneo Directo CMMS</div>
                  </div>

                  {/* Sección Datos */}
                  <div className="flex-1 p-4 lg:p-6 flex flex-col justify-between bg-white">
                      {/* Logo Superior Derecho */}
                      <div className="flex justify-end">
                          <div className="bg-black text-white px-2 py-1 rounded-md flex items-center gap-1 shadow-md">
                              <span className="text-[9px] font-black italic tracking-tighter">NβyB</span>
                              <span className="text-[6px] font-bold opacity-80">SPA</span>
                          </div>
                      </div>

                      {/* ID de Tag */}
                      <div className="space-y-0.5">
                          <p className="text-[7px] font-black text-slate-400 mb-0.5 uppercase tracking-widest">Tag Identificador</p>
                          <div className="text-[18px] lg:text-[22px] font-mono font-black text-black leading-[0.9] tracking-tighter italic">
                              {tagData.almacen} -<br/>
                              {tagData.tipo}.{tagData.correlativo.padStart(3, '0')}
                          </div>
                      </div>

                      {/* Descripción */}
                      <div className="space-y-0.5 pt-2 border-t border-slate-50">
                          <p className="text-[7px] font-black text-slate-400 uppercase mb-0.5">Descripción de Activo</p>
                          <p className="text-[10px] font-black text-slate-700 uppercase leading-tight line-clamp-2 italic">
                            {tagData.nombreEquipo}
                          </p>
                      </div>
                  </div>
              </div>
           </div>

           <div className="w-full space-y-4">
              <div className="bg-slate-900 rounded-2xl p-4 space-y-2 shadow-inner">
                 <label className="text-[9px] font-black uppercase text-slate-500">URL de Destino</label>
                 <input 
                    type="text" 
                    className="w-full bg-slate-800 border-none text-white text-[10px] font-mono p-2 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                 />
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                 <button 
                  onClick={handleExport}
                  disabled={isExporting}
                  className="flex-1 py-4 bg-white border border-slate-200 text-slate-900 text-[10px] font-black uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 hover:bg-slate-50 transition-all shadow-sm active:scale-95 disabled:opacity-50">
                    {isExporting ? <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div> : <ImageIcon className="w-4 h-4 text-blue-500" />}
                    <span>Exportar</span>
                 </button>
                 <button 
                  onClick={handlePrint}
                  className="flex-1 py-4 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 hover:bg-black transition-all shadow-xl active:scale-95">
                    <Printer className="w-4 h-4 text-amber-500" /> 
                    <span>Imprimir</span>
                 </button>
              </div>
              <p className="text-[8px] lg:text-[9px] font-medium text-slate-400 italic text-center px-2">La etiqueta cumple con el estándar de codificación NBYB CMMS.</p>
           </div>
          </div>
          )}
        </div>

        {/* Right Panel: Technical Form */}
        <div className="md:col-span-7 p-6 lg:p-10 overflow-y-auto no-print">
          <div className="flex justify-between items-center mb-6 lg:mb-8">
             <div>
                <h3 className="text-lg lg:text-xl font-black text-slate-900 uppercase">Configuración de Activo</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Generación de TAG y registro técnico</p>
             </div>
             <div className="flex items-center gap-2">
                <input 
                  type="file" 
                  id="ocr-upload" 
                  accept="image/*" 
                  capture="environment" 
                  className="hidden" 
                  onChange={handleOCR}
                />
                <button 
                  onClick={() => document.getElementById('ocr-upload')?.click()}
                  disabled={isScanning}
                  className="flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-100 transition-all border border-blue-100 shadow-sm"
                >
                  {isScanning ? <LoadingIndicator size="xs" color="text-blue-600" /> : <Camera className="w-4 h-4" />}
                  <span>{isScanning ? "Escaneando..." : "Escanear Placa IA"}</span>
                  <Sparkles className="w-3 h-3 text-blue-400" />
                </button>
                <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X className="w-5 h-5" /></button>
             </div>
          </div>

          <form className="space-y-6 lg:space-y-8" onSubmit={handleSubmit}>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
                <div className="space-y-1 z-50">
                   <div className="flex justify-between items-center">
                     <label className="text-[10px] sm:text-xs font-black uppercase text-slate-400">Sucursal/Almacén/Proyecto/Edificio</label>
                     <button type="button" onClick={() => setIsCodificacionModalOpen(true)} className="text-[10px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-widest">+ Crear Cód.</button>
                   </div>
                   <SearchableSelect
                      options={localSucursales.map(s => ({ value: s.codigo || s.id, label: s.nombre }))}
                      value={tagData.almacen}
                      onChange={(val) => setTagData({...tagData, almacen: val})}
                      placeholder="Seleccionar sucursal"
                   />
                </div>
                <div className="space-y-1 z-40">
                   <div className="flex justify-between items-center">
                     <label className="text-[10px] font-black uppercase text-slate-400">Categoría de Equipo</label>
                     <button type="button" onClick={() => setIsCodificacionModalOpen(true)} className="text-[10px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-widest">+ Crear Cód.</button>
                   </div>
                   <SearchableSelect
                      options={localCatalogAssetTypes.map(c => ({ value: c.codigo, label: `${c.descripcion} (${c.codigo})` }))}
                      value={tagData.tipo}
                      onChange={(val) => setTagData({...tagData, tipo: val})}
                      placeholder="Seleccionar categoría"
                   />
                </div>
             </div>

             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
                <div className="space-y-1">
                   <div className="flex justify-between items-center">
                     <label className="text-[10px] font-black uppercase text-slate-400">Correlativo</label>
                     <div className="flex items-center gap-1">
                        <LoadingIndicator size="xs" color="text-blue-500" />
                        <span className="text-[8px] font-black text-blue-500 uppercase">Auto-Sugerido</span>
                     </div>
                   </div>
                   <input 
                      type="text" 
                      maxLength={3}
                      className="w-full px-4 py-3 bg-blue-50/50 border border-blue-100 rounded-2xl text-sm font-black text-blue-900 outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                      value={tagData.correlativo}
                      onChange={(e) => setTagData({...tagData, correlativo: e.target.value.replace(/\D/g, '').slice(0, 3)})}
                   />
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase text-slate-400">Nombre de Activo</label>
                   <input 
                      type="text" 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                      value={tagData.nombreEquipo}
                      onChange={(e) => setTagData({...tagData, nombreEquipo: e.target.value})}
                   />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6 mt-4">
                   <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400">Marca</label>
                      <input 
                         type="text" 
                         className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                         value={tagData.marca}
                         onChange={(e) => setTagData({...tagData, marca: e.target.value})}
                      />
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400">Modelo</label>
                      <input 
                         type="text" 
                         className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                         value={tagData.modelo}
                         onChange={(e) => setTagData({...tagData, modelo: e.target.value})}
                      />
                   </div>
                </div>
                <div className="space-y-1 mt-4">
                   <label className="text-[10px] font-black uppercase text-slate-400">Serie / Serial Number</label>
                   <input 
                      type="text" 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                      value={tagData.serie}
                      onChange={(e) => setTagData({...tagData, serie: e.target.value})}
                   />
                </div>
             </div>

             <div className="space-y-4">
                <div className="flex items-center gap-2">
                   <Calculator className="w-4 h-4 text-blue-600" />
                   <h4 className="text-[10px] font-black uppercase text-slate-900 tracking-widest">Dimensionamiento Eléctrico</h4>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                   <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400">Voltaje (V)</label>
                      <input type="number" value={voltaje} onChange={(e) => setVoltaje(Number(e.target.value))} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:border-blue-300 transition-all" />
                   </div>
                   <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400">Corriente (A)</label>
                      <input type="number" value={corriente} onChange={(e) => setCorriente(Number(e.target.value))} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:border-blue-300 transition-all" />
                   </div>
                   <div className="p-3 bg-blue-50 border border-blue-100 rounded-2xl flex flex-col justify-center col-span-2 sm:col-span-1">
                      <span className="text-[8px] font-black text-blue-600 uppercase">Potencia Est.</span>
                      <span className="text-sm lg:text-base font-black text-blue-600">{potencia.toFixed(2)} kW</span>
                   </div>
                </div>
             </div>

             <div className="space-y-4 pt-2">
                <div className="flex items-center gap-2">
                   <Calculator className="w-4 h-4 text-emerald-600" />
                   <h4 className="text-[10px] font-black uppercase text-slate-900 tracking-widest">Mantenimiento Preventivo</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400">Último Mantenimiento Realizado</label>
                      <input 
                         type="date" 
                         value={ultimoMantenimiento} 
                         onChange={(e) => setUltimoMantenimiento(e.target.value)} 
                         className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] font-bold outline-none focus:border-emerald-300 transition-all font-mono uppercase text-slate-700" 
                      />
                   </div>
                   <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400">Frecuencia de Mantenimiento</label>
                      <select 
                         value={frecuenciaMantenimiento} 
                         onChange={(e) => setFrecuenciaMantenimiento(e.target.value)} 
                         className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] font-bold outline-none focus:border-emerald-300 transition-all text-slate-700 select"
                      >
                         <option value="Mensual">Mensual (1 Mes)</option>
                         <option value="Bi-Mestral">Bi-Mestral (2 Meses)</option>
                         <option value="Trimestral">Trimestral (3 Meses)</option>
                         <option value="Cuatrimestral">Cuatrimestral (4 Meses)</option>
                         <option value="Semestral">Semestral (6 Meses)</option>
                         <option value="Anual">Anual (12 Meses)</option>
                      </select>
                   </div>
                </div>
             </div>

             <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <button 
                  type="button" 
                  onClick={onClose}
                  className="flex-1 py-5 bg-slate-100 hover:bg-slate-200 text-slate-900 text-xs font-black uppercase tracking-widest rounded-[32px] transition-all flex items-center justify-center gap-3 active:scale-95"
                >
                   <ChevronLeft className="w-5 h-5" /> 
                   <span>Volver Atrás</span>
                </button>
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="flex-[2] py-5 bg-blue-600 text-white text-xs font-black uppercase tracking-widest rounded-[32px] shadow-2xl shadow-blue-600/30 active:scale-95 hover:bg-blue-700 hover:shadow-blue-600/40 transition-all flex items-center justify-center gap-3 group disabled:opacity-50"
                >
                   {isSaving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Save className="w-5 h-5 group-hover:scale-110 transition-transform" /> }
                   <span>Guardar Cambios y Crear en BD</span>
                </button>
             </div>
          </form>
        </div>
      </div>
    </div>
    {isCodificacionModalOpen && (
      <CodificacionModal isOpen={isCodificacionModalOpen} onClose={() => setIsCodificacionModalOpen(false)} />
    )}
    </>
  );
};
