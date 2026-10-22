import manualLeadTimeFile from "./manual-lead-time.estimate.json" with { type: "json" };

export type ManualLeadStep = {
  id: string;
  label: string;
  minutes: number;
  estimate: true;
  placeholder: true;
  value_status: "PLACEHOLDER";
};

export type ManualLeadEstimate = {
  label: "estimate";
  status: "placeholder";
  note: string;
  unit: "minutes";
  steps: ManualLeadStep[];
  total_minutes: number;
};

/** Manual lead times. Every value is a labelled placeholder estimate. */
export function manualLeadEstimate(): ManualLeadEstimate {
  const raw = manualLeadTimeFile;
  if (raw.label !== "estimate" || raw.status !== "placeholder" || raw.unit !== "minutes") {
    throw new Error("Manual lead times must be marked estimate, placeholder, and minutes.");
  }
  if (!/PLACEHOLDER/i.test(raw.note)) {
    throw new Error("Manual lead times must say PLACEHOLDER in the note.");
  }
  const steps: ManualLeadStep[] = raw.steps.map((step) => {
    if (step.estimate !== true || step.placeholder !== true || step.value_status !== "PLACEHOLDER") {
      throw new Error(`Manual step ${step.id} is not marked as a placeholder estimate.`);
    }
    if (!Number.isFinite(step.minutes) || step.minutes < 0) {
      throw new Error(`Manual step ${step.id} needs a placeholder minute value.`);
    }
    return {
      id: step.id,
      label: step.label,
      minutes: step.minutes,
      estimate: true,
      placeholder: true,
      value_status: "PLACEHOLDER",
    };
  });
  if (steps.length !== 5) throw new Error("Manual lead times need the five lead steps.");
  return {
    label: "estimate",
    status: "placeholder",
    note: raw.note,
    unit: "minutes",
    steps,
    total_minutes: steps.reduce((total, step) => total + step.minutes, 0),
  };
}
