import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

type ExerciseOption = {
  code: string;
  name: string;
};

type ExerciseSearchSelectProps = {
  options: ExerciseOption[];
  value: string;
  onChange: (value: string) => void;
};

function getExerciseLabel(option: ExerciseOption | undefined, value: string) {
  return option?.name || value || "Select exercise";
}

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase();
}

export function ExerciseSearchSelect({
  options,
  value,
  onChange,
}: ExerciseSearchSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const selectedOption = options.find((option) => option.code === value);
  const searchQuery = normalizeSearchValue(searchValue);
  const filteredOptions = useMemo(() => {
    if (!searchQuery) {
      return options;
    }

    return options.filter((option) => {
      const optionText = `${option.name} ${option.code}`.toLowerCase();

      return optionText.includes(searchQuery);
    });
  }, [options, searchQuery]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    searchInputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        rootRef.current &&
        event.target instanceof Node &&
        !rootRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function handleToggle() {
    setIsOpen((current) => {
      const nextIsOpen = !current;

      if (nextIsOpen) {
        setSearchValue("");
      }

      return nextIsOpen;
    });
  }

  function handleSelect(nextValue: string) {
    onChange(nextValue);
    setIsOpen(false);
    setSearchValue("");
  }

  return (
    <div className="exercise-search-select" ref={rootRef}>
      <button
        type="button"
        className="exercise-search-trigger"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={handleToggle}
      >
        <span>{getExerciseLabel(selectedOption, value)}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="exercise-search-menu">
          <label className="exercise-search-input">
            <Search size={15} aria-hidden="true" />
            <input
              ref={searchInputRef}
              type="search"
              value={searchValue}
              placeholder="Search exercises"
              onChange={(event) => setSearchValue(event.target.value)}
            />
          </label>

          <div className="exercise-search-list" role="listbox">
            {filteredOptions.map((option) => (
              <button
                type="button"
                key={option.code}
                className="exercise-search-option"
                role="option"
                aria-selected={option.code === value}
                onClick={() => handleSelect(option.code)}
              >
                <span>{option.name}</span>
                <small>{option.code}</small>
                {option.code === value && <Check size={15} aria-hidden="true" />}
              </button>
            ))}

            {!filteredOptions.length && (
              <div className="exercise-search-empty">No exercises found.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
