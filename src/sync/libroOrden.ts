/**
 * Orden de envío del Libro de Obra.
 *
 * El servidor procesa los inserts de un lote en paralelo, así que dos anotaciones del mismo
 * lote podrían recibir el folio en cualquier orden, y un participante podría llegar antes
 * que su obra. Esta función deja para el ciclo siguiente lo que depende de algo todavía
 * pendiente, y envía una sola anotación por obra por ciclo (la más antigua), de modo que
 * el folio siga el orden en que se escribieron.
 */
export interface ItemDeCola {
  table: string;
  uuid_sync: string;
  operation: 'insert' | 'update' | 'delete';
  data?: any;
}

export function diferirHijosDelLibro<T extends ItemDeCola>(items: T[]): T[] {
  const inserts = items.filter((i) => i.operation === 'insert');
  const obrasPendientes = new Set(inserts.filter((i) => i.table === 'obras').map((i) => i.uuid_sync));
  const obrasConParticipantesPendientes = new Set(
    inserts.filter((i) => i.table === 'participantes_obra').map((i) => String(i.data?.obra_id))
  );
  const anotacionesPendientes = new Set(inserts.filter((i) => i.table === 'anotaciones').map((i) => i.uuid_sync));

  // La anotación más antigua de cada obra es la única que sale en este ciclo.
  const primeraPorObra = new Map<string, T>();
  for (const item of inserts.filter((i) => i.table === 'anotaciones')) {
    const obra = String(item.data?.obra_id);
    const actual = primeraPorObra.get(obra);
    if (!actual || (item.data?.escrito_en ?? 0) < (actual.data?.escrito_en ?? 0)) {
      primeraPorObra.set(obra, item);
    }
  }

  return items.filter((item) => {
    if (item.operation !== 'insert') return true;
    const obra = String(item.data?.obra_id);
    switch (item.table) {
      case 'participantes_obra':
        return !obrasPendientes.has(obra);
      case 'anotacion_acuses':
        return !obrasPendientes.has(obra) && !anotacionesPendientes.has(String(item.data?.anotacion_uuid));
      case 'anotaciones':
        return (
          !obrasPendientes.has(obra) &&
          !obrasConParticipantesPendientes.has(obra) &&
          primeraPorObra.get(obra)?.uuid_sync === item.uuid_sync
        );
      default:
        return true;
    }
  });
}
