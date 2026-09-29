import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';

export function SearchableSelect({ 
  options, 
  value, 
  onChange, 
  placeholder = "Select...", 
  className = "" 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setQuery('');
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(o => String(o.value) === String(value));
  
  const filteredOptions = query === '' 
    ? options 
    : options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => {
          setIsOpen(prev => !prev);
          if (isOpen) setQuery('');
        }}
        className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/35"
      >
        <span className={selectedOption ? 'text-slate-900' : 'text-slate-500'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </button>

      {isOpen && (
        <div
          className="absolute z-50 mt-1 max-h-60 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg flex flex-col"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="bg-white px-2 py-2 border-b border-slate-100 shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                autoFocus
                className="w-full rounded-lg bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-brand/20"
                placeholder="Search..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
          
          <div className="overflow-y-auto py-1 flex-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-slate-500">No results found.</div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                    setQuery('');
                  }}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 transition-colors ${String(value) === String(option.value) ? 'bg-slate-50 font-medium text-brand' : 'text-slate-700'}`}
                >
                  <span className="truncate">{option.label}</span>
                  {String(value) === String(option.value) && <Check className="ml-2 h-4 w-4 shrink-0 text-brand" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
