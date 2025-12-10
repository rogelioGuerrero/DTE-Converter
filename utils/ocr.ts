import { loadSettings } from './settings';

export interface TaxPayerData {
  name: string;
  nit: string;
  nrc: string;
  activity: string;
  address: string;
}

export const INITIAL_DATA: TaxPayerData = {
  name: '',
  nit: '',
  nrc: '',
  activity: '',
  address: '',
};

const MODEL_NAME = 'gemini-2.5-flash';

const PROMPT =
  'Extract the data from this El Salvador Tax ID Card (Tarjeta de IVA/Contribuyente). ' +
  'I need the Name (Nombre), NIT, NRC (Registro), Economic Activity (Giro), and Address (Dirección). ' +
  'If a field is not visible, return an empty string.';

/**
 * Llama a la API de Gemini usando fetch directamente.
 * IMPORTANTE: en producción es mejor hacer esto desde un backend para no exponer la API key en el navegador.
 */
export const extractDataFromImage = async (
  base64Image: string
): Promise<TaxPayerData> => {
  const settings = loadSettings();
  const apiKey = settings.apiKey || (import.meta.env.VITE_GEMINI_API_KEY as string | undefined);

  if (!apiKey) {
    throw new Error('Falta configurar la API Key de Google Gemini. Haz clic 5 veces en el logo para configurarla.');
  }

  // Quitar encabezado data URL si viene así: "data:image/jpeg;base64,XXXX"
  const [header, dataPart] = base64Image.split(',');
  const cleanBase64 = dataPart || base64Image;

  let mimeType = 'image/jpeg';
  if (header && header.startsWith('data:')) {
    const match = header.match(/^data:(.*?);base64/);
    if (match && match[1]) {
      mimeType = match[1];
    }
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType,
              data: cleanBase64,
            },
          },
          {
            text: PROMPT,
          },
        ],
      },
    ],
    systemInstruction: {
      role: 'system',
      parts: [
        {
          text: 'You are an expert OCR system for El Salvador Ministry of Finance documents. Extract fields accurately.',
        },
      ],
    },
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          nit: { type: 'string' },
          nrc: { type: 'string' },
          activity: { type: 'string' },
          address: { type: 'string' },
        },
        required: ['name', 'nit', 'nrc', 'activity', 'address'],
      },
    },
  } as const;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const json = await res.json();

  if (!res.ok) {
    const message = json?.error?.message || 'Error al llamar a Gemini.';
    throw new Error(message);
  }

  const text: string | undefined =
    json?.candidates?.[0]?.content?.parts?.[0]?.text ?? undefined;

  if (!text) {
    throw new Error('Gemini no devolvió texto con los datos extraídos.');
  }

  // Limpiar posibles ```json ... ```
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```/i, '')
    .replace(/```$/i, '');

  let extracted: Partial<TaxPayerData> = {};
  try {
    extracted = JSON.parse(cleaned);
  } catch (err) {
    console.error('No se pudo parsear el JSON devuelto por Gemini:', text);
    throw new Error('Respuesta de Gemini no es JSON válido.');
  }

  return { ...INITIAL_DATA, ...extracted };
};
