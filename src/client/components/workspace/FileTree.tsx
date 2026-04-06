import { ChevronRight, FileIcon } from "lucide-react";
import type { FileEntry } from "#shared";

export interface TreeNode {
  entry: FileEntry;
  children: TreeNode[] | null;
  expanded: boolean;
}

export function buildNodes(entries: FileEntry[]): TreeNode[] {
  return entries.map(function (entry) {
    return { entry, children: null, expanded: false };
  });
}

interface FileTreeItemProps {
  node: TreeNode;
  depth: number;
  selectedPath: string | null;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
}

function FileTreeItem(props: FileTreeItemProps) {
  var { node, depth, selectedPath, onToggle, onSelect } = props;
  var isSelected = selectedPath === node.entry.path;
  var isDir = node.entry.isDirectory;

  function handleActivate() {
    if (isDir) {
      onToggle(node.entry.path);
    } else {
      onSelect(node.entry.path);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleActivate();
    }
  }

  return (
    <div role="treeitem" aria-expanded={isDir ? node.expanded : undefined} aria-selected={isSelected}>
      <div
        tabIndex={0}
        onClick={handleActivate}
        onKeyDown={handleKeyDown}
        className={
          "flex items-center gap-1.5 py-[3px] pr-2 cursor-pointer text-[13px] rounded select-none outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-base-200 " +
          (isSelected ? "bg-base-300 text-primary" : "text-base-content hover:bg-base-200")
        }
        style={{ paddingLeft: (8 + depth * 16) + "px" }}
      >
        {isDir ? (
          <ChevronRight
            size={12}
            className="flex-shrink-0 text-base-content/40 transition-transform duration-[120ms]"
            style={{ transform: node.expanded ? "rotate(90deg)" : "none" }}
          />
        ) : (
          <FileIcon
            size={12}
            className="flex-shrink-0 text-base-content/40"
          />
        )}
        <span
          className={
            "truncate " +
            (isDir ? "text-info" : "text-base-content")
          }
        >
          {node.entry.name}
        </span>
      </div>
      {isDir && node.expanded && node.children && (
        <div role="group">
          {node.children.map(function (child) {
            return (
              <FileTreeItem
                key={child.entry.path}
                node={child}
                depth={depth + 1}
                selectedPath={selectedPath}
                onToggle={onToggle}
                onSelect={onSelect}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

interface FileTreeProps {
  nodes: TreeNode[];
  selectedPath: string | null;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
}

export function FileTree(props: FileTreeProps) {
  var { nodes, selectedPath, onToggle, onSelect } = props;

  return (
    <div role="tree" aria-label="File tree">
      {nodes.length === 0 ? (
        <div className="px-2 py-3 text-[12px] text-base-content/40">
          Loading...
        </div>
      ) : (
        nodes.map(function (node) {
          return (
            <FileTreeItem
              key={node.entry.path}
              node={node}
              depth={0}
              selectedPath={selectedPath}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          );
        })
      )}
    </div>
  );
}
