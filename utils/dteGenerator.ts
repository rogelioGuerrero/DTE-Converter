import { ClientData } from './clientDb';
import { EmisorData } from './emisorDb';

export interface ItemFactura {
  numItem: number;
  tipoItem: number; // 1=Bienes, 2=Servicios
  cantidad: number;
  codigo: string | null;
  uniMedida: number;
  descripcion: string;
  precioUni: number;
  montoDescu: number;
  ventaNoSuj: number;
  ventaExenta: number;
  ventaGravada: number;
  tributos: string[] | null;
  numeroDocumento?: string | null;
  codTributo?: string | null;
  psv?: number;
  noGravado?: number;
  ivaItem?: number;
}

export interface DatosFactura {
  emisor: EmisorData;
  receptor: ClientData;
  items: ItemFactura[];
  tipoDocumento: string;
  tipoTransmision: number;
  formaPago: string;
  condicionOperacion: number;
  observaciones?: string;
}

export interface DTEJSON {
  identificacion: {
    version: number;
    ambiente: string;
    tipoDte: string;
    numeroControl: string;
    codigoGeneracion: string;
    tipoModelo: number;
    tipoOperacion: number;
    tipoContingencia: number | null;
    motivoContin: string | null;
    fecEmi: string;
    horEmi: string;
    tipoMoneda: string;
  };
  documentoRelacionado: null;
  emisor: {
    nit: string;
    nrc: string;
    nombre: string;
    codActividad: string;
    descActividad: string;
    nombreComercial: string | null;
    tipoEstablecimiento: string;
    codEstable: string | null;
    codPuntoVenta: string | null;
    direccion: {
      departamento: string;
      municipio: string;
      complemento: string;
    };
    telefono: string;
    correo: string;
    codEstableMH: string | null;
    codPuntoVentaMH: string | null;
  };
  receptor: {
    tipoDocumento: string | null;
    numDocumento: string | null;
    nrc: string | null;
    nombre: string;
    codActividad: string | null;
    descActividad: string | null;
    direccion: {
      departamento: string;
      municipio: string;
      complemento: string;
    } | null;
    telefono: string | null;
    correo: string;
  };
  otrosDocumentos: null;
  ventaTercero: null;
  cuerpoDocumento: ItemFactura[];
  resumen: {
    totalNoSuj: number;
    totalExenta: number;
    totalGravada: number;
    subTotalVentas: number;
    descuNoSuj: number;
    descuExenta: number;
    descuGravada: number;
    porcentajeDescuento: number;
    totalDescu: number;
    totalIva: number;
    tributos: Array<{
      codigo: string;
      descripcion: string;
      valor: number;
    }> | null;
    subTotal: number;
    ivaRete1: number;
    reteRenta: number;
    montoTotalOperacion: number;
    totalNoGravado: number;
    totalPagar: number;
    totalLetras: string;
    saldoFavor: number;
    condicionOperacion: number;
    pagos: Array<{
      codigo: string;
      montoPago: number;
      referencia: string | null;
      plazo: string | null;
      periodo: number | null;
    }> | null;
    numPagoElectronico: string | null;
  };
  extension: {
    nombEntrega: string | null;
    docuEntrega: string | null;
    nombRecibe: string | null;
    docuRecibe: string | null;
    observaciones: string | null;
    placaVehiculo: string | null;
  } | null;
  apendice: null;
}

const isCodActividad = (value: string | null | undefined): boolean => {
  if (!value) return false;
  return /^\d{5,6}$/.test(value.trim());
};

const isCodDepartamento = (value: string | null | undefined): boolean => {
  if (!value) return false;
  return /^(0[1-9]|1[0-4])$/.test(value.trim());
};

const isCodMunicipio = (value: string | null | undefined): boolean => {
  if (!value) return false;
  return /^(0[1-9]|[1-5]\d|6[0-8])$/.test(value.trim());
};

const normalizeEmisorCodActividad = (value: string | null | undefined): string => {
  const digits = (value || '').replace(/\D/g, '');
  if (digits === '96099') return '96090';
  return digits;
};


