export type SpecStatus = "draft" | "in-progress" | "completed" | "on-hold";
export type SpecPriority = "high" | "medium" | "low";
export type SpecEffort = "small" | "medium" | "large" | "xl";

export interface SpecSection {
  summary: string;
  currentState: string;
  requirements: string;
  implementationPlan: string;
  migrationMap: string;
  testing: string;
}

export interface SpecLinkedSession {
  sessionId: string;
  linkedAt: number;
  note?: string;
  sessionType?: string;
}

export type SpecActivityType = "created" | "status-change" | "session-linked" | "edited" | "ai-note";

export interface SpecActivity {
  timestamp: number;
  type: SpecActivityType;
  detail: string;
  sessionId?: string;
}

export interface Spec {
  id: string;
  projectSlug: string;
  title: string;
  tagline: string;
  status: SpecStatus;
  priority: SpecPriority;
  estimatedEffort: SpecEffort;
  author: string;
  tags: string[];
  requires: string[];
  blockedBy: string[];
  sections: SpecSection;
  linkedSessions: SpecLinkedSession[];
  activity: SpecActivity[];
  createdAt: number;
  updatedAt: number;
  resolvedAt: number | null;
}
