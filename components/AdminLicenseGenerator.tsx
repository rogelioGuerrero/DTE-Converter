import React, { useState } from 'react';
import { Shield, Key, Calendar, Mail, User, Smartphone, Copy, Check, ExternalLink, Lock } from 'lucide-react';
import { notify } from '../utils/notifications';

export const AdminLicenseGenerator: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  
  // Form State
  const [formData, setFormData] = useState({
    email: '',
    companyName: '',
    userId: '',
    daysValid: 365,
    maxExports: -1, // -1 ilimitado
    deviceFingerprint: ''
  });

  // Result State
  const [generatedResult, setGeneratedResult] = useState<{
    licenseBase64: string;
    magicLink: string;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Validación básica local, la real es en el servidor
    if (password) setIsAuthenticated(true);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setGeneratedResult(null);

    try {
      // Calcular fecha expiración
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + formData.daysValid);

      const payload = {
        password,
        licenseData: {
          email: formData.email,
          companyName: formData.companyName,
          userId: formData.userId || undefined,
          expiresAt: expiresAt.toISOString(),
          maxExports: Number(formData.maxExports),
          deviceFingerprint: formData.deviceFingerprint || undefined
        }
      };

      const response = await fetch('/.netlify/functions/admin-generate-license', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error generando licencia');
      }

      setGeneratedResult({
        licenseBase64: data.licenseBase64,
        magicLink: data.magicLink
      });
      notify('Licencia generada exitosamente', 'success');

    } catch (error) {
      console.error(error);
      notify((error as Error).message, 'error');
      if ((error as Error).message.includes('Contraseña')) {
        setIsAuthenticated(false); // Reset si falló pass
      }
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, isLink: boolean) => {
    try {
      await navigator.clipboard.writeText(text);
      if (isLink) {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      } else {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      }
    } catch (err) {
      notify('Error al copiar', 'error');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
          <div className="flex justify-center mb-6">
            <div className="p-3 bg-indigo-100 rounded-full">
              <Lock className="w-8 h-8 text-indigo-600" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">Acceso Administrativo</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña Maestra</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="••••••••"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              Ingresar
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-indigo-600 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <Shield className="w-6 h-6" />
              <h1 className="text-xl font-bold">Generador de Licencias</h1>
            </div>
            <button 
              onClick={() => setIsAuthenticated(false)}
              className="text-indigo-100 hover:text-white text-sm"
            >
              Salir
            </button>
          </div>

          <div className="p-6 md:p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Formulario */}
              <form onSubmit={handleGenerate} className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Datos del Cliente</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                    <Mail className="w-4 h-4" /> Email del Cliente
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="cliente@ejemplo.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                    <User className="w-4 h-4" /> Nombre / Empresa
                  </label>
                  <input
                    type="text"
                    value={formData.companyName}
                    onChange={(e) => setFormData({...formData, companyName: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Empresa S.A. de C.V."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                    <Smartphone className="w-4 h-4" /> Fingerprint (ID Dispositivo)
                  </label>
                  <input
                    type="text"
                    value={formData.deviceFingerprint}
                    onChange={(e) => setFormData({...formData, deviceFingerprint: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 font-mono text-xs"
                    placeholder="Pegar ID que envió el cliente..."
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Obligatorio para vincular al dispositivo.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                      <Calendar className="w-4 h-4" /> Días Validez
                    </label>
                    <input
                      type="number"
                      value={formData.daysValid}
                      onChange={(e) => setFormData({...formData, daysValid: Number(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                      <Key className="w-4 h-4" /> Límite Diario
                    </label>
                    <select
                      value={formData.maxExports}
                      onChange={(e) => setFormData({...formData, maxExports: Number(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="-1">Ilimitado</option>
                      <option value="10">10 DTEs</option>
                      <option value="50">50 DTEs</option>
                      <option value="100">100 DTEs</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className={`w-full flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium ${loading ? 'opacity-70 cursor-wait' : ''}`}
                  >
                    {loading ? (
                      <>Generando...</>
                    ) : (
                      <>
                        <Shield className="w-5 h-5" /> Generar Licencia
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Resultados */}
              <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Licencia Generada</h3>
                
                {!generatedResult ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 min-h-[200px]">
                    <Shield className="w-12 h-12 mb-2 opacity-20" />
                    <p className="text-sm">Completa el formulario para generar</p>
                  </div>
                ) : (
                  <div className="space-y-6 animate-fadeIn">
                    {/* Magic Link */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Opción 1: Enlace Mágico (Recomendado)
                      </label>
                      <div className="flex gap-2">
                        <input
                          readOnly
                          value={generatedResult.magicLink}
                          className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-600 truncate"
                        />
                        <button
                          onClick={() => copyToClipboard(generatedResult.magicLink, true)}
                          className={`p-2 rounded-md transition-colors ${copiedLink ? 'bg-green-100 text-green-600' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                          title="Copiar enlace"
                        >
                          {copiedLink ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                        </button>
                        <a 
                          href={generatedResult.magicLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 bg-white border border-gray-300 text-gray-600 rounded-md hover:bg-gray-50"
                          title="Probar enlace"
                        >
                          <ExternalLink className="w-5 h-5" />
                        </a>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Envía este link por WhatsApp. Al abrirlo, la app se activará automáticamente.
                      </p>
                    </div>

                    <div className="border-t border-gray-200"></div>

                    {/* Base64 Code */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Opción 2: Código de Texto
                      </label>
                      <div className="relative">
                        <textarea
                          readOnly
                          value={generatedResult.licenseBase64}
                          className="w-full h-24 px-3 py-2 bg-white border border-gray-300 rounded-md text-xs font-mono text-gray-600 resize-none focus:outline-none"
                        />
                        <button
                          onClick={() => copyToClipboard(generatedResult.licenseBase64, false)}
                          className={`absolute top-2 right-2 p-1.5 rounded-md transition-colors ${copiedCode ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
                          {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Si el link falla, envía este código para que lo peguen manualmente.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
