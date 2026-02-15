import React, { useState, useEffect } from 'react';
import { Lock, Save, Settings, Shield, X, Key, LayoutTemplate, CheckCircle2 } from 'lucide-react';
import { loadSettings, saveSettings, AppSettings } from '../utils/settings';
import { validateAdminPin, hasAdminPin } from '../utils/adminPin';
import { getUserModeConfig, setUserMode, UserMode } from '../utils/userMode';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AdminModal: React.FC<AdminModalProps> = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState<AppSettings>(loadSettings());
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [activeTab, setActiveTab] = useState('general');
  const [error, setError] = useState('');
  const [currentMode, setCurrentMode] = useState<UserMode>('negocio');
  
  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSettings(loadSettings());
      setIsAuthenticated(false);
      setPinInput('');
      setError('');
      setActiveTab('general');
      setCurrentMode(getUserModeConfig().mode);
    }
  }, [isOpen]);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateAdminPin(pinInput)) {
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

  const handleModeChange = (mode: UserMode) => {
    setUserMode(mode);
    setCurrentMode(mode);
    // Recargar para aplicar cambios en pestañas
    window.location.reload();
  };

  const tabs = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'modo', label: 'Modo de Uso', icon: LayoutTemplate },
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
                <p className="text-sm text-gray-500">
                  Ingresa el PIN de seguridad para acceder.
                </p>
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
                        Estado: <span className="font-mono font-bold">{hasAdminPin() ? 'Configurado por variable de entorno' : 'No configurado (solo desarrollo)'}</span>
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        El PIN se configura via variable de entorno VITE_ADMIN_PIN
                      </p>
                    </div>
                  </div>
                )}

                {activeTab === 'modo' && (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                      Seleccione la interfaz que mejor se adapte a su actividad. El cambio recargará la aplicación.
                    </p>
                    
                    <div className="grid gap-3">
                      <button
                        onClick={() => handleModeChange('profesional')}
                        className={`p-4 rounded-xl border-2 text-left transition-all relative ${
                          currentMode === 'profesional' 
                            ? 'border-indigo-500 bg-indigo-50' 
                            : 'border-gray-200 hover:border-indigo-200'
                        }`}
                      >
                        <div className="font-semibold text-gray-900 flex justify-between items-center">
                          Profesional / Servicios
                          {currentMode === 'profesional' && <CheckCircle2 className="w-5 h-5 text-indigo-500" />}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Interfaz simplificada. <strong>Oculta Inventario y Productos</strong>. Ideal para venta de servicios.
                        </p>
                      </button>

                      <button
                        onClick={() => handleModeChange('negocio')}
                        className={`p-4 rounded-xl border-2 text-left transition-all relative ${
                          currentMode === 'negocio' 
                            ? 'border-indigo-500 bg-indigo-50' 
                            : 'border-gray-200 hover:border-indigo-200'
                        }`}
                      >
                        <div className="font-semibold text-gray-900 flex justify-between items-center">
                          Negocio / Tienda
                          {currentMode === 'negocio' && <CheckCircle2 className="w-5 h-5 text-indigo-500" />}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Interfaz completa. Incluye <strong>Inventario y Catálogo de Productos</strong>. Para comercios.
                        </p>
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === 'licencias' && (
                  <div className="space-y-4">
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm text-amber-800">
                        El licenciamiento es controlado remotamente por el administrador del sistema.
                      </p>
                      <p className="text-xs text-amber-600 mt-1">
                        Los cambios se aplican automáticamente a todos los usuarios.
                      </p>
                    </div>
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-gray-700">Estado del Licenciamiento</h4>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600">
                          Estado: <span className="font-mono font-bold">Controlado por servidor</span>
                        </p>
                      </div>
                    </div>
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
