import { useId } from "react";
import type { FitPowerTargetUnit } from "../services/workoutApi";

type Props = {
  value: FitPowerTargetUnit;
  onChange: (value: FitPowerTargetUnit) => void;
  disabled?: boolean;
};

export function FitPowerTargetUnitsField({ value, onChange, disabled }: Props) {
  const id = useId();
  return (
    <div className="fit-target-units-field">
      <label htmlFor={id}>FIT power target units</label>
      <select id={id} value={value} disabled={disabled} aria-describedby={`${id}-hint`}
        onChange={(event) => onChange(event.target.value as FitPowerTargetUnit)}>
        <option value="auto">Auto (FIT encoding)</option>
        <option value="watts">Watts</option>
        <option value="percent_ftp">% FTP</option>
      </select>
      <p id={`${id}-hint`}>Auto follows FIT encoding. Choose Watts or % FTP when the file stores raw target values in those units.</p>
    </div>
  );
}
