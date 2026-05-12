import { db, LocalBase } from './dbLocal';

export const syncData = async () => {
  if (!navigator.onLine) return;

  const tables = ['activos', 'tickets', 'mantenimientos', 'clientes', 'usuarios'] as const;

  for (const tableName of tables) {
    const table = db[tableName];
    // @ts-ignore
    const pending = await table.where('sync_status').startsWith('pending').toArray();

    if (pending.length > 0) {
      console.log(`Sincronizando ${pending.length} registros de ${tableName}...`);
      try {
        const response = await fetch(`/api/sync/${tableName}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ records: pending })
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            // Actualizar estado a synced
            const uuids = pending.map((p: LocalBase) => p.uuid_sincro);
            // @ts-ignore
            await table.where('uuid_sincro').anyOf(uuids).modify({ sync_status: 'synced' });
            console.log(`${tableName} sincronizado correctamente.`);
          }
        }
      } catch (error) {
        console.error(`Error sincronizando ${tableName}:`, error);
      }
    }
  }
};

export const initSyncEngine = () => {
  window.addEventListener('online', syncData);
  // Intentar sincro cada 30 segundos si hay red
  setInterval(syncData, 30000);
  // Sincro inicial
  syncData();
};
