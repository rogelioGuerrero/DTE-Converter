import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Printer, Download, ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';
import { GroupedData } from '../../types';
import { getEmisor, EmisorData } from '../../utils/emisorDb';
import { TipoLibro, getConfigLibro, formatMoneda } from './librosConfig';

interface LibroLegalViewerProps {
  groupedData: GroupedData;
  tipoLibro: TipoLibro;
}

const MESES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];

const LibroLegalViewer: React.FC<LibroLegalViewerProps> = ({ groupedData, tipoLibro }) => {
  const [emisor, setEmisor] = useState<EmisorData | null>(null);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number>(0);
  const libroRef = useRef<HTMLDivElement>(null);
  
  const config = useMemo(() => {
    const cfg = getConfigLibro(tipoLibro);
    if (!cfg) {
      console.error(`Configuración no encontrada para tipoLibro: ${tipoLibro}`);
    }
    return cfg;
  }, [tipoLibro]);

  // Si no hay config, mostrar mensaje de error
  if (!config) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-red-200 p-8 text-center">
        <BookOpen className="w-12 h-12 text-red-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-red-900 mb-2">Error de Configuración</h3>
        <p className="text-red-500 text-sm">
          No se encontró la configuración para el tipo de libro: {tipoLibro}
        </p>
      </div>
    );
  }

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

  // Generar items del libro según el tipo
  const items = useMemo(() => {
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
      
      // Mapear según el tipo de libro
      switch (tipoLibro) {
        case 'compras':
          return {
            correlativo: index + 1,
            fecha: file.data.date,
            codigoGeneracion: csvParts[3] || '',
            nrc: csvParts[4] || '',
            nitSujetoExcluido: '',
            nombreProveedor: file.data.receiver,
            comprasExentas: parseFloat(csvParts[6] || '0'),
            comprasGravadasLocales: parseFloat(csvParts[9] || '0'),
            creditoFiscal: parseFloat(csvParts[13] || '0'),
            totalCompras: parseFloat(file.data.total),
            retencionTerceros: 0,
            comprasSujetoExcluido: 0,
          };
        
        case 'contribuyentes':
          return {
            correlativo: index + 1,
            fecha: file.data.date,
            codigoGeneracion: csvParts[5] || csvParts[3] || '', // selloRecibido o codigoGeneracion
            formUnico: '',
            cliente: file.data.receiver,
            nrc: csvParts[7] || '', // receptor.nrc
            exportaciones: 0,
            ventasGravadas: parseFloat(csvParts[11] || '0'), // totalGravada
            debitoFiscal: parseFloat(csvParts[12] || '0'), // tributos
            ventaCuentaTerceros: 0,
            debitoFiscalTerceros: 0,
            impuestoPercibido: 0,
            ventasTotales: parseFloat(file.data.total),
          };
        
        case 'consumidor':
          return {
            fecha: file.data.date,
            codigoGeneracionInicial: csvParts[5] || csvParts[3] || '',
            codigoGeneracionFinal: csvParts[5] || csvParts[3] || '',
            numeroControlDel: csvParts[3] || '',
            numeroControlAl: csvParts[3] || '',
            ventasExentas: parseFloat(csvParts[9] || '0'), // totalExenta
            ventasGravadas: parseFloat(csvParts[11] || '0'), // totalGravada
            exportaciones: 0,
            ventaTotal: parseFloat(file.data.total),
          };
        
        default:
          return {};
      }
    });
  }, [selectedMonth, groupedData, tipoLibro]);

  // Calcular totales usando la config
  const totales = useMemo(() => {
    return config.calcularTotales(items);
  }, [items, config]);

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
        table { width: 100%; border-collapse: collapse; font-size: 9px; }
        th, td { border: 1px solid #ccc; padding: 3px 5px; }
        th { background-color: #f3f4f6; font-weight: bold; }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .text-left { text-align: left; }
        .font-bold { font-weight: bold; }
        .bg-gray-100 { background-color: #f3f4f6; }
        .border-t-2 { border-top: 2px solid #1f2937; }
        .font-mono { font-family: monospace; font-size: 8px; }
        .print-signature { margin-top: 40px; }
        .print-signature-line { border-bottom: 1px solid #000; height: 40px; margin-bottom: 8px; }
        .resumen-table { margin-top: 20px; font-size: 9px; }
        .resumen-table th, .resumen-table td { border: 1px solid #ccc; padding: 4px 6px; }
        h1 { font-size: 16px; margin-bottom: 8px; }
        h2 { font-size: 14px; margin-bottom: 16px; }
      </style>
    `;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${config.titulo} - ${selectedMonth || ''}</title>
          ${printStyles}
        </head>
        <body>
          ${libroContent}
        </body>
      </html>
    `);
    
    printWindow.document.close();
    
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const handleExportCSV = () => {
    if (!selectedMonth) return;
    
    // Headers
    let csv = config.columnas.map(col => col.header.replace(/\n/g, ' ')).join(';') + '\n';
    
    // Data rows
    items.forEach(item => {
      const row = config.columnas.map(col => {
        const valor = config.getValor(item, col.key);
        if (col.format === 'moneda') {
          return typeof valor === 'number' ? valor.toFixed(2) : valor;
        }
        return String(valor || '');
      });
      csv += row.join(';') + '\n';
    });

    // Totales row
    const totalesKeys = Object.keys(totales);
    if (totalesKeys.length > 0) {
      const totalesRow = config.columnas.map(col => {
        if (totales[col.key] !== undefined) {
          return totales[col.key].toFixed(2);
        }
        return '';
      });
      csv += totalesRow.join(';') + '\n';
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${config.titulo.replace(/\s+/g, '_')}_${selectedMonth}.csv`;
    link.click();
  };

  if (availableMonths.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay datos disponibles</h3>
        <p className="text-gray-500 text-sm">
          Sube archivos JSON primero para ver el {config.titulo}.
        </p>
      </div>
    );
  }

  // Renderizar celda según formato
  const renderCelda = (valor: any, formato?: string) => {
    if (formato === 'moneda') {
      return formatMoneda(valor);
    }
    if (formato === 'codigo') {
      return <span className="font-mono text-[10px]">{valor}</span>;
    }
    return valor || '';
  };

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
              {config.titulo}
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
                {config.columnas.map((col, idx) => (
                  <th
                    key={idx}
                    className={`px-2 py-3 font-bold border-r border-gray-300 ${col.width || ''} ${
                      col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'
                    }`}
                  >
                    {col.header.split('\n').map((line, i) => (
                      <React.Fragment key={i}>
                        {i > 0 && <br />}
                        {line}
                      </React.Fragment>
                    ))}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, rowIdx) => (
                <tr key={rowIdx} className="border-b border-gray-200 hover:bg-gray-50">
                  {config.columnas.map((col, colIdx) => (
                    <td
                      key={colIdx}
                      className={`px-2 py-2 border-r border-gray-200 ${
                        col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : ''
                      } ${col.format === 'moneda' && Number(config.getValor(item, col.key) || 0) > 0 ? 'font-semibold' : ''}`}
                    >
                      {renderCelda(config.getValor(item, col.key), col.format) || ''}
                    </td>
                  ))}
                </tr>
              ))}
              {/* Fila de Totales */}
              <tr className="bg-gray-100 border-t-2 border-gray-800 font-bold">
                {config.columnas.map((col, idx) => {
                  const total = totales[col.key];
                  return (
                    <td
                      key={idx}
                      className={`px-2 py-3 border-r border-gray-300 ${
                        col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : ''
                      }`}
                    >
                      {idx === 5 ? 'TOTALES' : total !== undefined ? total.toFixed(2) : ''}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Resumen de operaciones (solo para contribuyentes) */}
        {config.mostrarResumen && config.resumenFilas && (
          <div className="p-6 border-t border-gray-300">
            <div className="text-center mb-4">
              <h3 className="font-bold text-sm">RESUMEN DE OPERACIONES</h3>
            </div>
            <table className="w-full text-xs resumen-table">
              <thead>
                <tr className="bg-gray-100">
                  <th className="text-left px-2 py-2 border border-gray-300">Descripción</th>
                  <th className="text-right px-2 py-2 border border-gray-300 w-28">VALOR NETO</th>
                  <th className="text-right px-2 py-2 border border-gray-300 w-28">DEBITO FISCAL</th>
                  <th className="text-right px-2 py-2 border border-gray-300 w-28">IVA RETENIDO</th>
                </tr>
              </thead>
              <tbody>
                {config.resumenFilas.map((fila, idx) => (
                  <tr key={idx} className="border-b border-gray-200">
                    <td className="px-2 py-2 border border-gray-300 font-semibold">{fila.label}</td>
                    <td className="px-2 py-2 text-right border border-gray-300">{fila.valorNeto.toFixed(2)}</td>
                    <td className="px-2 py-2 text-right border border-gray-300">{fila.debitoFiscal.toFixed(2)}</td>
                    <td className="px-2 py-2 text-right border border-gray-300">{fila.ivaRetenido?.toFixed(2) || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

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
export type { TipoLibro };
