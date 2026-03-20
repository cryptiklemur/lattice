import { ExternalLink } from "lucide-react";
import { ProjectMemory } from "../project-settings/ProjectMemory";

export function GlobalMemory() {
  return (
    <div>
      <a
        href="https://docs.anthropic.com/en/docs/claude-code/memory"
        target="_blank"
        rel="noopener noreferrer"
        className="text-[11px] text-base-content/30 hover:text-primary/70 flex items-center gap-1 mb-4 transition-colors"
      >
        <ExternalLink size={11} />
        Claude Code docs
      </a>
      <ProjectMemory projectSlug="__global__" />
    </div>
  );
}
