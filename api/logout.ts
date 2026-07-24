export default function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `cmms_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`);
  return res.json({ success: true });
}
