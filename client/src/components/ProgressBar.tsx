interface ProgressBarProps {
  percent: number;
  label?: string;
  indeterminate?: boolean;
}

export function ProgressBar({ percent, label, indeterminate = false }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, percent));

  return (
    <div className="progress-bar">
      <div className="progress-bar-track">
        <div
          className={`progress-bar-fill${indeterminate ? " indeterminate" : ""}`}
          style={indeterminate ? undefined : { width: `${clamped}%` }}
        />
      </div>
      {label && <div className="progress-bar-label">{label}</div>}
    </div>
  );
}
