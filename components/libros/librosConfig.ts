export interface LibroConfig {
  tipo: string;
  nombre: string;
  descripcion: string;
  campos: CampoConfig[];
}

export interface CampoConfig {
  nombre: string;
  etiqueta: string;
  tipo: 'texto' | 'numero' | 'fecha' | 'select';
  requerido: boolean;
  longitud?: number;
  decimales?: number;
  opciones?: string[];
}

export type TipoLibro = 'compras' | 'contribuyentes' | 'consumidor';

export interface ColumnaConfig {
  key: string;
  header: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  format?: 'moneda' | 'codigo';
}

export interface ResumenFila {
  label: string;
  valorNeto: number;
  debitoFiscal: number;
  ivaRetenido?: number;
}

export interface LibroLegalConfig {
  titulo: string;
  columnas: ColumnaConfig[];
  mostrarResumen?: boolean;
  resumenFilas?: ResumenFila[];
  getValor: (item: any, key: string) => any;
  calcularTotales: (items: any[]) => Record<string, number>;
}

export const LIBROS_CONFIG: LibroConfig[] = [
  {
    tipo: 'C',
    nombre: 'Libro de Compras',
    descripcion: 'Registro de compras y servicios recibidos',
    campos: [
      { nombre: 'docTipo', etiqueta: 'Tipo Documento', tipo: 'select', requerido: true, opciones: ['DTE', 'DOC'] },
      { nombre: 'docNumero', etiqueta: 'Número Documento', tipo: 'texto', requerido: true, longitud: 20 },
      { nombre: 'fecha', etiqueta: 'Fecha', tipo: 'fecha', requerido: true },
      { nombre: 'nit', etiqueta: 'NIT', tipo: 'texto', requerido: true, longitud: 17 },
      { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true, longitud: 200 },
      { nombre: 'exento', etiqueta: 'Exento', tipo: 'numero', requerido: false, decimales: 2 },
      { nombre: 'noSujeto', etiqueta: 'No Sujeto', tipo: 'numero', requerido: false, decimales: 2 },
      { nombre: 'gravado', etiqueta: 'Gravado', tipo: 'numero', requerido: true, decimales: 2 },
      { nombre: 'iva', etiqueta: 'IVA', tipo: 'numero', requerido: true, decimales: 2 },
      { nombre: 'total', etiqueta: 'Total', tipo: 'numero', requerido: true, decimales: 2 }
    ]
  },
  {
    tipo: 'V',
    nombre: 'Libro de Ventas',
    descripcion: 'Registro de ventas y servicios prestados',
    campos: [
      { nombre: 'docTipo', etiqueta: 'Tipo Documento', tipo: 'select', requerido: true, opciones: ['DTE', 'DOC'] },
      { nombre: 'docNumero', etiqueta: 'Número Documento', tipo: 'texto', requerido: true, longitud: 20 },
      { nombre: 'fecha', etiqueta: 'Fecha', tipo: 'fecha', requerido: true },
      { nombre: 'nit', etiqueta: 'NIT', tipo: 'texto', requerido: true, longitud: 17 },
      { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true, longitud: 200 },
      { nombre: 'exento', etiqueta: 'Exento', tipo: 'numero', requerido: false, decimales: 2 },
      { nombre: 'noSujeto', etiqueta: 'No Sujeto', tipo: 'numero', requerido: false, decimales: 2 },
      { nombre: 'gravado', etiqueta: 'Gravado', tipo: 'numero', requerido: true, decimales: 2 },
      { nombre: 'iva', etiqueta: 'IVA', tipo: 'numero', requerido: true, decimales: 2 },
      { nombre: 'total', etiqueta: 'Total', tipo: 'numero', requerido: true, decimales: 2 }
    ]
  },
  {
    tipo: 'R',
    nombre: 'Libro de Remesas',
    descripcion: 'Registro de remesas y envíos',
    campos: [
      { nombre: 'docTipo', etiqueta: 'Tipo Documento', tipo: 'select', requerido: true, opciones: ['DTE', 'DOC'] },
      { nombre: 'docNumero', etiqueta: 'Número Documento', tipo: 'texto', requerido: true, longitud: 20 },
      { nombre: 'fecha', etiqueta: 'Fecha', tipo: 'fecha', requerido: true },
      { nombre: 'nit', etiqueta: 'NIT', tipo: 'texto', requerido: true, longitud: 17 },
      { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true, longitud: 200 },
      { nombre: 'total', etiqueta: 'Total', tipo: 'numero', requerido: true, decimales: 2 }
    ]
  },
  {
    tipo: 'I',
    nombre: 'Libro de Ingresos',
    descripcion: 'Registro de ingresos y percepciones',
    campos: [
      { nombre: 'docTipo', etiqueta: 'Tipo Documento', tipo: 'select', requerido: true, opciones: ['DTE', 'DOC'] },
      { nombre: 'docNumero', etiqueta: 'Número Documento', tipo: 'texto', requerido: true, longitud: 20 },
      { nombre: 'fecha', etiqueta: 'Fecha', tipo: 'fecha', requerido: true },
      { nombre: 'nit', etiqueta: 'NIT', tipo: 'texto', requerido: true, longitud: 17 },
      { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true, longitud: 200 },
      { nombre: 'gravado', etiqueta: 'Gravado', tipo: 'numero', requerido: true, decimales: 2 },
      { nombre: 'iva', etiqueta: 'IVA', tipo: 'numero', requerido: true, decimales: 2 },
      { nombre: 'total', etiqueta: 'Total', tipo: 'numero', requerido: true, decimales: 2 }
    ]
  }
];

