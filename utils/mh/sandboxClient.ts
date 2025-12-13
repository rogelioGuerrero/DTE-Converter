import type { TransmisionResult, AdvertenciaMH, ErrorValidacionMH } from './types';

interface TransmitirResponse {
  estado?: string;
  codigoGeneracion?: string;
  selloRecepcion?: string;
  fechaHoraRecepcion?: string;
  fechaHoraProcesamiento?: string;
  numeroControl?: string;
  mensaje?: string;
  enlaceConsulta?: string;
  advertencias?: Array<{ codigo: string; campo?: string; descripcion: string; severidad?: 'BAJA' | 'MEDIA' | 'ALTA' }>;
  errores?: Array<{ codigo: string; campo?: string; descripcion: string; severidad?: string; valorEsperado?: string; valorActual?: string }>;
  [k: string]: unknown;
}

const getProxyUrl = (): string => {
  const raw = (import.meta as any)?.env?.VITE_MH_PROXY_URL as string | undefined;
  const base = raw && raw.trim().length > 0 ? raw : '/api/mh';
  return base.replace(/\/+$/, '');
};

const mapErrores = (raw?: TransmitirResponse['errores']): ErrorValidacionMH[] | undefined => {
  if (!raw || raw.length === 0) return undefined;
  return raw.map((e) => ({
    codigo: e.codigo || 'MH-ERROR',
    campo: e.campo,
    descripcion: e.descripcion || 'Error',
    severidad: 'ERROR',
    valorActual: e.valorActual,
    valorEsperado: e.valorEsperado,
  }));
};

const mapAdvertencias = (raw?: TransmitirResponse['advertencias']): AdvertenciaMH[] | undefined => {
  if (!raw || raw.length === 0) return undefined;
  return raw.map((a) => ({
    codigo: a.codigo,
    descripcion: a.descripcion,
    campo: a.campo,
    severidad: a.severidad,
  }));
};

export const consultarDTESandbox = async <T = unknown>(
  codigoGeneracion: string,
  ambiente: '00' | '01' = '00'
): Promise<T> => {
  const baseUrl = getProxyUrl();
  const url = `${baseUrl}/consulta/${encodeURIComponent(codigoGeneracion)}?ambiente=${encodeURIComponent(ambiente)}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const data = (await res.json().catch(() => ({}))) as T;
  if (!res.ok) {
    throw new Error(`Consulta MH falló (${res.status}): ${JSON.stringify(data)}`);
  }

  return data;
};

export const transmitirDTESandbox = async (jws: string, ambiente: '00' | '01' = '00'): Promise<TransmisionResult> => {
  const baseUrl = getProxyUrl();
  const res = await fetch(`${baseUrl}/transmitir`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      dte: jws,
      ambiente,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as TransmitirResponse;

  const estadoRaw = (data.estado || '').toUpperCase();
  const estado = (estadoRaw as TransmisionResult['estado']) || 'RECHAZADO';

  const result: TransmisionResult = {
    success: estado === 'ACEPTADO' || estado === 'ACEPTADO_CON_ADVERTENCIAS',
    estado,
    codigoGeneracion: data.codigoGeneracion,
    selloRecepcion: data.selloRecepcion,
    numeroControl: data.numeroControl,
    fechaHoraRecepcion: data.fechaHoraRecepcion,
    fechaHoraProcesamiento: data.fechaHoraProcesamiento,
    mensaje: data.mensaje,
    enlaceConsulta: data.enlaceConsulta,
    advertencias: mapAdvertencias(data.advertencias),
    errores: mapErrores(data.errores),
  };

  if (!res.ok) {
    return {
      ...result,
      success: false,
      estado: 'RECHAZADO',
      mensaje: result.mensaje || `Transmisión fallida (${res.status})`,
      errores:
        result.errores && result.errores.length > 0
          ? result.errores
          : [
              {
                codigo: `HTTP-${res.status}`,
                descripcion: 'Error HTTP en transmisión',
                severidad: 'ERROR',
              },
            ],
    };
  }

  return result;
};
