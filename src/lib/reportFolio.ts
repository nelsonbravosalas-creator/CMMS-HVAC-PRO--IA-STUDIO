const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const compactToken = (uuid: string, length: number) =>
  uuid.replace(/[^a-z0-9]/gi, '').slice(0, length).toUpperCase();

export const buildDraftReportFolio = (uuid: string) =>
  `INF-BOR-${compactToken(uuid, 6) || 'NUEVO'}`;

export const buildFinalReportFolio = (uuid: string, date = new Date()) =>
  `INF-${String(date.getFullYear()).slice(-2)}-${compactToken(uuid, 8) || 'NUEVO'}`;

export const isDraftReportFolio = (folio?: string) =>
  !folio || /^INF-(?:BOR|PENDIENTE)-/i.test(folio);

export const getReportDisplayFolio = (folio?: string, recordId?: string, uuid?: string) => {
  const candidate = [folio, recordId].find(value => value && value !== uuid && !UUID_PATTERN.test(value));
  return candidate || buildDraftReportFolio(uuid || recordId || 'nuevo');
};
