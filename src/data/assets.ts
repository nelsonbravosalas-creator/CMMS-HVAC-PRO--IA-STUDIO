
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
  estado: 'operativo' | 'falla' | 'mantenimiento' | 'baja'; // Estado operacional de la máquina
  ultimo_mantenimiento: string; 
  proximo_mantenimiento: string;
  frecuencia_mantenimiento?: string;
  horas_operacion: number;  
  tecnicos: string[];      // Referencia a una tabla de "Usuarios"
  notas: string;           
}

export const EQUIPOS_DATA: Equipo[] = [
  {
    "tag": "21-STK.AC.001",
    "nombre": "GERENTE DE OPERACIONES",
    "tipo": "Aire acondicionado",
    "marca": "ANWO",
    "modelo": "GES12E",
    "serie": "",
    "ubicacion": "GERENTE DE OPERACIONES",
    "area": "GERENTE DE OPERACIONES",
    "capacidad": "12000",
    "voltaje": "220",
    "corriente": "5.1",
    "refrigerante": "R-410A",
    "fecha_instalacion": "",
    "vida_util": 10,
    "estado": "operativo",
    "ultimo_mantenimiento": "2026-02-02",
    "proximo_mantenimiento": "2026-08-01",
    "horas_operacion": 0,
    "tecnicos": [
      "Nelson Bravo",
      "Gonzalo Bravo"
    ],
    "notas": ""
  },
  {
    "tag": "21-STK.AC.002",
    "nombre": "AREA DE OPERACIONES",
    "tipo": "Aire acondicionado",
    "marca": "ANWO",
    "modelo": "GES9E",
    "serie": "",
    "ubicacion": "AREA DE OPERACIONES",
    "area": "AREA DE OPERACIONES",
    "capacidad": "9000",
    "voltaje": "220",
    "corriente": "4.0",
    "refrigerante": "R-410A",
    "fecha_instalacion": "",
    "vida_util": 10,
    "estado": "operativo",
    "ultimo_mantenimiento": "2026-02-02",
    "proximo_mantenimiento": "2026-08-01",
    "horas_operacion": 0,
    "tecnicos": [
      "Nelson Bravo",
      "Gonzalo Bravo"
    ],
    "notas": ""
  },
  {
    "tag": "21-STK.AC.003",
    "nombre": "AREA DE PROPUESTAS Y SOLUCIONES",
    "tipo": "Aire acondicionado",
    "marca": "ANWO",
    "modelo": "GES24E",
    "serie": "",
    "ubicacion": "AREA DE PROPUESTAS Y SOLUCIONES",
    "area": "AREA DE PROPUESTAS Y SOLUCIONES",
    "capacidad": "24000",
    "voltaje": "220",
    "corriente": "10.8",
    "refrigerante": "R-410A",
    "fecha_instalacion": "",
    "vida_util": 10,
    "estado": "operativo",
    "ultimo_mantenimiento": "2026-02-02",
    "proximo_mantenimiento": "2026-08-01",
    "horas_operacion": 0,
    "tecnicos": [
      "Nelson Bravo",
      "Gonzalo Bravo"
    ],
    "notas": ""
  },
  {
    "tag": "21-STK.AC.004",
    "nombre": "OF ITINERANTE",
    "tipo": "Aire acondicionado",
    "marca": "ANWO",
    "modelo": "GES9E",
    "serie": "",
    "ubicacion": "OF ITINERANTE",
    "area": "OF ITINERANTE",
    "capacidad": "9000",
    "voltaje": "220",
    "corriente": "7.9",
    "refrigerante": "R-410A",
    "fecha_instalacion": "",
    "vida_util": 10,
    "estado": "operativo",
    "ultimo_mantenimiento": "2026-02-02",
    "proximo_mantenimiento": "2026-08-01",
    "horas_operacion": 0,
    "tecnicos": [
      "Nelson Bravo",
      "Gonzalo Bravo"
    ],
    "notas": ""
  },
  {
    "tag": "21-STK.AC.005",
    "nombre": "GERENTE DE CUENTAS GLOBALES",
    "tipo": "Aire acondicionado",
    "marca": "KHONE",
    "modelo": "GKH18KJB",
    "serie": "",
    "ubicacion": "GERENTE DE CUENTAS GLOBALES",
    "area": "GERENTE DE CUENTAS GLOBALES",
    "capacidad": "18000",
    "voltaje": "220",
    "corriente": "10.9",
    "refrigerante": "R-410A",
    "fecha_instalacion": "",
    "vida_util": 8,
    "estado": "operativo",
    "ultimo_mantenimiento": "2026-02-02",
    "proximo_mantenimiento": "2026-08-01",
    "horas_operacion": 0,
    "tecnicos": [
      "Nelson Bravo",
      "Gonzalo Bravo"
    ],
    "notas": ""
  },
  {
    "tag": "21-STK.AC.006",
    "nombre": "DIRECTOR REGIONAL SENIOR INTERNACIONAL",
    "tipo": "Aire acondicionado",
    "marca": "KHONE",
    "modelo": "GKH24KJB",
    "serie": "",
    "ubicacion": "DIRECTOR REGIONAL SENIOR INTERNACIONAL",
    "area": "DIRECTOR REGIONAL SENIOR INTERNACIONAL",
    "capacidad": "24000",
    "voltaje": "220",
    "corriente": "7.6",
    "refrigerante": "R-410A",
    "fecha_instalacion": "",
    "vida_util": 8,
    "estado": "operativo",
    "ultimo_mantenimiento": "2026-02-02",
    "proximo_mantenimiento": "2026-08-01",
    "horas_operacion": 0,
    "tecnicos": [
      "Nelson Bravo",
      "Gonzalo Bravo"
    ],
    "notas": ""
  },
  {
    "tag": "21-STK.AC.010",
    "nombre": "1-4 SALA SERVIDORES",
    "tipo": "Aire acondicionado",
    "marca": "MIDEA",
    "modelo": "MS9A-09HR",
    "serie": "",
    "ubicacion": "SALA SERVIDORES",
    "area": "SALA SERVIDORES",
    "capacidad": "9000",
    "voltaje": "220",
    "corriente": "10.2",
    "refrigerante": "R-410A",
    "fecha_instalacion": "",
    "vida_util": 10,
    "estado": "operativo",
    "ultimo_mantenimiento": "2026-02-02",
    "proximo_mantenimiento": "2026-05-03",
    "horas_operacion": 0,
    "tecnicos": [
      "Nelson Bravo",
      "Gonzalo Bravo"
    ],
    "notas": ""
  },
  {
    "tag": "Planta-STK.AC.001",
    "nombre": "Of Calidad y servicio",
    "tipo": "Aire acondicionado",
    "marca": "KENDAL",
    "modelo": "I-ASC-048MDS.OM",
    "serie": "",
    "ubicacion": "Of Calidad y servicio",
    "area": "Of Calidad y servicio",
    "capacidad": "48000",
    "voltaje": "380",
    "corriente": "0.0",
    "refrigerante": "R-410A",
    "fecha_instalacion": "",
    "vida_util": 8,
    "estado": "operativo",
    "ultimo_mantenimiento": "2026-02-15",
    "proximo_mantenimiento": "2026-08-14",
    "horas_operacion": 0,
    "tecnicos": [
      "Nelson Bravo",
      "Gonzalo Bravo"
    ],
    "notas": ""
  }
] as Equipo[];
