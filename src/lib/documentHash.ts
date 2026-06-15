export async function generarHashDocumento(payload: object): Promise<string> {
  const canonical = JSON.stringify(payload, Object.keys(payload).sort());
  const buffer = new TextEncoder().encode(canonical);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
