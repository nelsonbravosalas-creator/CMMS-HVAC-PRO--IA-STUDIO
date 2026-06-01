import { getDb } from '../_db.js';

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
    const { method, query, body } = req;
    const id = query.id;

    if (!id) {
      return res.status(400).json({ success: false, error: 'Falta identificador de repuesto' });
    }

    if (method === 'GET') {
      const rows = await sql`
        SELECT * FROM inventory 
        WHERE (id = ${id} OR uuid_sync = ${id}) AND deleted_at IS NULL
      `;
      if (rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Repuesto no encontrado' });
      }
      return res.json({ success: true, data: mapToDexie(rows[0]) });
    }

    if (method === 'PUT') {
      const d = body;
      const now = Date.now();
      await sql`
        UPDATE inventory SET
          categoria = ${d.categoria || ''},
          codigo = ${d.codigo || ''},
          nombre = ${d.nombre || ''},
          cantidad = ${d.stock || 0},
          unidad_medida = ${d.unidad || ''},
          updated_at = ${now},
          data = ${JSON.stringify(d)}
        WHERE id = ${id} OR uuid_sync = ${id}
      `;
      return res.json({ success: true, message: 'Repuesto actualizado' });
    }

    if (method === 'DELETE') {
      const now = Date.now();
      await sql`
        UPDATE inventory 
        SET deleted_at = ${now}, updated_at = ${now} 
        WHERE id = ${id} OR uuid_sync = ${id}
      `;
      return res.json({ success: true, message: 'Repuesto eliminado' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Error en /api/parts/[id]:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
