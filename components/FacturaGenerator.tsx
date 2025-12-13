import React, { useState, useEffect, useRef } from 'react';
import {
  FileText, Plus, Trash2, Search, User, Building2, 
  ChevronDown, Calculator, Settings, Save,
  CheckCircle, Loader2, QrCode, FileSignature, Eye
} from 'lucide-react';
import { getClients, ClientData } from '../utils/clientDb';
import { getEmisor, saveEmisor, EmisorData } from '../utils/emisorDb';
import { 
  generarDTE, ItemFactura, tiposDocumento, formasPago,
  calcularTotales, redondear, DTEJSON
} from '../utils/dteGenerator';
import { ToastContainer, useToast } from './Toast';
import Tooltip from './Tooltip';
import TransmisionModal from './TransmisionModal';
import DTEPreviewModal from './DTEPreviewModal';
import QRClientCapture from './QRClientCapture';
import MobileFactura from './MobileFactura';
import MobileEmisorModal from './MobileEmisorModal';
import { EmailField, NitOrDuiField, NrcField, PhoneField, SelectActividad, SelectUbicacion } from './formularios';
import { hasCertificate, saveCertificate } from '../utils/secureStorage';
import LogoUploader from './LogoUploader';
import { leerP12, CertificadoInfo, formatearFechaCertificado, validarCertificadoDTE } from '../utils/p12Handler';
import {
  validateNIT,
  validateNRC,
  validatePhone,
  validateEmail,
  formatTextInput,
  formatMultilineTextInput,
} from '../utils/validators';

interface ItemForm {
  descripcion: string;
  cantidad: number;
  precioUni: number;
  tipoItem: number;
  uniMedida: number;
  esExento: boolean;
}

const emptyItem: ItemForm = {
  descripcion: '',
  cantidad: 1,
  precioUni: 0,
  tipoItem: 1,
  uniMedida: 99,
  esExento: false,
};

