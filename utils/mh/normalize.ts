import type { DTEJSON } from '../dteGenerator';

const onlyDigits = (value: string | null | undefined): string | null => {
  if (value === null || value === undefined) return null;
  const cleaned = value.replace(/\D/g, '');
  return cleaned.length > 0 ? cleaned : null;
};

const trimOrNull = (value: string | null | undefined): string | null => {
  if (value === null || value === undefined) return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
};

export const normalizeDTE = (dte: DTEJSON): DTEJSON => {
  return {
    ...dte,
    identificacion: {
      ...dte.identificacion,
      ambiente: dte.identificacion.ambiente === '01' ? '01' : '00',
      tipoMoneda: 'USD',
      tipoContingencia: dte.identificacion.tipoOperacion === 2 ? dte.identificacion.tipoContingencia : null,
      motivoContin: dte.identificacion.tipoContingencia === 5 ? (trimOrNull(dte.identificacion.motivoContin) as any) : null,
    },
    emisor: {
      ...dte.emisor,
      nit: (onlyDigits(dte.emisor.nit) || ''),
      nrc: (onlyDigits(dte.emisor.nrc) || ''),
      nombre: dte.emisor.nombre.trim(),
      codActividad: (onlyDigits(dte.emisor.codActividad) || dte.emisor.codActividad).trim(),
      descActividad: dte.emisor.descActividad.trim(),
      nombreComercial: trimOrNull(dte.emisor.nombreComercial) as any,
      telefono: dte.emisor.telefono.trim(),
      correo: dte.emisor.correo.trim(),
      codEstableMH: trimOrNull(dte.emisor.codEstableMH) as any,
      codPuntoVentaMH: trimOrNull(dte.emisor.codPuntoVentaMH) as any,
    },
    receptor: {
      ...dte.receptor,
      tipoDocumento: dte.receptor.tipoDocumento ?? null,
      numDocumento: onlyDigits(dte.receptor.numDocumento),
      nrc: onlyDigits(dte.receptor.nrc),
      nombre: dte.receptor.nombre.trim(),
      codActividad: trimOrNull(dte.receptor.codActividad) as any,
      descActividad: trimOrNull(dte.receptor.descActividad) as any,
      correo: dte.receptor.correo.trim(),
      telefono: trimOrNull(dte.receptor.telefono) as any,
      direccion: dte.receptor.direccion
        ? {
            departamento: trimOrNull(dte.receptor.direccion.departamento) as any,
            municipio: trimOrNull(dte.receptor.direccion.municipio) as any,
            complemento: trimOrNull(dte.receptor.direccion.complemento) as any,
          }
        : null,
    },
    cuerpoDocumento: dte.cuerpoDocumento.map((i) => ({
      ...i,
      codigo: i.codigo ? i.codigo.trim() : null,
      descripcion: i.descripcion.trim(),
    })),
    resumen: {
      ...dte.resumen,
      totalLetras: dte.resumen.totalLetras.trim(),
    },
    extension: dte.extension ?? null,
    apendice: dte.apendice ?? null,
  };
};
