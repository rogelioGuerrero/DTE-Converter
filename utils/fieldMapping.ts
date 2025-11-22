import { FieldConfiguration, DTEData } from '../types';

// --- VENTAS CONFIGURATION (Legacy/Default) ---
// Based on F-07 Manual for Sales
export const VENTAS_CONFIG: FieldConfiguration = [
  { id: 'v1', columnLetter: 'A', label: 'Fecha Emisión', sourceType: 'json', value: 'identificacion.fecEmi', transformation: 'date_ddmmyyyy', enabled: true },
  { id: 'v2', columnLetter: 'B', label: 'Clase Doc', sourceType: 'static', value: '4', transformation: 'none', enabled: true },
  { id: 'v3', columnLetter: 'C', label: 'Tipo DTE', sourceType: 'json', value: 'identificacion.tipoDte', transformation: 'none', enabled: true },
  { id: 'v4', columnLetter: 'D', label: 'Num. Control', sourceType: 'json', value: 'identificacion.numeroControl', transformation: 'remove_hyphens', enabled: true },
  { id: 'v5', columnLetter: 'E', label: 'Sello Recibido', sourceType: 'json', value: 'selloRecibido', transformation: 'none', enabled: true },
  { id: 'v6', columnLetter: 'F', label: 'Cod. Generación', sourceType: 'json', value: 'identificacion.codigoGeneracion', transformation: 'remove_hyphens', enabled: true },
  { id: 'v7', columnLetter: 'G', label: 'Campo Vacío (G)', sourceType: 'static', value: '', transformation: 'none', enabled: true },
  { id: 'v8', columnLetter: 'H', label: 'NRC Cliente', sourceType: 'json', value: 'receptor.nrc', transformation: 'none', enabled: true },
  { id: 'v9', columnLetter: 'I', label: 'Nombre Cliente', sourceType: 'json', value: 'receptor.nombre', transformation: 'none', enabled: true },
  { id: 'v10', columnLetter: 'J', label: 'Total Exenta', sourceType: 'json', value: 'resumen.totalExenta', transformation: 'currency', enabled: true },
  { id: 'v11', columnLetter: 'K', label: 'Total No Sujeta', sourceType: 'json', value: 'resumen.totalNoSuj', transformation: 'currency', enabled: true },
  { id: 'v12', columnLetter: 'L', label: 'Total Gravada', sourceType: 'json', value: 'resumen.totalGravada', transformation: 'currency', enabled: true },
  { id: 'v13', columnLetter: 'M', label: 'Débito Fiscal (IVA)', sourceType: 'json', value: 'resumen.tributos', transformation: 'first_element_currency', enabled: true },
  { id: 'v14', columnLetter: 'N', label: 'Vtas Terceros No Dom', sourceType: 'static', value: '0.00', transformation: 'none', enabled: true },
  { id: 'v15', columnLetter: 'O', label: 'Debito Vtas Terceros', sourceType: 'static', value: '0.00', transformation: 'none', enabled: true },
  { id: 'v16', columnLetter: 'P', label: 'Total Ventas', sourceType: 'json', value: 'resumen.montoTotalOperacion', transformation: 'currency', enabled: true },
  { id: 'v17', columnLetter: 'Q', label: 'DUI (Cliente)', sourceType: 'static', value: '', transformation: 'none', enabled: true },
  { id: 'v18', columnLetter: 'R', label: 'Tipo Operación', sourceType: 'static', value: '1', transformation: 'none', enabled: true },
  { id: 'v19', columnLetter: 'S', label: 'Tipo Ingreso', sourceType: 'static', value: '2', transformation: 'none', enabled: true },
  { id: 'v20', columnLetter: 'T', label: 'Número Anexo', sourceType: 'static', value: '1', transformation: 'none', enabled: true },
];

// Alias for backward compatibility
export const EXACT_SCRIPT_CONFIG = VENTAS_CONFIG;

