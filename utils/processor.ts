import { DTEData, ProcessedFile, FieldConfiguration, AppMode } from '../types';
import { extractValue, VENTAS_CONFIG } from './fieldMapping';
import { loadSettings } from './settings';

// Standard DTE Types for El Salvador
const VALID_DTE_TYPES = [
  '01', // Factura
  '03', // Comprobante de crédito fiscal
  '04', // Nota de remisión
  '05', // Nota de crédito
  '06', // Nota de débito
  '07', // Comprobante de retención
  '08', // Comprobante de liquidación
  '09', // Documento contable de liquidación
  '11', // Facturas de exportación
  '14', // Factura de sujeto excluido
  '15', // Comprobante de donación
];

export const processJsonContent = (
  fileName: string, 
  jsonContent: string, 
  config: FieldConfiguration = VENTAS_CONFIG,
  mode: AppMode | 'auto' = 'ventas'
): ProcessedFile => {
  const settings = loadSettings();
  // Simple unique ID generation
  const uniqueId = Date.now().toString(36) + Math.random().toString(36).substr(2);

  try {
    const data: DTEData = JSON.parse(jsonContent);

    // Validate essential fields to ensure it's a DTE
    if (!data.identificacion) {
      throw new Error("Estructura JSON inválida: Falta 'identificacion'");
    }

    // Validate DTE Type
    const tipoDte = data.identificacion.tipoDte;
    if (!tipoDte || !VALID_DTE_TYPES.includes(tipoDte)) {
      throw new Error(`Tipo de DTE no válido o desconocido: ${tipoDte || 'Indefinido'}`);
    }

    // Extract essential metadata for grouping/display (kept separate from CSV line generation for UI purposes)
    const rawDate = data.identificacion.fecEmi || '';
    const dateParts = rawDate.split('-');
    const yearMonth = dateParts.length === 3 ? `${dateParts[0]}-${dateParts[1]}` : 'Unknown';
    
    // Safety checks for display data
    const displayDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : rawDate;
    const displayControl = data.identificacion.numeroControl || 'N/A';
    
    // Auto-detect mode if user has configured their NIT/NRC
    let effectiveMode: AppMode = mode === 'auto' ? 'ventas' : mode;
    
    if (settings.myNit || settings.myNrc) {
      const emisorNit = data.emisor?.nit?.replace(/-/g, '') || '';
      const emisorNrc = data.emisor?.nrc?.replace(/-/g, '') || '';
      const myNitClean = settings.myNit.replace(/-/g, '');
      const myNrcClean = settings.myNrc.replace(/-/g, '');
      
      const isMyCompanyEmitter = 
        (myNitClean && emisorNit === myNitClean) || 
        (myNrcClean && emisorNrc === myNrcClean);
      
      effectiveMode = isMyCompanyEmitter ? 'ventas' : 'compras';
    }

    // Determine Counterparty Name based on Mode
    // Ventas (Sales) -> We want to see the Receptor (Client)
    // Compras (Purchases) -> We want to see the Emisor (Provider)
    let displayCounterparty = 'Sin Nombre';
    
    if (effectiveMode === 'compras') {
       displayCounterparty = data.emisor?.nombre || 'Sin Proveedor';
    } else {
       displayCounterparty = data.receptor?.nombre || 'Sin Cliente';
    }

    const displayTotal = (data.resumen?.montoTotalOperacion || 0).toFixed(2);

    // Dynamic CSV Line Generation
    const csvFields = config
      .filter(field => field.enabled)
      .map(field => extractValue(data, field));
    
    const linea = csvFields.join(';') + '\n';

    return {
      id: uniqueId,
      fileName,
      month: yearMonth,
      csvLine: linea,
      isValid: true,
      data: {
        date: displayDate,
        controlNumber: displayControl,
        total: displayTotal,
        receiver: displayCounterparty // This property name remains 'receiver' but holds Counterparty name
      }
    };

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    return {
      id: uniqueId,
      fileName,
      month: 'error',
      csvLine: '',
      isValid: false,
      errorMessage: msg,
      data: { date: '', controlNumber: '', total: '', receiver: '' }
    };
  }
};

export const downloadCSV = (content: string, filename: string) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};