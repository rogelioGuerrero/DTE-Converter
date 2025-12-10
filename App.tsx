import React, { useState, useRef } from 'react';
import BatchDashboard from './components/BatchDashboard';
import OCRScanner from './components/OCRScanner';
import AdminModal from './components/AdminModal';
import { LayoutDashboard, ScanLine, CheckCircle } from 'lucide-react';

type AppTab = 'batch' | 'ocr';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>('batch');
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
      
      {/* Global Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-40 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3 cursor-pointer select-none" onClick={handleLogoClick}>
            <div className={`p-2 rounded-xl shadow-md transition-colors duration-500 ${activeTab === 'batch' ? 'bg-indigo-600 shadow-indigo-200' : 'bg-blue-600 shadow-blue-200'}`}>
              <LayoutDashboard className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight hidden md:block">
              Facturas DTE <span className={activeTab === 'batch' ? 'text-indigo-600' : 'text-blue-600'}>Pro</span>
            </h1>
          </div>
          
          {/* Main Navigation - The Decoupling Switch */}
          <nav className="flex items-center p-1 bg-gray-100/80 rounded-xl">
             <button 
               onClick={() => setActiveTab('batch')}
               className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${activeTab === 'batch' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
             >
               <LayoutDashboard className="w-4 h-4" />
               <span>Libros IVA</span>
             </button>
             <button 
               onClick={() => setActiveTab('ocr')}
               className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${activeTab === 'ocr' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
             >
               <ScanLine className="w-4 h-4" />
               <span>Factura Fácil AI</span>
             </button>
          </nav>
          
          {/* External Links / Profile Placeholder */}
          <div className="flex items-center space-x-3">
             {/* Espacio reservado para futuros controles globales */}
          </div>
        </div>
      </header>

      {/* Main Content Area - Decoupled Rendering */}
      <main className="flex-grow px-4 sm:px-6 lg:px-8 py-10">
        {activeTab === 'batch' ? (
            <BatchDashboard />
        ) : (
            <OCRScanner />
        )}
      </main>

      <footer className="border-t border-gray-200 mt-auto bg-white/50">
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
    </div>
  );
};

export default App;
