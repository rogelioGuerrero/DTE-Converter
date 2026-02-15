import React, { useState, useEffect } from 'react';
import { getClients, ClientData } from '../utils/clientDb';
import { ProductData } from '../utils/productDb';
import { getEmisor, saveEmisor, EmisorData } from '../utils/emisorDb';
import { 
  generarDTE, ItemFactura, tiposDocumento, formasPago,
  calcularTotales, redondear, DTEJSON
} from '../utils/dteGenerator';
import { ToastContainer, useToast } from './Toast';
import { useCertificateManager } from '../hooks/useCertificateManager';
import { FacturaMainContent } from './FacturaMainContent';
import { FacturaModals } from './FacturaModals';
import TransmisionModal from './TransmisionModal';
import QRClientCapture from './QRClientCapture';
import { FacturaHeader } from './FacturaHeader';
import MobileFactura from './MobileFactura';
import MobileEmisorModal from './MobileEmisorModal';
import { applySalesFromDTE, validateStockForSale } from '../utils/inventoryDb';
import { revertSalesFromDTE } from '../utils/inventoryDb';
import { inventarioService } from '../utils/inventario/inventarioService';
import { getUserModeConfig, hasFeature } from '../utils/userMode';
import { resolveProductForDescription } from '../utils/facturaGeneratorHelpers';
import { useStockByCode } from '../hooks/useStockByCode';
import { requiereStripe } from '../catalogos/pagos';
import { 
  buildInventarioDTEFromGenerated,
  getPresentacionesForCodigo as getPresentacionesForCodigoHelper,
  validateStockForInventario as validateStockForInventarioHelper,
} from '../utils/facturaGeneratorInventoryHelpers';
import type { ResolverItem } from './ResolveNoCodeModal';
import {
  validateNIT,
  validateNRC,
  validatePhone,
  validateEmail,
  formatTextInput,
  formatMultilineTextInput,
} from '../utils/validators';

interface ItemForm {
  codigo: string;
  descripcion: string;
  cantidad: number;
  unidadVenta: string;
  factorConversion: number;
  precioUni: number;
  precioUniRaw?: string;
  tipoItem: number;
  uniMedida: number;
  esExento: boolean;
}

const emptyItem: ItemForm = {
  codigo: '',
  descripcion: '',
  cantidad: 1,
  unidadVenta: 'UNIDAD',
  factorConversion: 1,
  precioUni: 0,
  tipoItem: 1,
  uniMedida: 99,
  esExento: false,
};


