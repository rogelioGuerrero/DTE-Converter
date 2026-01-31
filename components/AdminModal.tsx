import React, { useState, useEffect } from 'react';
import { X, Lock, Key, Eye, EyeOff, Save, HelpCircle } from 'lucide-react';
import Tooltip from './Tooltip';
import { loadSettings, saveSettings, AppSettings } from '../utils/settings';
import { NitOrDuiField, NrcField } from './formularios';

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
                    <div className="flex items-center gap-1 mb-1">
                      <label className="block text-sm font-medium text-gray-700">Google Gemini API Key</label>
                      <Tooltip content="Obtén tu API Key gratis en ai.google.dev" position="right">
                        <HelpCircle className="w-3.5 h-3.5 text-gray-400 cursor-help" />
                      </Tooltip>
                    </div>
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
                 
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <div className="flex items-center gap-1 mb-1">
                          <label className="block text-sm font-medium text-gray-700">Mi NIT / DUI</label>
                          <Tooltip content="Se usa para detectar si un DTE es compra o venta" position="top">
                            <HelpCircle className="w-3 h-3 text-gray-400 cursor-help" />
                          </Tooltip>
                        </div>
                        <NitOrDuiField
                            label={null}
                            value={settings.myNit}
                            onChange={(myNit) => setSettings({ ...settings, myNit })}
                            placeholder="02453099-6"
                            messageVariant="none"
                            colorMode="blue"
                            tone="neutral"
                            inputClassName="w-full px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                        />
                        <p className="text-[10px] text-gray-400 mt-1">9 dígitos (DUI) ó 14 dígitos (NIT)</p>
                    </div>
                    <div>
                        <div className="flex items-center gap-1 mb-1">
                          <label className="block text-sm font-medium text-gray-700">Mi NRC</label>
                          <Tooltip content="Alternativa al NIT para identificar tu empresa" position="top">
                            <HelpCircle className="w-3 h-3 text-gray-400 cursor-help" />
                          </Tooltip>
                        </div>
                        <NrcField
                            label={null}
                            value={settings.myNrc}
                            onChange={(myNrc) => setSettings({ ...settings, myNrc })}
                            placeholder="1571266"
                            messageVariant="none"
                            colorMode="blue"
                            tone="neutral"
                            inputClassName="w-full px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                        />
                        <p className="text-[10px] text-gray-400 mt-1">6-8 dígitos</p>
                    </div>
                 </div>

                 {/* Auto-Detection Checkbox */}
                 <div className="mt-4">
                    <label className="flex items-start gap-3 cursor-pointer group">
                       <input
                          type="checkbox"
                          checked={settings.useAutoDetection}
                          disabled={!settings.myNit && !settings.myNrc}
                          onChange={(e) => setSettings({ ...settings, useAutoDetection: e.target.checked })}
                          className="mt-0.5 w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                       />
                       <div className="flex-1">
                          <span className={`text-sm font-medium ${(!settings.myNit && !settings.myNrc) ? 'text-gray-400' : 'text-gray-700 group-hover:text-gray-900'}`}>
                             Detección automática
                          </span>
                          <p className="text-[10px] text-gray-500 mt-0.5">
                             Detecta ventas/compras según tu NIT/NRC
                          </p>
                          {(!settings.myNit && !settings.myNrc) && (
                             <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
                                <HelpCircle className="w-3 h-3" />
                                Requiere NIT o NRC
                             </p>
                          )}
                       </div>
                    </label>
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
