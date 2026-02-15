const crypto = require('crypto');

exports.handler = async function(event, context) {
  // Solo permitir POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body);
    const { password, licenseData } = body;

    // 1. Verificar contraseña maestra
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword || password !== adminPassword) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Contraseña de administrador incorrecta' })
      };
    }

    // 2. Verificar llave privada
    const privateKey = process.env.LICENSE_PRIVATE_KEY;
    if (!privateKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Llave privada no configurada en el servidor' })
      };
    }

    // 3. Preparar datos de la licencia
    // Asegurar valores por defecto y estructura
    const now = new Date();
    const expiresAt = licenseData.expiresAt ? new Date(licenseData.expiresAt) : new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    
    const finalLicenseData = {
      id: crypto.randomUUID(),
      userId: licenseData.userId || 'user-' + Math.random().toString(36).substr(2, 9),
      issuedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      maxExports: typeof licenseData.maxExports === 'number' ? licenseData.maxExports : -1,
      features: licenseData.features || ['basic'],
      email: licenseData.email || '',
      companyName: licenseData.companyName || '',
      deviceFingerprint: licenseData.deviceFingerprint || null,
      version: '1.0'
    };

    // 4. Firmar licencia
    const sign = crypto.createSign('SHA256');
    sign.update(JSON.stringify(finalLicenseData));
    const signature = sign.sign(privateKey.replace(/\\n/g, '\n'), 'base64');

    const license = {
      data: finalLicenseData,
      signature
    };

    // 5. Generar formatos extra (Base64 y Link)
    const licenseBase64 = Buffer.from(JSON.stringify(license)).toString('base64');
    
    // URL base desde variable o default
    const appUrl = process.env.URL || 'https://factura.mishacienda.sv'; 
    const magicLink = `${appUrl}/?license=${licenseBase64}`;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        license,
        licenseBase64,
        magicLink
      })
    };

  } catch (error) {
    console.error('Error generating license:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error interno generando la licencia: ' + error.message })
    };
  }
};