// --- COMPRAS CONFIGURATION ---
// Based on F-07 Manual Section V (Detalle de Compras)
// Columns A to U
export const COMPRAS_CONFIG: FieldConfiguration = [
  { id: 'c1', columnLetter: 'A', label: 'Fecha Emisión', sourceType: 'json', value: 'identificacion.fecEmi', transformation: 'date_ddmmyyyy', enabled: true },
  { id: 'c2', columnLetter: 'B', label: 'Clase Doc', sourceType: 'static', value: '4', transformation: 'none', enabled: true },
  { id: 'c3', columnLetter: 'C', label: 'Tipo Doc', sourceType: 'json', value: 'identificacion.tipoDte', transformation: 'none', enabled: true },
  { id: 'c4', columnLetter: 'D', label: 'Num. Resolución/Gen', sourceType: 'json', value: 'identificacion.codigoGeneracion', transformation: 'remove_hyphens', enabled: true }, // For DTE usually generation code
  { id: 'c5', columnLetter: 'E', label: 'NRC Proveedor', sourceType: 'json', value: 'emisor.nrc', transformation: 'none', enabled: true },
  { id: 'c6', columnLetter: 'F', label: 'Nombre Proveedor', sourceType: 'json', value: 'emisor.nombre', transformation: 'none', enabled: true },
  { id: 'c7', columnLetter: 'G', label: 'Comp. Int. Exentas', sourceType: 'json', value: 'resumen.totalExenta', transformation: 'currency', enabled: true },
  { id: 'c8', columnLetter: 'H', label: 'Internaciones Exentas', sourceType: 'static', value: '0.00', transformation: 'none', enabled: true },
  { id: 'c9', columnLetter: 'I', label: 'Importaciones Exentas', sourceType: 'static', value: '0.00', transformation: 'none', enabled: true },
  { id: 'c10', columnLetter: 'J', label: 'Comp. Int. Gravadas', sourceType: 'json', value: 'resumen.totalGravada', transformation: 'currency', enabled: true },
  { id: 'c11', columnLetter: 'K', label: 'Internaciones Gravadas', sourceType: 'static', value: '0.00', transformation: 'none', enabled: true },
  { id: 'c12', columnLetter: 'L', label: 'Importaciones Gravadas', sourceType: 'static', value: '0.00', transformation: 'none', enabled: true },
  { id: 'c13', columnLetter: 'M', label: 'Imp. Grav. Servicios', sourceType: 'static', value: '0.00', transformation: 'none', enabled: true },
  { id: 'c14', columnLetter: 'N', label: 'Crédito Fiscal (IVA)', sourceType: 'json', value: 'resumen.tributos', transformation: 'first_element_currency', enabled: true },
  { id: 'c15', columnLetter: 'O', label: 'Total Compras', sourceType: 'json', value: 'resumen.montoTotalOperacion', transformation: 'currency', enabled: true },
  { id: 'c16', columnLetter: 'P', label: 'DUI Proveedor', sourceType: 'static', value: '', transformation: 'none', enabled: true },
  { id: 'c17', columnLetter: 'Q', label: 'Tipo Operación', sourceType: 'static', value: '1', transformation: 'none', enabled: true },
  { id: 'c18', columnLetter: 'R', label: 'Clasificación', sourceType: 'static', value: '1', transformation: 'none', enabled: true }, // 1: Costo, 2: Gasto
  { id: 'c19', columnLetter: 'S', label: 'Sector', sourceType: 'static', value: '1', transformation: 'none', enabled: true }, // 1: Industria...
  { id: 'c20', columnLetter: 'T', label: 'Tipo Costo', sourceType: 'static', value: '1', transformation: 'none', enabled: true },
  { id: 'c21', columnLetter: 'U', label: 'Número Anexo', sourceType: 'static', value: '3', transformation: 'none', enabled: true }, // Anexo 3 for Compras
];


// Helper to get nested property safely
const getNestedValue = (obj: any, path: string): any => {
  return path.split('.').reduce((prev, curr) => (prev ? prev[curr] : undefined), obj);
};

export const extractValue = (data: DTEData, field: any): string => {
  let rawValue: any = '';

  if (field.sourceType === 'static') {
    rawValue = field.value;
  } else {
    rawValue = getNestedValue(data, field.value);
  }

  // Transformations
  if (rawValue === undefined || rawValue === null) rawValue = '';

  switch (field.transformation) {
    case 'date_ddmmyyyy':
      // Expects YYYY-MM-DD
      if (typeof rawValue === 'string' && rawValue.includes('-')) {
        const parts = rawValue.split('-');
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return rawValue;
    
    case 'remove_hyphens':
      return String(rawValue).replace(/-/g, '');
    
    case 'currency':
      const num = parseFloat(rawValue);
      return isNaN(num) ? '0.00' : num.toFixed(2);

    case 'first_element_currency':
      // Special case for tributos array [0].valor
      if (Array.isArray(rawValue) && rawValue.length > 0) {
         const val = parseFloat(rawValue[0].valor);
         return isNaN(val) ? '0.00' : val.toFixed(2);
      }
      return '0.00';

    default:
      return String(rawValue);
  }
};

export const generateHeaderRow = (config: FieldConfiguration): string => {
  return config.map(c => c.enabled ? getHeaderKey(c) : '').join(';') + '\n';
};

const getHeaderKey = (c: any) => {
   if(c.sourceType === 'static') return c.value || '';
   const parts = c.value.split('.');
   return parts[parts.length - 1];
}