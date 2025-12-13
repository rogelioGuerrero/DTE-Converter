import React, { useState, useRef } from 'react';
import BatchDashboard from './components/BatchDashboard';
import ClientManager from './components/ClientManager';
import FacturaGenerator from './components/FacturaGenerator';
import DTEDashboard from './components/DTEDashboard';
import AdminModal from './components/AdminModal';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import ClientFormPage from './components/ClientFormPage';
import { LayoutDashboard, Users, FileText, CheckCircle, History } from 'lucide-react';

type AppTab = 'batch' | 'clients' | 'factura' | 'historial';

// Detectar si estamos en la pagina publica del cliente
const isClientFormPage = (): boolean => {
  return window.location.pathname === '/cliente';
};

const getVendorIdFromUrl = (): string | undefined => {
  const params = new URLSearchParams(window.location.search);
  return params.get('v') || undefined;
};

const App: React.FC = () => {
  // Si estamos en /cliente, mostrar solo el formulario publico
  if (isClientFormPage()) {
    return <ClientFormPage vendorId={getVendorIdFromUrl()} />;
  }

  const [activeTab, setActiveTab] = useState<AppTab>('clients');
  const [showAdminModal, setShowAdminModal] = useState(false);
  const clickCountRef = useRef(0);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLogoClick = () => {
    clickCountRef.current += 1;
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    clickTimerRef.current = setTimeout(() => {
      clickCountRef.current = 0;
    }, 1500);
    if (clickCountRef.current >= 5) {
      clickCountRef.current = 0;
      setShowAdminModal(true);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col font-sans text-slate-900">
      
      {/* Global Header - Desktop */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-40 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 md:h-16 flex items-center justify-between">
          
          {/* Logo & Brand */}
          <div className="flex items-center space-x-2 md:space-x-3 cursor-pointer select-none" onClick={handleLogoClick}>
            <div className={`p-1.5 md:p-2 rounded-lg md:rounded-xl shadow-md transition-colors duration-500 ${
                activeTab === 'batch' ? 'bg-indigo-600 shadow-indigo-200' : 
                activeTab === 'clients' ? 'bg-blue-600 shadow-blue-200' : 
                'bg-green-600 shadow-green-200'
              }`}>
              <LayoutDashboard className="w-4 h-4 md:w-5 md:h-5 text-white" />
            </div>
            <h1 className="text-lg md:text-xl font-bold text-gray-900 tracking-tight">
              DTE <span className={`hidden sm:inline ${
                activeTab === 'batch' ? 'text-indigo-600' : 
                activeTab === 'clients' ? 'text-blue-600' : 
                'text-green-600'
              }`}>Pro</span>
            </h1>
          </div>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center p-1 bg-gray-100/80 rounded-xl">
             <button 
               onClick={() => setActiveTab('batch')}
               className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${activeTab === 'batch' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
             >
               <LayoutDashboard className="w-4 h-4" />
               <span>Libros IVA</span>
             </button>
             <button 
               onClick={() => setActiveTab('clients')}
               className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${activeTab === 'clients' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
             >
               <Users className="w-4 h-4" />
               <span>Clientes</span>
             </button>
             <button 
               onClick={() => setActiveTab('factura')}
               className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${activeTab === 'factura' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
             >
               <FileText className="w-4 h-4" />
               <span>Facturar</span>
             </button>
             <button 
               onClick={() => setActiveTab('historial')}
               className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${activeTab === 'historial' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
             >
               <History className="w-4 h-4" />
               <span>Historial</span>
             </button>
          </nav>
          
          {/* Mobile: Current tab indicator */}
          <div className="md:hidden text-sm font-medium text-gray-600">
            {activeTab === 'batch' && 'Libros IVA'}
            {activeTab === 'clients' && 'Clientes'}
            {activeTab === 'factura' && 'Facturar'}
            {activeTab === 'historial' && 'Historial'}
          </div>
        </div>
      </header>

      {/* Main Content Area - with bottom padding for mobile nav */}
      <main className="flex-grow px-3 sm:px-6 lg:px-8 py-4 md:py-10 pb-20 md:pb-10">
        {activeTab === 'batch' && <BatchDashboard />}
        {activeTab === 'clients' && <ClientManager />}
        {activeTab === 'factura' && <FacturaGenerator />}
        {activeTab === 'historial' && <DTEDashboard />}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 safe-area-pb">
        <div className="flex items-center justify-around h-16">
          <button
            onClick={() => setActiveTab('batch')}
            className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
              activeTab === 'batch' ? 'text-indigo-600' : 'text-gray-400'
            }`}
          >
            <LayoutDashboard className={`w-5 h-5 ${activeTab === 'batch' ? 'scale-110' : ''} transition-transform`} />
            <span className="text-[10px] mt-1 font-medium">Libros</span>
          </button>
          <button
            onClick={() => setActiveTab('clients')}
            className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
              activeTab === 'clients' ? 'text-blue-600' : 'text-gray-400'
            }`}
          >
            <Users className={`w-5 h-5 ${activeTab === 'clients' ? 'scale-110' : ''} transition-transform`} />
            <span className="text-[10px] mt-1 font-medium">Clientes</span>
          </button>
          <button
            onClick={() => setActiveTab('factura')}
            className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
              activeTab === 'factura' ? 'text-green-600' : 'text-gray-400'
            }`}
          >
            <FileText className={`w-5 h-5 ${activeTab === 'factura' ? 'scale-110' : ''} transition-transform`} />
            <span className="text-[10px] mt-1 font-medium">Facturar</span>
          </button>
          <button
            onClick={() => setActiveTab('historial')}
            className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
              activeTab === 'historial' ? 'text-purple-600' : 'text-gray-400'
            }`}
          >
            <History className={`w-5 h-5 ${activeTab === 'historial' ? 'scale-110' : ''} transition-transform`} />
            <span className="text-[10px] mt-1 font-medium">Historial</span>
          </button>
        </div>
      </nav>

      <footer className="hidden md:block border-t border-gray-200 mt-auto bg-white/50">
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 flex justify-between items-center gap-4">
          <div className="flex flex-col space-y-1">
            <p className="text-sm text-gray-400">
              &copy; {new Date().getFullYear()} Facturas DTE Pro.
            </p>
            <p className="text-xs text-gray-400">
              Formato diseñado para ser compatible con los lineamientos del Ministerio de Hacienda de El Salvador.
              <br />
              Revisa siempre tus archivos en{' '}
              <a
                href="https://factura.gob.sv/"
                target="_blank"
                rel="noreferrer"
                className="underline decoration-dotted text-indigo-500 hover:text-indigo-600"
                title="Ir al sitio oficial del Ministerio de Hacienda (factura.gob.sv) para consultar normativa y validar tus DTE."
              >
                factura.gob.sv
              </a>{' '}
              antes de presentarlos.
            </p>
          </div>
          <div className="flex items-center space-x-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
             <CheckCircle className="w-3 h-3" />
             <span>100% Seguro & Privado</span>
          </div>
        </div>
      </footer>
      <AdminModal isOpen={showAdminModal} onClose={() => setShowAdminModal(false)} />
      <PWAInstallPrompt />
    </div>
  );
};

export default App;