// Generar UUID v4
export const generarUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16).toUpperCase();
  });
};

// Generar número de control según formato DTE
export const generarNumeroControl = (tipoDte: string, correlativo: number, codEstableMH: string | null, codPuntoVentaMH: string | null): string => {
  const tipoDoc = tipoDte.padStart(2, '0');
  const corr = correlativo.toString().padStart(15, '0');
  
  // Usar códigos MH si existen, sino fallback a valores por defecto
  const establecimiento = (codEstableMH || 'M001').padEnd(4, '0').slice(0, 4);
  const puntoVenta = (codPuntoVentaMH || 'P001').padEnd(4, '0').slice(0, 4);
  const segmentoMedio = `${establecimiento}${puntoVenta}`;
  
  return `DTE-${tipoDoc}-${segmentoMedio}-${corr}`;
};

// Redondeo según especificación AT (8 decimales para cantidades/precios)
export const redondear = (valor: number, decimales: number = 2): number => {
  const factor = Math.pow(10, decimales);
  return Math.round((valor + Number.EPSILON) * factor) / factor;
};

// Convertir número a letras (simplificado)
export const numeroALetras = (num: number): string => {
  const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
  const decenas = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const especiales = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE'];
  
  const entero = Math.floor(num);
  const centavos = Math.round((num - entero) * 100);
  
  if (entero === 0) return `CERO DÓLARES CON ${centavos.toString().padStart(2, '0')}/100 USD`;
  
  let resultado = '';
  
  if (entero >= 1000) {
    const miles = Math.floor(entero / 1000);
    resultado += miles === 1 ? 'MIL ' : `${unidades[miles]} MIL `;
  }
  
  const resto = entero % 1000;
  if (resto >= 100) {
    const centenas = Math.floor(resto / 100);
    if (centenas === 1 && resto % 100 === 0) {
      resultado += 'CIEN ';
    } else {
      const centenasTexto = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];
      resultado += centenasTexto[centenas] + ' ';
    }
  }
  
  const decenaUnidad = resto % 100;
  if (decenaUnidad > 0) {
    if (decenaUnidad < 10) {
      resultado += unidades[decenaUnidad];
    } else if (decenaUnidad < 16) {
      resultado += especiales[decenaUnidad - 10];
    } else if (decenaUnidad < 20) {
      resultado += 'DIECI' + unidades[decenaUnidad - 10].toLowerCase();
    } else {
      const d = Math.floor(decenaUnidad / 10);
      const u = decenaUnidad % 10;
      if (u === 0) {
        resultado += decenas[d];
      } else if (d === 2) {
        resultado += 'VEINTI' + unidades[u].toLowerCase();
      } else {
        resultado += decenas[d] + ' Y ' + unidades[u];
      }
    }
  }
  
  const moneda = entero === 1 ? 'DÓLAR' : 'DÓLARES';
  return `${resultado.trim()} ${moneda} CON ${centavos.toString().padStart(2, '0')}/100 USD`;
};

// Obtener fecha actual en formato ISO
export const obtenerFechaActual = (): string => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/El_Salvador',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
};

// Obtener hora actual en formato HH:mm:ss
export const obtenerHoraActual = (): string => {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/El_Salvador',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date());
};

