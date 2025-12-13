// Utilidad para firma JWS de DTEs
// Basado en la especificación del Ministerio de Hacienda de El Salvador

import type { DTEJSON } from './dteGenerator';
import type { AdvertenciaMH, ErrorValidacionMH, EstadoTransmision, TransmisionResult } from './mh/types';

export type { AdvertenciaMH, ErrorValidacionMH, EstadoTransmision, TransmisionResult } from './mh/types';

// Extraer payload de JWS
export const extraerPayloadJWS = (jws: string): DTEJSON | null => {
  try {
    const parts = jws.split('.');
    if (parts.length !== 3) return null;

    const payloadB64 = parts[1];
    const payloadStr = decodeURIComponent(escape(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))));
    return JSON.parse(payloadStr);
  } catch {
    return null;
  }
};

// Generar sello de recepción fake (para pruebas)
export const generarSelloRecepcionFake = (): string => {
  // Formato: UUID v4 modificado según especificación MH
  const uuid = crypto.randomUUID().toUpperCase();
  return `${uuid}`;
};

// Simular transmisión a Hacienda (MOCK para pruebas - sandbox)
export const transmitirDTEMock = async (
  jws: string,
  ambiente: '00' | '01' = '00'
): Promise<TransmisionResult> => {
  // Simular latencia de red
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));

  // Extraer DTE del JWS para validar
  const dte = extraerPayloadJWS(jws);
  if (!dte) {
    return {
      success: false,
      estado: 'RECHAZADO',
      mensaje: 'No se pudo extraer el DTE del JWS',
      errores: [{
        codigo: 'E-4001',
        descripcion: 'Firma JWS inválida o corrupta',
        severidad: 'ERROR'
      }]
    };
  }

  // Validaciones básicas (simular validación de MH)
  const errores: ErrorValidacionMH[] = [];
  const advertencias: AdvertenciaMH[] = [];

  // Validar campos requeridos
  if (!dte.identificacion?.codigoGeneracion) {
    errores.push({
      codigo: 'E-1001',
      campo: 'identificacion.codigoGeneracion',
      descripcion: 'Falta código de generación',
      severidad: 'ERROR'
    });
  }
  if (!dte.emisor?.nit) {
    errores.push({
      codigo: 'E-1002',
      campo: 'emisor.nit',
      descripcion: 'Falta NIT del emisor',
      severidad: 'ERROR'
    });
  }
  if (!dte.receptor?.numDocumento) {
    errores.push({
      codigo: 'E-1003',
      campo: 'receptor.numDocumento',
      descripcion: 'Falta identificación del receptor',
      severidad: 'ERROR'
    });
  }
  if (!dte.cuerpoDocumento || dte.cuerpoDocumento.length === 0) {
    errores.push({
      codigo: 'E-1004',
      campo: 'cuerpoDocumento',
      descripcion: 'El documento no tiene items',
      severidad: 'ERROR'
    });
  }

  // Validar ambiente
  if (dte.identificacion?.ambiente !== ambiente) {
    errores.push({
      codigo: 'E-2001',
      campo: 'identificacion.ambiente',
      descripcion: `Ambiente incorrecto. Esperado: ${ambiente}, Recibido: ${dte.identificacion?.ambiente}`,
      severidad: 'ERROR',
      valorActual: dte.identificacion?.ambiente,
      valorEsperado: ambiente
    });
  }

  // Agregar advertencias de ejemplo (campos opcionales)
  if (!dte.emisor?.nombreComercial) {
    advertencias.push({
      codigo: 'W001',
      descripcion: 'Campo opcional nombreComercial no incluido'
    });
  }

  // Simular rechazo aleatorio (5% de probabilidad en pruebas)
  if (ambiente === '00' && Math.random() < 0.05) {
    errores.push({
      codigo: 'E-5001',
      descripcion: 'Error simulado de prueba (sandbox)',
      severidad: 'ERROR'
    });
  }

  if (errores.length > 0) {
    return {
      success: false,
      estado: 'RECHAZADO',
      codigoGeneracion: dte.identificacion?.codigoGeneracion,
      mensaje: 'Documento contiene errores de validación',
      errores,
      fechaHoraRecepcion: new Date().toISOString()
    };
  }

  // Éxito
  const sello = generarSelloRecepcionFake();
  const fechaHora = new Date().toISOString();
  
  return {
    success: true,
    estado: 'ACEPTADO',
    codigoGeneracion: dte.identificacion?.codigoGeneracion,
    selloRecepcion: sello,
    numeroControl: dte.identificacion?.numeroControl,
    fechaHoraRecepcion: fechaHora,
    fechaHoraProcesamiento: fechaHora,
    mensaje: 'Documento transmitido exitosamente',
    advertencias: advertencias.length > 0 ? advertencias : undefined,
    enlaceConsulta: `https://consultadte.mh.gob.sv/consulta/${dte.identificacion?.codigoGeneracion}`
  };
};

// Configuración de endpoints (para cuando se conecte a producción)
export const ENDPOINTS_MH = {
  pruebas: {
    autenticacion: 'https://apitest.dtes.mh.gob.sv/seguridad/auth',
    recepcion: 'https://apitest.dtes.mh.gob.sv/fesv/recepciondte',
    consulta: 'https://apitest.dtes.mh.gob.sv/fesv/consultadte',
    anulacion: 'https://apitest.dtes.mh.gob.sv/fesv/anulardte',
  },
  produccion: {
    autenticacion: 'https://api.dtes.mh.gob.sv/seguridad/auth',
    recepcion: 'https://api.dtes.mh.gob.sv/fesv/recepciondte',
    consulta: 'https://api.dtes.mh.gob.sv/fesv/consultadte',
    anulacion: 'https://api.dtes.mh.gob.sv/fesv/anulardte',
  },
};

export interface ProgresoTransmision {
  estado: EstadoTransmision;
  mensaje: string;
  porcentaje: number;
}
