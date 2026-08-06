import React, { useEffect } from 'react';
import { useLocation } from 'wouter';

/**
 * Compatibilidad para enlaces antiguos. El módulo independiente fue retirado:
 * todo informe se inicia, continúa y consulta desde su orden de servicio.
 */
export default function InformesHVAC() {
  const [, setLocation] = useLocation();
  useEffect(() => setLocation('/ordenes-servicio'), [setLocation]);
  return (
    <div className="p-8 text-center text-sm font-bold text-slate-500">
      Los informes se administran desde una orden de servicio.
    </div>
  );
}
