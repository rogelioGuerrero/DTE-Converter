import React, { useState, useEffect, useRef } from 'react';
import {
  FileText, Plus, Trash2, Search, User, Building2, 
  ChevronDown, Calculator, Settings, Save,
  CheckCircle, Loader2, FileSignature, Eye, X, Zap
} from 'lucide-react';
import { getClients, ClientData } from '../utils/clientDb';
import { ProductData } from '../utils/productDb';
import { getEmisor, saveEmisor, EmisorData } from '../utils/emisorDb';
import { 
  generarDTE, ItemFactura, tiposDocumento, formasPago,
  calcularTotales, redondear, DTEJSON
} from '../utils/dteGenerator';
import { requiereStripe } from '../catalogos';
import { ToastContainer, useToast } from './Toast';
import Tooltip from './Tooltip';
import TransmisionModal from './TransmisionModal';
import SimuladorTransmision from './SimuladorTransmision';
import DTEPreviewModal from './DTEPreviewModal';
import QRClientCapture from './QRClientCapture';
import MobileFactura from './MobileFactura';
import MobileEmisorModal from './MobileEmisorModal';
import { StripeConnectModal } from './StripeConnectModal';
import QRPaymentModal from './QRPaymentModal';
import { applySalesFromDTE, getAllStock, InventoryStock, validateStockForSale } from '../utils/inventoryDb';
import { revertSalesFromDTE } from '../utils/inventoryDb';
import { inventarioService } from '../utils/inventario/inventarioService';
import { EmailField, NitOrDuiField, NrcField, PhoneField, SelectActividad, SelectUbicacion } from './formularios';
import { hasCertificate, saveCertificate } from '../utils/secureStorage';
import LogoUploader from './LogoUploader';
import { leerP12, CertificadoInfo, formatearFechaCertificado, validarCertificadoDTE } from '../utils/p12Handler';
import { getUserModeConfig, hasFeature } from '../utils/userMode';
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

