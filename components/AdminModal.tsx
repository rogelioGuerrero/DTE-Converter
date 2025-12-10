import React, { useState, useEffect } from 'react';
import { X, Lock, Key, Eye, EyeOff, Save } from 'lucide-react';
import { loadSettings, saveSettings, AppSettings } from '../utils/settings';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AdminModal: React.FC<AdminModalProps> = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState<AppSettings>(loadSettings());
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [error, setError] = useState('');
  
  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSettings(loadSettings());
      setIsAuthenticated(false);
      setPinInput('');
      setError('');
    }
  }, [isOpen]);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Default PIN check (1321) or stored PIN if we allowed changing it
    // The user requested checking against "1321" or allowing the user to set it?
    // "pedir un código de 4 dígitos para validar, que sería 1321" implies the validation code is 1321.
    // However, storing the PIN in settings allows changing it later if we implement that.
    // For now, let's validate against the stored PIN (which defaults to 1321).
    if (pinInput === settings.pin) {
      setIsAuthenticated(true);
      setError('');
    } else {
      setError('PIN incorrecto');
    }
  };

  const handleSave = () => {
    saveSettings(settings);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <Lock className="w-4 h-4 text-gray-500" />
            Configuración Avanzada
          </h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {!isAuthenticated ? (
            <form onSubmit={handlePinSubmit} className="space-y-4">
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Key className="w-6 h-6 text-gray-500" />
                </div>
                <p className="text-sm text-gray-500">Ingresa el PIN de seguridad para acceder.</p>
              </div>
              
              <div>
                <input
                  type="password"
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    setError('');
                  }}
                  className="w-full text-center text-2xl tracking-widest font-mono py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="••••"
                  maxLength={4}
                  autoFocus
                />
                {error && <p className="text-xs text-red-500 text-center mt-2">{error}</p>}
              </div>

              <button
                type="submit"
                className="w-full bg-gray-900 text-white py-2.5 rounded-xl font-medium hover:bg-gray-800 transition-colors"
              >
                Desbloquear
              </button>
            </form>
          ) : (
            <div className="space-y-6">
               
               {/* API Configuration */}
               <div className="space-y-3">
                 <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Integración IA</h4>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Google Gemini API Key</label>
                    <div className="relative">
                        <input
                            type={showApiKey ? "text" : "password"}
                            value={settings.apiKey}
                            onChange={(e) => setSettings({...settings, apiKey: e.target.value})}
                            placeholder="AIzaSy..."
                            className="w-full pl-3 pr-10 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                        />
                        <button
                            type="button"
                            onClick={() => setShowApiKey(!showApiKey)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                            {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">
                        Necesaria para el funcionamiento del OCR. Se guarda localmente.
                    </p>
                 </div>
               </div>

               <hr className="border-gray-100" />

               {/* My Company Configuration */}
               <div className="space-y-3">
                 <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Datos de mi Empresa</h4>
                 <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-700 mb-2">
                    Estos datos ayudan a identificar automáticamente si un DTE es Compra o Venta.
                 </div>
                 
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Mi NIT</label>
                        <input
                            type="text"
                            value={settings.myNit}
                            onChange={(e) => setSettings({...settings, myNit: e.target.value})}
                            placeholder="0000-000000-000-0"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Mi NRC</label>
                        <input
                            type="text"
                            value={settings.myNrc}
                            onChange={(e) => setSettings({...settings, myNrc: e.target.value})}
                            placeholder="000000-0"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                        />
                    </div>
                 </div>
               </div>

               <button
                  onClick={handleSave}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
               >
                  <Save className="w-4 h-4" />
                  Guardar Cambios
               </button>

            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default AdminModal;
