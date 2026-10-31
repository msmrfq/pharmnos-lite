"use client";

import { INDIAN_REGIONS } from "@/lib/constants/indian-states";
import { Label } from "@/components/ui/label";

type Props = {
  id: string;
  name: string;
  label: string;
  placeholder: string;
  error?: string;
};

export function GstStateSelect({ id, name, label, placeholder, error }: Props) {
  return (
    <div className="space-y-2" data-field-error={!!error}>
      <Label htmlFor={id}>{label}</Label>
      <input
        id={id}
        name={name}
        list={`${id}-options`}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        placeholder={placeholder}
        autoComplete="off"
      />
      <datalist id={`${id}-options`}>
        {INDIAN_REGIONS.map((region) => (
          <option key={region.code} value={region.code}>{region.name}</option>
        ))}
      </datalist>
      {error && <p className="text-caption text-destructive">{error}</p>}
    </div>
  );
}
