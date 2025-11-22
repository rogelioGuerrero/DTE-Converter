import React, { useState, useEffect } from 'react';
import DropZone from './components/DropZone';
import Stats from './components/Stats';
import FileList from './components/FileList';
import FieldManager from './components/FieldManager';
import DownloadModal from './components/DownloadModal';
import { processJsonContent, downloadCSV } from './utils/processor';
import { VENTAS_CONFIG, COMPRAS_CONFIG, generateHeaderRow } from './utils/fieldMapping';
import { GroupedData, ProcessedFile, FieldConfiguration, AppMode } from './types';
import { LayoutDashboard, RefreshCw, Search, Download, CheckCircle, Settings2, ShoppingCart, FileSpreadsheet } from 'lucide-react';

const App: React.FC = () => {
  const [groupedData, setGroupedData] = useState<GroupedData>({});
  const [errors, setErrors] = useState<ProcessedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [showFieldManager, setShowFieldManager] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  
  // Application Mode: 'ventas' or 'compras'
  const [appMode, setAppMode] = useState<AppMode>('ventas');

  // Load config based on mode
  const [fieldConfig, setFieldConfig] = useState<FieldConfiguration>([]);

  // Initialize or switch config when mode changes
  useEffect(() => {
    const storageKey = `dte_field_config_${appMode}`;
    const saved = localStorage.getItem(storageKey);
    
    if (saved) {
      setFieldConfig(JSON.parse(saved));
    } else {
      // Load default based on mode
      setFieldConfig(appMode === 'ventas' ? VENTAS_CONFIG : COMPRAS_CONFIG);
    }
    
    // Clear data when switching modes to avoid mixing fields
    setGroupedData({});
    setErrors([]);
  }, [appMode]);

  // Save config when changed
  useEffect(() => {
    if (fieldConfig.length > 0) {
      const storageKey = `dte_field_config_${appMode}`;
      localStorage.setItem(storageKey, JSON.stringify(fieldConfig));
    }
  }, [fieldConfig, appMode]);

  // Helper to read file as text promise
  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => reject(new Error("Error reading file"));
      reader.readAsText(file);
    });
  };

  const handleFilesSelected = async (files: File[]) => {
    setIsProcessing(true);
    setProgress({ current: 0, total: files.length });
    
    // Use local vars to accumulate results across batches
    const newGroupedData: GroupedData = { ...groupedData };
    const newErrors: ProcessedFile[] = [...errors];

    // Batch processing configuration
    const BATCH_SIZE = 50; // Process 50 files at a time
    
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);
        
        // Process batch in parallel
        const batchResults = await Promise.all(batch.map(async (file) => {
            try {
                const content = await readFileAsText(file);
                // Pass appMode to processor so it knows whether to grab Receptor or Emisor name
                return processJsonContent(file.name, content, fieldConfig, appMode);
            } catch (error) {
                const uniqueId = Date.now().toString(36) + Math.random().toString(36).substr(2);
                return {
                    id: uniqueId,
                    fileName: file.name,
                    month: 'error',
                    csvLine: '',
                    isValid: false,
                    errorMessage: "Error de lectura",
                    data: { date: '', controlNumber: '', total: '', receiver: '' }
                } as ProcessedFile;
            }
        }));

        // Update state with batch results
        batchResults.forEach(result => {
            if (result.isValid) {
                if (!newGroupedData[result.month]) {
                    newGroupedData[result.month] = [];
                }
                newGroupedData[result.month].push(result);
            } else {
                newErrors.push(result);
            }
        });

        // Update Progress
        setProgress({ current: Math.min(i + BATCH_SIZE, files.length), total: files.length });
        
        // Small delay to allow UI to render the progress bar update
        await new Promise(resolve => setTimeout(resolve, 10));
    }

    setGroupedData(newGroupedData);
    setErrors(newErrors);
    setIsProcessing(false);
  };

  const handleReorder = (month: string, newOrder: ProcessedFile[]) => {
    setGroupedData(prev => ({
      ...prev,
      [month]: newOrder
    }));
  };
  
  const handleRemoveFiles = (idsToRemove: string[]) => {
      const idSet = new Set(idsToRemove);
      const newData = { ...groupedData };
      
      Object.keys(newData).forEach(month => {
          newData[month] = newData[month].filter(file => !idSet.has(file.id));
          // Clean up empty months
          if (newData[month].length === 0) {
              delete newData[month];
          }
      });
      
      setGroupedData(newData);
  };

  const handleReset = () => {
    setGroupedData({});
    setErrors([]);
    setSearchTerm('');
  };

  const handleBatchDownload = (selectedMonths: string[]) => {
    const header = generateHeaderRow(fieldConfig);
    let allLines = "";
    
    // Sort months to ensure chronological order in CSV
    selectedMonths.sort().forEach(month => {
        const files = groupedData[month];
        if (files) {
            allLines += files.map(f => f.csvLine).join('');
        }
    });

    const prefix = appMode === 'ventas' ? 'VENTAS' : 'COMPRAS';
    const label = selectedMonths.length === Object.keys(groupedData).length ? 'CONSOLIDADO' : 'PARCIAL';
    
    downloadCSV(header + allLines, `REPORTE_${prefix}_${label}.csv`);
    setShowDownloadModal(false);
  };

  // Calculate stats
  const filesValues = Object.values(groupedData) as ProcessedFile[][];
  const validFilesCount = filesValues.reduce((acc, files) => acc + files.length, 0);
  const totalFiles = validFilesCount + errors.length;
  const totalAmount = filesValues
    .flat()
    .reduce((acc, file) => acc + parseFloat(file.data.total), 0);

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col font-sans text-slate-900">
      
      {/* Backdrop decoration */}
      <div className={`fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] ${appMode === 'ventas' ? 'from-indigo-100/50' : 'from-emerald-100/50'} via-gray-50 to-white transition-colors duration-700`}></div>

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-40 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-xl shadow-md ${appMode === 'ventas' ? 'bg-indigo-600 shadow-indigo-200' : 'bg-emerald-600 shadow-emerald-200'}`}>
              <LayoutDashboard className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight hidden md:block">
              DTE Converter <span className={appMode === 'ventas' ? 'text-indigo-600' : 'text-emerald-600'}>Pro</span>
            </h1>
          </div>
          
          {/* Mode Switcher */}
          <div className="bg-gray-100 p-1 rounded-lg flex items-center">
             <button 
               onClick={() => setAppMode('ventas')}
               className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${appMode === 'ventas' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
             >
               <FileSpreadsheet className="w-4 h-4" />
               <span>Ventas</span>
             </button>
             <button 
               onClick={() => setAppMode('compras')}
               className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${appMode === 'compras' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
             >
               <ShoppingCart className="w-4 h-4" />
               <span>Compras</span>
             </button>
          </div>
          
          <div className="flex items-center space-x-3">
             {/* Configuration Button */}
             <button 
               onClick={() => setShowFieldManager(true)}
               className={`text-gray-500 px-3 py-1.5 rounded-lg flex items-center space-x-1 text-sm font-medium transition-all border border-transparent ${appMode === 'ventas' ? 'hover:text-indigo-600 hover:bg-indigo-50' : 'hover:text-emerald-600 hover:bg-emerald-50'}`}
             >
               <Settings2 className="w-4 h-4" />
               <span className="hidden sm:inline">Campos</span>
             </button>

             {totalFiles > 0 && (
               <>
                <div className="h-6 w-px bg-gray-200 mx-2 hidden md:block"></div>
                <div className="hidden md:flex relative">
                   <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                   <input 
                      type="text" 
                      placeholder={appMode === 'ventas' ? "Buscar cliente..." : "Buscar proveedor..."}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className={`pl-9 pr-4 py-1.5 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:bg-white outline-none transition-all w-64 ${appMode === 'ventas' ? 'focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200' : 'focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200'}`}
                   />
                </div>
                <button 
                  onClick={handleReset}
                  className="text-gray-500 hover:text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg flex items-center space-x-1 text-sm font-medium transition-all"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span className="hidden sm:inline">Reiniciar</span>
                </button>
               </>
             )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow px-4 sm:px-6 lg:px-8 py-10">
        <div className="max-w-7xl mx-auto">
          
          {totalFiles === 0 ? (
            <div className="text-center mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-4">
                Libro de <span className={appMode === 'ventas' ? 'text-indigo-600' : 'text-emerald-600'}>{appMode === 'ventas' ? 'Ventas' : 'Compras'}</span> a CSV
              </h2>
              <p className="max-w-2xl mx-auto text-lg text-gray-500">
                Selecciona <span className="font-semibold text-gray-700">carpetas sincronizadas (Drive/OneDrive)</span> o archivos locales de {appMode === 'ventas' ? 'facturas' : 'comprobantes'}.
                <br/>El sistema importará automáticamente el lote completo.
              </p>
              <DropZone onFilesSelected={handleFilesSelected} />
            </div>
          ) : (
            <div className="animate-in fade-in duration-500 space-y-8">
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                 <div>
                    <h2 className="text-2xl font-bold text-gray-900">Dashboard de {appMode === 'ventas' ? 'Ventas' : 'Compras'}</h2>
                    <p className="text-gray-500 text-sm">Validación y cálculo completado</p>
                 </div>
                 <button 
                    onClick={() => setShowDownloadModal(true)}
                    className="flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-200 transition-all hover:-translate-y-0.5"
                 >
                    <Download className="w-5 h-5" />
                    <span>Exportar / Descargar</span>
                 </button>
              </div>

              <Stats 
                totalFiles={totalFiles}
                successCount={validFilesCount}
                errorCount={errors.length}
                totalAmount={totalAmount}
              />
              
              <FileList 
                groupedData={groupedData} 
                errors={errors} 
                searchTerm={searchTerm} 
                onReorder={handleReorder}
                onRemoveFiles={handleRemoveFiles}
              />
            </div>
          )}

          {/* Progress Overlay */}
          {isProcessing && (
             <div className="fixed inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
               <div className="flex flex-col items-center bg-white p-8 rounded-2xl shadow-2xl border border-gray-100 max-w-sm w-full">
                 <div className="w-full flex justify-between text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    <span>Procesando</span>
                    <span>{Math.round((progress.current / progress.total) * 100)}%</span>
                 </div>
                 <div className="w-full bg-gray-100 rounded-full h-2 mb-4 overflow-hidden">
                    <div 
                        className={`h-full rounded-full transition-all duration-300 ease-out ${appMode === 'ventas' ? 'bg-indigo-600' : 'bg-emerald-600'}`}
                        style={{ width: `${(progress.current / progress.total) * 100}%` }}
                    ></div>
                 </div>
                 <p className="text-gray-600 text-sm">
                    Analizando {progress.current} de {progress.total} archivos...
                 </p>
               </div>
             </div>
          )}

          {/* Field Manager Modal */}
          {showFieldManager && (
            <FieldManager 
              config={fieldConfig} 
              onConfigChange={setFieldConfig} 
              onClose={() => setShowFieldManager(false)} 
            />
          )}

          {/* Download Manager Modal */}
          <DownloadModal 
            isOpen={showDownloadModal}
            groupedData={groupedData}
            fieldConfig={fieldConfig}
            onClose={() => setShowDownloadModal(false)}
            onDownload={handleBatchDownload}
          />

        </div>
      </main>

      <footer className="border-t border-gray-200 mt-auto bg-white/50">
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <p className="text-sm text-gray-400">
            &copy; {new Date().getFullYear()} DTE Converter Pro.
          </p>
          <div className="flex items-center space-x-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
             <CheckCircle className="w-3 h-3" />
             <span>100% Seguro (Client-side)</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;