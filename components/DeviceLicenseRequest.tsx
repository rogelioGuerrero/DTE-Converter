import React, { useState, useEffect } from 'react';
import { Copy, Check, Shield, Key, Mail, Download } from 'lucide-react';
import { deviceFingerprint } from '../utils/deviceFingerprint';

interface DeviceLicenseRequestProps {
  onLicenseUploaded?: () => void;
}

export const DeviceLicenseRequest: React.FC<DeviceLicenseRequestProps> = ({ onLicenseUploaded }) => {
  const [fingerprint, setFingerprint] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    generateFingerprint();
  }, []);

  const generateFingerprint = async () => {
    try {
      setLoading(true);
      const fp = await deviceFingerprint.generateFingerprint();
      setFingerprint(fp);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (fingerprint) {
      try {
        await navigator.clipboard.writeText(fingerprint);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        console.error('Error copiando:', error);
      }
    }
  };

  const handleSendEmail = () => {
    const subject = encodeURIComponent('Solicitud de Licencia DTE - Mi Dispositivo');
    const body = encodeURIComponent(`
Hola,

Solicito mi licencia para DTE App.

Mi código de dispositivo es:
${fingerprint}

Por favor, envíenme mi licencia a este correo.

Gracias.
    `.trim());

    // Detectar si es móvil y abrir cliente de correo por defecto
    if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
      // En móviles, abrir cliente de correo por defecto
      window.location.href = `mailto:info@agtisa.com?subject=${subject}&body=${body}`;
    } else {
      // En desktop, intentar múltiples opciones
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=info@agtisa.com&su=${subject}&body=${body}`;
      
      // Primero intentar Gmail
      window.open(gmailUrl, '_blank');
      
      // Mostrar instrucciones fallback
      setTimeout(() => {
        if (!confirm('¿No se abrió Gmail? También puedes usar Outlook o cualquier otro cliente de correo para enviar tu solicitud a info@agtisa.com')) {
          // Fallback a mailto si cancela
          window.location.href = `mailto:info@agtisa.com?subject=${subject}&body=${body}`;
        }
      }, 1000);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/json') {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const license = JSON.parse(event.target?.result as string);
          
          // Validar que sea una licencia válida
          if (!license.data || !license.signature) {
            throw new Error('Formato de licencia inválido');
          }
          
          // Aquí iría la validación completa con licenseValidator.verifyLicense(license)
          // Por ahora, asumimos que es válida
          
          if (onLicenseUploaded) {
            onLicenseUploaded();
          }
        } catch (error) {
          alert('Archivo de licencia inválido: ' + (error as Error).message);
        }
      };
      reader.readAsText(file);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-2">
          <Key className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="text-base font-semibold">Activa tu Licencia</h3>
            <p className="text-xs text-gray-600">
              Tu licencia estará atada a este dispositivo
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Fingerprint Display */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-medium text-gray-700">Código de tu Dispositivo:</h4>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3" />
                  <span>Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copiar</span>
                </>
              )}
            </button>
          </div>
          <div className="font-mono text-xs bg-white border rounded px-2 py-1 break-all select-all">
            {fingerprint}
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <Shield className="w-4 h-4 text-blue-600 mt-0.5" />
            <div className="text-xs text-blue-800">
              <p className="font-medium mb-1">Pasos para activar:</p>
              <ol className="list-decimal list-inside space-y-0.5 text-blue-700">
                <li>Copia tu código (botón amarillo)</li>
                <li>Envíalo por correo electrónico</li>
                <li>Recibirás tu archivo .json</li>
                <li>Arrastra el archivo aquí</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Send Options */}
        <button
          onClick={handleSendEmail}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
        >
          <Mail className="w-4 h-4" />
          <span>Enviar por Correo</span>
        </button>

        {/* Upload Area */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
          <Download className="w-6 h-6 text-gray-400 mx-auto mb-1" />
          <p className="text-xs text-gray-600 mb-2">
            ¿Ya tienes tu licencia?
          </p>
          <label className="cursor-pointer">
            <span className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors inline-block text-xs">
              Subir Archivo .json
            </span>
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        {/* Note */}
        <div className="text-xs text-gray-500 text-center space-y-0.5">
          <p>Esta licencia solo funcionará en este dispositivo</p>
          <p>No podrá ser transferida</p>
        </div>
      </div>
    </div>
  );
};
