import { getDb } from './_db.js';

function mapToNeon(frontData: any) {
  return {
    id: frontData.id,
    categoria: frontData.categoria || '',
    codigo: frontData.codigo || '',
    nombre: frontData.nombre || '',
    cantidad: frontData.stock || 0,
    unidad_medida: frontData.unidad || '',
    cliente_id: frontData.cliente_id || frontData.clienteId || 'cliente-eecol-default-001',
    marca: frontData.marca || '',
    modelo: frontData.modelo || '',
    estado: frontData.estado || 'disponible',
    uuid_sync: frontData.uuid_sync || frontData.uuidSync || frontData.id,
    updated_at: frontData.updated_at || frontData.updatedAt || Date.now()
  };
}

function mapToDexie(neonData: any) {
  let extraData: any = {};
  if (neonData.data) {
    try {
      extraData = typeof neonData.data === 'string' ? JSON.parse(neonData.data) : neonData.data;
    } catch (e) {}
  }

  return {
    id: neonData.id,
    categoria: neonData.categoria || extraData.categoria || '',
    codigo: neonData.codigo || extraData.codigo || '',
    nombre: neonData.nombre || extraData.nombre || '',
    stock: neonData.cantidad !== undefined ? Number(neonData.cantidad) : (extraData.stock !== undefined ? Number(extraData.stock) : 0),
    unidad: neonData.unidad_medida || extraData.unidad || '',
    cliente_id: neonData.cliente_id || extraData.cliente_id || 'cliente-eecol-default-001',
    marca: neonData.marca || extraData.marca || '',
    modelo: neonData.modelo || extraData.modelo || '',
    estado: neonData.estado || extraData.estado || 'disponible',
    uuid_sync: neonData.uuid_sync,
    updated_at: Number(neonData.updated_at || Date.now())
  };
}

export default async function handler(req: any, res: any) {
  try {
    const sql = getDb();
    const { method, body, query } = req;

    if (method === 'GET') {
      const rows = await sql`SELECT * FROM inventory WHERE deleted_at IS NULL ORDER BY nombre ASC LIMIT 500`;
      return res.json({ success: true, data: rows.map(mapToDexie) });
    }

    if (method === 'POST') {
      const mapped = mapToNeon(body);
      const id = mapped.id || `PRT-${Date.now()}`;
      const now = Date.now();

      await sql`
        INSERT INTO inventory (id, categoria, codigo, nombre, cantidad, unidad_medida,
          cliente_id, marca, modelo, estado, uuid_sync, updated_at, data)
        VALUES (
          ${id}, ${mapped.categoria}, ${mapped.codigo}, ${mapped.nombre},
          ${mapped.cantidad}, ${mapped.unidad_medida}, ${mapped.cliente_id},
          ${mapped.marca}, ${mapped.modelo}, ${mapped.estado},
          ${mapped.uuid_sync || id}, ${mapped.updated_at || now}, ${JSON.stringify(body)}
        )
        ON CONFLICT (id) DO UPDATE SET
          categoria = EXCLUDED.categoria, codigo = EXCLUDED.codigo,
          nombre = EXCLUDED.nombre, cantidad = EXCLUDED.cantidad,
          unidad_medida = EXCLUDED.unidad_medida, updated_at = EXCLUDED.updated_at,
          data = EXCLUDED.data
        WHERE EXCLUDED.updated_at > inventory.updated_at OR inventory.updated_at IS NULL
      `;
      return res.json({ success: true, data: { id } });
    }

    if (method === 'DELETE') {
      const id = query.id || body?.id;
      if (!id) return res.status(400).json({ error: 'Falta id' });
      const now = Date.now();
      await sql`UPDATE inventory SET deleted_at = ${now}, updated_at = ${now} WHERE id = ${id}`;
      return res.json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