const FacturaGenerator: React.FC = () => {
  const isModoProfesional = getUserModeConfig().mode === 'profesional';
  const defaultItem: ItemForm = isModoProfesional ? { ...emptyItem, tipoItem: 2 } : { ...emptyItem };
  const canUseCatalogoProductos = hasFeature('productos');

  const [showTransmision, setShowTransmision] = useState(false);
  const [showQRCapture, setShowQRCapture] = useState(false);
  const [showDTEPreview, setShowDTEPreview] = useState(false);
  const [showStripeConnect, setShowStripeConnect] = useState(false);
  const [showQRPayment, setShowQRPayment] = useState(false);
  
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

  const [products, setProducts] = useState<ProductData[]>([]);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [productPickerIndex, setProductPickerIndex] = useState<number | null>(null);
  const [productSearch, setProductSearch] = useState('');

  const [stockError, setStockError] = useState<string>('');

  const [items, setItems] = useState<ItemForm[]>([{ ...defaultItem }]);
  const [tipoDocumento, setTipoDocumento] = useState('03');
  const [formaPago, setFormaPago] = useState('01');

  // Recalcular precios al cambiar tipo de documento
  const handleSetTipoDocumento = (nuevoTipo: string) => {
    const tipoAnterior = tipoDocumento;
    setTipoDocumento(nuevoTipo);

    if (tipoAnterior === nuevoTipo) return;

    // Si no hay items o solo el default vacío, no hacer nada
    if (items.length === 0 || (items.length === 1 && !items[0].codigo && items[0].precioUni === 0)) return;

    const newItems = items.map(item => {
      // Si es exento, no se toca el precio
      if (item.esExento) return item;

      let nuevoPrecio = item.precioUni;

      // De Sin IVA (03) a Con IVA (01) -> Sumar IVA
      if (tipoAnterior !== '01' && nuevoTipo === '01') {
        nuevoPrecio = redondear(item.precioUni * 1.13, 2);
      }
      // De Con IVA (01) a Sin IVA (03) -> Restar IVA
      else if (tipoAnterior === '01' && nuevoTipo !== '01') {
        nuevoPrecio = redondear(item.precioUni / 1.13, 2);
      }

      return {
        ...item,
        precioUni: nuevoPrecio
      };
    });

    setItems(newItems);
    addToast(
      nuevoTipo === '01' 
        ? 'Precios actualizados a IVA incluido' 
        : 'Precios actualizados a Sin IVA',
      'info'
    );
  };

  const handleSelectReceptor = (client: ClientData) => {
    setSelectedReceptor(client);
    setShowClientSearch(false);
    setClientSearch('');

    const receptorId = (client?.nit || '').replace(/[\s-]/g, '').trim();
    if (!receptorId && tipoDocumento === '03') {
      handleSetTipoDocumento('01');
    }
  };

  // ... (rest of the code)

  // Resetear tipo de documento cuando cambia el receptor (Auto-selección)
  useEffect(() => {
    if (selectedReceptor) {
      // Si es consumidor final y el tipo actual no es permitido, cambiar a 01
      if (receptorEsConsumidorFinal && !['01', '02', '10', '11'].includes(tipoDocumento)) {
        handleSetTipoDocumento('01');
      }
      // Si es cliente con NIT y el tipo actual es 02 o 10, cambiar a 01
      else if (!receptorEsConsumidorFinal && ['02', '10'].includes(tipoDocumento)) {
        handleSetTipoDocumento('01');
      }
    }
  }, [selectedReceptor, receptorEsConsumidorFinal]); // Removed tipoDocumento dependency to avoid loops with the new handler logic

  // ...

  const applyProductToItem = (index: number, p: ProductData) => {
    const newItems = [...items];
    if (!newItems[index]) return;
    
    // Si estamos en Factura (01), asumimos que el precio del catálogo es Neto y le agregamos IVA
    // Si estamos en CCF (03), usamos el precio del catálogo tal cual (Neto)
    const precioAplicar = tipoDocumento === '01' ? p.precioUni * 1.13 : p.precioUni;

    newItems[index] = {
      ...newItems[index],
      codigo: p.codigo,
      descripcion: p.descripcion,
      unidadVenta: 'UNIDAD',
      factorConversion: 1,
      precioUni: precioAplicar,
      uniMedida: p.uniMedida,
      tipoItem: p.tipoItem,
    };
    setItems(newItems);
    setStockError('');
  };

  // ...

  const handleItemDescriptionBlur = (index: number) => {
    const current = items[index];
    if (!current) return;

    const found = resolveProductForDescription({ raw: current.descripcion, products });
    if (!found) return;

    const newItems = [...items];
    const precioAplicar = tipoDocumento === '01' ? redondear(found.precioUni * 1.13, 2) : found.precioUni;

    newItems[index] = {
      ...newItems[index],
      codigo: found.codigo,
      descripcion: found.descripcion,
      precioUni: precioAplicar,
      uniMedida: found.uniMedida,
      tipoItem: found.tipoItem,
    };
    setItems(newItems);
    setStockError('');
  };

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

      <FacturaModals
        // ResolveNoCodeModal
        showResolveModal={showResolveModal}
        setShowResolveModal={setShowResolveModal}
        resolverItems={resolverItems}
        setResolverItems={setResolverItems}
        inventarioService={inventarioService}
        addToast={addToast}
        confirmarResolucion={confirmarResolucion}
        // TransmisionModal
        showTransmision={showTransmision}
        generatedDTE={generatedDTE}
        emisor={emisor}
        setShowTransmision={setShowTransmision}
        // DTEPreviewModal
        showDTEPreview={showDTEPreview}
        setShowDTEPreview={setShowDTEPreview}
        handleCopyJSON={handleCopyJSON}
        handleDownloadJSON={handleDownloadJSON}
        // QRClientCapture
        showQRCapture={showQRCapture}
        setShowQRCapture={setShowQRCapture}
        setSelectedReceptor={setSelectedReceptor}
        loadData={loadData}
        // EmisorConfigModal
        showEmisorConfig={showEmisorConfig}
        setShowEmisorConfig={setShowEmisorConfig}
        emisorForm={emisorForm}
        setEmisorForm={setEmisorForm}
        nitValidation={nitValidation}
        nrcValidation={nrcValidation}
        telefonoValidation={telefonoValidation}
        correoValidation={correoValidation}
        formatTextInput={formatTextInput}
        formatMultilineTextInput={formatMultilineTextInput}
        handleSaveEmisor={handleSaveEmisor}
        isSavingEmisor={isSavingEmisor}
        hasCert={hasCert}
        fileInputRef={fileInputRef}
        certificateFile={certificateFile}
        certificatePassword={certificatePassword}
        showCertPassword={showCertPassword}
        certificateInfo={certificateInfo}
        certificateError={certificateError}
        isValidatingCert={isValidatingCert}
        isSavingCert={isSavingCert}
        setCertificatePassword={setCertificatePassword}
        setShowCertPassword={setShowCertPassword}
        setCertificateInfo={setCertificateInfo}
        setCertificateError={setCertificateError}
        handleCertFileSelect={handleCertFileSelect}
        handleValidateCertificate={handleValidateCertificate}
        handleSaveCertificate={handleSaveCertificate}
        // ProductPickerModal
        canUseCatalogoProductos={canUseCatalogoProductos}
        showProductPicker={showProductPicker}
        productSearch={productSearch}
        setProductSearch={setProductSearch}
        filteredProductsForPicker={filteredProductsForPicker}
        productPickerIndex={productPickerIndex}
        applyProductToItem={applyProductToItem}
        setShowProductPicker={setShowProductPicker}
        // QRPaymentModal
        showQRPayment={showQRPayment}
        setShowQRPayment={setShowQRPayment}
        // StripeConnectModal
        showStripeConnect={showStripeConnect}
        setShowStripeConnect={setShowStripeConnect}
        handleStripeConnectSuccess={handleStripeConnectSuccess}
        totales={totales}
      />

      {/* Header */}
      <FacturaHeader emisor={emisor} onOpenEmisorConfig={() => setShowEmisorConfig(true)} />

      {/* Main Content */}
      <FacturaMainContent
        // Left column
        selectedReceptor={selectedReceptor}
        showClientSearch={showClientSearch}
        setShowClientSearch={setShowClientSearch}
        clientSearch={clientSearch}
        setClientSearch={setClientSearch}
        filteredClients={filteredClients}
        onSelectReceptor={handleSelectReceptor}
        tipoDocumento={tipoDocumento}
        setTipoDocumento={handleSetTipoDocumento}
        receptorEsConsumidorFinal={receptorEsConsumidorFinal}
        tiposDocumentoFiltrados={tiposDocumentoFiltrados}
        items={items}
        canUseCatalogoProductos={canUseCatalogoProductos}
        onAddItem={handleAddItem}
        onRemoveItem={handleRemoveItem}
        onOpenProductPicker={openProductPicker}
        onItemChange={handleItemChange}
        onItemDescriptionBlur={handleItemDescriptionBlur}
        onPrecioUniChange={handlePrecioUniChange}
        onPrecioUniBlur={handlePrecioUniBlur}
        getPresentacionesForCodigo={getPresentacionesForCodigo}
        getStockDisplayForCodigo={getStockDisplayForCodigo}
        redondear={redondear}
        formaPago={formaPago}
        setFormaPago={setFormaPago}
        formasPago={formasPago}
        condicionOperacion={condicionOperacion}
        setCondicionOperacion={setCondicionOperacion}
        observaciones={observaciones}
        setObservaciones={setObservaciones}
        stockError={stockError}
        isGenerating={isGenerating}
        emisor={emisor}
        generatedDTE={generatedDTE}
        onGenerateDTE={handleGenerateDTE}
        onNuevaFactura={handleNuevaFactura}
        // Right column
        totales={totales}
        requiereStripe={requiereStripe}
        onOpenDTEPreview={() => setShowDTEPreview(true)}
        onTransmit={handleTransmitir}
        onDeleteDTE={handleDeleteGeneratedDTE}
      />
    </div>
  );
};

export default FacturaGenerator;