const FacturaGenerator: React.FC = () => {
  const [showTransmision, setShowTransmision] = useState(false);
  const [showQRCapture, setShowQRCapture] = useState(false);
  const [showDTEPreview, setShowDTEPreview] = useState(false);
  
  const [emisor, setEmisor] = useState<EmisorData | null>(null);
  const [showEmisorConfig, setShowEmisorConfig] = useState(false);
  const [emisorForm, setEmisorForm] = useState<Omit<EmisorData, 'id'>>({
    nit: '',
    nrc: '',
    nombre: '',
    nombreComercial: '',
    actividadEconomica: '',
    descActividad: '',
    tipoEstablecimiento: '01',
    departamento: '',
    municipio: '',
    direccion: '',
    telefono: '',
    correo: '',
    codEstableMH: null,
    codPuntoVentaMH: null,
  });

  const [clients, setClients] = useState<ClientData[]>([]);
  const [selectedReceptor, setSelectedReceptor] = useState<ClientData | null>(null);
  const [showClientSearch, setShowClientSearch] = useState(false);
  const [clientSearch, setClientSearch] = useState('');

  const [items, setItems] = useState<ItemForm[]>([{ ...emptyItem }]);
  const [tipoDocumento, setTipoDocumento] = useState('03');
  const [formaPago, setFormaPago] = useState('01');
  const [condicionOperacion, setCondicionOperacion] = useState(1);
  const [observaciones, setObservaciones] = useState('');

  const [generatedDTE, setGeneratedDTE] = useState<DTEJSON | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingEmisor, setIsSavingEmisor] = useState(false);

  const [hasCert, setHasCert] = useState(false);
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [certificatePassword, setCertificatePassword] = useState('');
  const [showCertPassword, setShowCertPassword] = useState(false);
  const [certificateInfo, setCertificateInfo] = useState<CertificadoInfo | null>(null);
  const [certificateError, setCertificateError] = useState<string | null>(null);
  const [isValidatingCert, setIsValidatingCert] = useState(false);
  const [isSavingCert, setIsSavingCert] = useState(false);
  const [p12Data, setP12Data] = useState<ArrayBuffer | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { toasts, addToast, removeToast } = useToast();

  useEffect(() => {
    loadData();
    refreshCertificateStatus();
  }, []);

  const refreshCertificateStatus = async () => {
    const has = await hasCertificate();
    setHasCert(has);
  };

  const loadData = async () => {
    const [emisorData, clientsData] = await Promise.all([
      getEmisor(),
      getClients(),
    ]);
    if (emisorData) {
      setEmisor(emisorData);
      setEmisorForm(emisorData);
    }
    setClients(clientsData);
  };

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.nit.includes(clientSearch)
  );

  const nitValidation = validateNIT(emisorForm.nit);
  const nrcValidationBase = validateNRC(emisorForm.nrc);
  const nrcValidation = emisorForm.nrc
    ? nrcValidationBase
    : { valid: false, message: 'Requerido' };
  const telefonoValidation = validatePhone(emisorForm.telefono);
  const correoValidation = validateEmail(emisorForm.correo);

  // Calcular totales a partir de los items del formulario
  const itemsParaCalculo: ItemFactura[] = items
    .filter(i => i.descripcion && i.precioUni > 0)
    .map((item, idx) => ({
      numItem: idx + 1,
      tipoItem: item.tipoItem,
      cantidad: item.cantidad,
      codigo: null,
      uniMedida: item.uniMedida,
      descripcion: item.descripcion,
      precioUni: item.precioUni,
      montoDescu: 0,
      ventaNoSuj: 0,
      ventaExenta: item.esExento ? redondear(item.cantidad * item.precioUni, 2) : 0,
      ventaGravada: item.esExento ? 0 : redondear(item.cantidad * item.precioUni, 2),
      tributos: item.esExento ? [] : ['20'],
    }));

  const totales = calcularTotales(itemsParaCalculo);

  const handleCertFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.name.endsWith('.p12') || file.name.endsWith('.pfx'))) {
      setCertificateFile(file);
      setCertificateInfo(null);
      setCertificateError(null);
      const buffer = await file.arrayBuffer();
      setP12Data(buffer);
    }
  };

  const handleValidateCertificate = async () => {
    if (!p12Data || !certificatePassword) return;
    setIsValidatingCert(true);
    setCertificateError(null);
    try {
      const result = await leerP12(p12Data, certificatePassword);
      if (!result.success) {
        setCertificateError(result.error || 'Error al leer certificado');
        setCertificateInfo(null);
        setHasCert(false);
      } else if (result.certificateInfo) {
        const validation = validarCertificadoDTE(result.certificateInfo);
        if (!validation.valid) {
          setCertificateError(validation.errors.join('. '));
        }
        setCertificateInfo(result.certificateInfo);
      }
    } catch (error) {
      setCertificateError(error instanceof Error ? error.message : 'Error desconocido');
    } finally {
      setIsValidatingCert(false);
    }
  };

  const handleSaveCertificate = async () => {
    if (!p12Data || !certificatePassword || !certificateInfo) return;
    setIsSavingCert(true);
    try {
      await saveCertificate(p12Data, certificatePassword);
      setHasCert(true);
      addToast('Certificado guardado correctamente', 'success');
    } catch (error) {
      console.error('Error guardando certificado:', error);
      setCertificateError('Error al guardar el certificado. Intenta de nuevo.');
      setHasCert(false);
    } finally {
      setIsSavingCert(false);
    }
  };

  const handleSaveEmisor = async () => {
    const nombreValid = emisorForm.nombre.trim().length >= 3;
    const actividadValid = emisorForm.actividadEconomica.trim().length > 0;
    const descActividadValid = emisorForm.descActividad.trim().length > 0;
    const direccionValid = emisorForm.direccion.trim().length >= 5;
    const deptoValid = !!emisorForm.departamento;
    const municipioValid = !!emisorForm.municipio;

    const isFormValid =
      nitValidation.valid &&
      nrcValidation.valid &&
      nombreValid &&
      actividadValid &&
      descActividadValid &&
      direccionValid &&
      deptoValid &&
      municipioValid &&
      telefonoValidation.valid &&
      correoValidation.valid;

    if (!isFormValid) {
      const errors: string[] = [];

      if (!nitValidation.valid) errors.push(`NIT: ${nitValidation.message || 'Inválido'}`);
      if (!nrcValidation.valid) errors.push(`NRC: ${nrcValidation.message || 'Inválido'}`);
      if (!nombreValid) errors.push('Razón social: Mínimo 3 caracteres');
      if (!actividadValid) errors.push('Código actividad económica: Requerido');
      if (!descActividadValid) errors.push('Descripción actividad: Requerido');
      if (!deptoValid) errors.push('Departamento: Requerido');
      if (!municipioValid) errors.push('Municipio: Requerido');
      if (!direccionValid) errors.push('Dirección: Mínimo 5 caracteres');
      if (!telefonoValidation.valid) errors.push(`Teléfono: ${telefonoValidation.message || 'Inválido'}`);
      if (!correoValidation.valid) errors.push(`Correo: ${correoValidation.message || 'Inválido'}`);

      const message = errors.length
        ? `Revisa los datos del emisor:\n- ${errors.join('\n- ')}`
        : 'Revisa los datos del emisor. Hay campos inválidos o incompletos.';

      addToast(message, 'error');
      return;
    }

    setIsSavingEmisor(true);
    try {
      await saveEmisor(emisorForm);
      setEmisor({ ...emisorForm, id: emisor?.id });
      setShowEmisorConfig(false);
      addToast('Datos del emisor guardados', 'success');
    } catch {
      addToast('Error al guardar', 'error');
    } finally {
      setIsSavingEmisor(false);
    }
  };

  const handleAddItem = () => {
    setItems([...items, { ...emptyItem }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleItemChange = (index: number, field: keyof ItemForm, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSelectReceptor = (client: ClientData) => {
    setSelectedReceptor(client);
    setShowClientSearch(false);
    setClientSearch('');
  };

  const handleGenerateDTE = () => {
    if (!emisor) {
      addToast('Configura los datos del emisor primero', 'error');
      return;
    }
    if (!selectedReceptor) {
      addToast('Selecciona un receptor', 'error');
      return;
    }
    if (itemsParaCalculo.length === 0) {
      addToast('Agrega al menos un item', 'error');
      return;
    }

    setIsGenerating(true);
    try {
      const correlativo = Date.now(); // En producción usar secuencia real
      const dte = generarDTE({
        emisor,
        receptor: selectedReceptor,
        items: itemsParaCalculo,
        tipoDocumento,
        tipoTransmision: 1,
        formaPago,
        condicionOperacion,
        observaciones,
      }, correlativo, '00');

      setGeneratedDTE(dte);
      addToast('DTE generado correctamente', 'success');
    } catch (error) {
      addToast('Error al generar DTE', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyJSON = () => {
    if (generatedDTE) {
      navigator.clipboard.writeText(JSON.stringify(generatedDTE, null, 2));
      addToast('JSON copiado al portapapeles', 'success');
    }
  };

  const handleDownloadJSON = () => {
    if (generatedDTE) {
      const blob = new Blob([JSON.stringify(generatedDTE, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DTE-${generatedDTE.identificacion.codigoGeneracion}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  if (isMobile) {
    return (
      <>
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        
        {showTransmision && generatedDTE && (
          <TransmisionModal
            dte={generatedDTE}
            onClose={() => setShowTransmision(false)}
            onSuccess={(sello) => {
              addToast(`DTE transmitido. Sello: ${sello.substring(0, 8)}...`, 'success');
            }}
            ambiente="00"
            logoUrl={emisor?.logo}
          />
        )}

        {showQRCapture && (
          <QRClientCapture
            onClose={() => setShowQRCapture(false)}
            onClientImported={(client) => {
              setSelectedReceptor(client);
              setShowQRCapture(false);
              addToast(`Cliente "${client.name}" importado`, 'success');
              loadData();
            }}
          />
        )}

        <MobileFactura
          emisor={emisor}
          onShowQR={() => setShowQRCapture(true)}
          onShowEmisorConfig={() => setShowEmisorConfig(true)}
          onShowTransmision={(dte) => {
            setGeneratedDTE(dte);
            setShowTransmision(true);
          }}
        />

        {/* Modal Emisor Config para móvil - Completo con validación */}
        {showEmisorConfig && (
          <MobileEmisorModal
            emisorForm={emisorForm}
            setEmisorForm={setEmisorForm}
            onSave={handleSaveEmisor}
            onClose={() => setShowEmisorConfig(false)}
            isSaving={isSavingEmisor}
          />
        )}
      </>
    );
  }

  return (
    <div className="h-[calc(100vh-180px)] flex flex-col md:h-auto">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      {/* Transmision Modal */}
      {showTransmision && generatedDTE && (
        <TransmisionModal
          dte={generatedDTE}
          onClose={() => setShowTransmision(false)}
          onSuccess={(sello) => {
            addToast(`DTE transmitido. Sello: ${sello.substring(0, 8)}...`, 'success');
          }}
          ambiente="00"
          logoUrl={emisor?.logo}
        />
      )}

      {/* DTE Preview Modal */}
      {showDTEPreview && generatedDTE && (
        <DTEPreviewModal
          dte={generatedDTE}
          onClose={() => setShowDTEPreview(false)}
          onTransmit={() => {
            setShowDTEPreview(false);
            setShowTransmision(true);
          }}
          onCopy={handleCopyJSON}
          onDownload={handleDownloadJSON}
        />
      )}

      {/* QR Client Capture Modal */}
      {showQRCapture && (
        <QRClientCapture
          onClose={() => setShowQRCapture(false)}
          onClientImported={(client) => {
            setSelectedReceptor(client);
            setShowQRCapture(false);
            addToast(`Cliente "${client.name}" importado`, 'success');
            loadData();
          }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Generar Factura DTE</h2>
          <p className="text-sm text-gray-500">Crea documentos tributarios electrónicos</p>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip content="Capturar cliente via QR" position="bottom">
            <button
              onClick={() => setShowQRCapture(true)}
              className="p-2 rounded-lg transition-colors text-blue-600 bg-blue-50 hover:bg-blue-100"
            >
              <QrCode className="w-4 h-4" />
            </button>
          </Tooltip>
          <Tooltip
            content={emisor ? 'Datos del emisor configurados' : 'Configura los datos del emisor'}
            position="bottom"
          >
            <button
              onClick={() => setShowEmisorConfig(true)}
              className={`p-2 rounded-lg transition-colors ${
                emisor 
                  ? 'text-green-600 bg-green-50 hover:bg-green-100' 
                  : 'text-amber-600 bg-amber-50 hover:bg-amber-100'
              }`}
            >
              <Settings className="w-4 h-4" />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-12 gap-4 min-h-0">
        
        {/* Left: Form */}
        <div className="col-span-8 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            
            {/* Tipo de Documento y Receptor */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Tipo de Documento</label>
                <div className="relative">
                  <select
                    value={tipoDocumento}
                    onChange={(e) => setTipoDocumento(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white"
                  >
                    {tiposDocumento.map(t => (
                      <option key={t.codigo} value={t.codigo}>{t.codigo} - {t.descripcion}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">
                  Receptor (Cliente) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <button
                    onClick={() => setShowClientSearch(!showClientSearch)}
                    className={`w-full px-3 py-2 border rounded-lg text-sm text-left flex items-center justify-between ${
                      selectedReceptor ? 'border-green-300 bg-green-50' : 'border-gray-300 hover:border-blue-400'
                    }`}
                  >
                    {selectedReceptor ? (
                      <span className="truncate">{selectedReceptor.name}</span>
                    ) : (
                      <span className="text-gray-400">Seleccionar cliente...</span>
                    )}
                    <User className="w-4 h-4 text-gray-400" />
                  </button>

                  {showClientSearch && (
                    <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-hidden">
                      <div className="p-2 border-b border-gray-100">
                        <div className="relative">
                          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            value={clientSearch}
                            onChange={(e) => setClientSearch(e.target.value)}
                            placeholder="Buscar por nombre o NIT..."
                            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                            autoFocus
                          />
                        </div>
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {filteredClients.length === 0 ? (
                          <p className="p-3 text-sm text-gray-400 text-center">Sin resultados</p>
                        ) : (
                          filteredClients.map(client => (
                            <button
                              key={client.id}
                              onClick={() => handleSelectReceptor(client)}
                              className="w-full px-3 py-2 text-left hover:bg-blue-50 transition-colors"
                            >
                              <p className="text-sm font-medium text-gray-800 truncate">{client.name}</p>
                              <p className="text-xs text-gray-400">NIT: {client.nit}</p>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-500 uppercase">Detalle de Items</label>
                <button
                  onClick={handleAddItem}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Agregar
                </button>
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="px-2 py-2 text-left w-8">#</th>
                      <th className="px-2 py-2 text-left">Descripción</th>
                      <th className="px-2 py-2 text-center w-20">Cant.</th>
                      <th className="px-2 py-2 text-right w-24">Precio</th>
                      <th className="px-2 py-2 text-right w-24">Subtotal</th>
                      <th className="px-2 py-2 text-center w-16">Exento</th>
                      <th className="px-2 py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-2 py-2 text-gray-400">{idx + 1}</td>
                        <td className="px-2 py-1">
                          <input
                            type="text"
                            value={item.descripcion}
                            onChange={(e) => handleItemChange(idx, 'descripcion', e.target.value)}
                            placeholder="Descripción del producto/servicio"
                            className="w-full px-2 py-1 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="number"
                            value={item.cantidad}
                            onChange={(e) => handleItemChange(idx, 'cantidad', parseFloat(e.target.value) || 0)}
                            min="0"
                            step="0.01"
                            className="w-full px-2 py-1 border border-gray-200 rounded text-sm text-center focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="number"
                            value={item.precioUni}
                            onChange={(e) => handleItemChange(idx, 'precioUni', parseFloat(e.target.value) || 0)}
                            min="0"
                            step="0.01"
                            className="w-full px-2 py-1 border border-gray-200 rounded text-sm text-right focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-gray-700">
                          ${redondear(item.cantidad * item.precioUni, 2).toFixed(2)}
                        </td>
                        <td className="px-2 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={item.esExento}
                            onChange={(e) => handleItemChange(idx, 'esExento', e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <button
                            onClick={() => handleRemoveItem(idx)}
                            disabled={items.length === 1}
                            className="p-1 text-gray-300 hover:text-red-500 disabled:opacity-30"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Forma de Pago y Observaciones */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Forma de Pago</label>
                <div className="relative">
                  <select
                    value={formaPago}
                    onChange={(e) => setFormaPago(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white"
                  >
                    {formasPago.map(f => (
                      <option key={f.codigo} value={f.codigo}>{f.descripcion}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Condición</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCondicionOperacion(1)}
                    className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      condicionOperacion === 1 ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Contado
                  </button>
                  <button
                    onClick={() => setCondicionOperacion(2)}
                    className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      condicionOperacion === 2 ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Crédito
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Observaciones</label>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                rows={2}
                placeholder="Observaciones opcionales..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="p-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end gap-2">
            <button
              onClick={handleGenerateDTE}
              disabled={isGenerating || !emisor || !selectedReceptor}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              Generar DTE
            </button>
          </div>
        </div>

        {/* Right: Totals & Preview */}
        <div className="col-span-4 flex flex-col gap-4">
          
          {/* Totales */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Calculator className="w-4 h-4" /> Resumen
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Gravado:</span>
                <span className="font-mono">${totales.totalGravada.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Exento:</span>
                <span className="font-mono">${totales.totalExenta.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Subtotal:</span>
                <span className="font-mono">${totales.subTotalVentas.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-blue-600">
                <span>IVA 13%:</span>
                <span className="font-mono">${totales.iva.toFixed(2)}</span>
              </div>
              <div className="border-t border-gray-200 pt-2 flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span className="font-mono text-green-600">${totales.totalPagar.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Receptor Info */}
          {selectedReceptor && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <User className="w-4 h-4" /> Receptor
              </h3>
              <div className="text-sm space-y-1">
                <p className="font-medium text-gray-800">{selectedReceptor.name}</p>
                <p className="text-gray-500">NIT: {selectedReceptor.nit}</p>
                {selectedReceptor.nrc && <p className="text-gray-500">NRC: {selectedReceptor.nrc}</p>}
                <p className="text-gray-500">{selectedReceptor.email}</p>
              </div>
            </div>
          )}

          {/* Generated DTE - Compact Card */}
          {generatedDTE && (
            <div className="bg-white rounded-xl border border-green-200 p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-gray-900">DTE Generado</h3>
                  <p className="text-xs text-gray-500 font-mono truncate">
                    {generatedDTE.identificacion.codigoGeneracion.substring(0, 20)}...
                  </p>
                </div>
              </div>
              
              <div className="bg-green-50 rounded-lg p-3 mb-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-green-600">Total</span>
                  <span className="text-lg font-bold text-green-700">
                    ${generatedDTE.resumen.totalPagar.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => setShowDTEPreview(true)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  Ver Detalles
                </button>
                <button
                  onClick={() => setShowTransmision(true)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  Transmitir a Hacienda
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Configurar Emisor */}
      {showEmisorConfig && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Building2 className="w-5 h-5" /> Configurar Datos del Emisor
              </h3>
              <button onClick={() => setShowEmisorConfig(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded">
                ✕
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <NitOrDuiField
                    label="NIT"
                    required
                    value={emisorForm.nit}
                    onChange={(nit) => setEmisorForm({ ...emisorForm, nit })}
                    validation={nitValidation}
                    placeholder="0000-000000-000-0"
                    messageVariant="below-invalid"
                    colorMode="status"
                  />
                </div>
                <div>
                  <NrcField
                    label="NRC"
                    required
                    value={emisorForm.nrc}
                    onChange={(nrc) => setEmisorForm({ ...emisorForm, nrc })}
                    validation={nrcValidation}
                    placeholder="000000-0"
                    messageVariant="below-invalid"
                    colorMode="status"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Nombre / Razón Social <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={emisorForm.nombre}
                    onChange={(e) => setEmisorForm({ ...emisorForm, nombre: formatTextInput(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Nombre legal del contribuyente"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Nombre Comercial</label>
                  <input
                    type="text"
                    value={emisorForm.nombreComercial}
                    onChange={(e) => setEmisorForm({ ...emisorForm, nombreComercial: formatTextInput(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Nombre comercial (opcional)"
                  />
                </div>
                <div className="col-span-2">
                  <LogoUploader
                    currentLogo={emisorForm.logo}
                    onLogoChange={(logo) => setEmisorForm({ ...emisorForm, logo })}
                  />
                </div>
                <div>
                  <SelectActividad
                    value={emisorForm.actividadEconomica}
                    onChange={(codigo, descripcion) => setEmisorForm({ ...emisorForm, actividadEconomica: codigo, descActividad: descripcion })}
                    required
                    label="Código Actividad"
                    placeholder="Buscar actividad..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Descripción Actividad <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={emisorForm.descActividad}
                    onChange={(e) => setEmisorForm({ ...emisorForm, descActividad: formatTextInput(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Ej: Servicios de programación"
                  />
                </div>
                <div className="col-span-2">
                  <SelectUbicacion
                    departamento={emisorForm.departamento}
                    municipio={emisorForm.municipio}
                    onDepartamentoChange={(codigo) => setEmisorForm({ ...emisorForm, departamento: codigo, municipio: '' })}
                    onMunicipioChange={(codigo) => setEmisorForm({ ...emisorForm, municipio: codigo })}
                    required
                    showLabels
                    layout="horizontal"
                    size="md"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Dirección <span className="text-red-500">*</span></label>
                  <textarea
                    value={emisorForm.direccion}
                    onChange={(e) => setEmisorForm({ ...emisorForm, direccion: formatMultilineTextInput(e.target.value) })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    placeholder="Calle, número, colonia, etc."
                  />
                </div>
                <div>
                  <PhoneField
                    label="Teléfono"
                    required
                    value={emisorForm.telefono}
                    onChange={(telefono) => setEmisorForm({ ...emisorForm, telefono })}
                    validation={telefonoValidation}
                    placeholder="0000-0000"
                    messageVariant="below-invalid"
                    colorMode="status"
                  />
                </div>
                <div>
                  <EmailField
                    label="Correo"
                    required
                    value={emisorForm.correo}
                    onChange={(correo) => setEmisorForm({ ...emisorForm, correo })}
                    validation={correoValidation}
                    placeholder="correo@ejemplo.com"
                    messageVariant="below-invalid"
                    colorMode="status"
                  />
                </div>
                <div className="col-span-2 mt-2 pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <FileSignature className={`w-4 h-4 ${hasCert ? 'text-blue-600' : 'text-gray-400'}`} />
                      <div>
                        <p className="text-xs font-semibold text-gray-700 uppercase">Firma electrónica</p>
                        <p className="text-[11px] text-gray-500">
                          {hasCert
                                ? 'Tu certificado está guardado. Puedes actualizarlo cuando quieras.'
                                : 'Aún no has registrado tu certificado digital (.p12/.pfx) y PIN.'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".p12,.pfx"
                    onChange={handleCertFileSelect}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className={`w-full p-3 border-2 border-dashed rounded-xl text-sm mb-3 transition-colors ${
                      certificateFile ? 'border-green-300 bg-green-50 text-green-700' : 'border-gray-300 text-gray-600 hover:border-blue-400 hover:bg-blue-50'
                    }`}
                  >
                    {certificateFile ? (
                      <span>{certificateFile.name}</span>
                    ) : (
                      <span>Seleccionar archivo .p12 / .pfx</span>
                    )}
                  </button>
                  {certificateFile && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Contraseña / PIN del certificado</label>
                        <div className="relative">
                          <input
                            type={showCertPassword ? 'text' : 'password'}
                            value={certificatePassword}
                            onChange={(e) => {
                              setCertificatePassword(e.target.value);
                              setCertificateInfo(null);
                              setCertificateError(null);
                            }}
                            placeholder="PIN que te dio Hacienda"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm pr-10 focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                          <button
                                type="button"
                                onClick={() => setShowCertPassword(!showCertPassword)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs"
                              >
                                {showCertPassword ? 'Ocultar' : 'Ver'}</button>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-1">Es el PIN que recibiste junto con tu certificado.</p>
                      </div>
                      {certificatePassword.length >= 4 && !certificateInfo && (
                        <button
                          onClick={handleValidateCertificate}
                          disabled={isValidatingCert}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                        >
                          {isValidatingCert ? 'Validando…' : 'Validar certificado'}
                        </button>
                      )}
                      {certificateError && (
                        <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                          {certificateError}
                        </div>
                      )}
                      {certificateInfo && (
                        <div className="p-3 rounded-lg border bg-green-50 border-green-200 text-xs space-y-1">
                          <p className="font-semibold text-green-700 flex items-center gap-1">
                            <span>Certificado válido</span>
                          </p>
                          <p className="text-gray-700">Titular: {certificateInfo.subject.commonName}</p>
                          <p className="text-gray-700">
                            Válido hasta: {formatearFechaCertificado(certificateInfo.validTo)}
                          </p>
                        </div>
                      )}
                      <button
                            onClick={handleSaveCertificate}
                            disabled={!certificateInfo || isSavingCert}
                            className="w-full mt-2 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                          >
                            {isSavingCert ? 'Guardando firma…' : 'Guardar firma digital'}</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs text-gray-400"><span className="text-red-500">*</span> Campos obligatorios</p>
              <div className="flex gap-2">
              <button
                onClick={() => setShowEmisorConfig(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEmisor}
                disabled={isSavingEmisor}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isSavingEmisor ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar
              </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FacturaGenerator;
