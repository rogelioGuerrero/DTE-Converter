import React, { useState, useEffect } from 'react';
import { Lock, Save, Settings, Shield, RefreshCw, HelpCircle, X, Key } from 'lucide-react';
import { loadSettings, saveSettings, AppSettings } from '../utils/settings';
import { setUserMode, UserMode, getUserModeConfig } from '../utils/userMode';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AdminModal: React.FC<AdminModalProps> = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState<AppSettings>(loadSettings());
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [currentUserMode, setCurrentUserMode] = useState<UserMode>(getUserModeConfig().mode);
  const [activeTab, setActiveTab] = useState('general');
  const [error, setError] = useState('');
  
  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSettings(loadSettings());
      setIsAuthenticated(false);
      setPinInput('');
      setError('');
      setActiveTab('general');
    }
  }, [isOpen]);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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

  const tabs = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'licencias', label: 'Licencias', icon: Shield }
  ];

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
                  placeholder="••••••"
                  maxLength={10}
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
            <div className="space-y-4">
              {/* Tabs Navigation */}
              <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                        activeTab === tab.id
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Tab Content */}
              <div className="min-h-[300px]">
                {activeTab === 'general' && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-gray-700">PIN de Acceso</h4>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">
                        PIN actual: <span className="font-mono font-bold">@1321rg</span>
                      </p>
                      <p className="text-[10px] text-gray-500 mt-1">
                        El PIN es fijo por seguridad. Para cambiarlo, modifica el código fuente.
                      </p>
                    </div>
                  </div>
                )}

                {activeTab === 'licencias' && (
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-gray-700">Gestión de Licencias</h4>
                      <div>
                        <label className="flex items-start gap-3 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={settings.licensingEnabled}
                            onChange={(e) => setSettings({ ...settings, licensingEnabled: e.target.checked })}
                            className="mt-0.5 w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                          />
                          <div className="flex-1">
                            <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                              Activar Licenciamiento
                            </span>
                            <p className="text-[10px] text-gray-500 mt-0.5">
                              Controla el acceso a funcionalidades premium mediante licencias
                            </p>
                            <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
                              <HelpCircle className="w-3 h-3" />
                              Desactivar esto permite uso ilimitado (solo para desarrollo/pruebas)
                            </p>
                          </div>
                        </label>
                      </div>
                    </div>
                    
                    {settings.licensingEnabled && (
                      <div className="space-y-3 pt-4 border-t border-gray-100">
                        <h4 className="text-sm font-semibold text-gray-700">Modo de Usuario</h4>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Usuario</label>
                          <select
                            value={currentUserMode}
                            onChange={(e) => {
                              const newMode = e.target.value as UserMode;
                              setCurrentUserMode(newMode);
                              setUserMode(newMode);
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                          >
                            <option value="profesional">Profesional (acceso completo)</option>
                            <option value="negocio">Negocio / Tienda (solo facturación)</option>
                          </select>
                          <p className="text-[10px] text-gray-500 mt-1">
                            Cambia las pestañas visibles según el tipo de usuario
                          </p>
                          <button
                            onClick={() => window.location.reload()}
                            className="mt-2 flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700"
                          >
                            <RefreshCw className="w-3 h-3" />
                            Recargar para aplicar cambios
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  Guardar Cambios
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default AdminModal;
