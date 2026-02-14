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

const TRIBUTO_IVA_CODIGO = '20';

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
  const [condicionOperacion, setCondicionOperacion] = useState(1);
  const [observaciones, setObservaciones] = useState('');

  const [generatedDTE, setGeneratedDTE] = useState<DTEJSON | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingEmisor, setIsSavingEmisor] = useState(false);

  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolverItems, setResolverItems] = useState<ResolverItem[]>([]);
  const [isRetryAfterResolve, setIsRetryAfterResolve] = useState(false);

  const { toasts, addToast, removeToast } = useToast();

  const { stockByCode } = useStockByCode();

  const {
    hasCert,
    certificateFile,
    certificatePassword,
    showCertPassword,
    certificateInfo,
    certificateError,
    isValidatingCert,
    isSavingCert,
    fileInputRef,
    setCertificatePassword,
    setShowCertPassword,
    setCertificateInfo,
    setCertificateError,
    handleCertFileSelect,
    handleValidateCertificate,
    handleSaveCertificate,
  } = useCertificateManager({
    onToast: (message: string, type: 'success' | 'error' | 'info') => addToast(message, type),
  });

  const getStockDisplayForCodigo = (codigo: string): number | null => {
    const c = (codigo || '').trim();
    if (!c) return null;
    const producto = inventarioService.findProductoByCodigo?.(c) as any;
    if (producto) {
      const stock = Number(producto.existenciasTotales);
      return Number.isFinite(stock) ? stock : 0;
    }
    const fromDb = stockByCode[c];
    if (fromDb) {
      const onHand = Number(fromDb.onHand);
      return Number.isFinite(onHand) ? onHand : 0;
    }
    return null;
  };

  const mapInventarioToFacturaProducts = (): ProductData[] => {
    const inv = inventarioService.getProductos();
    return inv
      .map((p) => {
        const codigo = (p.codigoPrincipal || p.codigo || '').toString().trim();
        if (!codigo) return null;
        const item: ProductData = {
          key: `INV:${p.id}`,
          codigo,
          descripcion: p.descripcion,
          uniMedida: 99,
          tipoItem: 1,
          precioUni: Number(p.precioSugerido) || 0,
          favorite: Boolean(p.esFavorito),
          timestamp: Date.now(),
        };
        return item;
      })
      .filter(Boolean) as ProductData[];
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [emisorData, clientsData, productsData] = await Promise.all([
      getEmisor(),
      getClients(),
      Promise.resolve(mapInventarioToFacturaProducts()),
    ]);
    if (emisorData) {
      setEmisor(emisorData);
      setEmisorForm(emisorData);
    }
    setClients(clientsData);
    setProducts(productsData);
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
      codigo: item.codigo?.trim() ? item.codigo.trim() : null,
      uniMedida: item.uniMedida,
      descripcion: item.descripcion,
      precioUni: item.precioUni,
      montoDescu: 0,
      ventaNoSuj: 0,
      ventaExenta: item.esExento ? redondear(item.cantidad * item.precioUni, 2) : 0,
      ventaGravada: item.esExento ? 0 : redondear(item.cantidad * item.precioUni, 2),
      tributos: !item.esExento ? [TRIBUTO_IVA_CODIGO] : null, // Array con código si NO es exento
      numeroDocumento: null,
      codTributo: item.esExento ? null : '20',
      psv: 0,
      noGravado: 0,
      ivaItem: item.esExento ? 0 : redondear(item.cantidad * item.precioUni * 0.13, 2),
    }));

  const totales = calcularTotales(itemsParaCalculo);


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
    setItems([...items, { ...defaultItem }]);
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

  const handlePrecioUniChange = (index: number, raw: string) => {
    setItems((prev) => {
      const next = [...prev];
      if (!next[index]) return prev;
      const parsed = Number(raw);
      next[index] = {
        ...next[index],
        precioUniRaw: raw,
        precioUni: Number.isFinite(parsed) ? parsed : 0,
      };
      return next;
    });
  };

  const handlePrecioUniBlur = (index: number) => {
    setItems((prev) => {
      const next = [...prev];
      if (!next[index]) return prev;
      const rounded = redondear(Number(next[index].precioUni) || 0, 2);
      next[index] = { ...next[index], precioUni: rounded, precioUniRaw: undefined };
      return next;
    });
  };

  const filteredProductsForPicker = products.filter((p) => {
    const term = productSearch.trim().toLowerCase();
    if (!term) return true;
    return (
      (p.codigo || '').toLowerCase().includes(term) ||
      (p.descripcion || '').toLowerCase().includes(term)
    );
  });

  const openProductPicker = (index: number) => {
    // Refrescar catálogo desde inventario (para reflejar importaciones recientes)
    setProducts(mapInventarioToFacturaProducts());
    setProductPickerIndex(index);
    setProductSearch('');
    setShowProductPicker(true);
  };

  const applyProductToItem = (index: number, p: ProductData) => {
    const newItems = [...items];
    if (!newItems[index]) return;
    newItems[index] = {
      ...newItems[index],
      codigo: p.codigo,
      descripcion: p.descripcion,
      unidadVenta: 'UNIDAD',
      factorConversion: 1,
      precioUni: p.precioUni,
      uniMedida: p.uniMedida,
      tipoItem: p.tipoItem,
    };
    setItems(newItems);
    setStockError('');
  };

  const getPresentacionesForCodigo = (codigo: string): Array<{ nombre: string; factor: number }> => {
    return getPresentacionesForCodigoHelper({
      codigo,
      findProductoByCodigo: inventarioService.findProductoByCodigo,
    });
  };

  const handleItemDescriptionBlur = (index: number) => {
    const current = items[index];
    if (!current) return;

    const found = resolveProductForDescription({ raw: current.descripcion, products });
    if (!found) return;

    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      codigo: found.codigo,
      descripcion: found.descripcion,
      precioUni: found.precioUni,
      uniMedida: found.uniMedida,
      tipoItem: found.tipoItem,
    };
    setItems(newItems);
    setStockError('');
  };

  const validateStockNow = async () => {
    if (items.length === 0) {
      setStockError('');
      return;
    }

    const goodsOnly = items
      .filter((i) => i.tipoItem === 1)
      .filter((i) => i.descripcion && i.precioUni > 0)
      .map((i) => ({
        codigo: (i.codigo || ''),
        cantidad: (Number(i.cantidad) || 0) * (Number(i.factorConversion) || 1),
        descripcion: i.descripcion,
      }));

    const invGoods = goodsOnly.filter((g) => {
      const code = (g.codigo || '').trim();
      if (!code) return false;
      return Boolean(inventarioService.findProductoByCodigo?.(code));
    });
    const goodsSinInventarioNuevo = goodsOnly.filter((g) => {
      const code = (g.codigo || '').trim();
      if (!code) return true;
      return !Boolean(inventarioService.findProductoByCodigo?.(code));
    });

    const invCheck = await validateStockForInventarioHelper({
      goods: invGoods,
      findProductoByCodigo: inventarioService.findProductoByCodigo,
    });
    if (!invCheck.ok) {
      setStockError(invCheck.message);
      return;
    }

    // Validación para productos que no están en el inventario nuevo
    const r = goodsSinInventarioNuevo.length ? await validateStockForSale(goodsSinInventarioNuevo) : ({ ok: true } as const);
    setStockError(r.ok ? '' : r.message);
  };

  useEffect(() => {
    validateStockNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsParaCalculo.length, itemsParaCalculo.map(i => `${i.codigo ?? ''}|${i.cantidad}`).join('||')]);

  const handleSelectReceptor = (client: ClientData) => {
    setSelectedReceptor(client);
    setShowClientSearch(false);
    setClientSearch('');

    const receptorId = (client?.nit || '').replace(/[\s-]/g, '').trim();
    if (!receptorId && tipoDocumento === '03') {
      setTipoDocumento('01');
    }
  };

  const handleGenerateDTE = async () => {
    if (!emisor) {
      addToast('Configura los datos del emisor primero', 'error');
      return;
    }
    if (!selectedReceptor) {
      addToast('Selecciona un receptor', 'error');
      return;
    }

    const receptorId = (selectedReceptor.nit || '').replace(/[\s-]/g, '').trim();
    if (!receptorId && tipoDocumento === '03') {
      addToast('Consumidor Final no puede emitirse como Crédito Fiscal (03). Cambia el tipo de documento a Factura (01).', 'error');
      return;
    }
    if (itemsParaCalculo.length === 0) {
      addToast('Agrega al menos un item', 'error');
      return;
    }

    if (totales.montoTotal >= 25000) {
      const receptorId = (selectedReceptor.nit || '').replace(/[\s-]/g, '').trim();
      if (!receptorId) {
        addToast('Monto >= $25,000: debes completar los datos del receptor (documento de identificación).', 'error');
        return;
      }
    }

    const goodsOnly = items
      .filter((i) => i.tipoItem === 1)
      .filter((i) => i.descripcion && i.precioUni > 0)
      .map((i) => ({
        codigo: (i.codigo || ''),
        cantidad: (Number(i.cantidad) || 0) * (Number(i.factorConversion) || 1),
        descripcion: i.descripcion,
      }));

    const invGoods = goodsOnly.filter((g) => {
      const code = (g.codigo || '').trim();
      if (!code) return false;
      return Boolean(inventarioService.findProductoByCodigo?.(code));
    });
    const goodsSinInventarioNuevo = goodsOnly.filter((g) => {
      const code = (g.codigo || '').trim();
      if (!code) return true;
      return !Boolean(inventarioService.findProductoByCodigo?.(code));
    });

    const stockCheck = invGoods.length
      ? await validateStockForInventarioHelper({
          goods: invGoods,
          findProductoByCodigo: inventarioService.findProductoByCodigo,
        })
      : ({ ok: true } as const);
    if (!stockCheck.ok) {
      addToast(stockCheck.message, 'error');
      setStockError(stockCheck.message);
      return;
    }

    // Validación para productos que no están en el inventario nuevo
    try {
      const extraCheck = goodsSinInventarioNuevo.length ? await validateStockForSale(goodsSinInventarioNuevo) : ({ ok: true } as const);
      setStockError(extraCheck.ok ? '' : extraCheck.message);
    } catch {
      addToast('Error validando inventario', 'error');
      return;
    }

    // 1) Resolver items sin código (modal inmediato)
    if (!isRetryAfterResolve) {
      const goodsWithoutCode = items
        .map((it, idx) => ({ it, idx }))
        .filter(({ it }) => it.tipoItem === 1)
        .filter(({ it }) => !(it.codigo || '').trim())
        .filter(({ it }) => (it.descripcion || '').trim());

      if (goodsWithoutCode.length > 0) {
        // Si está habilitado fallback, intentamos autoselección. Si ambiguo, abrimos modal.
        const settings = ((): { ask: number; auto: number; enabled: boolean } => {
          try {
            // settings se cargan dentro del service; pero aquí solo usamos los defaults del modal
            return { ask: 0.75, auto: 0.9, enabled: true };
          } catch {
            return { ask: 0.75, auto: 0.9, enabled: true };
          }
        })();

        const toResolve: ResolverItem[] = [];

        for (const { it, idx } of goodsWithoutCode) {
          const sugerencias = inventarioService.sugerirProductosPorDescripcion(it.descripcion, settings.ask, 5);
          if (sugerencias.length === 0) {
            toResolve.push({
              index: idx,
              descripcion: it.descripcion,
              cantidad: it.cantidad,
              selectedProductoId: '',
              recordar: true,
              candidates: [],
              search: '',
            });
            continue;
          }

          const top = sugerencias[0];
          // Autoselección solo si score >= autoThreshold y existe código utilizable
          const codigoTop = inventarioService.getCodigoPreferidoProducto(top.producto);
          if (top.score >= settings.auto && codigoTop) {
            // aplicamos automáticamente al formulario para no molestar
            setItems((prev) => {
              const next = [...prev];
              if (next[idx]) {
                next[idx] = {
                  ...next[idx],
                  codigo: codigoTop,
                  descripcion: top.producto.descripcion,
                };
              }
              return next;
            });
            inventarioService.guardarMapeoDescripcionProducto(it.descripcion, top.producto.id);
            continue;
          }

          toResolve.push({
            index: idx,
            descripcion: it.descripcion,
            cantidad: it.cantidad,
            selectedProductoId: '',
            recordar: true,
            candidates: sugerencias.map((s) => ({
              productoId: s.producto.id,
              label: `${inventarioService.getCodigoPreferidoProducto(s.producto) ? `[${inventarioService.getCodigoPreferidoProducto(s.producto)}] ` : ''}${s.producto.descripcion}`,
              score: s.score,
            })),
            search: '',
          });
        }

        if (toResolve.length > 0) {
          setResolverItems(toResolve);
          setShowResolveModal(true);
          return;
        }
      }
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
      await applySalesFromDTE(dte);
      const dteInventario = buildInventarioDTEFromGenerated({ dte, items });
      await inventarioService.aplicarVentaDesdeDTE(dteInventario as any);
      
      addToast('DTE generado correctamente', 'success');
    } catch (error) {
      addToast('Error al generar DTE', 'error');
    } finally {
      setIsGenerating(false);
      setIsRetryAfterResolve(false);
    }
  };

  const confirmarResolucion = () => {
    // Validar que todos estén resueltos
    const faltantes = resolverItems.filter((r) => !r.selectedProductoId);
    if (faltantes.length > 0) {
      addToast('Selecciona un producto para cada ítem sin código', 'error');
      return;
    }

    // Aplicar mapeos + actualizar items
    setItems((prev) => {
      const next = [...prev];
      for (const r of resolverItems) {
        const producto = inventarioService.getProductoById(r.selectedProductoId);
        if (!producto) continue;
        const cod = inventarioService.getCodigoPreferidoProducto(producto);
        if (!next[r.index]) continue;
        next[r.index] = {
          ...next[r.index],
          codigo: cod,
          descripcion: producto.descripcion,
        };
        if (r.recordar) {
          inventarioService.guardarMapeoDescripcionProducto(r.descripcion, producto.id);
        }
      }
      return next;
    });

    setShowResolveModal(false);
    setResolverItems([]);

    // Reintentar generación automáticamente
    setIsRetryAfterResolve(true);
    setTimeout(() => {
      handleGenerateDTE();
    }, 0);
  };

  const handleStripeConnectSuccess = () => {
    // Después de conectar Stripe y procesar pago
    setShowStripeConnect(false);
    setShowTransmision(true);
  };

  const handleNuevaFactura = () => {
    // Resetear todo el formulario
    setItems([{ ...defaultItem }]);
    setSelectedReceptor(null);
    setClientSearch('');
    setGeneratedDTE(null);
    setShowTransmision(false);
    setShowStripeConnect(false);
    setStockError('');
    setObservaciones('');
    setFormaPago('01');
    setCondicionOperacion(1);
    addToast('Formulario limpiado. Lista para nueva factura', 'info');
  };

  const handleTransmitir = () => {
    console.log('Forma de pago seleccionada:', formaPago);
    console.log('¿Requiere Stripe?', requiereStripe(formaPago));
    
    if (requiereStripe(formaPago)) {
      // Si es pago con tarjeta, mostrar modal de QR para pago
      setShowQRPayment(true);
    } else {
      // Si es efectivo, transmitir directamente
      console.log('Transmitiendo directamente (efectivo)...');
      setShowTransmision(true);
    }
  };

  const handleDeleteGeneratedDTE = () => {
    if (!generatedDTE) return;

    if (confirm('¿Eliminar el DTE generado? Esto revertirá inventario y contadores locales.')) {
      (async () => {
        try {
          // Inventario (IndexedDB)
          const invDb = await revertSalesFromDTE(generatedDTE);
          if (!invDb.ok) {
            console.warn('No se pudo revertir inventario (IndexedDB):', invDb.message);
          }

          // Inventario simplificado
          const docRef = (generatedDTE?.identificacion?.numeroControl || '').toString().trim();
          if (docRef) {
            const simp = await inventarioService.revertirVentaPorDocumentoReferencia(docRef);
            if (!simp.ok) {
              console.warn('No se pudo revertir inventario simplificado:', simp.message);
            }
          }
        } catch (e) {
          console.error('Error revirtiendo inventario:', e);
        } finally {
          setGeneratedDTE(null);
          setShowTransmision(false);
          setShowStripeConnect(false);
          setShowQRPayment(false);
          addToast('DTE eliminado. Inventario restaurado.', 'info');
        }
      })();
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

  const receptorIdClean = (selectedReceptor?.nit || '').replace(/[\s-]/g, '').trim();
  const receptorEsConsumidorFinal = Boolean(selectedReceptor) && !receptorIdClean;

  // Filtrar tipos de documento según el tipo de receptor
  const tiposDocumentoFiltrados = tiposDocumento.filter(t => {
    if (receptorEsConsumidorFinal) {
      // Para consumidor final solo permitir: 01, 02, 10, 11
      return ['01', '02', '10', '11'].includes(t.codigo);
    } else {
      // Para clientes con NIT/NRC permitir todos excepto los de consumidor final
      return !['02', '10'].includes(t.codigo);
    }
  });

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // Resetear tipo de documento cuando cambia el receptor
  useEffect(() => {
    if (selectedReceptor) {
      // Si es consumidor final y el tipo actual no es permitido, cambiar a 01
      if (receptorEsConsumidorFinal && !['01', '02', '10', '11'].includes(tipoDocumento)) {
        setTipoDocumento('01');
      }
      // Si es cliente con NIT y el tipo actual es 02 o 10, cambiar a 01
      else if (!receptorEsConsumidorFinal && ['02', '10'].includes(tipoDocumento)) {
        setTipoDocumento('01');
      }
    }
  }, [selectedReceptor, receptorEsConsumidorFinal, tipoDocumento]);

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
        setTipoDocumento={setTipoDocumento}
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
