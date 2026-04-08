import type { SpecStatus, SpecPriority, SpecEffort } from "#shared";

export const STATUS_DOT: Record<SpecStatus, string> = {
  "draft": "bg-info",
  "in-progress": "bg-warning",
  "on-hold": "bg-base-content/40",
  "completed": "bg-success",
};

export const PRIORITY_COLOR: Record<SpecPriority, string> = {
  "high": "text-error",
  "medium": "text-warning",
  "low": "text-base-content/40",
};

export const STATUS_LABELS: Record<SpecStatus, string> = {
  "draft": "Draft",
  "in-progress": "In Progress",
  "on-hold": "On Hold",
  "completed": "Completed",
};

export const PRIORITY_LABELS: Record<SpecPriority, string> = {
  "high": "High",
  "medium": "Medium",
  "low": "Low",
};

export const EFFORT_LABELS: Record<SpecEffort, string> = {
  "small": "Small",
  "medium": "Medium",
  "large": "Large",
  "xl": "XL",
};
