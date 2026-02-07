# Sistema de Licencias DTE Pro

Este documento explica cómo funciona y cómo configurar el sistema de licencias para monetizar la aplicación DTE Pro.

## 🎯 Concepto

El sistema utiliza **criptografía asimétrica** para validar licencias offline:
- **Llave Privada**: Solo tú la tienes. Firma las licencias.
- **Llave Pública**: Está en la app. Verifica que las licencias sean auténticas.

## � Control de Licenciamiento (Toggle)

La aplicación incluye un interruptor en **Configuración Avanzada** que permite:
- **✅ Activado (Producción)**: Aplica validación de licencias y límites
- **❌ Desactivado (Desarrollo)**: Uso ilimitado sin necesidad de licencia

### ¿Cómo acceder?
1. Haz clic 5 veces en el logo DTE Pro
2. Ingresa PIN: 1321
3. Ve a "Gestión de Licencias"
4. Activa/desactiva "Activar Licenciamiento"

### ¿Cuándo usarlo desactivado?
- **Desarrollo**: Para probar sin restricciones
- **Demostraciones**: Para mostrar funcionalidad completa
- **Versiones internas**: Para tu equipo
- **Testing**: Para simular diferentes escenarios

## �🚀 Configuración Inicial

### 1. Generar llaves criptográficas
```bash
cd scripts
node setup-license.mjs
```

Esto generará:
- `private-key.pem` - ¡GUARDAR SEGURO! Nunca compartir.
- `public-key.pem` - Llave pública en formato PEM
- `public-key.jwk` - Llave pública en formato para la web

### 2. Actualizar la aplicación
El script de configuración automáticamente actualiza `utils/licenseValidator.ts` con la llave pública.

## 💰 Generación de Licencias

### Comandos básicos
```bash
# Generar licencia por 1 año
node generate-license.mjs generate --email cliente@ejemplo.com

# Licencia personalizada
node generate-license.mjs generate \
  --email cliente@ejemplo.com \
  --company "Mi Empresa S.A. de C.V." \
  --days 365 \
  --exports 100

# Verificar licencia
node generate-license.mjs verify license-user-123.json
```

### Opciones disponibles
- `--email <correo>`: Email del usuario
- `--company <nombre>`: Nombre de la empresa
- `--days <número>`: Días de validez (defecto: 365)
- `--exports <número>`: Límite de exportaciones diarias (-1 = ilimitado)

## 🔧 Integración con la App

### Componentes
- `LicenseManager.tsx`: Modal para activar licencia
- `LicenseStatus.tsx`: Indicador visual de estado
- `licenseValidator.ts`: Lógica de validación
- `usageLimit.ts`: Control de exportaciones

### Flujo del usuario
1. Usuario usa app con límite gratuito (5 exportaciones/día)
2. Puede activar licencia cargando archivo `.json`
3. La licencia se valida offline usando Web Crypto API
4. Se guarda en IndexedDB para uso futuro

## 💡 Modelos de Monetización Sugeridos

### 1. Licencia Perpetua
- **Precio**: $99 USD
- **Incluye**: Uso ilimitado, actualizaciones por 1 año
- **Renovación**: $29/año para actualizaciones

### 2. Licencias por Volumen
- **Básica**: $49 - 50 exportaciones/día
- **Profesional**: $99 - 200 exportaciones/día
- **Empresarial**: $199 - Ilimitadas

### 3. Suscripción Anual (si decides cambiar)
- **Mensual**: $9/mes
- **Anual**: $99/año (2 meses gratis)

## 🛡️ Seguridad

### ¿Qué tan seguro es?
- ✅ **Firmas inviolables**: Nadie puede generar licencias sin tu llave privada
- ⚠️ **Código modificable**: Un programador podría saltarse la validación
- 💡 **Mitigación**: Ofuscación de código y precio accesible

### Mejores prácticas
1. **Guarda secure tu llave privada** (private-key.pem)
2. **Usa ofuscación** para dificultar ingeniería inversa
3. **Precio accesible** para desincentivar pirateo
4. **Ofrece soporte prioritario** a clientes pagos

## 📋 Proceso de Venta

### Opción 1: Manual
1. Cliente te contacta y paga (transferencia, PayPal, etc.)
2. Generas licencia con sus datos
3. Envías archivo JSON por email

### Opción 2: Automatizado (futuro)
- Integrar con **Gumroad** o **LemonSqueezy**
- API que genera licencias automáticamente al pagar
- Webhook para entrega instantánea

### Opción 3: Backend Mínimo
- Una Cloud Function para generar licencias
- Base de datos simple para registrar ventas
- No es SaaS completo, solo validación

## 🔍 Troubleshooting

### "Licencia inválida o manipulada"
- Verifica que el archivo JSON no fue modificado
- Asegúrate de usar la llave pública correcta

### "Licencia expirada"
- La fecha del sistema es correcta
- Generar nueva licencia con fecha futura

### "Límite de exportaciones alcanzado"
- Para usuarios sin licencia: 5 por día
- Para usuarios con licencia: según configuración
- Se reinicia cada día a medianoche

## 📝 Notas Técnicas

### Formato del archivo de licencia
```json
{
  "data": {
    "id": "uuid-único",
    "userId": "user-123",
    "issuedAt": "2024-01-01T00:00:00.000Z",
    "expiresAt": "2025-01-01T00:00:00.000Z",
    "maxExports": 100,
    "features": ["basic"],
    "email": "cliente@ejemplo.com",
    "companyName": "Mi Empresa",
    "version": "1.0"
  },
  "signature": "firma-base64-sha256-ecdsa"
}
```

### Almacenamiento
- Licencias guardadas en `localStorage` como `dte-license`
- Contador de exportaciones en `exports-YYYY-MM-DD`
- Compatible con IndexedDB para futuras mejoras

## 🚀 Próximos Pasos

1. **Configurar sistema**: Ejecutar `setup-license.mjs`
2. **Probar**: Generar licencia de prueba
3. **Definir precios**: Según tu mercado
4. **Crear canal de venta**: Email, web, etc.
5. **Documentar soporte**: FAQ y contacto

---

¿Necesitas ayuda implementando alguna parte específica?
