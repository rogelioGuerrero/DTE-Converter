import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Printer, Download, ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';
import { GroupedData } from '../types';
import { getEmisor, EmisorData } from '../utils/emisorDb';

interface LibroCompraItem {
  correlativo: number;
  fecha: string;
  codigoGeneracion: string;
  nrc: string;
  nitSujetoExcluido: string;
  nombreProveedor: string;
  comprasExentas: number;
  comprasGravadasLocales: number;
  creditoFiscal: number;
  totalCompras: number;
  retencionTerceros: number;
  comprasSujetoExcluido: number;
}

const MESES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];

interface LibroLegalViewerProps {
  groupedData: GroupedData;
  appMode: 'ventas' | 'compras';
}

const LibroLegalViewer: React.FC<LibroLegalViewerProps> = ({ groupedData, appMode }) => {
  const [emisor, setEmisor] = useState<EmisorData | null>(null);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number>(0);
  const libroRef = useRef<HTMLDivElement>(null);

  // Cargar datos del emisor
  useEffect(() => {
    getEmisor().then(setEmisor);
  }, []);

  // Meses disponibles ordenados
  const availableMonths = useMemo(() => {
    return Object.keys(groupedData).sort();
  }, [groupedData]);

  // Mes seleccionado actual
  const selectedMonth = availableMonths[selectedMonthIndex] || null;

  // Generar items del libro para el mes seleccionado
  const items: LibroCompraItem[] = useMemo(() => {
    if (!selectedMonth || !groupedData[selectedMonth]) return [];

    const monthFiles = [...groupedData[selectedMonth]];

    // Ordenar por fecha
    monthFiles.sort((a, b) => {
      const dateA = new Date(a.data.date.split('/').reverse().join('-'));
      const dateB = new Date(b.data.date.split('/').reverse().join('-'));
      return dateA.getTime() - dateB.getTime();
    });

    return monthFiles.map((file, index) => {
      const csvParts = file.csvLine.split(';');
      return {
        correlativo: index + 1,
        fecha: file.data.date,
        codigoGeneracion: csvParts[3] || '', // Columna D
        nrc: csvParts[4] || '', // Columna E
        nitSujetoExcluido: '', // TODO: extraer del JSON si es necesario
        nombreProveedor: file.data.receiver,
        comprasExentas: parseFloat(csvParts[6] || '0'), // Columna G
        comprasGravadasLocales: parseFloat(csvParts[9] || '0'), // Columna J
        creditoFiscal: parseFloat(csvParts[13] || '0'), // Columna N
        totalCompras: parseFloat(file.data.total),
        retencionTerceros: 0,
        comprasSujetoExcluido: 0,
      };
    });
  }, [selectedMonth, groupedData]);

  // Calcular totales
  const totales = useMemo(() => {
    return items.reduce(
      (acc, item) => ({
        comprasExentas: acc.comprasExentas + item.comprasExentas,
        comprasGravadasLocales: acc.comprasGravadasLocales + item.comprasGravadasLocales,
        creditoFiscal: acc.creditoFiscal + item.creditoFiscal,
        totalCompras: acc.totalCompras + item.totalCompras,
      }),
      { comprasExentas: 0, comprasGravadasLocales: 0, creditoFiscal: 0, totalCompras: 0 }
    );
  }, [items]);

  const getNombreMes = (monthKey: string): string => {
    const monthNum = parseInt(monthKey.split('-')[1], 10);
    return MESES[monthNum - 1] || monthKey;
  };

  const getAnio = (monthKey: string): number => {
    return parseInt(monthKey.split('-')[0], 10);
  };

  const handlePrevMonth = () => {
    setSelectedMonthIndex(prev => Math.max(0, prev - 1));
  };

  const handleNextMonth = () => {
    setSelectedMonthIndex(prev => Math.min(availableMonths.length - 1, prev + 1));
  };

  const handlePrint = () => {
    if (!libroRef.current) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const libroContent = libroRef.current.innerHTML;
    const printStyles = `
      <style>
        @page { size: landscape; margin: 10mm; }
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
        table { width: 100%; border-collapse: collapse; font-size: 10px; }
        th, td { border: 1px solid #ccc; padding: 4px 6px; }
        th { background-color: #f3f4f6; font-weight: bold; }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .font-bold { font-weight: bold; }
        .bg-gray-100 { background-color: #f3f4f6; }
        .border-t-2 { border-top: 2px solid #1f2937; }
        .font-mono { font-family: monospace; font-size: 9px; }
        .print-signature { margin-top: 40px; }
        .print-signature-line { border-bottom: 1px solid #000; height: 40px; margin-bottom: 8px; }
      </style>
    `;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Libro de Compras - ${selectedMonth || ''}</title>
          ${printStyles}
        </head>
        <body>
          ${libroContent}
        </body>
      </html>
    `);
    
    printWindow.document.close();
    
    // Esperar a que los estilos se carguen antes de imprimir
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const handleExportCSV = () => {
    if (!selectedMonth) return;
    
    let csv = 'No Corr;Fecha;Codigo de Generacion;NRC;Nit Sujeto Excluido;Nombre del Proveedor;Compras exentas;Compras Gravadas Locales;Credito Fiscal;Total Compras;Retencion a Terceros;Compras a Sujeto Excluido\n';
    
    items.forEach(item => {
      csv += `${item.correlativo};${item.fecha};${item.codigoGeneracion};${item.nrc};${item.nitSujetoExcluido};${item.nombreProveedor};${item.comprasExentas.toFixed(2)};${item.comprasGravadasLocales.toFixed(2)};${item.creditoFiscal.toFixed(2)};${item.totalCompras.toFixed(2)};${item.retencionTerceros.toFixed(2)};${item.comprasSujetoExcluido.toFixed(2)}\n`;
    });

    csv += `;;;;;TOTALES;${totales.comprasExentas.toFixed(2)};${totales.comprasGravadasLocales.toFixed(2)};${totales.creditoFiscal.toFixed(2)};${totales.totalCompras.toFixed(2)};;\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `LIBRO_COMPRAS_${selectedMonth}.csv`;
    link.click();
  };

  if (availableMonths.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay datos disponibles</h3>
        <p className="text-gray-500 text-sm">
          Sube archivos JSON de compras primero para ver el Libro Legal.
        </p>
      </div>
    );
  }

  if (appMode === 'ventas') {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Libro de Ventas</h3>
        <p className="text-gray-500 text-sm">
          El libro legal de ventas estará disponible próximamente.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controles de navegación y acciones */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevMonth}
            disabled={selectedMonthIndex === 0}
            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="text-center min-w-[180px]">
            <div className="text-sm text-gray-500">Período</div>
            <div className="font-semibold text-gray-900">
              {selectedMonth ? `${getNombreMes(selectedMonth)} ${getAnio(selectedMonth)}` : '---'}
            </div>
          </div>
          <button
            onClick={handleNextMonth}
            disabled={selectedMonthIndex === availableMonths.length - 1}
            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="text-sm text-gray-500">
          {selectedMonthIndex + 1} de {availableMonths.length} meses
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
          >
            <Printer className="w-4 h-4" />
            Imprimir
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Libro Legal - Formato Oficial */}
      <div ref={libroRef} className="bg-white shadow-lg border border-gray-300 print:shadow-none print:border-none overflow-hidden">
        {/* Cabecera del Libro */}
        <div className="p-8 border-b-2 border-gray-800 print:p-4">
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-gray-900 uppercase tracking-wide">
              {emisor?.nombre || 'NOMBRE DEL CONTRIBUYENTE'}
            </h1>
            <h2 className="text-lg font-bold text-gray-900 mt-2">
              LIBRO O REGISTRO DE COMPRAS
            </h2>
          </div>
          
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-700">SUCURSAL:</span>
                <span className="text-gray-900">{emisor?.nombreComercial || ''}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-700">MES:</span>
                <span className="text-gray-900 uppercase">
                  {selectedMonth ? getNombreMes(selectedMonth) : ''}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-700">AÑO:</span>
                <span className="text-gray-900">
                  {selectedMonth ? getAnio(selectedMonth) : ''}
                </span>
              </div>
            </div>
            <div className="space-y-1 text-right">
              <div className="flex items-center gap-2 justify-end">
                <span className="font-semibold text-gray-700">NIT:</span>
                <span className="text-gray-900">{emisor?.nit || ''}</span>
              </div>
              <div className="flex items-center gap-2 justify-end">
                <span className="font-semibold text-gray-700">NRC:</span>
                <span className="text-gray-900">{emisor?.nrc || ''}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabla del Libro */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-800">
                <th className="px-2 py-3 text-center font-bold border-r border-gray-300 w-12">No Corr</th>
                <th className="px-2 py-3 text-center font-bold border-r border-gray-300 w-20">Fecha</th>
                <th className="px-2 py-3 text-center font-bold border-r border-gray-300 w-32">Código de<br/>Generación</th>
                <th className="px-2 py-3 text-center font-bold border-r border-gray-300 w-20">NRC</th>
                <th className="px-2 py-3 text-center font-bold border-r border-gray-300 w-24">Nit Sujeto<br/>Excluido</th>
                <th className="px-2 py-3 text-left font-bold border-r border-gray-300">Nombre del Proveedor</th>
                <th className="px-2 py-3 text-right font-bold border-r border-gray-300 w-24">Compras<br/>exentas</th>
                <th className="px-2 py-3 text-right font-bold border-r border-gray-300 w-28">Compras<br/>Gravadas Locales</th>
                <th className="px-2 py-3 text-right font-bold border-r border-gray-300 w-20">Crédito<br/>Fiscal</th>
                <th className="px-2 py-3 text-right font-bold border-r border-gray-300 w-24">Total<br/>Compras</th>
                <th className="px-2 py-3 text-right font-bold border-r border-gray-300 w-24">Retención<br/>a Terceros</th>
                <th className="px-2 py-3 text-right font-bold w-28">Compras a<br/>Sujeto Excluido</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-2 py-2 text-center border-r border-gray-200">{item.correlativo}</td>
                  <td className="px-2 py-2 text-center border-r border-gray-200 whitespace-nowrap">{item.fecha}</td>
                  <td className="px-2 py-2 text-center border-r border-gray-200 font-mono text-[10px]">{item.codigoGeneracion}</td>
                  <td className="px-2 py-2 text-center border-r border-gray-200">{item.nrc}</td>
                  <td className="px-2 py-2 text-center border-r border-gray-200">{item.nitSujetoExcluido}</td>
                  <td className="px-2 py-2 border-r border-gray-200">{item.nombreProveedor}</td>
                  <td className="px-2 py-2 text-right border-r border-gray-200">{item.comprasExentas > 0 ? item.comprasExentas.toFixed(2) : ''}</td>
                  <td className="px-2 py-2 text-right border-r border-gray-200">{item.comprasGravadasLocales > 0 ? item.comprasGravadasLocales.toFixed(2) : ''}</td>
                  <td className="px-2 py-2 text-right border-r border-gray-200">{item.creditoFiscal > 0 ? item.creditoFiscal.toFixed(2) : ''}</td>
                  <td className="px-2 py-2 text-right border-r border-gray-200 font-semibold">{item.totalCompras.toFixed(2)}</td>
                  <td className="px-2 py-2 text-right border-r border-gray-200">{item.retencionTerceros > 0 ? item.retencionTerceros.toFixed(2) : ''}</td>
                  <td className="px-2 py-2 text-right">{item.comprasSujetoExcluido > 0 ? item.comprasSujetoExcluido.toFixed(2) : ''}</td>
                </tr>
              ))}
              {/* Fila de Totales */}
              <tr className="bg-gray-100 border-t-2 border-gray-800 font-bold">
                <td className="px-2 py-3 border-r border-gray-300"></td>
                <td className="px-2 py-3 border-r border-gray-300"></td>
                <td className="px-2 py-3 border-r border-gray-300"></td>
                <td className="px-2 py-3 border-r border-gray-300"></td>
                <td className="px-2 py-3 border-r border-gray-300"></td>
                <td className="px-2 py-3 text-right border-r border-gray-300">TOTALES</td>
                <td className="px-2 py-3 text-right border-r border-gray-300">{totales.comprasExentas.toFixed(2)}</td>
                <td className="px-2 py-3 text-right border-r border-gray-300">{totales.comprasGravadasLocales.toFixed(2)}</td>
                <td className="px-2 py-3 text-right border-r border-gray-300">{totales.creditoFiscal.toFixed(2)}</td>
                <td className="px-2 py-3 text-right border-r border-gray-300">{totales.totalCompras.toFixed(2)}</td>
                <td className="px-2 py-3 border-r border-gray-300"></td>
                <td className="px-2 py-3"></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Pie del reporte con firmas - solo al final */}
        <div className="p-8 border-t border-gray-800 print:mt-8">
          <div className="flex justify-between items-start gap-8">
            {/* Firma izquierda - Contribuyente */}
            <div className="flex-1 text-center">
              <div className="border-b border-gray-800 w-full h-16 mb-2"></div>
              <p className="text-sm font-semibold text-gray-900">
                Nombre Contador o Contribuyente
              </p>
            </div>
            
            {/* Espacio en medio */}
            <div className="w-16"></div>
            
            {/* Firma derecha - Contador */}
            <div className="flex-1 text-center">
              <div className="border-b border-gray-800 w-full h-16 mb-2"></div>
              <p className="text-sm font-semibold text-gray-900">
                Firma Contador o Contribuyente
              </p>
            </div>
          </div>
        </div>

        {/* Pie de página técnico */}
        <div className="p-4 border-t border-gray-300 text-center text-xs text-gray-500">
          <p>Documento generado por DTE Pro - {new Date().toLocaleDateString('es-SV')}</p>
        </div>
      </div>
    </div>
  );
};

export default LibroLegalViewer;
