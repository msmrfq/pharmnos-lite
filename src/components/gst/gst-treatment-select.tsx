"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GST_TREATMENT_LABELS,
  GST_TREATMENT_VALUES,
  type GstTreatmentLabel,
} from "@/lib/gst/treatment";

type Props = {
  name: string;
  defaultValue?: GstTreatmentLabel;
  error?: string;
};

export function GstTreatmentSelect({ name, defaultValue, error }: Props) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [query, setQuery] = useState("");
  const options = GST_TREATMENT_LABELS.filter((label) =>
    label.toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <div className="space-y-2" data-field-error={Boolean(error)}>
      <label htmlFor={`${name}_select`} className="text-body-sm font-medium">
        GST Treatment *
      </label>
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger id={`${name}_select`}>
          <SelectValue placeholder="Select GST treatment" />
        </SelectTrigger>
        <SelectContent>
          <div className="p-1">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => event.stopPropagation()}
              placeholder="Search treatment"
              aria-label="Search GST treatments"
            />
          </div>
          {options.map((label) => (
            <SelectItem
              key={label}
              value={label}
              disabled={label !== GST_TREATMENT_VALUES.REGULAR}
            >
              {label}{label !== GST_TREATMENT_VALUES.REGULAR ? " (not enabled)" : ""}
            </SelectItem>
          ))}
          {options.length === 0 && (
            <div className="px-2 py-3 text-caption text-muted">No treatment found.</div>
          )}
        </SelectContent>
      </Select>
      <input type="hidden" name={name} value={value} />
      <p className="text-caption text-muted">
        Deferred categories remain visible but cannot be finalized until their rules are approved.
      </p>
      {error && <p className="text-caption text-destructive">{error}</p>}
    </div>
  );
}
