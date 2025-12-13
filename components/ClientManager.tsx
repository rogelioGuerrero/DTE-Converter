import React, { useState, useRef, useEffect } from 'react';
import { 
  Loader2, Phone, Mail, Save, Search, Users, Trash2, 
  Download, FileUp, Plus, Edit3, ChevronDown, Building2,
  ScanLine
} from 'lucide-react';
import { 
  addClient, getClients, deleteClient, updateClient, exportClients, importClients, ClientData 
} from '../utils/clientDb';
import { extractDataFromImage } from '../utils/ocr';
import { ToastContainer, useToast } from './Toast';
import Tooltip from './Tooltip';
import { departamentos, getMunicipiosByDepartamento } from '../catalogos';
import { validateNIT, validateNRC, validatePhone, validateEmail } from '../utils/validators';

interface FormData {
  nit: string;
  name: string;
  nrc: string;
  nombreComercial: string;
  actividadEconomica: string;
  departamento: string;
  municipio: string;
  direccion: string;
  email: string;
  telefono: string;
}

const emptyForm: FormData = {
  nit: '',
  name: '',
  nrc: '',
  nombreComercial: '',
  actividadEconomica: '',
  departamento: '',
  municipio: '',
  direccion: '',
  email: '',
  telefono: '',
};

const ClientManager: React.FC = () => {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<ClientData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessingOCR, setIsProcessingOCR] = useState(false);
  
  const { toasts, addToast, removeToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

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

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    client.nit.includes(clientSearch) ||
    client.nrc.includes(clientSearch) ||
    client.nombreComercial?.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const municipios = getMunicipiosByDepartamento(formData.departamento);

  // Validaciones
  const nitValidation = validateNIT(formData.nit);
  const nrcValidation = validateNRC(formData.nrc);
  const phoneValidation = validatePhone(formData.telefono);
  const emailValidation = validateEmail(formData.email);

  const isFormValid = nitValidation.valid && formData.name.trim() && phoneValidation.valid && emailValidation.valid;

  const handleNewClient = () => {
    setSelectedClient(null);
    setFormData(emptyForm);
    setIsEditing(true);
  };

  const handleSelectClient = (client: ClientData) => {
    setSelectedClient(client);
    setFormData({
      nit: client.nit,
      name: client.name,
      nrc: client.nrc,
      nombreComercial: client.nombreComercial || '',
      actividadEconomica: client.actividadEconomica || '',
      departamento: client.departamento || '',
      municipio: client.municipio || '',
      direccion: client.direccion || '',
      email: client.email,
      telefono: client.telefono,
    });
    setIsEditing(false);
  };

  const handleDeleteClient = async (id: number) => {
    try {
      await deleteClient(id);
      await loadClients();
      if (selectedClient?.id === id) {
        setSelectedClient(null);
        setFormData(emptyForm);
        setIsEditing(false);
      }
      addToast('Cliente eliminado', 'info');
    } catch (error) {
      addToast('Error al eliminar cliente', 'error');
    }
  };

  const handleSave = async () => {
    if (!isFormValid) {
      addToast('Completa los campos requeridos correctamente', 'error');
      return;
    }

    setIsSaving(true);
    try {
      if (selectedClient?.id) {
        await updateClient({
          ...selectedClient,
          ...formData,
          timestamp: Date.now(),
        });
        addToast('Cliente actualizado', 'success');
      } else {
        await addClient({
          ...formData,
          timestamp: Date.now(),
        });
        addToast('Cliente guardado', 'success');
      }
      await loadClients();
      setIsEditing(false);
    } catch (error) {
      addToast('Error al guardar', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = async () => {
    try {
      const json = await exportClients();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `clientes-dte-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      addToast(`${clients.length} clientes exportados`, 'success');
    } catch (error) {
      addToast('Error al exportar', 'error');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const result = await importClients(text);
      await loadClients();
      addToast(`${result.imported} importados, ${result.skipped} omitidos (duplicados)`, 'success');
    } catch (error) {
      addToast('Error al importar: formato inválido', 'error');
    }
    if (importInputRef.current) importInputRef.current.value = '';
  };

  const handleOCRUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingOCR(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        try {
          const extracted = await extractDataFromImage(base64);
          setFormData(prev => ({
            ...prev,
            name: extracted.name || prev.name,
            nit: extracted.nit || prev.nit,
            nrc: extracted.nrc || prev.nrc,
            actividadEconomica: extracted.activity || prev.actividadEconomica,
            direccion: extracted.address || prev.direccion,
          }));
          addToast('Datos extraídos con IA', 'success');
        } catch {
          addToast('No se pudieron extraer datos', 'error');
        } finally {
          setIsProcessingOCR(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setIsProcessingOCR(false);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDepartamentoChange = (codigo: string) => {
    setFormData(prev => ({ ...prev, departamento: codigo, municipio: '' }));
  };

  return (
    <div className="h-[calc(100vh-180px)] flex flex-col">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestión de Clientes</h2>
          <p className="text-sm text-gray-500">Administra los receptores para tus documentos DTE</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2">
            <Tooltip content="Importar clientes desde archivo JSON" position="bottom">
              <button
                onClick={() => importInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <FileUp className="w-4 h-4" />
                Importar
              </button>
            </Tooltip>
            <Tooltip content="Exportar todos los clientes a JSON" position="bottom">
              <button
                onClick={handleExport}
                disabled={clients.length === 0}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                Exportar
              </button>
            </Tooltip>
          </div>
          <button
            onClick={handleNewClient}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Nuevo Cliente
          </button>
        </div>
      </div>

      <input type="file" ref={importInputRef} className="hidden" accept=".json" onChange={handleImport} />

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-12 gap-4 min-h-0 md:grid-cols-12">
        
        {/* Left: Client List */}
        <div className="col-span-12 md:col-span-4 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-gray-100 bg-gray-50/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder="Buscar por nombre, NIT..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {filteredClients.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 p-4">
                <Users className="w-10 h-10 mb-2 opacity-50" />
                <p className="text-sm">{clients.length === 0 ? 'Sin clientes' : 'Sin resultados'}</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredClients.map((client) => (
                  <div
                    key={client.id}
                    onClick={() => handleSelectClient(client)}
                    className={`p-3 cursor-pointer transition-colors group ${
                      selectedClient?.id === client.id ? 'bg-blue-50 border-l-2 border-blue-500' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{client.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">NIT: {client.nit}</p>
                        {client.nombreComercial && (
                          <p className="text-xs text-gray-400 truncate">{client.nombreComercial}</p>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (client.id) handleDeleteClient(client.id);
                        }}
                        className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="p-2 border-t border-gray-100 bg-gray-50/50 text-center">
            <span className="text-xs text-gray-400">{clients.length} cliente{clients.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Right: Form */}
        <div className="col-span-12 md:col-span-8 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden mt-4 md:mt-0">
          {!selectedClient && !isEditing ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8">
              <Building2 className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-lg font-medium text-gray-500">Selecciona o crea un cliente</p>
              <p className="text-sm mt-1">Los datos se usarán como receptor en tus facturas DTE</p>
              <button
                onClick={handleNewClient}
                className="mt-6 flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Crear nuevo cliente
              </button>
            </div>
          ) : (
            <>
              {/* Form Header */}
              <div className="p-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-700">
                    {selectedClient ? (isEditing ? 'Editar Cliente' : 'Detalle del Cliente') : 'Nuevo Cliente'}
                  </h3>
                  {!isEditing && selectedClient && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {isEditing && (
                  <Tooltip content="Escanear tarjeta NIT/NRC con IA" position="left">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isProcessingOCR}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-50"
                    >
                      {isProcessingOCR ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ScanLine className="w-3.5 h-3.5" />
                      )}
                      Escanear con IA
                    </button>
                  </Tooltip>
                )}
              </div>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleOCRUpload} />

              {/* Form Content */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  
                  {/* NIT */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">
                      NIT / DUI <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={formData.nit}
                        onChange={(e) => setFormData({ ...formData, nit: e.target.value })}
                        disabled={!isEditing}
                        placeholder="0000-000000-000-0"
                        className={`w-full px-3 py-2 border rounded-lg text-sm font-mono disabled:bg-gray-50 disabled:text-gray-600 ${
                          formData.nit && !nitValidation.valid ? 'border-red-300' : formData.nit && nitValidation.valid ? 'border-green-300' : 'border-gray-300'
                        } focus:ring-2 focus:ring-blue-500 outline-none`}
                      />
                      {formData.nit && (
                        <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-medium ${nitValidation.valid ? 'text-green-600' : 'text-red-500'}`}>
                          {nitValidation.message}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* NRC */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">NRC</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={formData.nrc}
                        onChange={(e) => setFormData({ ...formData, nrc: e.target.value })}
                        disabled={!isEditing}
                        placeholder="000000-0"
                        className={`w-full px-3 py-2 border rounded-lg text-sm font-mono disabled:bg-gray-50 disabled:text-gray-600 ${
                          formData.nrc && !nrcValidation.valid ? 'border-red-300' : formData.nrc && nrcValidation.valid ? 'border-green-300' : 'border-gray-300'
                        } focus:ring-2 focus:ring-blue-500 outline-none`}
                      />
                      {formData.nrc && (
                        <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-medium ${nrcValidation.valid ? 'text-green-600' : 'text-red-500'}`}>
                          {nrcValidation.message}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Nombre */}
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">
                      Nombre del Cliente <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      disabled={!isEditing}
                      placeholder="Nombre completo del cliente"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-50 disabled:text-gray-600 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  {/* Nombre Comercial */}
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Nombre Comercial</label>
                    <input
                      type="text"
                      value={formData.nombreComercial}
                      onChange={(e) => setFormData({ ...formData, nombreComercial: e.target.value })}
                      disabled={!isEditing}
                      placeholder="Personalizar nombre comercial"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-50 disabled:text-gray-600 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  {/* Actividad Económica */}
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Actividad Económica</label>
                    <input
                      type="text"
                      value={formData.actividadEconomica}
                      onChange={(e) => setFormData({ ...formData, actividadEconomica: e.target.value })}
                      disabled={!isEditing}
                      placeholder="Giro o actividad económica"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-50 disabled:text-gray-600 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  {/* Departamento */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Departamento</label>
                    <div className="relative">
                      <select
                        value={formData.departamento}
                        onChange={(e) => handleDepartamentoChange(e.target.value)}
                        disabled={!isEditing}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-50 disabled:text-gray-600 focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white"
                      >
                        <option value="">Seleccionar...</option>
                        {departamentos.map((d) => (
                          <option key={d.codigo} value={d.codigo}>{d.codigo} - {d.nombre}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>

                  {/* Municipio */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Municipio</label>
                    <div className="relative">
                      <select
                        value={formData.municipio}
                        onChange={(e) => setFormData({ ...formData, municipio: e.target.value })}
                        disabled={!isEditing || !formData.departamento}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-50 disabled:text-gray-600 focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white"
                      >
                        <option value="">Seleccionar...</option>
                        {municipios.map((m) => (
                          <option key={m.codigo} value={m.codigo}>{m.codigo} - {m.nombre}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>

                  {/* Dirección */}
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Dirección Complemento</label>
                    <textarea
                      value={formData.direccion}
                      onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                      disabled={!isEditing}
                      rows={2}
                      placeholder="Digite el complemento de la dirección"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-50 disabled:text-gray-600 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase mb-1">
                      <Mail className="w-3 h-3" /> Correo electrónico <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        disabled={!isEditing}
                        placeholder="cliente@ejemplo.com"
                        className={`w-full px-3 py-2 border rounded-lg text-sm disabled:bg-gray-50 disabled:text-gray-600 ${
                          formData.email && !emailValidation.valid ? 'border-red-300' : formData.email && emailValidation.valid ? 'border-green-300' : 'border-gray-300'
                        } focus:ring-2 focus:ring-blue-500 outline-none`}
                      />
                      {formData.email && (
                        <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-medium ${emailValidation.valid ? 'text-green-600' : 'text-red-500'}`}>
                          {emailValidation.message}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Teléfono */}
                  <div>
                    <label className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase mb-1">
                      <Phone className="w-3 h-3" /> Teléfono <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={formData.telefono}
                        onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                        disabled={!isEditing}
                        placeholder="2222-2222"
                        className={`w-full px-3 py-2 border rounded-lg text-sm font-mono disabled:bg-gray-50 disabled:text-gray-600 ${
                          formData.telefono && !phoneValidation.valid ? 'border-red-300' : formData.telefono && phoneValidation.valid ? 'border-green-300' : 'border-gray-300'
                        } focus:ring-2 focus:ring-blue-500 outline-none`}
                      />
                      {formData.telefono && (
                        <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-medium ${phoneValidation.valid ? 'text-green-600' : 'text-red-500'}`}>
                          {phoneValidation.message}
                        </span>
                      )}
                    </div>
                  </div>

                </div>
              </div>

              {/* Form Actions */}
              {isEditing && (
                <div className="p-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end gap-2">
                  <button
                    onClick={() => {
                      if (selectedClient) {
                        handleSelectClient(selectedClient);
                      } else {
                        setFormData(emptyForm);
                        setIsEditing(false);
                      }
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving || !isFormValid}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {selectedClient ? 'Actualizar' : 'Guardar'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientManager;
