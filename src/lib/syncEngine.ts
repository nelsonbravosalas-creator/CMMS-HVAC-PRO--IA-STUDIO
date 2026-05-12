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
          if (result.success && result.results) {
            // result.results is an array of { uuid_sincro, id_oficial }
            for (const res of result.results) {
              const localRecord = await table.where('uuid_sincro').equals(res.uuid_sincro).first();
              if (localRecord) {
                // If it's a ticket, maintaining the primary key might be complex if it's the ID.
                // We use uuid_sincro as the main offline key. The UI uses 'id' or 'tag' as folio.
                const updates: any = { sync_status: 'synced' };
                if (res.folio_oficial) {
                  updates.id = res.folio_oficial; 
                  if (tableName === 'activos') updates.tag = res.folio_oficial;
                }
                // @ts-ignore
                await table.where('uuid_sincro').equals(res.uuid_sincro).modify(updates);
              }
            }
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
