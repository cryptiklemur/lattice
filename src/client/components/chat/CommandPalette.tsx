import { useMemo } from "react";
import type { SkillInfo } from "#shared";
import { builtinCommands, type SlashCommand } from "../../commands";

interface PaletteItem {
  name: string;
  description: string;
  args?: string;
  category: "command" | "skill";
  handler: "client" | "passthrough";
}

interface CommandPaletteProps {
  query: string;
  skills: SkillInfo[];
  selectedIndex: number;
  onSelect: (item: PaletteItem) => void;
  onHover: (index: number) => void;
}

function matchesQuery(q: string, cmd: SlashCommand): boolean {
  if (cmd.name.toLowerCase().includes(q)) return true;
  if (cmd.description.toLowerCase().includes(q)) return true;
  if (cmd.aliases) {
    for (let i = 0; i < cmd.aliases.length; i++) {
      if (cmd.aliases[i].toLowerCase().includes(q)) return true;
    }
  }
  return false;
}

export function getFilteredItems(query: string, skills: SkillInfo[]): PaletteItem[] {
  const q = query.toLowerCase();
  const commands: PaletteItem[] = [];
  const skillItems: PaletteItem[] = [];

  for (let i = 0; i < builtinCommands.length; i++) {
    const cmd = builtinCommands[i];
    if (matchesQuery(q, cmd)) {
      commands.push({
        name: cmd.name,
        description: cmd.description,
        args: cmd.args,
        category: "command",
        handler: cmd.handler,
      });
    }
  }

  for (let j = 0; j < skills.length; j++) {
    const skill = skills[j];
    if (skill.name.toLowerCase().includes(q) || skill.description.toLowerCase().includes(q)) {
      skillItems.push({
        name: skill.name,
        description: skill.description,
        category: "skill",
        handler: "passthrough",
      });
    }
  }

  return commands.concat(skillItems);
}

export function getItemCount(query: string, skills: SkillInfo[]): number {
  return getFilteredItems(query, skills).length;
}

export function CommandPalette(props: CommandPaletteProps) {
  const items = useMemo(function () {
    return getFilteredItems(props.query, props.skills);
  }, [props.query, props.skills]);

  if (items.length === 0) {
    return (
      <div
        role="listbox"
        aria-label="Slash commands"
        className="absolute left-0 right-0 bottom-[calc(100%+6px)] rounded-lg border border-base-content/15 bg-base-300 shadow-lg z-50"
      >
        <div className="px-3.5 py-3 text-[12px] text-base-content/40 text-center font-mono">
          No matching commands
        </div>
      </div>
    );
  }

  const commandItems: PaletteItem[] = [];
  const skillItems: PaletteItem[] = [];
  for (let i = 0; i < items.length; i++) {
    if (items[i].category === "command") {
      commandItems.push(items[i]);
    } else {
      skillItems.push(items[i]);
    }
  }

  let globalIndex = 0;

  function renderItem(item: PaletteItem, idx: number) {
    const currentIndex = idx;
    return (
      <button
        key={item.name}
        data-active={currentIndex === props.selectedIndex}
        onMouseDown={function (e) {
          e.preventDefault();
          props.onSelect(item);
        }}
        onMouseEnter={function () { props.onHover(currentIndex); }}
        className={
          "flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors " +
          (currentIndex === props.selectedIndex ? "bg-primary/10" : "hover:bg-base-content/5")
        }
      >
        <span className="font-mono text-[12px] text-primary/90 whitespace-nowrap flex-shrink-0">
          /{item.name}
          {item.args ? <span className="text-base-content/25 ml-1">{item.args}</span> : null}
        </span>
        <span className="text-[11px] text-base-content/40 truncate min-w-0">
          {item.description}
        </span>
      </button>
    );
  }

  const elements: React.ReactNode[] = [];

  if (commandItems.length > 0) {
    elements.push(
      <div key="commands-header" className="px-3.5 py-1.5 text-[10px] uppercase tracking-widest text-base-content/30 font-mono font-bold">
        Commands
      </div>
    );
    for (let ci = 0; ci < commandItems.length; ci++) {
      elements.push(renderItem(commandItems[ci], globalIndex));
      globalIndex++;
    }
  }

  if (skillItems.length > 0) {
    elements.push(
      <div key="skills-header" className="px-3.5 py-1.5 text-[10px] uppercase tracking-widest text-base-content/30 font-mono font-bold">
        Skills
      </div>
    );
    for (let si = 0; si < skillItems.length; si++) {
      elements.push(renderItem(skillItems[si], globalIndex));
      globalIndex++;
    }
  }

  return (
    <div
      role="listbox"
      aria-label="Slash commands"
      className="absolute left-0 right-0 bottom-[calc(100%+6px)] max-h-[320px] overflow-y-auto rounded-lg border border-base-content/15 bg-base-300 shadow-lg z-50"
    >
      {elements}
    </div>
  );
}
