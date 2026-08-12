const CLIENT_LOGO_PATTERN = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
export const MAX_CLIENT_LOGO_DATA_URL_LENGTH = 320 * 1024;

export function validateClientLogoPayload(payload: any): string | null {
  const logo = payload?.logo_base64;
  if (logo == null || logo === '') return null;
  if (typeof logo !== 'string' || !CLIENT_LOGO_PATTERN.test(logo)) {
    return 'El logo debe ser una imagen PNG, JPG o WEBP valida';
  }
  if (logo.length > MAX_CLIENT_LOGO_DATA_URL_LENGTH) {
    return 'El logo excede el tamano maximo permitido';
  }
  return null;
}
