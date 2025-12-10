import React, { useState, useRef, useEffect } from 'react';
import { Upload, ScanLine, Check, Loader2, Sparkles, Phone, Mail, Save, RotateCw, FileText, AlertCircle, CheckCircle2, Search, Users, Trash2, X } from 'lucide-react';
import { addClient, getClients, deleteClient, ClientData } from '../utils/clientDb';
import { extractDataFromImage } from '../utils/ocr';
import { ToastContainer, useToast } from './Toast';
import Tooltip from './Tooltip';

interface ExtractedData {
  name: string;
  nit: string;
  nrc: string;
  activity: string;
  address: string;
  phone: string;
  email: string;
}

// Validación de NIT/DUI
// NIT tradicional: 14 dígitos (ej: 0614-0210-081052)
// DUI (unificado con NIT): 9 dígitos (ej: 02453099-6) - el cero inicial ES significativo
const validateNIT = (nit: string): { valid: boolean; message: string } => {
  if (!nit) return { valid: true, message: '' };
  const nitClean = nit.replace(/[\s-]/g, '');
  if (nitClean.length === 0) return { valid: true, message: '' };
  if (!/^\d+$/.test(nitClean)) return { valid: false, message: 'Solo números' };
  
  // Acepta NIT (14 dígitos) o DUI (9 dígitos)
  if (nitClean.length === 14) {
    return { valid: true, message: 'NIT válido' };
  } else if (nitClean.length === 9) {
    return { valid: true, message: 'DUI válido' };
  } else {
    return { valid: false, message: `${nitClean.length} dígitos (9 ó 14)` };
  }
};

// Validación de NRC: formato 000000-0 (6-8 dígitos)
const validateNRC = (nrc: string): { valid: boolean; message: string } => {
  if (!nrc) return { valid: true, message: '' };
  const nrcClean = nrc.replace(/[\s-]/g, '');
  if (nrcClean.length === 0) return { valid: true, message: '' };
  if (!/^\d+$/.test(nrcClean)) return { valid: false, message: 'Solo números' };
  if (nrcClean.length < 6 || nrcClean.length > 8) return { valid: false, message: 'Entre 6-8 dígitos' };
  return { valid: true, message: 'NRC válido' };
};