export function getLibroConfig(tipo: string): LibroConfig | undefined {
  return LIBROS_CONFIG.find(config => config.tipo === tipo);
}

export function getTiposLibros(): { tipo: string; nombre: string }[] {
  return LIBROS_CONFIG.map(config => ({
    tipo: config.tipo,
    nombre: config.nombre
  }));
}

export function formatMoneda(valor: any): string {
  if (typeof valor === 'number') {
    return valor.toFixed(2);
  }
  return '0.00';
}

export function getConfigLibro(tipoLibro: TipoLibro): LibroLegalConfig | null {
  switch (tipoLibro) {
    case 'compras':
      return {
        titulo: 'LIBRO DE COMPRAS',
        columnas: [
          { key: 'correlativo', header: 'CORRELATIVO', width: 'w-16', align: 'center' },
          { key: 'fecha', header: 'FECHA', width: 'w-20', align: 'center' },
          { key: 'codigoGeneracion', header: 'CÓDIGO\nGENERACIÓN', width: 'w-32', align: 'center', format: 'codigo' },
          { key: 'nrc', header: 'NRC', width: 'w-20', align: 'center' },
          { key: 'nitSujetoExcluido', header: 'NIT\nSUJETO\nEXCLUIDO', width: 'w-24', align: 'center' },
          { key: 'nombreProveedor', header: 'NOMBRE PROVEEDOR', width: 'w-48', align: 'left' },
          { key: 'comprasExentas', header: 'COMPRAS\nEXENTAS', width: 'w-24', align: 'right', format: 'moneda' },
          { key: 'comprasGravadasLocales', header: 'COMPRAS\nGRAVADAS\nLOCALES', width: 'w-28', align: 'right', format: 'moneda' },
          { key: 'creditoFiscal', header: 'CRÉDITO\nFISCAL', width: 'w-20', align: 'right', format: 'moneda' },
          { key: 'totalCompras', header: 'TOTAL\nCOMPRAS', width: 'w-20', align: 'right', format: 'moneda' },
          { key: 'retencionTerceros', header: 'RETENCIÓN\nDE\nTERCEROS', width: 'w-24', align: 'right', format: 'moneda' },
          { key: 'comprasSujetoExcluido', header: 'COMPRAS\nSUJETO\nEXCLUIDO', width: 'w-28', align: 'right', format: 'moneda' }
        ],
        getValor: (item, key) => item[key] || '',
        calcularTotales: (items) => {
          const totales = {
            comprasExentas: 0,
            comprasGravadasLocales: 0,
            creditoFiscal: 0,
            totalCompras: 0,
            retencionTerceros: 0,
            comprasSujetoExcluido: 0
          };
          
          items.forEach(item => {
            totales.comprasExentas += item.comprasExentas || 0;
            totales.comprasGravadasLocales += item.comprasGravadasLocales || 0;
            totales.creditoFiscal += item.creditoFiscal || 0;
            totales.totalCompras += item.totalCompras || 0;
            totales.retencionTerceros += item.retencionTerceros || 0;
            totales.comprasSujetoExcluido += item.comprasSujetoExcluido || 0;
          });
          
          return totales;
        }
      };
    
    case 'contribuyentes':
      return {
        titulo: 'LIBRO DE VENTAS',
        columnas: [
          { key: 'correlativo', header: 'CORRELATIVO', width: 'w-16', align: 'center' },
          { key: 'fecha', header: 'FECHA', width: 'w-20', align: 'center' },
          { key: 'codigoGeneracion', header: 'CÓDIGO\nGENERACIÓN', width: 'w-32', align: 'center', format: 'codigo' },
          { key: 'formUnico', header: 'FORM\nÚNICO', width: 'w-16', align: 'center' },
          { key: 'cliente', header: 'CLIENTE', width: 'w-48', align: 'left' },
          { key: 'nrc', header: 'NRC', width: 'w-20', align: 'center' },
          { key: 'exportaciones', header: 'EXPORTACIONES', width: 'w-24', align: 'right', format: 'moneda' },
          { key: 'ventasGravadas', header: 'VENTAS\nGRAVADAS', width: 'w-24', align: 'right', format: 'moneda' },
          { key: 'debitoFiscal', header: 'DÉBITO\nFISCAL', width: 'w-20', align: 'right', format: 'moneda' },
          { key: 'ventaCuentaTerceros', header: 'VENTA\nCUENTA\nDE\nTERCEROS', width: 'w-28', align: 'right', format: 'moneda' },
          { key: 'debitoFiscalTerceros', header: 'DÉBITO\nFISCAL\nDE\nTERCEROS', width: 'w-32', align: 'right', format: 'moneda' },
          { key: 'impuestoPercibido', header: 'IMPUESTO\nPERCIBIDO', width: 'w-24', align: 'right', format: 'moneda' },
          { key: 'ventasTotales', header: 'VENTAS\nTOTALES', width: 'w-20', align: 'right', format: 'moneda' }
        ],
        mostrarResumen: true,
        resumenFilas: [
          { label: 'VENTAS GRAVADAS LOCALES', valorNeto: 0, debitoFiscal: 0, ivaRetenido: 0 },
          { label: 'EXPORTACIONES', valorNeto: 0, debitoFiscal: 0, ivaRetenido: 0 },
          { label: 'VENTAS A CUENTA DE TERCEROS', valorNeto: 0, debitoFiscal: 0, ivaRetenido: 0 },
          { label: 'SUBTOTAL', valorNeto: 0, debitoFiscal: 0, ivaRetenido: 0 },
          { label: 'IVA RETENIDO', valorNeto: 0, debitoFiscal: 0, ivaRetenido: 0 },
          { label: 'TOTAL VENTAS', valorNeto: 0, debitoFiscal: 0, ivaRetenido: 0 }
        ],
        getValor: (item, key) => item[key] || '',
        calcularTotales: (items) => {
          const totales = {
            exportaciones: 0,
            ventasGravadas: 0,
            debitoFiscal: 0,
            ventaCuentaTerceros: 0,
            debitoFiscalTerceros: 0,
            impuestoPercibido: 0,
            ventasTotales: 0
          };
          
          items.forEach(item => {
            totales.exportaciones += item.exportaciones || 0;
            totales.ventasGravadas += item.ventasGravadas || 0;
            totales.debitoFiscal += item.debitoFiscal || 0;
            totales.ventaCuentaTerceros += item.ventaCuentaTerceros || 0;
            totales.debitoFiscalTerceros += item.debitoFiscalTerceros || 0;
            totales.impuestoPercibido += item.impuestoPercibido || 0;
            totales.ventasTotales += item.ventasTotales || 0;
          });
          
          return totales;
        }
      };
    
    case 'consumidor':
      return {
        titulo: 'LIBRO DE CONSUMIDOR FINAL',
        columnas: [
          { key: 'fecha', header: 'FECHA', width: 'w-20', align: 'center' },
          { key: 'codigoGeneracionInicial', header: 'CÓDIGO\nGENERACIÓN\nINICIAL', width: 'w-32', align: 'center', format: 'codigo' },
          { key: 'codigoGeneracionFinal', header: 'CÓDIGO\nGENERACIÓN\nFINAL', width: 'w-32', align: 'center', format: 'codigo' },
          { key: 'numeroControlDel', header: 'NÚMERO\nCONTROL\nDEL', width: 'w-24', align: 'center', format: 'codigo' },
          { key: 'numeroControlAl', header: 'NÚMERO\nCONTROL\nAL', width: 'w-24', align: 'center', format: 'codigo' },
          { key: 'ventasExentas', header: 'VENTAS\nEXENTAS', width: 'w-20', align: 'right', format: 'moneda' },
          { key: 'ventasGravadas', header: 'VENTAS\nGRAVADAS', width: 'w-20', align: 'right', format: 'moneda' },
          { key: 'exportaciones', header: 'EXPORTACIONES', width: 'w-24', align: 'right', format: 'moneda' },
          { key: 'ventaTotal', header: 'VENTA\nTOTAL', width: 'w-20', align: 'right', format: 'moneda' }
        ],
        getValor: (item, key) => item[key] || '',
        calcularTotales: (items) => {
          const totales = {
            ventasExentas: 0,
            ventasGravadas: 0,
            exportaciones: 0,
            ventaTotal: 0
          };
          
          items.forEach(item => {
            totales.ventasExentas += item.ventasExentas || 0;
            totales.ventasGravadas += item.ventasGravadas || 0;
            totales.exportaciones += item.exportaciones || 0;
            totales.ventaTotal += item.ventaTotal || 0;
          });
          
          return totales;
        }
      };
    
    default:
      return null;
  }
}
