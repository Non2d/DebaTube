import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, ChevronUp } from 'lucide-react';

interface SearchableSelectProps {
    options: string[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    label?: string;
    className?: string;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
    options,
    value,
    onChange,
    placeholder = 'Select...',
    label,
    className = '',
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState(value);
    const [filteredOptions, setFilteredOptions] = useState<string[]>(options);
    const containerRef = useRef<HTMLDivElement>(null);

    // Update internal search term when parent value changes
    useEffect(() => {
        setSearchTerm(value);
    }, [value]);

    // Filter options based on search term
    useEffect(() => {
        if (!searchTerm) {
            setFilteredOptions(options);
        } else {
            const lowerTerm = searchTerm.toLowerCase();
            const filtered = options.filter(opt =>
                opt.toLowerCase().includes(lowerTerm)
            );
            setFilteredOptions(filtered);
        }
    }, [searchTerm, options]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                // On blur, revert search term to current selected value if invalid? 
                // Or just let it be. Let's keep the typed value effectively acting as selecting it.
                // Actually, if we want strict selection we would revert, but for a "Round ID Input"
                // we likely want free text input too, but with suggestions.
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVal = e.target.value;
        setSearchTerm(newVal);
        onChange(newVal); // Propagate text change immediately allowing free text
        setIsOpen(true);
    };

    const handleOptionClick = (option: string) => {
        setSearchTerm(option);
        onChange(option);
        setIsOpen(false);
    };

    const handleInputFocus = () => {
        setIsOpen(true);
    };

    return (
        <div className={`relative group h-full ${className}`} ref={containerRef}>
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                <Search size={18} strokeWidth={2} />
            </div>

            <input
                type="text"
                value={searchTerm}
                onChange={handleInputChange}
                onFocus={handleInputFocus}
                className="h-12 w-full pl-10 pr-10 bg-white dark:bg-slate-800 border-0 ring-1 ring-slate-200/80 dark:ring-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono hover:bg-slate-50/50 dark:hover:bg-slate-700/50"
                placeholder={placeholder}
            />

            {label && (
                <label className="absolute -top-2 left-3 px-1 bg-white dark:bg-slate-800 text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 pointer-events-none">
                    {label}
                </label>
            )}

            {/* Chevron indicator */}
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>

            {/* Dropdown Options */}
            {isOpen && filteredOptions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-lg max-h-60 overflow-auto ring-1 ring-black/5 dark:ring-white/10 py-1">
                    {filteredOptions.map((option, index) => (
                        <div
                            key={index}
                            onClick={() => handleOptionClick(option)}
                            className="px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer transition-colors font-mono"
                        >
                            {option}
                        </div>
                    ))}
                </div>
            )}

            {isOpen && searchTerm && filteredOptions.length === 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-lg px-4 py-3 text-sm text-slate-500 dark:text-slate-400 text-center italic">
                    No matches found
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;
