import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  const { imageBase64, mimeType } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'imageBase64 requerido' });

  try {
    const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          { text: 'Analiza esta placa de características de un equipo HVAC. Extrae en formato JSON los siguientes campos: marca, modelo, serie, voltaje (número). Si no encuentras un valor, deja string vacío o null.' },
          { inlineData: { data: imageBase64, mimeType: mimeType || 'image/jpeg' } }
        ]
      }]
    });

    const text = result.response.text();
    // Simple text cleaning if model returns triple backticks
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    return res.json({ success: true, data: JSON.parse(jsonStr || '{}') });
  } catch (error: any) {
    console.error("OCR API error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