// Calcular totales de items
export const calcularTotales = (items: ItemFactura[], tipoDocumento: string = '01') => {
  const totalGravada = items.reduce((sum, item) => sum + item.ventaGravada, 0);
  const totalExenta = items.reduce((sum, item) => sum + item.ventaExenta, 0);
  const totalNoSuj = items.reduce((sum, item) => sum + item.ventaNoSuj, 0);
  const totalDescu = items.reduce((sum, item) => sum + item.montoDescu, 0);
  
  const subTotalVentas = totalGravada + totalExenta + totalNoSuj;
  
  let iva = 0;
  let montoTotal = 0;

  if (tipoDocumento === '01') {
    // Factura (01): Precios incluyen IVA.
    // El IVA total es la suma de los IVAs calculados por ítem (informativo)
    // O se calcula del totalGravada? La guía sugiere sumar los IVAs de los items para consistencia.
    // Pero para el resumen ejecutivo, el Total a Pagar es el SubTotalVentas (menos descuentos).
    iva = items.reduce((sum, item) => sum + (item.ivaItem || 0), 0);
    // En Factura, el IVA ya está en el subTotalVentas
    montoTotal = redondear(subTotalVentas - totalDescu, 2);
  } else {
    // CCF (03) y otros: Precios sin IVA.
    // El IVA se calcula sobre el total gravado
    iva = redondear(totalGravada * 0.13, 2);
    montoTotal = redondear(subTotalVentas + iva - totalDescu, 2);
  }
  
  return {
    totalNoSuj: redondear(totalNoSuj, 2),
    totalExenta: redondear(totalExenta, 2),
    totalGravada: redondear(totalGravada, 2),
    subTotalVentas: redondear(subTotalVentas, 2),
    totalDescu: redondear(totalDescu, 2),
    iva: redondear(iva, 2),
    montoTotal,
    totalPagar: montoTotal,
  };
};

