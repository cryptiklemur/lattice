import { useRef, useEffect } from "react";
import { Search, X } from "lucide-react";

interface SearchFilterProps {
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  placeholder?: string;
}

export function SearchFilter(props: SearchFilterProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(function () {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      props.onClose();
    }
  }

  return (
    <div className="px-2 pb-1.5 flex-shrink-0">
      <div className="flex items-center gap-1.5 bg-base-300 border border-base-content/15 rounded-md px-2 h-7 focus-within:border-primary transition-colors duration-[120ms]">
        <Search size={12} className="text-base-content/30 flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={props.value}
          onChange={function (e) { props.onChange(e.target.value); }}
          onKeyDown={handleKeyDown}
          placeholder={props.placeholder || "Search..."}
          className="flex-1 bg-transparent text-base-content text-[13px] outline-none min-w-0"
          spellCheck={false}
        />
        {props.value.length > 0 && (
          <button
            onClick={function () { props.onChange(""); }}
            aria-label="Clear search"
            className="text-base-content/30 hover:text-base-content flex-shrink-0"
          >
            <X size={11} />
          </button>
        )}
      </div>
    </div>
  );
}
