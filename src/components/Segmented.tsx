interface Option<T extends string> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  variant?: 'pill' | 'tab';
}

/** A row of toggle buttons where exactly one is pressed. */
export function Segmented<T extends string>({ label, options, value, onChange, variant = 'tab' }: SegmentedProps<T>) {
  return (
    <div role="group" aria-label={label} className={`segmented segmented--${variant}`}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
