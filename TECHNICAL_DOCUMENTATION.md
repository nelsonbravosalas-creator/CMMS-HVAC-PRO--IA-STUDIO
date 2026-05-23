# Documentación Técnica - Sistema CMMS NBYB

## 1. Introducción
Este sistema es una aplicación de gestión de mantenimiento asistido por computadora (CMMS) diseñada específicamente para operaciones HVAC y activos industriales. Utiliza una arquitectura moderna basada en React, Vite y Neon PostgreSQL.

## 2. Pila Tecnológica (Tech Stack)
- **Frontend**: React 18 (TypeScript)
- **Ruteo**: Wouter (ligero y eficiente)
- **Estilos**: Tailwind CSS con sistema de diseño personalizado.
- **Iconografía**: Lucide React.
- **Gráficos**: Recharts.
- **Base de Datos**: Neon PostgreSQL.
- **Autenticación**: Vercel/Neon Auth.
- **Utilidades**: 
  - `html2canvas`: Generación de imágenes de etiquetas QR.
  - `motion`: Animaciones fluidas de interfaz.

## 3. Arquitectura de Datos (Neon PostgreSQL)
La base de datos se organiza en tablas relacionales principales:

### 3.1 `activos`
Almacena la hoja de vida de cada activo.
- **Identificador**: TAG único (ej: 21-STK.AC.001)
- **Propiedades clave**: `estado`, `ubicacion`, `ultimo_mantenimiento`, `proximo_mantenimiento`.

### 3.2 `tickets` / `informes`
Gestión de incidencias, fallas reportadas y mantenimiento.
- **Relatividad**: Vinculado a un TAG de equipo.

### 3.3 `usuarios`
Perfiles extendidos de usuarios.
- **Roles**: `tecnico`, `supervisor`, `administrador`, `cliente`.

## 5. Módulos Críticos

### 5.1 Terminal Scanner (`/src/pages/ScannerQR.tsx`)
Gestiona la interfaz entre el mundo físico y digital. Incluye un motor de renderizado de etiquetas que cumple con los estándares de impresión industrial (100x50mm).

### 5.2 Salud Operativa (`/src/pages/Dashboard.tsx`)
Calcula en tiempo real métricas de confiabilidad:
- **MTBF**: Tiempo medio entre fallas.
- **MTTR**: Tiempo medio de reparación.
- **Disponibilidad**: Ratio de operatividad del parque.

## 6. Convenciones de Desarrollo
- **Tipado**: Todos los modelos de datos deben definirse en `src/types.ts`.
- **Componentes**: Deben ser funcionales y utilizar hooks para la lógica de estado.
- **Estilos**: No se permiten archivos CSS externos; usar exclusivamente clases de utilidad de Tailwind en el JSX.

---
*Desarrollado por el Agente de IA para NBYB SPA - 2024*
