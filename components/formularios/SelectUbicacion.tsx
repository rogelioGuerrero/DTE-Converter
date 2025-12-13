import React from 'react';
import { ChevronDown, MapPin } from 'lucide-react';
import { departamentos, getMunicipiosByDepartamento } from '../../catalogos';

interface SelectUbicacionProps {
  departamento: string;
  municipio: string;
  onDepartamentoChange: (codigo: string) => void;
  onMunicipioChange: (codigo: string) => void;
  disabled?: boolean;
  required?: boolean;
  showLabels?: boolean;
  size?: 'sm' | 'md' | 'lg';
  layout?: 'horizontal' | 'vertical';
  className?: string;
}

const SelectUbicacion: React.FC<SelectUbicacionProps> = ({
  departamento,
  municipio,
  onDepartamentoChange,
  onMunicipioChange,
  disabled = false,
  required = false,
  showLabels = true,
  size = 'md',
  layout = 'horizontal',
  className = '',
}) => {
  const municipios = getMunicipiosByDepartamento(departamento);

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-3 text-base',
  };

  const handleDepartamentoChange = (codigo: string) => {
    onDepartamentoChange(codigo);
    onMunicipioChange(''); // Reset municipio when departamento changes
  };

  const containerClass = layout === 'horizontal' 
    ? 'grid grid-cols-2 gap-3' 
    : 'space-y-3';

  return (
    <div className={`${containerClass} ${className}`}>
      {/* Departamento */}
      <div>
        {showLabels && (
          <label className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase mb-1">
            <MapPin className="w-3 h-3" />
            Departamento {required && <span className="text-red-500">*</span>}
          </label>
        )}
        <div className="relative">
          <select
            value={departamento}
            onChange={(e) => handleDepartamentoChange(e.target.value)}
            disabled={disabled}
            className={`
              w-full ${sizeClasses[size]} border border-gray-300 rounded-lg 
              focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
              outline-none appearance-none bg-white
              disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed
            `}
          >
            <option value="">Seleccionar...</option>
            {departamentos.map((d) => (
              <option key={d.codigo} value={d.codigo}>
                {d.codigo} - {d.nombre}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Municipio */}
      <div>
        {showLabels && (
          <label className="block text-xs font-medium text-gray-500 uppercase mb-1">
            Municipio {required && <span className="text-red-500">*</span>}
          </label>
        )}
        <div className="relative">
          <select
            value={municipio}
            onChange={(e) => onMunicipioChange(e.target.value)}
            disabled={disabled || !departamento}
            className={`
              w-full ${sizeClasses[size]} border border-gray-300 rounded-lg 
              focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
              outline-none appearance-none bg-white
              disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed
            `}
          >
            <option value="">{departamento ? 'Seleccionar...' : 'Primero seleccione departamento'}</option>
            {municipios.map((m) => (
              <option key={m.codigo} value={m.codigo}>
                {m.codigo} - {m.nombre}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>
    </div>
  );
};

export default SelectUbicacion;
