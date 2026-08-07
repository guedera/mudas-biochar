export default function ToggleButton({ value, onChange, labelTrue, labelFalse }) {
  return (
    <button
      type="button"
      className={`toggle-button ${value ? 'is-true' : 'is-false'}`}
      onClick={() => onChange(!value)}
      aria-pressed={value}
    >
      {value ? labelTrue : labelFalse}
    </button>
  )
}
