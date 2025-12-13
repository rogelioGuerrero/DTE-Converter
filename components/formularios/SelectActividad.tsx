import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, ChevronDown, Briefcase, X } from 'lucide-react';
import { actividadesEconomicas, buscarActividades, ActividadEconomica } from '../../catalogos';

interface SelectActividadProps {
  value: string;
  onChange: (codigo: string, descripcion: string) => void;
  disabled?: boolean;
  required?: boolean;
  label?: string;
  placeholder?: string;
  className?: string;
}

const SelectActividad: React.FC<SelectActividadProps> = ({
  value,
  onChange,
  disabled = false,
  required = false,
  label = 'Actividad Económica',
  placeholder = 'Buscar actividad...',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Obtener actividad seleccionada
  const selectedActividad = useMemo(() => {
    return actividadesEconomicas.find(a => a.codigo === value);
  }, [value]);

  // Filtrar actividades
  const filteredActividades = useMemo(() => {
    if (search.trim()) {
      return buscarActividades(search).slice(0, 50);
    }
    return actividadesEconomicas.slice(0, 50); // Limitar resultados
  }, [search]);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (actividad: ActividadEconomica) => {
    onChange(actividad.codigo, actividad.descripcion);
    setIsOpen(false);
    setSearch('');
  };

  const handleClear = () => {
    onChange('', '');
    setSearch('');
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase mb-1">
          <Briefcase className="w-3 h-3" />
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full px-3 py-2 text-left border rounded-lg text-sm
          flex items-center justify-between gap-2
          focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none
          disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed
          ${isOpen ? 'border-blue-500 ring-2 ring-blue-500' : 'border-gray-300'}
        `}
      >
        <span className={`truncate ${selectedActividad ? 'text-gray-900' : 'text-gray-400'}`}>
          {selectedActividad 
            ? `${selectedActividad.codigo} - ${selectedActividad.descripcion}`
            : placeholder
          }
        </span>
        <div className="flex items-center gap-1">
          {selectedActividad && !disabled && (
            <X 
              className="w-4 h-4 text-gray-400 hover:text-gray-600" 
              onClick={(e) => { e.stopPropagation(); handleClear(); }}
            />
          )}
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por código o descripción..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                autoFocus
              />
            </div>
          </div>

          {/* Results */}
          <div className="max-h-60 overflow-y-auto">
            {filteredActividades.length === 0 ? (
              <p className="p-3 text-sm text-gray-400 text-center">Sin resultados</p>
            ) : (
              filteredActividades.map(actividad => (
                <button
                  key={actividad.codigo}
                  onClick={() => handleSelect(actividad)}
                  className={`
                    w-full px-3 py-2 text-left hover:bg-blue-50 transition-colors
                    ${actividad.codigo === value ? 'bg-blue-50' : ''}
                  `}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-mono text-blue-600 bg-blue-50 px-1 rounded shrink-0">
                      {actividad.codigo}
                    </span>
                    <span className="text-sm text-gray-700 line-clamp-2">
                      {actividad.descripcion}
                    </span>
                  </div>
                </button>
              ))
            )}
            {filteredActividades.length === 50 && (
              <p className="p-2 text-xs text-gray-400 text-center border-t">
                Mostrando primeros 50 resultados. Refina tu búsqueda.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SelectActividad;
