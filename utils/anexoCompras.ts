import { DTEData, ProcessedFile } from '../types';
import { AppSettings, loadSettings } from './settings';

// --- Anexo 3 (Detalle de Compras) F-07 ---
// Genera la línea CSV de 21 columnas según el Manual de Usuario Anexos F-07 v14.
// Estructura: A..U separadas por ';', sin encabezados.

export interface ComprasRowData {
  fecha: string;            // DD/MM/YYYY
  tipoDte: string;          // '01', '03', '05', etc.
  codigoGeneracion: string; // UUID (se escribe sin guiones)
  proveedorNitNrc: string;  // NRC o NIT del emisor (se escribe sin guiones)
  proveedorDui: string;     // DUI del emisor (vacío si tiene NRC/NIT)
  proveedorNombre: string;
  exentasNoSuj: number;     // totalExenta + totalNoSuj - descuentos
  gravadas: number;         // totalGravada - descuGravada
  iva: number;              // tributo código 20
  total: number;            // montoTotalOperacion
}

const toNum = (v: unknown): number => {
  const n = parseFloat(String(v ?? '0'));
  return isNaN(n) ? 0 : n;
};

const stripId = (v: string | undefined | null): string =>
  (v || '').replace(/[-\s]/g, '');

// Quita comas y punto y coma para no romper el CSV
const sanitizeText = (v: string): string =>
  v.replace(/[;,]/g, ' ').replace(/\s+/g, ' ').trim();

const money = (v: number): string => Math.abs(v).toFixed(2);

// Montos netos de la compra desde el resumen del DTE
export const getComprasMontos = (data: DTEData) => {
  const r = data.resumen;
  const exentasNoSuj = Math.max(
    0,
    toNum(r?.totalExenta) + toNum(r?.totalNoSuj) - toNum(r?.descuExenta) - toNum(r?.descuNoSuj)
  );
  const gravadas = Math.max(0, toNum(r?.totalGravada) - toNum(r?.descuGravada));
  return { exentasNoSuj, gravadas };
};

// IVA del documento: tributo código '20' (fallback al primero)
export const getComprasIva = (data: DTEData): number => {
  const tributos = data.resumen?.tributos;
  if (!Array.isArray(tributos) || tributos.length === 0) return 0;
  const iva = tributos.find(t => t.codigo === '20') || tributos[0];
  return toNum(iva?.valor);
};

// Identificación del proveedor: NRC preferido, NIT como respaldo (sin guiones)
export const getProveedorNitNrc = (data: DTEData): string =>
  stripId(data.emisor?.nrc) || stripId(data.emisor?.nit);

// Columna Q - Tipo de Operación (catálogo DGII):
// 1 = gravada, 2 = no gravada/exenta, 3 = excluida/no constituye renta, 4 = mixta, 0 = sin datos
export const getTipoOperacionCompras = (exentasNoSuj: number, gravadas: number): string => {
  const g = gravadas > 0;
  const e = exentasNoSuj > 0;
  if (g && e) return '4';
  if (g) return '1';
  if (e) return '2';
  return '0';
};

export const comprasRowFromDTE = (data: DTEData): ComprasRowData => {
  const rawDate = data.identificacion?.fecEmi || '';
  const parts = rawDate.split('-');
  const fecha = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : rawDate;
  const { exentasNoSuj, gravadas } = getComprasMontos(data);

  return {
    fecha,
    tipoDte: data.identificacion?.tipoDte || '',
    codigoGeneracion: data.identificacion?.codigoGeneracion || '',
    proveedorNitNrc: getProveedorNitNrc(data),
    proveedorDui: stripId(data.emisor?.numDocumento),
    proveedorNombre: data.emisor?.nombre || '',
    exentasNoSuj,
    gravadas,
    iva: getComprasIva(data),
    total: toNum(data.resumen?.montoTotalOperacion),
  };
};

// Reconstruye la fila desde un archivo ya procesado (exportación tardía).
// Devuelve null si el registro es antiguo y no tiene los datos del proveedor.
export const comprasRowFromFile = (file: ProcessedFile): ComprasRowData | null => {
  const d = file.data;
  const hasProvider = d.proveedorNit || d.proveedorNrc || d.proveedorDui;
  const hasMontos = d.comprasGravadas !== undefined || d.comprasExentasNoSuj !== undefined;
  if (!hasProvider && !hasMontos) return null;

  return {
    fecha: d.date,
    tipoDte: d.tipoDTE || file.dteType || '',
    codigoGeneracion: d.codigoGeneracion || '',
    proveedorNitNrc: stripId(d.proveedorNrc) || stripId(d.proveedorNit),
    proveedorDui: stripId(d.proveedorDui),
    proveedorNombre: d.receiver || '',
    exentasNoSuj: toNum(d.comprasExentasNoSuj),
    gravadas: toNum(d.comprasGravadas),
    iva: toNum(d.iva),
    total: toNum(d.total),
  };
};

// Genera una línea del anexo 3. Las columnas R, S y T se toman de la
// configuración del contribuyente al momento de llamar a esta función,
// salvo que el documento tenga overrides propios.
export const buildComprasCsvLine = (
  row: ComprasRowData,
  settings: AppSettings = loadSettings(),
  overrides?: { clasificacion?: string; tipoCosto?: string }
): string => {
  const cols = [
    row.fecha,                                        // A  Fecha de emisión
    '4',                                              // B  Clase de documento (DTE)
    row.tipoDte,                                      // C  Tipo de documento
    stripId(row.codigoGeneracion),                    // D  Número de documento
    stripId(row.proveedorNitNrc),                     // E  NIT o NRC del proveedor
    sanitizeText(row.proveedorNombre),                // F  Nombre del proveedor
    money(row.exentasNoSuj),                          // G  Compras internas exentas/no sujetas
    '0.00',                                           // H  Internaciones exentas/no sujetas
    '0.00',                                           // I  Importaciones exentas/no sujetas
    money(row.gravadas),                              // J  Compras internas gravadas
    '0.00',                                           // K  Internaciones gravadas de bienes
    '0.00',                                           // L  Importaciones gravadas de bienes
    '0.00',                                           // M  Importaciones gravadas de servicios
    money(row.iva),                                   // N  Crédito fiscal
    money(row.total),                                 // O  Total de compras
    row.proveedorDui,                                 // P  DUI del proveedor
    getTipoOperacionCompras(row.exentasNoSuj, row.gravadas), // Q  Tipo de operación
    overrides?.clasificacion || settings.comprasClasificacion || '1', // R  Clasificación
    settings.comprasSector || '4',                    // S  Sector del sujeto pasivo
    overrides?.tipoCosto || settings.comprasTipoCosto || '5',          // T  Tipo de costo/gasto
    '3',                                              // U  Número de anexo
  ];
  return cols.join(';');
};
