import React, { useCallback, useState, useRef } from 'react';
import { Upload, FolderInput, FilePlus, Link as LinkIcon, Globe, ArrowRight } from 'lucide-react';

interface DropZoneProps {
  onFilesSelected: (files: File[]) => void;
}

type InputMode = 'file' | 'url';

import { notify } from '../utils/notifications';

const DropZone: React.FC<DropZoneProps> = ({ onFilesSelected }) => {
  const [mode, setMode] = useState<InputMode>('file');
  const [isDragging, setIsDragging] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (mode === 'file') setIsDragging(true);
  }, [mode]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (mode === 'file') setIsDragging(false);
  }, [mode]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (mode === 'url') return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesArray = Array.from(e.dataTransfer.files).filter((file: File) => 
        file.name.toLowerCase().endsWith('.json')
      );
      if (filesArray.length === 0) {
        notify('No se detectaron archivos .json en lo que soltaste', 'error');
        return;
      }
      onFilesSelected(filesArray);
      notify(`${filesArray.length} archivos detectados`, 'info');
    }
  }, [onFilesSelected, mode]);

  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('[DropZone] handleFileInput triggered');
    console.log('[DropZone] Total files from input:', e.target.files?.length ?? 0);
    
    if (e.target.files && e.target.files.length > 0) {
      // Log all files received (for debugging folder selection)
      console.log('[DropZone] All files received:', Array.from(e.target.files).map(f => f.name));
      console.log('[DropZone] File types:', Array.from(e.target.files).map(f => f.type));
      console.log('[DropZone] File sizes:', Array.from(e.target.files).map(f => f.size));
      
      // First pass: filter by extension
      let filesArray = Array.from(e.target.files).filter((file: File) => {
        // More flexible JSON detection - trim whitespace and check case-insensitive
        const fileName = file.name.trim().toLowerCase();
        const isJson = fileName.endsWith('.json') || fileName.endsWith('.jsonl');
        console.log(`[DropZone] File: "${file.name}" -> "${fileName}", isJSON: ${isJson}, size: ${file.size}`);
        return isJson;
      });
      
      // If no JSON files found by extension, try content detection
      if (filesArray.length === 0) {
        console.log('[DropZone] No JSON files by extension, trying content detection...');
        
        for (const file of Array.from(e.target.files)) {
          // Check if MIME type suggests JSON
          if (file.type === 'application/json' || file.type === 'text/json') {
            console.log(`[DropZone] Found JSON by MIME type: ${file.name}`);
            filesArray.push(file);
            continue;
          }
          
          // For small files, try reading first few bytes to detect JSON
          if (file.size < 1024 * 1024) { // Only for files < 1MB
            try {
              const text = await file.text();
              const trimmed = text.trim();
              if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
                  (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
                console.log(`[DropZone] Found JSON by content: ${file.name}`);
                filesArray.push(file);
              }
            } catch (err) {
              console.log(`[DropZone] Could not read file ${file.name}:`, err);
            }
          }
        }
      }
      
      console.log('[DropZone] JSON files after filter:', filesArray.length);
      console.log('[DropZone] JSON file names:', filesArray.map(f => f.name));
      
      if (filesArray.length === 0) {
        notify('No se detectaron archivos .json en tu selección. Intenta con archivos que tengan extensión .json o contenido JSON válido.', 'error');
      } else {
        onFilesSelected(filesArray);
        notify(`${filesArray.length} archivos seleccionados`, 'info');
      }
    } else {
      console.log('[DropZone] No files in input event');
    }
    e.target.value = '';
  }, [onFilesSelected]);

  const handleUrlSubmit = async () => {
    if (!urlInput.trim()) return;
    
    setIsFetching(true);
    const urls = urlInput.split('\n').map(u => u.trim()).filter(u => u.length > 0);
    const files: File[] = [];

    try {
        await Promise.all(urls.map(async (url) => {
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const text = await response.text();
                
                // Attempt to guess filename from URL or use random
                let name = url.substring(url.lastIndexOf('/') + 1);
                if (!name.endsWith('.json')) name = `cloud_import_${Date.now()}.json`;

                // Create a File object from the response
                const file = new File([text], name, { type: "application/json" });
                files.push(file);
            } catch (err) {
                console.error(`Failed to fetch ${url}`, err);
                // We could add error handling feedback here
            }
        }));
        
        if (files.length > 0) {
            onFilesSelected(files);
            setUrlInput('');
            notify(`${files.length} archivos cargados correctamente`, 'success');
        } else {
            notify('No se pudieron cargar los archivos desde las URLs proporcionadas. Verifica permisos CORS y validez.', 'error');
        }

    } finally {
        setIsFetching(false);
    }
  };

  const triggerFolderSelect = () => {
    // Check if browser supports directory selection
    const input = folderInputRef.current;
    if (input) {
      console.log('[DropZone] Triggering folder select');
      console.log('[DropZone] webkitdirectory support:', 'webkitdirectory' in input);
      console.log('[DropZone] directory support:', 'directory' in input);
      input.click();
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto mt-10">
      
      {/* Mode Toggles */}
      <div className="flex justify-center mb-4">
         <div className="bg-gray-200 p-1 rounded-xl inline-flex">
             <button 
                onClick={() => setMode('file')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'file' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
             >
                 <Upload className="w-4 h-4" />
                 <span>Subir Archivos/Carpetas</span>
             </button>
             <button 
                onClick={() => setMode('url')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'url' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
             >
                 <LinkIcon className="w-4 h-4" />
                 <span>Nube (URL)</span>
             </button>
         </div>
      </div>

      <div 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative flex flex-col items-center justify-center w-full min-h-[24rem]
          border-3 border-dashed rounded-3xl 
          transition-all duration-300 ease-out overflow-hidden
          ${isDragging && mode === 'file'
            ? 'border-indigo-500 bg-indigo-50 scale-[1.02] shadow-xl' 
            : 'border-gray-300 bg-white shadow-lg shadow-gray-100'
          }
        `}
      >
        
        {mode === 'file' ? (
            <>
                {/* File Upload Content */}
                <div className="flex flex-col items-center justify-center pt-10 pb-8 z-10 w-full px-4 animate-in fade-in duration-300">
                <div className={`
                    p-5 rounded-full mb-6 transition-all duration-300 relative group
                    ${isDragging ? 'bg-indigo-100 scale-110' : 'bg-indigo-50'}
                `}>
                    <div className="absolute inset-0 rounded-full bg-indigo-200 opacity-0 group-hover:opacity-30 animate-pulse"></div>
                    <Upload className={`w-12 h-12 ${isDragging ? 'text-indigo-600' : 'text-indigo-500'}`} />
                </div>
                
                <h3 className="mb-3 text-2xl font-bold text-gray-800 text-center">
                    {isDragging ? '¡Suelta la carpeta aquí!' : 'Importar Lote de Datos'}
                </h3>
                
                <p className="text-sm text-gray-500 max-w-md text-center mb-8 leading-relaxed">
                    Arrastra archivos JSON o una <span className="font-semibold text-indigo-600">carpeta completa</span>.<br/>
                    Compatible con carpetas locales y sincronizadas.
                </p>

                {/* Primary Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 w-full max-w-lg justify-center">
                    
                    <button
                        onClick={triggerFolderSelect}
                        className="flex-1 flex items-center justify-center space-x-2 px-6 py-3.5 bg-white border-2 border-indigo-600 rounded-xl hover:bg-indigo-50 text-indigo-700 font-bold transition-all shadow-sm hover:shadow-md group"
                    >
                        <FolderInput className="w-5 h-5 text-indigo-600 group-hover:scale-110 transition-transform" />
                        <span className="text-center">Carpeta</span>
                    </button>

                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 flex items-center justify-center space-x-2 px-6 py-3.5 bg-white border-2 border-indigo-600 rounded-xl hover:bg-indigo-50 text-indigo-700 font-bold transition-all shadow-sm hover:shadow-md group"
                    >
                        <FilePlus className="w-5 h-5 text-indigo-600 group-hover:scale-110 transition-transform" />
                        <span>Archivos</span>
                    </button>
                </div>
                </div>

            </>
        ) : (
            /* URL Input Mode */
            <div className="flex flex-col items-center justify-center w-full h-full p-8 animate-in fade-in duration-300">
                <div className="p-4 bg-indigo-50 rounded-full mb-4 text-indigo-500">
                    <Globe className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">Importar desde URL</h3>
                <p className="text-sm text-gray-500 text-center mb-6 max-w-md">
                    Ingresa las URLs directas a los archivos JSON (una por línea).<br/>
                    <span className="text-xs text-gray-400 italic">* Asegúrate de que los enlaces sean públicos o tengan permisos CORS habilitados.</span>
                </p>

                <textarea 
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://example.com/factura1.json&#10;https://example.com/factura2.json"
                    className="w-full max-w-lg h-32 p-4 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none bg-gray-50/50 text-gray-900 mb-4 font-mono"
                />

                <button 
                    onClick={handleUrlSubmit}
                    disabled={!urlInput.trim() || isFetching}
                    className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-8 py-3 rounded-xl font-medium shadow-md transition-all"
                >
                    {isFetching ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                        <>
                            <span>Procesar Enlaces</span>
                            <ArrowRight className="w-4 h-4" />
                        </>
                    )}
                </button>
            </div>
        )}
        
        {/* Hidden Inputs */}
        <input 
          ref={fileInputRef}
          type="file" 
          className="hidden" 
          multiple 
          accept=".json"
          onChange={handleFileInput}
        />
        
        <input 
          ref={folderInputRef}
          type="file" 
          className="hidden" 
          multiple
          {...({ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
          onChange={handleFileInput}
        />
      </div>
    </div>
  );
};

export default DropZone;
