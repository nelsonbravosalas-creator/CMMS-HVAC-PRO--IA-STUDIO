import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

const MOCK_DB_PATH = path.join(process.cwd(), 'src', 'db', 'mock_db_store.json');

// Memory representation of Postgres tables
interface MockSchema {
  clientes: any[];
  sucursales: any[];
  assets: any[];
  users: any[];
  preventive_maintenance: any[];
  work_orders: any[];
  reports: any[];
  events: any[];
  catalog_asset_types: any[];
  settings: any[];
  ordenes_servicio: any[];
  inventory: any[];
  audit_logs: any[];
  cmms_auth_failures: any[];
  cmms_idempotency_keys: any[];
  calendar: any[];
}

let mockData: MockSchema = {
  clientes: [],
  sucursales: [],
  assets: [],
  users: [],
  preventive_maintenance: [],
  work_orders: [],
  reports: [],
  events: [],
  catalog_asset_types: [],
  settings: [],
  ordenes_servicio: [],
  inventory: [],
  audit_logs: [],
  cmms_auth_failures: [],
  cmms_idempotency_keys: [],
  calendar: []
};

// Helper to save DB to local JSON file
const saveMockData = () => {
  try {
    const parentDir = path.dirname(MOCK_DB_PATH);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(MOCK_DB_PATH, JSON.stringify(mockData, null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving mock database:', error);
  }
};

// Helper to load DB from local JSON file or seed defaults
export const loadMockData = () => {
  try {
    if (fs.existsSync(MOCK_DB_PATH)) {
      const content = fs.readFileSync(MOCK_DB_PATH, 'utf8');
      mockData = JSON.parse(content);
      // Double check all tables exist in loaded data
      const defaultKeys = ['clientes', 'sucursales', 'assets', 'users', 'preventive_maintenance', 'work_orders', 'reports', 'events', 'catalog_asset_types', 'settings', 'ordenes_servicio', 'inventory', 'audit_logs', 'cmms_auth_failures', 'cmms_idempotency_keys', 'calendar'];
      for (const key of defaultKeys) {
        if (!mockData[key as keyof MockSchema]) {
          (mockData as any)[key] = [];
        }
      }
      return;
    }
  } catch (error) {
    console.error('Error loading mock database, falling back to seeding defaults...', error);
  }

  // Seed default data
  const now = Date.now();
  
  const mockAdminEmail = process.env.DEV_MOCK_ADMIN_EMAIL;
  const mockAdminPin = process.env.DEV_MOCK_ADMIN_PIN;
  if (mockAdminEmail && mockAdminPin) {
    const pinHash = bcrypt.hashSync(mockAdminPin, 10);
    const adminUser = {
      uuid_sync: 'dev-mock-admin-uuid',
      id: 'dev-admin',
      nombre: 'Dev Admin',
      correo: mockAdminEmail,
      perfil: 'administrador',
      pin: pinHash,
      activo: true,
      data: JSON.stringify({ email: mockAdminEmail, nombre: 'Dev Admin', rol: 'administrador' }),
      updated_at: now,
      created_at: now
    };
    mockData.users = [adminUser];
  }

  // Default Client & Clientes
  const eecolClientData = { nombre: 'EECOL Default', empresa: 'EECOL' };
  const defaultClient = {
    id: 'cliente-eecol-default-001',
    uuid_sync: 'cliente-eecol-default-001',
    data: JSON.stringify(eecolClientData),
    updated_at: now,
    created_at: now
  };
  mockData.clientes = [defaultClient];

  // Default Sucursal & Sucursales
  const defaultBranchData = { nombre: 'Bodega Central', codigo: '21-STK', direccion: 'Las Condes 123', ciudad: 'Santiago', region: 'RM', activo: true };
  const defaultBranch = {
    id: 'default-sucursal',
    cliente_id: 'cliente-eecol-default-001',
    uuid_sync: 'default-sucursal',
    data: JSON.stringify(defaultBranchData),
    updated_at: now,
    created_at: now
  };
  mockData.sucursales = [defaultBranch];

  // Default Assets
  mockData.assets = [
    {
      uuid_sync: 'ACT-001',
      tag: 'ACT-001',
      nombre: 'Aire Acondicionado Cassette Matriz',
      tipo: 'AC',
      marca: 'Carrier',
      modelo: 'Cassette 36k',
      serie: 'CAR-123456',
      ubicacion: 'Oficina Central',
      area: 'Operaciones',
      capacidad: '36000 BTU',
      voltaje: '220V',
      corriente: '16A',
      refrigerante: 'R410A',
      fecha_instalacion: '2025-01-15',
      vida_util: 10,
      estado: 'operativo',
      ultimo_mantenimiento: '2026-01-10',
      proximo_mantenimiento: '2026-07-10',
      horas_operacion: 1200,
      tecnicos: JSON.stringify(['user-nelson-admin-uuid']),
      notas: 'Equipo principal de climatización. En óptimas condiciones.',
      cliente_id: 'cliente-eecol-default-001',
      sucursal_id: 'default-sucursal',
      latitud: -33.4489,
      longitud: -70.6693,
      updated_at: now,
      created_at: now
    },
    {
      uuid_sync: 'ACT-002',
      tag: 'ACT-002',
      nombre: 'Grupo Electrógeno de Emergencia',
      tipo: 'GE',
      marca: 'Caterpillar',
      modelo: 'CAT-250',
      serie: 'CAT-987654',
      ubicacion: 'Patio Trasero Bodega',
      area: 'Soporte',
      capacidad: '250 kVA',
      voltaje: '380V',
      corriente: '380A',
      refrigerante: 'N/A',
      fecha_instalacion: '2024-06-20',
      vida_util: 15,
      estado: 'operativo',
      ultimo_mantenimiento: '2026-02-15',
      proximo_mantenimiento: '2026-08-15',
      horas_operacion: 450,
      tecnicos: JSON.stringify(['user-nelson-admin-uuid']),
      notas: 'Generador de respaldo de energía crítica.',
      cliente_id: 'cliente-eecol-default-001',
      sucursal_id: 'default-sucursal',
      latitud: -33.4510,
      longitud: -70.6710,
      updated_at: now,
      created_at: now
    }
  ];

  // Default Asset Types
  const catalogTypes = [
    { id: 'AC', data: JSON.stringify({ codigo: 'AC', descripcion: 'Aire acondicionado', activo: true }) },
    { id: 'VH', data: JSON.stringify({ codigo: 'VH', descripcion: 'Vehículo', activo: true }) },
    { id: 'GE', data: JSON.stringify({ codigo: 'GE', descripcion: 'Grupo electrógeno', activo: true }) },
    { id: 'EB', data: JSON.stringify({ codigo: 'EB', descripcion: 'Equipo de Bodega', activo: true }) },
    { id: 'GO', data: JSON.stringify({ codigo: 'GO', descripcion: 'Grúa horquilla', activo: true }) },
    { id: 'XX', data: JSON.stringify({ codigo: 'XX', descripcion: 'Otros Activos', activo: true }) }
  ];
  mockData.catalog_asset_types = catalogTypes.map(c => ({
    uuid_sync: c.id,
    id: c.id,
    data: c.data,
    updated_at: now,
    created_at: now
  }));

  saveMockData();
};

// Initial load
loadMockData();

// Generalized Mock SQL tagged template literal parser & simulator
export const createMockSql = () => {
  const sql = async (strings: TemplateStringsArray, ...values: any[]): Promise<any[]> => {
    // Reconstruct full query string for regex inspection
    let rawQuery = '';
    for (let i = 0; i < strings.length; i++) {
      rawQuery += strings[i] + (i < values.length ? `__VAL${i}__` : '');
    }

    const query = rawQuery.trim();
    const queryLower = query.toLowerCase();

    // 1. Check for SELECT queries
    if (queryLower.startsWith('select')) {
      // Find the table name
      const tableMatch = query.match(/FROM\s+"?(\w+)"?/i);
      if (!tableMatch) return [];
      
      const rawTableName = tableMatch[1];
      const tableName = rawTableName.toLowerCase() as keyof MockSchema;
      const targetTable = mockData[tableName];
      if (!targetTable) return [];

      let filteredRows = [...targetTable];

      // Handle common WHERE conditions
      // Case A: SELECT * FROM users WHERE LOWER(correo) = $1 OR LOWER(data->>'email') = $1
      if (tableName === 'users' && (queryLower.includes('lower(correo)') || queryLower.includes('correo ='))) {
        const emailVal = String(values[0]).toLowerCase();
        return filteredRows.filter(u => 
          String(u.correo || '').toLowerCase() === emailVal || 
          String(u.email || '').toLowerCase() === emailVal ||
          (u.data && JSON.parse(u.data).email && String(JSON.parse(u.data).email).toLowerCase() === emailVal)
        );
      }

      // Case B: WHERE id = $1 or uuid_sync = $1
      if (queryLower.includes('uuid_sync =') || queryLower.includes('id =')) {
        const idVal = String(values[0]);
        filteredRows = filteredRows.filter(row => 
          String(row.uuid_sync || '') === idVal || 
          String(row.id || '') === idVal || 
          String(row.tag || '') === idVal
        );
      }

      // Case C: WHERE cliente_id = $1
      if (queryLower.includes('cliente_id =')) {
        const clientIdVal = String(values[0]);
        filteredRows = filteredRows.filter(row => 
          String(row.cliente_id || '') === clientIdVal ||
          (row.data && JSON.parse(row.data).cliente_id && String(JSON.parse(row.data).cliente_id) === clientIdVal)
        );
      }

      // Case D: WHERE tag = $1 or tag LIKE ...
      if (queryLower.includes('tag =')) {
        const tagVal = String(values[0]);
        filteredRows = filteredRows.filter(row => String(row.tag || '') === tagVal);
      }

      // Case E: WHERE updated_at > $1 or timestamp > $1 or timestamp_sync > $1
      if (queryLower.includes('updated_at >') || queryLower.includes('timestamp >')) {
        const sinceVal = Number(values[0]) || 0;
        filteredRows = filteredRows.filter(row => 
          (row.updated_at || 0) > sinceVal || 
          (row.timestamp || 0) > sinceVal
        );
      }

      // Filter out soft-deleted items unless explicitly queried
      if (queryLower.includes('deleted_at is null') && !queryLower.includes('deleted_at is not null')) {
        filteredRows = filteredRows.filter(row => row.deleted_at === undefined || row.deleted_at === null);
      }

      // Handle ORDER BY / LIMIT
      if (queryLower.includes('order by tag desc') || queryLower.includes('order by id desc')) {
        filteredRows.sort((a, b) => String(b.id || b.tag || '').localeCompare(String(a.id || a.tag || '')));
      } else if (queryLower.includes('order by updated_at asc')) {
        filteredRows.sort((a, b) => (a.updated_at || 0) - (b.updated_at || 0));
      }

      if (queryLower.includes('limit 1')) {
        return filteredRows.slice(0, 1);
      } else if (queryLower.includes('limit')) {
        const matchLimit = queryLower.match(/limit\s+(\d+)/);
        if (matchLimit) {
          const limitCount = parseInt(matchLimit[1], 10);
          return filteredRows.slice(0, limitCount);
        }
      }

      return filteredRows;
    }

    // 2. Check for INSERT queries
    if (queryLower.startsWith('insert')) {
      const tableMatch = query.match(/INTO\s+"?(\w+)"?/i);
      if (!tableMatch) return [];
      
      const rawTableName = tableMatch[1];
      const tableName = rawTableName.toLowerCase() as keyof MockSchema;
      const targetTable = mockData[tableName];
      if (!targetTable) return [];

      // Detect standard generic insert: INSERT INTO table (id, data, uuid_sync, updated_at, created_at) VALUES ($1,$2,$3,$4,$5)
      // Or INSERT INTO assets (...) VALUES (...)
      if (tableName === 'assets') {
        const tag = values[0];
        const nombre = values[1];
        const tipo = values[2] || '';
        const marca = values[3] || '';
        const modelo = values[4] || '';
        const serie = values[5] || '';
        const ubicacion = values[6] || '';
        const area = values[7] || '';
        const capacidad = values[8] || '';
        const voltaje = values[9] || '';
        const corriente = values[10] || '';
        const refrigerante = values[11] || '';
        const fecha_instalacion = values[12] || '';
        const vida_util = values[13] || 10;
        const estado = values[14] || 'operativo';
        const ultimo_mantenimiento = values[15] || null;
        const proximo_mantenimiento = values[16] || null;
        const horas_operacion = values[17] || 0;
        const notas = values[18] || '';
        const uuid_sync = values[19] || tag;
        const updated_at = values[20] || Date.now();
        const created_at = values[21] || Date.now();
        const cliente_id = values[22] || 'cliente-eecol-default-001';
        const sucursal_id = values[23] || 'default-sucursal';

        const record = {
          uuid_sync, tag, nombre, tipo, marca, modelo, serie, ubicacion, area, 
          capacidad, voltaje, corriente, refrigerante, fecha_instalacion, vida_util, 
          estado, ultimo_mantenimiento, proximo_mantenimiento, horas_operacion, notas,
          cliente_id, sucursal_id, updated_at, created_at
        };

        const idx = targetTable.findIndex(row => row.uuid_sync === uuid_sync);
        if (idx >= 0) {
          // conflict do update
          targetTable[idx] = { ...targetTable[idx], ...record, updated_at };
        } else {
          targetTable.push(record);
        }
      } else if (tableName === 'users' && queryLower.includes('perfil')) {
        // Advanced user insertion
        const uuid_sync = values[0];
        const id = values[1];
        const nombre = values[2];
        const correo = values[3];
        const perfil = values[4];
        const pin = values[5];
        const activo = values[6] !== false;
        const data = values[7] || '{}';
        const updated_at = values[8] || Date.now();
        const created_at = values[9] || Date.now();
        const deleted_at = values[10] || null;

        const record = { uuid_sync, id, nombre, correo, perfil, pin, activo, data, updated_at, created_at, deleted_at };
        const idx = targetTable.findIndex(row => row.uuid_sync === uuid_sync);
        if (idx >= 0) {
          targetTable[idx] = { ...targetTable[idx], ...record };
        } else {
          targetTable.push(record);
        }
      } else {
        // Standard (id, data, uuid_sync, updated_at, created_at) or similar
        const id = values[0];
        const data = typeof values[1] === 'object' ? JSON.stringify(values[1]) : values[1];
        const uuid_sync = values[2] || id;
        const updated_at = values[3] || Date.now();
        const created_at = values[4] || Date.now();

        const record = { id, data, uuid_sync, updated_at, created_at };
        const idx = targetTable.findIndex(row => row.uuid_sync === uuid_sync);
        if (idx >= 0) {
          targetTable[idx] = { ...targetTable[idx], ...record, updated_at };
        } else {
          targetTable.push(record);
        }
      }

      saveMockData();
      return [{ success: true }];
    }

    // 3. Check for UPDATE queries
    if (queryLower.startsWith('update')) {
      const tableMatch = query.match(/UPDATE\s+"?(\w+)"?/i);
      if (!tableMatch) return [];
      
      const rawTableName = tableMatch[1];
      const tableName = rawTableName.toLowerCase() as keyof MockSchema;
      const targetTable = mockData[tableName];
      if (!targetTable) return [];

      // Extract uuid_sync value if provided
      // Case A: SET deleted_at = ... WHERE uuid_sync = ...
      if (queryLower.includes('deleted_at =') && queryLower.includes('uuid_sync =')) {
        const deletedAtVal = values[0];
        const uuidSyncVal = values[1] || values[values.length - 1]; // usually is the second value or last
        const idx = targetTable.findIndex(row => row.uuid_sync === uuidSyncVal || row.id === uuidSyncVal);
        if (idx >= 0) {
          targetTable[idx].deleted_at = deletedAtVal;
          targetTable[idx].updated_at = deletedAtVal;
        }
      } else if (tableName === 'assets') {
        // Advanced UPDATE assets SET tag = $1 ... WHERE uuid_sync = $20
        const tag = values[0];
        const nombre = values[1];
        const tipo = values[2] || '';
        const marca = values[3] || '';
        const modelo = values[4] || '';
        const serie = values[5] || '';
        const ubicacion = values[6] || '';
        const area = values[7] || '';
        const capacidad = values[8] || '';
        const voltaje = values[9] || '';
        const corriente = values[10] || '';
        const refrigerante = values[11] || '';
        const fecha_instalacion = values[12] || '';
        const vida_util = values[13] || 10;
        const estado = values[14] || 'operativo';
        const ultimo_mantenimiento = values[15] || null;
        const proximo_mantenimiento = values[16] || null;
        const horas_operacion = values[17] || 0;
        const notas = values[18] || '';
        const cliente_id = values[19];
        const sucursal_id = values[20];
        const updated_at = values[21] || Date.now();
        const uuid_sync = values[22];

        const idx = targetTable.findIndex(row => row.uuid_sync === uuid_sync);
        const record = {
          tag, nombre, tipo, marca, modelo, serie, ubicacion, area, capacidad,
          voltaje, corriente, refrigerante, fecha_instalacion, vida_util, estado,
          ultimo_mantenimiento, proximo_mantenimiento, horas_operacion, notas,
          cliente_id, sucursal_id, updated_at
        };

        if (idx >= 0) {
          targetTable[idx] = { ...targetTable[idx], ...record };
        }
      } else {
        // Standard generic update: UPDATE table SET id = $1, data = $2, updated_at = $3 WHERE uuid_sync = $4
        const id = values[0];
        const data = typeof values[1] === 'object' ? JSON.stringify(values[1]) : values[1];
        const updated_at = values[2] || Date.now();
        const uuid_sync = values[3];

        const idx = targetTable.findIndex(row => row.uuid_sync === uuid_sync || row.id === uuid_sync);
        if (idx >= 0) {
          targetTable[idx] = { ...targetTable[idx], id, data, updated_at };
        }
      }

      saveMockData();
      return [{ success: true }];
    }

    // 4. Default return for tables setup, index creation or non-queries
    return [];
  };

  return sql;
};
