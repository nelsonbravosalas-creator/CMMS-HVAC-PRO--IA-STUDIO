export const PARAMETRIC_SEED_VERSION = 2026061601;

export const PARAMETRIC_CLIENTS = [
  {
    id: "cliente-default-001",
    uuid_sync: "cliente-default-001",
    data: {
      nombre: "Cliente Internacional",
      empresa: "Client Corp",
      activo: true
    }
  },
  {
    id: "C1",
    uuid_sync: "C1",
    data: {
      nombre: "EECOL ELECTRIC",
      rut: "78.928.030-4",
      plan: "enterprise",
      activo: true,
      usuariosIds: ["U1", "U2"]
    }
  }
];

export const PARAMETRIC_BRANCHES = [
  {
    id: "sucursal-default-001",
    uuid_sync: "sucursal-default-001",
    cliente_id: "cliente-default-001",
    data: {
      nombre: "Sede Central",
      ciudad: "Santiago",
      activo: true
    }
  },
  { id: "11-STK", nombre: "11-STK - Iquique" },
  { id: "12-STK", nombre: "12-STK - Antofagasta" },
  { id: "13-STK", nombre: "13-STK - Copiapo" },
  { id: "21-STK", nombre: "21-STK - Santiago 14 de la Fama" },
  { id: "21-STK-SB", nombre: "21-STK-SB - BME La Vara 3310" },
  { id: "23-STK", nombre: "23-STK - Vina del Mar" },
  { id: "24-STK", nombre: "24-STK - Rancagua" },
  { id: "31-STK", nombre: "31-STK - Concepcion" },
  { id: "32-STK", nombre: "32-STK - Puerto Montt" },
  { id: "Planta-STK", nombre: "Planta-STK - Planta Industrial" }
].map((branch) => ({
  id: branch.id,
  uuid_sync: "uuid_sync" in branch ? branch.uuid_sync : branch.id,
  cliente_id: "cliente_id" in branch ? branch.cliente_id : "C1",
  data: "data" in branch
    ? branch.data
    : {
        nombre: branch.nombre,
        codigo: branch.id,
        activo: true
      }
}));

export const PARAMETRIC_ASSET_TYPES = [
  { codigo: "AC", descripcion: "Aire acondicionado", activo: true },
  { codigo: "VH", descripcion: "Vehiculo", activo: true },
  { codigo: "GE", descripcion: "Grupo electrogeno", activo: true },
  { codigo: "EB", descripcion: "Equipo de Bodega", activo: true },
  { codigo: "GO", descripcion: "Grua horquilla", activo: true },
  { codigo: "XX", descripcion: "Otros Activos", activo: true }
];

export const PARAMETRIC_REGIONS_CL = [
  { value: "Arica y Parinacota", label: "Arica y Parinacota" },
  { value: "Tarapaca", label: "Tarapaca" },
  { value: "Antofagasta", label: "Antofagasta" },
  { value: "Atacama", label: "Atacama" },
  { value: "Coquimbo", label: "Coquimbo" },
  { value: "Valparaiso", label: "Valparaiso" },
  { value: "Metropolitana de Santiago", label: "Metropolitana de Santiago" },
  { value: "Libertador Gral. Bernardo O'Higgins", label: "Libertador Gral. Bernardo O'Higgins" },
  { value: "Maule", label: "Maule" },
  { value: "Nuble", label: "Nuble" },
  { value: "Biobio", label: "Biobio" },
  { value: "La Araucania", label: "La Araucania" },
  { value: "Los Rios", label: "Los Rios" },
  { value: "Los Lagos", label: "Los Lagos" },
  { value: "Aysen del Gral. Carlos Ibanez del Campo", label: "Aysen del Gral. Carlos Ibanez del Campo" },
  { value: "Magallanes y de la Antartica Chilena", label: "Magallanes y de la Antartica Chilena" }
];

