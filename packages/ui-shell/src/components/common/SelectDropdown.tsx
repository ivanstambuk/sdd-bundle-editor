import styles from './SelectDropdown.module.css';

interface Option {
  value: string;
  label: string;
}

interface SelectDropdownProps {
  id: string;
  label?: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function SelectDropdown({
  id,
  label,
  options,
  value,
  onChange,
  className = '',
}: SelectDropdownProps) {
  return (
    <div className={`${styles.wrapper} ${className}`}>
      {label && (
        <label className={styles.label} htmlFor={id}>
          {label}
        </label>
      )}
      <select
        id={id}
        className={styles.select}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
