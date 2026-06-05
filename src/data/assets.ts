
/**
 * =========================================================================
 * ARCHIVO DE BASE DE DATOS LOCAL MOCK: equipos.ts
 * =========================================================================
 * 
 * PROPÓSITO:
 * Este archivo actúa como una tabla de base de datos "simulada" en memoria 
 * (Mock DB) para el desarrollo del frontend. En un entorno de producción real,
 * la data aquí definida se obtendría mediante consultas a un backend 
 * (ej., PostgreSQL sobre NeonDB).
 * 
 * INTERACCIONES (QUIÉN LO USA):
 * - ScannerQR.tsx: Lo utiliza para buscar un equipo por su campo "tag" cuando
 *   se escanea un código QR u ocurre una redirección desde el QR impreso.
 * - CreateAssetModal.tsx: Lo utilizaría para guardar nuevos equipos en la BD 
 *   (aunque al ser local se resetea al recargar).
 * - Componentes de Dashboard: Leen la lista de equipos para mostrar métricas.
 */

/**
 * Interfaz fundamental que define la estructura o "Schema" de los equipos físicos.
 * Todo nuevo equipo debe seguir exactamente esta estructura.
 */
/**
 * =========================================================================
 * ARCHIVO DE DATOS: equipos.ts (Simulación de Base de Datos Local)
 * =========================================================================
 * 
 * ¿QUÉ ES ESTO?:
 * Este archivo contiene la estructura y datos de los equipos HVAC.
 * En desarrollo, sirve como una base de datos local (Mock DB).
 */
export interface Equipo {
  tag: string;             // Identificador único universal en formato Almacen.Tipo.Correlativo
  nombre: string;          // Nombre legíble para el sistema
  tipo: string;            // Categoría del dispositivo
  marca: string;           // Identificación extraída por OCR u operador
  modelo: string;          
  serie: string;           
  ubicacion: string;       
  area: string;            
  capacidad: string;       // BTU/h o Vatios
  voltaje: string;         // Detectado por OCR via AI
  corriente: string;       
  refrigerante: string;    
  fecha_instalacion: string;
  vida_util: number;        
  estado: 'Operativo' | 'En Falla' | 'Mantenimiento' | 'Con Observaciones' | 'Baja'; // Estado operacional de la máquina
  ultimo_mantenimiento: string; 
  proximo_mantenimiento: string;
  frecuencia_mantenimiento?: string;
  horas_operacion: number;  
  tecnicos: string[];      // Referencia a una tabla de "Usuarios"
  notas: string;           
}

export const EQUIPOS_DATA: Equipo[] = [
  {
    tag: "21-STK.AC.001",
    nombre: "Unidad Aire Acondicionado Central",
    tipo: "AC",
    marca: "Carrier",
    modelo: "38TUA060",
    serie: "SER000123",
    ubicacion: "Santiago B01 - Oficina Gerente",
    area: "Sala General",
    capacidad: "60000 BTU/h",
    voltaje: "220V",
    corriente: "15A",
    refrigerante: "R-410A",
    fecha_instalacion: "2024-01-15",
    vida_util: 10,
    estado: "Operativo",
    ultimo_mantenimiento: "2026-04-15",
    proximo_mantenimiento: "2026-07-15",
    frecuencia_mantenimiento: "Trimestral",
    horas_operacion: 1200,
    tecnicos: ["U1"],
    notas: "Equipo en excelente estado operativo.",
  },
  {
    tag: "Planta-STK.AC.005",
    nombre: "Compresor de Aire Industrial",
    tipo: "AC",
    marca: "Sullair",
    modelo: "LS16-75",
    serie: "SER000456",
    ubicacion: "Santiago B01 - Planta Productiva",
    area: "Producción",
    capacidad: "75 HP",
    voltaje: "380V",
    corriente: "25A",
    refrigerante: "R-407C",
    fecha_instalacion: "2023-06-20",
    vida_util: 15,
    estado: "En Falla",
    ultimo_mantenimiento: "2026-03-24",
    proximo_mantenimiento: "2026-05-24",
    frecuencia_mantenimiento: "Bimestral",
    horas_operacion: 4500,
    tecnicos: ["U2"],
    notas: "Falla de presión reportada.",
  },
  {
    tag: "21-STK.AC.010",
    nombre: "Unidad de Climatización Server Room",
    tipo: "AC",
    marca: "Daikin",
    modelo: "FTXM50R",
    serie: "SER000789",
    ubicacion: "Santiago B01 - Sala de Servidores",
    area: "TI",
    capacidad: "18000 BTU/h",
    voltaje: "220V",
    corriente: "8A",
    refrigerante: "R-32",
    fecha_instalacion: "2025-02-10",
    vida_util: 8,
    estado: "Operativo",
    ultimo_mantenimiento: "2026-04-23",
    proximo_mantenimiento: "2026-06-23",
    frecuencia_mantenimiento: "Bimestral",
    horas_operacion: 2200,
    tecnicos: ["U1", "U2"],
    notas: "Revisar rodamientos del ventilador.",
  }
];