// Generar estructura JSON del DTE
export const generarDTE = (datos: DatosFactura, correlativo: number, ambiente: string = '00'): DTEJSON => {
  const uuid = generarUUID();
  const numeroControl = generarNumeroControl(datos.tipoDocumento, correlativo, datos.emisor.codEstableMH, datos.emisor.codPuntoVentaMH);
  const totales = calcularTotales(datos.items, datos.tipoDocumento);

  const receptorIdDigits = (datos.receptor.nit || '').replace(/[\s-]/g, '').trim();
  const receptorSinDocumento = receptorIdDigits.length === 0;

  const receptorCodActividad = isCodActividad(datos.receptor.actividadEconomica)
    ? datos.receptor.actividadEconomica.trim()
    : null;

  const receptorDescActividad = datos.receptor.descActividad?.trim()
    ? datos.receptor.descActividad.trim()
    : (!isCodActividad(datos.receptor.actividadEconomica) && (datos.receptor.actividadEconomica || '').trim()
        ? (datos.receptor.actividadEconomica || '').trim()
        : null);

  const receptorDireccion =
    isCodDepartamento(datos.receptor.departamento) && isCodMunicipio(datos.receptor.municipio)
      ? {
          departamento: datos.receptor.departamento.trim(),
          municipio: datos.receptor.municipio.trim(),
          complemento: datos.receptor.direccion || '',
        }
      : null;

  const emisorCodActividad = normalizeEmisorCodActividad(datos.emisor.actividadEconomica);
  const emisorDescActividad = (datos.emisor.descActividad || '').trim();
  const montoTotalOperacion =
    datos.tipoDocumento === '01'
      ? redondear(totales.subTotalVentas - totales.totalDescu, 2)
      : totales.montoTotal;
  const totalPagar = montoTotalOperacion;
  const cuerpoDocumento: ItemFactura[] = datos.items.map((item, index) => {
    let ivaItem = 0;
    
    if (datos.tipoDocumento === '01') {
      // Para Factura (01), los montos son IVA incluido.
      // El IVA se calcula hacia atrás: Total - (Total / 1.13)
      if (item.ventaGravada > 0) {
        ivaItem = redondear(item.ventaGravada - (item.ventaGravada / 1.13), 2);
      }
    } else {
      // Para CCF (03) y otros, los montos son sin IVA.
      // El IVA se calcula sobre la venta gravada total de la línea
      ivaItem = item.ventaGravada > 0 ? redondear(item.ventaGravada * 0.13, 2) : 0;
    }

    const tributos = datos.tipoDocumento === '03' && item.ventaGravada > 0 ? ['20'] : null;

    return {
      ...item,
      numItem: index + 1,
      cantidad: redondear(item.cantidad, 8),
      precioUni: redondear(item.precioUni, 8),
      ventaNoSuj: redondear(item.ventaNoSuj, 8),
      ventaExenta: redondear(item.ventaExenta, 8),
      ventaGravada: redondear(item.ventaGravada, 8),
      tributos: tributos, 
      numeroDocumento: item.numeroDocumento ?? null,
      codTributo: null,
      psv: item.psv ?? 0,
      noGravado: item.noGravado ?? 0,
      ivaItem,
    };
  });
  const totalIva =
    datos.tipoDocumento === '01'
      ? redondear(cuerpoDocumento.reduce((sum, item) => sum + (item.ivaItem || 0), 0), 2)
      : totales.iva;
  
  const dteJSON: DTEJSON = {
    identificacion: {
      version: datos.tipoDocumento === '01' ? 1 : 3,
      ambiente,
      tipoDte: datos.tipoDocumento,
      numeroControl,
      codigoGeneracion: uuid,
      tipoModelo: 1,
      tipoOperacion: datos.tipoTransmision,
      tipoContingencia: null,
      motivoContin: null,
      fecEmi: obtenerFechaActual(),
      horEmi: obtenerHoraActual(),
      tipoMoneda: 'USD',
    },
    documentoRelacionado: null,
    emisor: {
      nit: datos.emisor.nit,
      nrc: datos.emisor.nrc,
      nombre: datos.emisor.nombre,
      codActividad: emisorCodActividad,
      descActividad: emisorDescActividad,
      nombreComercial: datos.emisor.nombreComercial || null,
      tipoEstablecimiento: datos.emisor.tipoEstablecimiento || '01',
      codEstable: datos.emisor.codEstableMH || null,
      codPuntoVenta: datos.emisor.codPuntoVentaMH || null,
      direccion: {
        departamento: datos.emisor.departamento,
        municipio: datos.emisor.municipio,
        complemento: datos.emisor.direccion,
      },
      telefono: datos.emisor.telefono,
      correo: datos.emisor.correo,
      codEstableMH: datos.emisor.codEstableMH || null,
      codPuntoVentaMH: datos.emisor.codPuntoVentaMH || null,
    },
    receptor: {
      tipoDocumento: receptorSinDocumento ? null : (receptorIdDigits.length === 9 ? '13' : '36'),
      numDocumento: receptorSinDocumento ? null : datos.receptor.nit,
      nrc: datos.receptor.nrc || null,
      nombre: (datos.receptor.name || '').trim() ? datos.receptor.name : 'Consumidor Final',
      codActividad: receptorCodActividad,
      descActividad: receptorDescActividad,
      direccion: receptorDireccion,
      telefono: datos.receptor.telefono || null,
      correo: datos.receptor.email,
    },
    otrosDocumentos: null,
    ventaTercero: null,
    cuerpoDocumento,
    resumen: {
      totalNoSuj: totales.totalNoSuj,
      totalExenta: totales.totalExenta,
      totalGravada: totales.totalGravada,
      subTotalVentas: totales.subTotalVentas,
      descuNoSuj: 0,
      descuExenta: 0,
      descuGravada: totales.totalDescu,
      porcentajeDescuento: 0,
      totalDescu: totales.totalDescu,
      totalIva,
      tributos: datos.tipoDocumento === '01' ? null : [
        {
          codigo: '20',
          descripcion: 'Impuesto al Valor Agregado 13%',
          valor: totales.iva
        }
      ],
      subTotal: totales.subTotalVentas,
      ivaRete1: 0,
      reteRenta: 0,
      montoTotalOperacion,
      totalNoGravado: 0,
      totalPagar,
      totalLetras: numeroALetras(totalPagar),
      saldoFavor: 0,
      condicionOperacion: datos.condicionOperacion,
      pagos: datos.condicionOperacion === 1 ? [{
        codigo: datos.formaPago,
        montoPago: totalPagar,
        referencia: null,
        plazo: null,
        periodo: null,
      }] : null,
      numPagoElectronico: null,
    },
    extension: {
      nombEntrega: null,
      docuEntrega: null,
      nombRecibe: null,
      docuRecibe: null,
      observaciones: datos.observaciones || null,
      placaVehiculo: null,
    },
    apendice: null,
  };
  
  return dteJSON;
};

// Re-exportar catálogos desde ubicación centralizada
export { tiposDocumento, formasPago, unidadesMedida } from '../catalogos';