const OCRScanner: React.FC = () => {
  const [image, setImage] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState(false);
  const [fileName, setFileName] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrStatus, setOcrStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [ocrConfidence, setOcrConfidence] = useState<'high' | 'medium' | 'low' | null>(null);
  
  // Historial de clientes
  const [showClientHistory, setShowClientHistory] = useState(false);
  const [clients, setClients] = useState<ClientData[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  
  // Toast notifications
  const { toasts, addToast, removeToast } = useToast();
  
  const [data, setData] = useState<ExtractedData>({
    name: '',
    nit: '',
    nrc: '',
    activity: '',
    address: '',
    phone: '',
    email: ''
  });
  const [isFlipped, setIsFlipped] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cargar clientes al montar
  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      const allClients = await getClients();
      setClients(allClients);
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  };

  // Filtrar clientes por búsqueda
  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    client.nit.includes(clientSearch) ||
    client.nrc.includes(clientSearch)
  );

  // Validaciones en tiempo real
  const nitValidation = validateNIT(data.nit);
  const nrcValidation = validateNRC(data.nrc);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPdfFile = file.type === 'application/pdf';
    setIsPdf(isPdfFile);
    setFileName(file.name);
    setOcrStatus('idle');
    setOcrConfidence(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setImage(dataUrl);
      processImage(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const processImage = async (base64Image: string) => {
    setIsProcessing(true);
    setOcrStatus('processing');
    
    try {
      const extracted = await extractDataFromImage(base64Image);

      // Calcular confianza basada en campos extraídos
      const filledFields = [extracted.name, extracted.nit, extracted.nrc, extracted.activity, extracted.address].filter(Boolean).length;
      if (filledFields >= 4) setOcrConfidence('high');
      else if (filledFields >= 2) setOcrConfidence('medium');
      else setOcrConfidence('low');

      setData((prev) => ({
        ...prev,
        name: extracted.name || prev.name,
        nit: extracted.nit || prev.nit,
        nrc: extracted.nrc || prev.nrc,
        activity: extracted.activity || prev.activity,
        address: extracted.address || prev.address,
      }));
      setOcrStatus('success');
    } catch (error) {
      console.error('Error al extraer datos con Gemini:', error);
      setOcrStatus('error');
      setOcrConfidence(null);
      addToast('No se pudieron extraer datos. Ingresa manualmente.', 'info');
    } finally {
      setIsProcessing(false);
    }
  };

  const clearData = () => {
    setImage(null);
    setIsPdf(false);
    setFileName('');
    setOcrStatus('idle');
    setOcrConfidence(null);
    setData({
      name: '',
      nit: '',
      nrc: '',
      activity: '',
      address: '',
      phone: '',
      email: ''
    });
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
    setSaveStatus('idle');
  };

  const handleSaveClient = async () => {
    if (!data.name || !data.nit) {
      addToast('Nombre y NIT son requeridos', 'error');
      return;
    }
    
    if (!nitValidation.valid) {
      addToast('El formato del NIT no es válido', 'error');
      return;
    }
    
    setIsSaving(true);
    try {
        await addClient({
            ...data,
            timestamp: Date.now()
        });
        setSaveStatus('success');
        addToast('Cliente guardado exitosamente', 'success');
        await loadClients(); // Recargar lista
        setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
        console.error("Error saving client:", error);
        setSaveStatus('error');
        addToast('Error al guardar el cliente', 'error');
    } finally {
        setIsSaving(false);
    }
  };

  const handleDeleteClient = async (id: number) => {
    try {
      await deleteClient(id);
      await loadClients();
      addToast('Cliente eliminado', 'info');
    } catch (error) {
      addToast('Error al eliminar cliente', 'error');
    }
  };

  const selectClient = (client: ClientData) => {
    setData({
      name: client.name,
      nit: client.nit,
      nrc: client.nrc,
      activity: client.activity,
      address: client.address,
      phone: client.phone,
      email: client.email
    });
    setShowClientHistory(false);
    addToast(`Cliente "${client.name}" cargado`, 'success');
  };

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in duration-500">
      
      <div className="text-center mb-10">
        <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-4">
          Digitaliza tus <span className="text-blue-600">Documentos Tributarios</span>
        </h2>
        <p className="max-w-2xl mx-auto text-lg text-gray-500">
          Sube tu tarjeta NIT o NRC y nuestra IA extraerá los datos automáticamente para guardar clientes o generar facturas.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        
        {/* Left Column: Input & Data */}
        <div className="space-y-6">
          
          {/* Upload Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
               <h3 className="font-semibold text-gray-700">1. Subir Documento</h3>
               {image && (
                 <button onClick={clearData} className="text-xs text-red-500 hover:text-red-700 font-medium">
                   Limpiar
                 </button>
               )}
            </div>
            
            <div className="p-6">
              {!image ? (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all group"
                >
                  <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Upload className="w-8 h-8" />
                  </div>
                  <p className="text-sm font-medium text-gray-700 text-center">
                    Haz clic para subir o <span className="text-blue-600 font-bold">tomar foto</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-1 text-center">
                    Soporta JPG, PNG, PDF (Max 5MB)
                  </p>
                </div>
              ) : (
                <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50 aspect-video flex flex-col items-center justify-center group">
                    {isPdf ? (
                      /* PDF Preview - Elegant placeholder */
                      <div className="flex flex-col items-center justify-center p-6 text-center">
                        <div className="w-20 h-24 bg-gradient-to-br from-red-500 to-red-600 rounded-lg shadow-lg flex items-center justify-center mb-4 relative">
                          <FileText className="w-10 h-10 text-white" />
                          <div className="absolute -bottom-1 -right-1 bg-white rounded px-1.5 py-0.5 text-[10px] font-bold text-red-600 shadow">PDF</div>
                        </div>
                        <p className="text-sm font-medium text-gray-700 truncate max-w-full px-4" title={fileName}>
                          {fileName}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">Documento cargado correctamente</p>
                      </div>
                    ) : (
                      /* Image Preview */
                      <img src={image} alt="Documento" className="max-h-full max-w-full object-contain" />
                    )}
                    
                    {/* Processing Overlay */}
                    {isProcessing && (
                        <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                            <div className="relative">
                              <div className="w-16 h-16 border-4 border-blue-200 rounded-full"></div>
                              <div className="absolute inset-0 w-16 h-16 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
                            </div>
                            <p className="text-sm font-semibold text-blue-600 mt-4">Analizando con IA...</p>
                            <p className="text-xs text-gray-400 mt-1">Extrayendo datos del documento</p>
                        </div>
                    )}

                    {/* Status Badge */}
                    {!isProcessing && ocrStatus !== 'idle' && (
                      <div className={`absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium shadow-sm ${
                        ocrStatus === 'success' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {ocrStatus === 'success' ? (
                          <><CheckCircle2 className="w-3.5 h-3.5" /> Datos extraídos</>
                        ) : (
                          <><AlertCircle className="w-3.5 h-3.5" /> Ingreso manual</>
                        )}
                      </div>
                    )}
                </div>
              )}
              <input 
                type="file" 
                ref={fileInputRef}
                className="hidden" 
                accept="image/*,application/pdf"
                capture="environment"
                onChange={handleImageUpload}
              />
            </div>
          </div>

          {/* Extracted Data Form */}
          <div className={`bg-white rounded-2xl shadow-sm border border-gray-200 transition-all duration-500`}>
             <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
               <div className="flex items-center gap-3">
                  <div>
                    <h3 className="font-semibold text-gray-700">Datos del Cliente</h3>
                    <p className="text-[10px] text-gray-400">Edita o ingresa los datos manualmente</p>
                  </div>
                  <Tooltip content="Ver clientes guardados" position="bottom">
                    <button
                      onClick={() => setShowClientHistory(!showClientHistory)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        showClientHistory 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>{clients.length}</span>
                    </button>
                  </Tooltip>
               </div>
               {ocrConfidence && (
                 <Tooltip 
                   content={ocrConfidence === 'high' 
                     ? 'La IA detectó 4-5 campos correctamente' 
                     : ocrConfidence === 'medium' 
                       ? 'La IA detectó 2-3 campos, verifica el resto' 
                       : 'Pocos campos detectados, ingresa manualmente'}
                   position="left"
                 >
                   <span className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 cursor-help ${
                     ocrConfidence === 'high' ? 'bg-green-100 text-green-700' :
                     ocrConfidence === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                     'bg-gray-100 text-gray-600'
                   }`}>
                     <Sparkles className="w-3 h-3"/>
                     {ocrConfidence === 'high' ? 'Alta precisión' : ocrConfidence === 'medium' ? 'Precisión media' : 'Verificar datos'}
                   </span>
                 </Tooltip>
               )}
            </div>

            {/* Panel de Historial de Clientes */}
            {showClientHistory && (
              <div className="border-b border-gray-100 bg-blue-50/50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      placeholder="Buscar por nombre, NIT o NRC..."
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <button
                    onClick={() => setShowClientHistory(false)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {filteredClients.length === 0 ? (
                    <p className="text-center text-sm text-gray-400 py-4">
                      {clients.length === 0 ? 'No hay clientes guardados' : 'Sin resultados'}
                    </p>
                  ) : (
                    filteredClients.slice(0, 10).map((client) => (
                      <div
                        key={client.id}
                        className="flex items-center justify-between p-2 bg-white rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50/50 transition-all group"
                      >
                        <button
                          onClick={() => selectClient(client)}
                          className="flex-1 text-left"
                        >
                          <p className="text-sm font-medium text-gray-800 truncate">{client.name}</p>
                          <p className="text-xs text-gray-400">NIT: {client.nit} | NRC: {client.nrc}</p>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (client.id) handleDeleteClient(client.id);
                          }}
                          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
                {filteredClients.length > 10 && (
                  <p className="text-center text-xs text-gray-400 mt-2">
                    Mostrando 10 de {filteredClients.length} resultados
                  </p>
                )}
              </div>
            )}

            <div className="p-6 space-y-4">
               <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Nombre / Razón Social</label>
                  <input 
                    type="text" 
                    value={data.name} 
                    onChange={(e) => setData({...data, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-mono text-sm"
                  />
               </div>
               
               <div className="grid grid-cols-2 gap-4">
                 <div>
                    <Tooltip content="NIT: 14 dígitos | DUI: 9 dígitos (ej: 02453099-6)" position="top">
                      <label className="block text-xs font-medium text-gray-500 uppercase mb-1 cursor-help"># NIT / DUI</label>
                    </Tooltip>
                    <div className="relative">
                      <input 
                          type="text" 
                          value={data.nit} 
                          onChange={(e) => setData({...data, nit: e.target.value})}
                          placeholder="0000-000000-000-0"
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 outline-none transition-all font-mono text-sm ${
                            data.nit && !nitValidation.valid 
                              ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                              : data.nit && nitValidation.valid 
                                ? 'border-green-300 focus:ring-green-500 focus:border-green-500'
                                : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                          }`}
                      />
                      {data.nit && (
                        <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-medium ${
                          nitValidation.valid ? 'text-green-600' : 'text-red-500'
                        }`}>
                          {nitValidation.message}
                        </span>
                      )}
                    </div>
                 </div>
                 <div>
                    <Tooltip content="Número de Registro de Contribuyente (6-8 dígitos)" position="top">
                      <label className="block text-xs font-medium text-gray-500 uppercase mb-1 cursor-help">NRC</label>
                    </Tooltip>
                    <div className="relative">
                      <input 
                          type="text" 
                          value={data.nrc} 
                          onChange={(e) => setData({...data, nrc: e.target.value})}
                          placeholder="000000-0"
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 outline-none transition-all font-mono text-sm ${
                            data.nrc && !nrcValidation.valid 
                              ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                              : data.nrc && nrcValidation.valid 
                                ? 'border-green-300 focus:ring-green-500 focus:border-green-500'
                                : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                          }`}
                      />
                      {data.nrc && (
                        <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-medium ${
                          nrcValidation.valid ? 'text-green-600' : 'text-red-500'
                        }`}>
                          {nrcValidation.message}
                        </span>
                      )}
                    </div>
                 </div>
               </div>

               <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Giro / Actividad</label>
                  <input 
                    type="text" 
                    value={data.activity} 
                    onChange={(e) => setData({...data, activity: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-mono text-sm"
                  />
               </div>

               <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Dirección</label>
                  <textarea 
                    value={data.address} 
                    onChange={(e) => setData({...data, address: e.target.value})}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-mono text-sm resize-none"
                  />
               </div>

               <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                  <div>
                    <label className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase mb-1">
                        <Phone className="w-3 h-3" /> Teléfono
                    </label>
                    <input 
                        type="text" 
                        value={data.phone} 
                        onChange={(e) => setData({...data, phone: e.target.value})}
                        placeholder="2222-2222"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase mb-1">
                        <Mail className="w-3 h-3" /> Correo
                    </label>
                    <input 
                        type="email" 
                        value={data.email} 
                        onChange={(e) => setData({...data, email: e.target.value})}
                        placeholder="cliente@ejemplo.com"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-mono text-sm"
                    />
                  </div>
               </div>

               <div className="pt-4">
                 <button
                    onClick={handleSaveClient}
                    disabled={isSaving || !data.name}
                    className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white font-medium transition-all ${
                        saveStatus === 'success' 
                            ? 'bg-green-600 hover:bg-green-700' 
                            : 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 hover:-translate-y-0.5'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                 >
                    {isSaving ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : saveStatus === 'success' ? (
                        <>
                            <Check className="w-5 h-5" />
                            <span>Cliente Guardado</span>
                        </>
                    ) : (
                        <>
                            <Save className="w-5 h-5" />
                            <span>Guardar Cliente</span>
                        </>
                    )}
                 </button>
               </div>
            </div>
          </div>

        </div>

        {/* Right Column: Preview & JSON */}
        <div className="perspective-1000 h-[500px]">
            <div 
                className={`relative w-full h-full transition-all duration-700 preserve-3d cursor-pointer ${isFlipped ? 'rotate-y-180' : ''}`}
                onClick={() => setIsFlipped(!isFlipped)}
            >
                {/* Front: Visual Preview */}
                <div className="absolute inset-0 backface-hidden">
                    <div className="bg-gray-900 rounded-2xl shadow-xl overflow-hidden text-white h-full flex flex-col relative group">
                        <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <ScanLine className="w-5 h-5 text-yellow-400" />
                                <h3 className="font-semibold">Vista Previa</h3>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400">Clic para ver JSON</span>
                                <RotateCw className="w-4 h-4 text-gray-500 group-hover:rotate-180 transition-transform duration-500" />
                            </div>
                        </div>
                        
                        <div className="flex-grow p-8 flex items-center justify-center bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
                            {/* Simulated Card Preview */}
                            <div className="w-full max-w-md bg-white text-gray-900 rounded-xl shadow-2xl p-6">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="text-center w-full">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">República de El Salvador</p>
                                        <p className="text-xs font-bold uppercase text-gray-600">Ministerio de Hacienda</p>
                                    </div>
                                </div>
                                
                                <div className="space-y-4 font-mono">
                                    <div>
                                        <p className="text-[10px] text-gray-400 uppercase">Nombre del Contribuyente</p>
                                        <p className="font-bold text-sm truncate">{data.name || '--------------------------------'}</p>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <p className="text-[10px] text-gray-400 uppercase">NIT</p>
                                            <p className="font-bold text-lg tracking-wider border-2 border-gray-200 rounded px-2 py-1 inline-block">
                                                {data.nit || '0000-000000-000-0'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-gray-400 uppercase">NRC</p>
                                            <p className="font-bold text-lg tracking-wider border-2 border-gray-200 rounded px-2 py-1 inline-block">
                                                {data.nrc || '000000-0'}
                                            </p>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-gray-400 uppercase">Giro o Actividad Económica</p>
                                        <p className="font-bold text-xs">{data.activity || '--------------------------------'}</p>
                                    </div>
                                    
                                    <div>
                                        <div className="flex items-center gap-1 mb-1">
                                            <p className="text-[10px] text-gray-400 uppercase">Dirección Principal</p>
                                        </div>
                                        <p className="font-bold text-xs">{data.address || '--------------------------------'}</p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100 mt-2">
                                        <div>
                                            <div className="flex items-center gap-1 mb-1">
                                                <Phone className="w-3 h-3 text-gray-400" />
                                                <p className="text-[10px] text-gray-400 uppercase">Teléfono</p>
                                            </div>
                                            <p className="font-bold text-xs">{data.phone || '----'}</p>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-1 mb-1">
                                                <Mail className="w-3 h-3 text-gray-400" />
                                                <p className="text-[10px] text-gray-400 uppercase">Correo</p>
                                            </div>
                                            <p className="font-bold text-xs truncate" title={data.email}>{data.email || '----'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="p-3 bg-gray-800 text-center text-xs text-gray-400">
                            Diseño digital basado en los datos ingresados
                        </div>
                    </div>
                </div>

                {/* Back: JSON View */}
                <div className="absolute inset-0 backface-hidden rotate-y-180">
                     <div className="bg-gray-800 rounded-2xl shadow-xl border border-gray-700 overflow-hidden h-full flex flex-col">
                        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                           <div className="flex items-center gap-2 text-white">
                              <div className="font-mono text-xs bg-gray-700 px-2 py-1 rounded">JSON</div>
                              <h3 className="font-semibold text-sm">Datos Estructurados</h3>
                           </div>
                           <button 
                             onClick={(e) => {
                                e.stopPropagation();
                                setIsFlipped(false);
                             }}
                             className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
                           >
                             <RotateCw className="w-3 h-3" /> Volver
                           </button>
                        </div>
                        <div className="p-4 bg-gray-900 overflow-auto flex-grow scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                            <pre className="text-xs font-mono text-green-400 whitespace-pre-wrap">
{JSON.stringify(data, null, 2)}
                            </pre>
                        </div>
                    </div>
                </div>
            </div>
            
            <style>{`
                .perspective-1000 { perspective: 1000px; }
                .preserve-3d { transform-style: preserve-3d; }
                .backface-hidden { backface-visibility: hidden; }
                .rotate-y-180 { transform: rotateY(180deg); }
            `}</style>
        </div>
      </div>
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
};

export default OCRScanner;
