interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
  tone?: 'brand' | 'coral';
}

/** iOS-style switch in the tractor theme. */
export function Toggle({ checked, onChange, disabled, label, tone = 'brand' }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-[30px] w-[50px] shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-40 ${
        checked ? (tone === 'coral' ? 'bg-coral-500' : 'bg-brand') : 'bg-line/[0.14]'
      }`}
    >
      <span
        className={`inline-block h-[24px] w-[24px] rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.25)] transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          checked ? 'translate-x-[23px]' : 'translate-x-[3px]'
        }`}
      />
    </button>
  );
}
