import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, Plus } from 'lucide-react';

interface Option {
  value: string;
  label: string;
  subtitle?: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  allowCreate?: boolean;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Seleccionar...",
  icon,
  disabled = false,
  allowCreate = false
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value) || (value ? { value, label: value } : undefined);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (opt.subtitle && opt.subtitle.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const exactMatchExists = options.some(opt => opt.label.toLowerCase() === searchTerm.toLowerCase() || opt.value.toLowerCase() === searchTerm.toLowerCase());

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div 
        className={`w-full pl-11 pr-10 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold uppercase outline-none focus-within:ring-2 focus-within:ring-blue-500/10 focus-within:border-blue-500 flex items-center justify-between cursor-pointer ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300">
          {icon || <Search className="w-4 h-4" />}
        </div>
        <span className={selectedOption ? "text-slate-900" : "text-slate-400"}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 absolute right-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="p-2 border-b border-slate-50">
            <input
              type="text"
              autoFocus
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/10"
              onClick={e => e.stopPropagation()}
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {filteredOptions.length === 0 ? (
              allowCreate && searchTerm ? (
                 <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(searchTerm);
                    setIsOpen(false);
                    setSearchTerm("");
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold uppercase transition-all flex items-center gap-2 hover:bg-slate-50 text-blue-600"
                >
                  <Plus className="w-4 h-4" />
                  Agregar "{searchTerm}"
                </button>
              ) : (
                <div className="px-3 py-4 text-center text-[10px] font-black uppercase text-slate-400">
                  No se encontraron resultados
                </div>
              )
            ) : (
              <>
                {filteredOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange(opt.value);
                      setIsOpen(false);
                      setSearchTerm("");
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold uppercase transition-all flex items-center justify-between hover:bg-slate-50 ${
                      value === opt.value ? "bg-blue-50 text-blue-600" : "text-slate-600"
                    }`}
                  >
                    <div>
                      {opt.label}
                      {opt.subtitle && (
                        <span className="block text-[9px] text-slate-400 mt-0.5">{opt.subtitle}</span>
                      )}
                    </div>
                    {value === opt.value && <Check className="w-4 h-4" />}
                  </button>
                ))}
                {allowCreate && searchTerm && !exactMatchExists && (
                   <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange(searchTerm);
                      setIsOpen(false);
                      setSearchTerm("");
                    }}
                    className="w-full text-left px-3 py-2 mt-1 border-t border-slate-100 rounded-xl text-xs font-bold uppercase transition-all flex items-center gap-2 hover:bg-slate-50 text-blue-600"
                  >
                    <Plus className="w-4 h-4" />
                    Agregar "{searchTerm}"
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
