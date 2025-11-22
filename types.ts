export interface DTEIdentificacion {
  fecEmi: string; // YYYY-MM-DD
  tipoDte: string;
  numeroControl: string;
  codigoGeneracion: string;
}

export interface DTEEmisor {
  nit: string;
  nrc: string;
  nombre: string;
}

export interface DTEReceptor {
  nrc: string;
  nombre: string;
}

export interface DTETributo {
  codigo: string;
  valor: number;
}

export interface DTEResumen {
  totalExenta: number;
  totalNoSuj: number;
  totalGravada: number;
  montoTotalOperacion: number;
  tributos: DTETributo[] | null;
}

export interface DTEData {
  identificacion: DTEIdentificacion;
  selloRecibido: string;
  emisor: DTEEmisor; // Added for Purchases (Compras)
  receptor: DTEReceptor; // Used for Sales (Ventas)
  resumen: DTEResumen;
}

export interface ProcessedFile {
  id: string; // Unique identifier for selection
  fileName: string;
  month: string; // MM
  csvLine: string;
  data: {
    date: string;
    controlNumber: string;
    total: string;
    receiver: string; // Acts as "Counterparty" (Client in Sales, Provider in Purchases)
  };
  isValid: boolean;
  errorMessage?: string;
}

export interface GroupedData {
  [month: string]: ProcessedFile[];
}

// --- Field Mapping Types ---

export type TransformationType = 'none' | 'date_ddmmyyyy' | 'remove_hyphens' | 'currency' | 'first_element_currency';

export interface FieldDefinition {
  id: string;
  columnLetter: string; // A, B, C...
  label: string; // Human readable name (e.g., "Fecha de Emisión")
  sourceType: 'json' | 'static';
  value: string; // If json: object path (e.g. 'identificacion.fecEmi'). If static: the constant value.
  transformation: TransformationType;
  enabled: boolean;
}

export type FieldConfiguration = FieldDefinition[];

export type AppMode = 'ventas' | 'compras';

// --- Historial de exportaciones (IndexedDB) ---
export interface HistoryEntry {
  id?: number;
  timestamp: number; // Epoch ms
  mode: AppMode; // ventas o compras
  fileName: string; // nombre del CSV generado
  totalAmount: number; // monto total incluido en el archivo
  fileCount: number; // número de documentos incluidos
  hash: string; // hash SHA-256 del contenido CSV
}