export const PARAMETRIC_REFRIGERANTS_CL = [
  { value: "R-410A", label: "R-410A", subtitle: "Aire Acondicionado (Domestico/Comercial)" },
  { value: "R-134a", label: "R-134a", subtitle: "Refrigeracion Comercial y Automotriz" },
  { value: "R-22", label: "R-22", subtitle: "Aire Acondicionado (Antiguo / En retirada)" },
  { value: "R-404A", label: "R-404A", subtitle: "Refrigeracion Comercial (Baja Temperatura)" },
  { value: "R-507A", label: "R-507A", subtitle: "Refrigeracion Industrial/Comercial" },
  { value: "R-407C", label: "R-407C", subtitle: "Retrofit de R-22 / Aire Acondicionado" },
  { value: "R-32", label: "R-32", subtitle: "Aire Acondicionado Nueva Generacion (GWP Menor)" },
  { value: "R-600a", label: "R-600a (Isobutano)", subtitle: "Refrigeracion Domestica (Ecologico)" },
  { value: "R-290", label: "R-290 (Propano)", subtitle: "Refrigeracion Comercial (Ecologico)" },
  { value: "R-1234yf", label: "R-1234yf", subtitle: "Aire Acondicionado Automotriz" },
  { value: "R-448A", label: "R-448A", subtitle: "Reemplazo de R-404A (Bajo GWP)" },
  { value: "R-449A", label: "R-449A", subtitle: "Reemplazo de R-404A/R-507A" },
  { value: "R-452A", label: "R-452A", subtitle: "Transporte Refrigerado" },
  { value: "R-744", label: "R-744 (CO2)", subtitle: "Refrigeracion Comercial/Industrial" },
  { value: "R-717", label: "R-717 (Amoniaco)", subtitle: "Refrigeracion Industrial" },
  { value: "R-513A", label: "R-513A", subtitle: "Reemplazo de R-134a" },
  { value: "R-417A", label: "R-417A", subtitle: "Retrofit directo de R-22" },
  { value: "R-422D", label: "R-422D", subtitle: "Reemplazo Drop-in para R-22" },
  { value: "R-438A", label: "R-438A (MO99)", subtitle: "Reemplazo de R-22" },
  { value: "R-1234ze", label: "R-1234ze", subtitle: "Chillers y Bombas de Calor" }
];

export const PARAMETRIC_SETTINGS = [
  {
    id: "regions:cl",
    uuid_sync: "settings-regions-cl",
    cliente_id: "cliente-default-001",
    data: {
      key: "regions:cl",
      values: PARAMETRIC_REGIONS_CL,
      activo: true
    }
  },
  {
    id: "refrigerants:cl",
    uuid_sync: "settings-refrigerants-cl",
    cliente_id: "cliente-default-001",
    data: {
      key: "refrigerants:cl",
      values: PARAMETRIC_REFRIGERANTS_CL,
      activo: true
    }
  }
];

export const PARAMETRIC_USERS = [
  {
    id: "U1",
    uuid_sync: "U1",
    nombre: "Programador CMMS",
    correo: "programador@cmms.local",
    perfil: "programador",
    activo: true,
    cliente_id: "C1",
    pinHash: "$argon2id$v=19$m=19456,t=2,p=1$Ue5nwFv+sBP+q28p/7Wy1A$zGNCwxjwxriUUxM4i5nisoQlcHW5I7RMe6fu/7HUnQU",
    data: {
      id: "U1",
      nombre: "Programador CMMS",
      email: "programador@cmms.local",
      rol: "programador",
      cliente_id: "C1",
      activo: true,
      puedeEditarMantenimientos: true
    }
  },
  {
    id: "U2",
    uuid_sync: "U2",
    nombre: "Administrador CMMS",
    correo: "admin@cmms.local",
    perfil: "administrador",
    activo: true,
    cliente_id: "C1",
    pinHash: "$argon2id$v=19$m=19456,t=2,p=1$Ue5nwFv+sBP+q28p/7Wy1A$zGNCwxjwxriUUxM4i5nisoQlcHW5I7RMe6fu/7HUnQU",
    data: {
      id: "U2",
      nombre: "Administrador CMMS",
      email: "admin@cmms.local",
      rol: "administrador",
      cliente_id: "C1",
      activo: true,
      puedeEditarMantenimientos: true
    }
  }
];