type ResolverItem = {
  index: number;
  descripcion: string;
  cantidad: number;
  selectedProductoId: string;
  recordar: boolean;
  candidates: Array<{ productoId: string; label: string; score: number }>;
  search: string;
};

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
  const [showSimulador, setShowSimulador] = useState(false);
  
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

  const [stockByCode, setStockByCode] = useState<Record<string, InventoryStock>>({});
  const [stockError, setStockError] = useState<string>('');

  const [items, setItems] = useState<ItemForm[]>([{ ...defaultItem }]);
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

  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolverItems, setResolverItems] = useState<ResolverItem[]>([]);
  const [isRetryAfterResolve, setIsRetryAfterResolve] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { toasts, addToast, removeToast } = useToast();

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

  const validateStockForInventario = async (
    goods: Array<{ codigo: string; cantidad: number; descripcion?: string }>
  ): Promise<{ ok: true } | { ok: false; message: string }> => {
    for (const g of goods) {
      const codigo = (g.codigo || '').trim();
      if (!codigo) continue;
      const producto = inventarioService.findProductoByCodigo?.(codigo) as any;
      if (!producto) continue;
      const qty = Number(g.cantidad) || 0;
      if (qty <= 0) continue;
      const stock = Number(producto.existenciasTotales) || 0;
      if (stock < qty) {
        return {
          ok: false,
          message: `Stock insuficiente para "${producto.descripcion}". Disponible: ${stock}, solicitado: ${qty}`,
        };
      }
    }
    return { ok: true };
  };

  useEffect(() => {
    loadData();
    refreshCertificateStatus();
  }, []);

  useEffect(() => {
    const loadStock = async () => {
      try {
        const all = await getAllStock();
        const map: Record<string, InventoryStock> = {};
        for (const s of all) {
          const code = (s.productCode || '').trim();
          if (code) map[code] = s;
        }
        setStockByCode(map);
      } catch {
        // ignore
      }
    };
    loadStock();
  }, []);

  const refreshCertificateStatus = async () => {
    const has = await hasCertificate();
    setHasCert(has);
  };

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
    const producto = inventarioService.findProductoByCodigo?.(codigo);
    if (!producto) return [{ nombre: 'UNIDAD', factor: 1 }];
    const base = (producto.unidadBase || 'UNIDAD').toUpperCase();
    const pres = Array.isArray(producto.presentaciones) && producto.presentaciones.length
      ? producto.presentaciones.map((p) => ({ nombre: (p.nombre || '').toUpperCase(), factor: Number(p.factor) || 1 }))
      : [{ nombre: base, factor: 1 }];
    if (!pres.some((x) => x.nombre === base)) pres.unshift({ nombre: base, factor: 1 });
    if (!pres.some((x) => x.nombre === 'UNIDAD')) pres.unshift({ nombre: 'UNIDAD', factor: 1 });
    const unique: Array<{ nombre: string; factor: number }> = [];
    for (const x of pres) {
      if (!x.nombre) continue;
      if (unique.some((u) => u.nombre === x.nombre)) continue;
      unique.push(x);
    }
    return unique;
  };

  const buildInventarioDTEFromGenerated = (dte: DTEJSON): any => {
    const body = Array.isArray((dte as any)?.cuerpoDocumento) ? (dte as any).cuerpoDocumento : [];
    const used = new Array(items.length).fill(false);
    const converted = body.map((it: any) => {
      const codigo = ((it?.codigo || '') as string).toString().trim();
      const desc = ((it?.descripcion || '') as string).toString().trim();

      const matchIdx = items.findIndex((x, i) => {
        if (used[i]) return false;
        const c = (x.codigo || '').toString().trim();
        const d = (x.descripcion || '').toString().trim();
        if (codigo && c) return c === codigo;
        return d === desc;
      });

      const form = matchIdx >= 0 ? items[matchIdx] : undefined;
      if (matchIdx >= 0) used[matchIdx] = true;

      const factor = form ? Number(form.factorConversion) || 1 : 1;
      const cantidad = Number(it?.cantidad) || 0;
      return { ...it, cantidad: cantidad * factor };
    });
    return { ...dte, cuerpoDocumento: converted };
  };

  const normalizeProductText = (value: string): string => {
    return (value || '').trim().replace(/\s+/g, ' ').toUpperCase();
  };

  const resolveProductForDescription = (raw: string): ProductData | undefined => {
    const value = (raw || '').trim();
    if (!value) return undefined;

    const byCode = products.find((p) => p.codigo && p.codigo.trim() === value);
    if (byCode) return byCode;

    const needle = normalizeProductText(value);
    return products.find((p) => normalizeProductText(p.descripcion) === needle);
  };

  const handleItemDescriptionBlur = (index: number) => {
    const current = items[index];
    if (!current) return;

    const found = resolveProductForDescription(current.descripcion);
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

    if (goodsOnly.length === 0) {
      setStockError('');
      return;
    }

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

    const invCheck = await validateStockForInventario(invGoods);
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
      ? await validateStockForInventario(invGoods)
      : ({ ok: true } as const);
    if (!stockCheck.ok) {
      addToast(stockCheck.message, 'error');
      setStockError(stockCheck.message);
      return;
    }

    // Validación para productos que no están en el inventario nuevo
    try {
      const extraCheck = goodsSinInventarioNuevo.length ? await validateStockForSale(goodsSinInventarioNuevo) : ({ ok: true } as const);
      if (!extraCheck.ok) {
        addToast(extraCheck.message, 'error');
        setStockError(extraCheck.message);
        return;
      }
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
      const dteInventario = buildInventarioDTEFromGenerated(dte);
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

  const handleSimular = () => {
    setShowSimulador(true);
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

        {showSimulador && generatedDTE && (
          <SimuladorTransmision
            dte={generatedDTE}
            onClose={() => setShowSimulador(false)}
            onSuccess={(res) => {
              setShowSimulador(false);
              if (res.success && res.selloRecepcion) {
                addToast(`Simulación OK. Sello: ${res.selloRecepcion.substring(0, 8)}...`, 'success');
              } else {
                addToast('Simulación finalizada con errores.', 'error');
              }
            }}
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

      {/* Resolver items sin código */}
      {showResolveModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">Resolver productos sin código</p>
                <p className="text-xs text-gray-500">Selecciona el producto correcto para evitar errores de inventario y cumplimiento.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowResolveModal(false);
                  setResolverItems([]);
                }}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                title="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {resolverItems.map((r, idx) => (
                <div key={`${r.index}-${idx}`} className="border border-gray-200 rounded-xl p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{r.descripcion}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Cantidad: <span className="font-mono">{r.cantidad}</span></p>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-gray-600 select-none">
                      <input
                        type="checkbox"
                        checked={r.recordar}
                        onChange={(e) => {
                          const v = e.target.checked;
                          setResolverItems((prev) => prev.map((x) => x.index === r.index ? { ...x, recordar: v } : x));
                        }}
                      />
                      Recordar
                    </label>
                  </div>

                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Producto</label>
                      <select
                        value={r.selectedProductoId}
                        onChange={(e) => {
                          const v = e.target.value;
                          setResolverItems((prev) => prev.map((x) => x.index === r.index ? { ...x, selectedProductoId: v } : x));
                        }}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      >
                        <option value="">Seleccionar…</option>
                        {r.candidates.map((c) => (
                          <option key={c.productoId} value={c.productoId}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                      {r.candidates.length === 0 && (
                        <p className="text-[10px] text-amber-600 mt-1">No hay candidatos. Crea el producto en Productos o ajusta la descripción.</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Buscar en inventario</label>
                      <input
                        type="text"
                        value={r.search}
                        onChange={(e) => {
                          const v = e.target.value;
                          const candidatos = inventarioService.buscarProductosFacturacion(v)
                            .slice(0, 8)
                            .map((p) => ({
                              productoId: p.id,
                              label: `${inventarioService.getCodigoPreferidoProducto(p) ? `[${inventarioService.getCodigoPreferidoProducto(p)}] ` : ''}${p.descripcion}`,
                              score: 0,
                            }));
                          setResolverItems((prev) => prev.map((x) => x.index === r.index ? { ...x, search: v, candidates: v.trim() ? candidatos : x.candidates } : x));
                        }}
                        placeholder="Escribe para buscar…"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                      <p className="text-[10px] text-gray-400 mt-1">Opcional: si no aparece, búscalo manualmente.</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-gray-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowResolveModal(false);
                  setResolverItems([]);
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarResolucion}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}
      
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

      {showSimulador && generatedDTE && (
        <SimuladorTransmision
          dte={generatedDTE}
          onClose={() => setShowSimulador(false)}
          onSuccess={(res) => {
            setShowSimulador(false);
            if (res.success && res.selloRecepcion) {
              addToast(`Simulación OK. Sello: ${res.selloRecepcion.substring(0, 8)}...`, 'success');
            } else {
              addToast('Simulación finalizada con errores.', 'error');
            }
          }}
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
            
            {/* Receptor y Tipo de Documento */}
            <div className="grid grid-cols-2 gap-4">
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
                        <button
                          onClick={() =>
                            handleSelectReceptor({
                              nit: '',
                              name: 'Consumidor Final',
                              nrc: '',
                              nombreComercial: '',
                              actividadEconomica: '',
                              descActividad: '',
                              departamento: '',
                              municipio: '',
                              direccion: '',
                              email: '',
                              telefono: '',
                              timestamp: Date.now(),
                            })
                          }
                          className="w-full px-3 py-2 text-left hover:bg-blue-50 transition-colors border-b border-gray-100"
                        >
                          <p className="text-sm font-medium text-gray-800 truncate">Consumidor Final</p>
                          <p className="text-xs text-gray-400">Sin documento</p>
                        </button>
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

              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">
                  Tipo de Documento
                  {receptorEsConsumidorFinal && (
                    <Tooltip content="Para Consumidor Final solo se permiten: Factura (01), Factura Simplificada (02), Tiquetes (10) y Factura de Exportación (11)" position="bottom">
                      <span className="ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold cursor-help">
                        i
                      </span>
                    </Tooltip>
                  )}
                </label>
                <div className="relative">
                  <select
                    value={tipoDocumento}
                    onChange={(e) => setTipoDocumento(e.target.value)}
                    disabled={!selectedReceptor}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    {tiposDocumentoFiltrados.map(t => (
                      <option
                        key={t.codigo}
                        value={t.codigo}
                      >
                        {t.codigo} - {t.descripcion}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>

                {!selectedReceptor && (
                  <p className="mt-1 text-[11px] text-gray-400">
                    Selecciona receptor para ver documentos disponibles.
                  </p>
                )}
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
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={item.descripcion}
                              onChange={(e) => handleItemChange(idx, 'descripcion', e.target.value)}
                              onBlur={() => handleItemDescriptionBlur(idx)}
                              className="w-full px-2 py-1 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                            {canUseCatalogoProductos && (
                              <button
                                type="button"
                                onClick={() => openProductPicker(idx)}
                                className="px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors whitespace-nowrap"
                                title="Buscar en catálogo"
                              >
                                Catálogo
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={item.cantidad}
                              onChange={(e) => handleItemChange(idx, 'cantidad', parseFloat(e.target.value) || 0)}
                              className="w-16 px-2 py-1 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                              min="0"
                              step="0.01"
                            />
                            <select
                              value={(item.unidadVenta || 'UNIDAD').toUpperCase()}
                              onChange={(e) => {
                                const unidad = (e.target.value || 'UNIDAD').toUpperCase();
                                const pres = getPresentacionesForCodigo(item.codigo || '');
                                const found = pres.find((p) => p.nombre === unidad);
                                handleItemChange(idx, 'unidadVenta', unidad);
                                handleItemChange(idx, 'factorConversion', found ? found.factor : 1);
                              }}
                              disabled={!(item.codigo || '').trim()}
                              className="px-2 py-1 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                            >
                              {getPresentacionesForCodigo(item.codigo || '').map((p) => (
                                <option key={p.nombre} value={p.nombre}>{p.nombre}</option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={item.precioUniRaw ?? Number(item.precioUni || 0).toFixed(2)}
                            onChange={(e) => handlePrecioUniChange(idx, e.target.value)}
                            onBlur={() => handlePrecioUniBlur(idx)}
                            className="w-full px-2 py-1 border border-gray-200 rounded text-sm text-right focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                          {(() => {
                            const code = (item.codigo || '').trim();
                            if (!code) return null;
                            const stock = getStockDisplayForCodigo(code);
                            if (stock === null) return null;
                            return (
                              <p className="mt-1 text-[10px] text-gray-400 text-center">
                                Stock: {Number(stock).toFixed(2)}
                              </p>
                            );
                          })()}
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
            {stockError && (
              <div className="mr-auto text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
                {stockError}
              </div>
            )}
            <button
              onClick={handleGenerateDTE}
              disabled={isGenerating || !emisor || !selectedReceptor || !!stockError}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              {generatedDTE ? 'Actualizar DTE' : 'Generar DTE'}
            </button>
            <button
              onClick={handleNuevaFactura}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nueva Factura
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
                  onClick={handleTransmitir}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  {requiereStripe(formaPago) ? 'Cobrar con Tarjeta' : 'Transmitir a Hacienda'}
                </button>
                
                <button
                  onClick={handleSimular}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium transition-colors"
                >
                  <Zap className="w-4 h-4" />
                  Simular Transmisión
                </button>
                
                {generatedDTE && (
                  <button
                    onClick={() => {
                      if (confirm('¿Eliminar DTE generado? Esto restaurará el inventario.')) {
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
                    }}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Eliminar DTE
                  </button>
                )}
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
                    label="Actividad Económica"
                    placeholder="Escribe una actividad..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Código Actividad <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={emisorForm.actividadEconomica}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 text-gray-700 font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Se completa al seleccionar"
                  />
                </div>
                <div className="col-span-2">
                  <SelectUbicacion
                    departamento={emisorForm.departamento}
                    municipio={emisorForm.municipio}
                    onDepartamentoChange={(codigo) =>
                      setEmisorForm((prev) => ({ ...prev, departamento: codigo, municipio: '' }))
                    }
                    onMunicipioChange={(codigo) => setEmisorForm((prev) => ({ ...prev, municipio: codigo }))}
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
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
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

      {canUseCatalogoProductos && showProductPicker && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">Seleccionar producto</p>
                <p className="text-xs text-gray-500">Busca por código o descripción</p>
              </div>
              <button
                type="button"
                onClick={() => setShowProductPicker(false)}
                className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cerrar
              </button>
            </div>

            <div className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Ej: 14848 o TOMA ADAPTADOR..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  autoFocus
                />
              </div>

              <div className="mt-3 max-h-80 overflow-y-auto border border-gray-100 rounded-xl">
                {filteredProductsForPicker.length === 0 ? (
                  <div className="p-6 text-sm text-gray-400 text-center">Sin resultados</div>
                ) : (
                  filteredProductsForPicker.slice(0, 200).map((p) => (
                    <button
                      key={p.id ?? p.key}
                      type="button"
                      onClick={() => {
                        const idx = productPickerIndex;
                        if (typeof idx === 'number') {
                          applyProductToItem(idx, p);
                        }
                        setShowProductPicker(false);
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">{p.descripcion}</p>
                          <p className="text-xs text-gray-500 mt-0.5 truncate">
                            {p.codigo ? `Código: ${p.codigo}` : 'Sin código'}
                          </p>
                        </div>
                        <div className="text-right whitespace-nowrap">
                          <p className="text-sm font-mono text-gray-900">${p.precioUni.toFixed(2)}</p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>

              {filteredProductsForPicker.length > 200 && (
                <p className="mt-2 text-xs text-gray-400">Mostrando 200 resultados. Refina tu búsqueda.</p>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Modal: QR Payment */}
      {showQRPayment && generatedDTE && (
        <QRPaymentModal
          isOpen={showQRPayment}
          onClose={() => setShowQRPayment(false)}
          totalAmount={Number(generatedDTE.resumen?.totalPagar || 0)}
          dteJson={generatedDTE}
          sellerInfo={{
            businessName: (emisor as any)?.nombreComercial || (emisor as any)?.nombre || '',
            name: (emisor as any)?.nombre || ''
          }}
          onPaymentGenerated={(checkoutUrl, sessionId) => {
            console.log('Pago generado:', { checkoutUrl, sessionId });
            // Aquí puedes manejar el seguimiento del pago
          }}
        />
      )}
      
      {/* Modal: Stripe Connect */}
      {showStripeConnect && generatedDTE && (
        <StripeConnectModal
          isOpen={showStripeConnect}
          onClose={() => setShowStripeConnect(false)}
          onSuccess={handleStripeConnectSuccess}
          clienteId={String((emisor as any)?.nit || '')}
          clienteNombre={String((emisor as any)?.nombreComercial || (emisor as any)?.nombre || '')}
          totalVenta={Number(totales.subTotalVentas || 0)}
        />
      )}
    </div>
  );
};

export default FacturaGenerator;
