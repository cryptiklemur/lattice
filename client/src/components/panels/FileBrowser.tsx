import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, FileIcon } from "lucide-react";
import type { FileEntry, FsListResultMessage, FsReadResultMessage } from "@lattice/shared";
import { useWebSocket } from "../../hooks/useWebSocket";
import type { ServerMessage } from "@lattice/shared";

interface TreeNode {
  entry: FileEntry;
  children: TreeNode[] | null;
  expanded: boolean;
}

function buildNodes(entries: FileEntry[]): TreeNode[] {
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

  return (
    <div>
      <div
        onClick={function () {
          if (isDir) {
            onToggle(node.entry.path);
          } else {
            onSelect(node.entry.path);
          }
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "3px 8px 3px " + (8 + depth * 16) + "px",
          cursor: "pointer",
          fontSize: "13px",
          color: isSelected ? "var(--text-accent)" : "var(--text-primary)",
          background: isSelected ? "var(--bg-overlay)" : "transparent",
          borderRadius: "var(--radius-sm)",
          userSelect: "none",
        }}
        onMouseEnter={function (e) {
          if (!isSelected) {
            (e.currentTarget as HTMLDivElement).style.background = "var(--bg-tertiary)";
          }
        }}
        onMouseLeave={function (e) {
          if (!isSelected) {
            (e.currentTarget as HTMLDivElement).style.background = "transparent";
          }
        }}
      >
        {isDir ? (
          <ChevronRight
            size={12}
            style={{
              flexShrink: 0,
              transform: node.expanded ? "rotate(90deg)" : "none",
              transition: "transform var(--transition-fast)",
              color: "var(--text-muted)",
            }}
          />
        ) : (
          <FileIcon
            size={12}
            style={{ flexShrink: 0, color: "var(--text-muted)" }}
          />
        )}
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            color: isDir ? "var(--blue)" : "var(--text-primary)",
          }}
        >
          {node.entry.name}
        </span>
      </div>
      {isDir && node.expanded && node.children && (
        <div>
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

export function FileBrowser() {
  var { send, subscribe, unsubscribe } = useWebSocket();
  var [rootNodes, setRootNodes] = useState<TreeNode[]>([]);
  var [selectedPath, setSelectedPath] = useState<string | null>(null);
  var [fileContent, setFileContent] = useState<string | null>(null);
  var [loadingContent, setLoadingContent] = useState(false);
  var nodesRef = useRef<TreeNode[]>([]);

  nodesRef.current = rootNodes;

  var handleListResult = useCallback(function (msg: ServerMessage) {
    var listMsg = msg as FsListResultMessage;
    var newNodes = buildNodes(listMsg.entries);

    if (listMsg.path === "" || listMsg.path === ".") {
      setRootNodes(newNodes);
      return;
    }

    function updateNodes(nodes: TreeNode[]): TreeNode[] {
      return nodes.map(function (node) {
        if (node.entry.path === listMsg.path) {
          return Object.assign({}, node, { children: newNodes, expanded: true });
        }
        if (node.children) {
          return Object.assign({}, node, { children: updateNodes(node.children) });
        }
        return node;
      });
    }

    setRootNodes(function (prev) {
      return updateNodes(prev);
    });
  }, []);

  var handleReadResult = useCallback(function (msg: ServerMessage) {
    var readMsg = msg as FsReadResultMessage;
    setFileContent(readMsg.content);
    setLoadingContent(false);
  }, []);

  var handleFsChanged = useCallback(function (msg: ServerMessage) {
    var changedPath = (msg as { path: string }).path;
    if (changedPath === selectedPath) {
      send({ type: "fs:read", path: changedPath });
    }
  }, [selectedPath, send]);

  useEffect(function () {
    subscribe("fs:list_result", handleListResult);
    subscribe("fs:read_result", handleReadResult);
    subscribe("fs:changed", handleFsChanged);

    send({ type: "fs:list", path: "." });

    return function () {
      unsubscribe("fs:list_result", handleListResult);
      unsubscribe("fs:read_result", handleReadResult);
      unsubscribe("fs:changed", handleFsChanged);
    };
  }, [handleListResult, handleReadResult, handleFsChanged, send, subscribe, unsubscribe]);

  function handleToggle(path: string) {
    function findAndToggle(nodes: TreeNode[]): TreeNode[] {
      return nodes.map(function (node) {
        if (node.entry.path === path) {
          if (!node.expanded && !node.children) {
            send({ type: "fs:list", path });
            return Object.assign({}, node, { expanded: true });
          }
          return Object.assign({}, node, { expanded: !node.expanded });
        }
        if (node.children) {
          return Object.assign({}, node, { children: findAndToggle(node.children) });
        }
        return node;
      });
    }
    setRootNodes(function (prev) {
      return findAndToggle(prev);
    });
  }

  function handleSelect(path: string) {
    setSelectedPath(path);
    setFileContent(null);
    setLoadingContent(true);
    send({ type: "fs:read", path });
  }

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        width: "100%",
        overflow: "hidden",
        background: "var(--bg-primary)",
      }}
    >
      <div
        style={{
          width: "220px",
          flexShrink: 0,
          borderRight: "1px solid var(--border-subtle)",
          overflowY: "auto",
          padding: "8px 4px",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            padding: "4px 8px 8px",
          }}
        >
          Files
        </div>
        {rootNodes.length === 0 ? (
          <div
            style={{
              padding: "12px 8px",
              fontSize: "12px",
              color: "var(--text-muted)",
            }}
          >
            Loading...
          </div>
        ) : (
          rootNodes.map(function (node) {
            return (
              <FileTreeItem
                key={node.entry.path}
                node={node}
                depth={0}
                selectedPath={selectedPath}
                onToggle={handleToggle}
                onSelect={handleSelect}
              />
            );
          })
        )}
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {selectedPath && (
          <div
            style={{
              height: "36px",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              padding: "0 16px",
              borderBottom: "1px solid var(--border-subtle)",
              background: "var(--bg-secondary)",
              fontSize: "12px",
              color: "var(--text-secondary)",
              fontFamily: "var(--font-mono)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {selectedPath}
          </div>
        )}

        <div
          style={{
            flex: 1,
            overflow: "auto",
          }}
        >
          {!selectedPath && (
            <div
              style={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-muted)",
                fontSize: "13px",
              }}
            >
              Select a file to view its contents
            </div>
          )}

          {selectedPath && loadingContent && (
            <div
              style={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-muted)",
                fontSize: "13px",
              }}
            >
              Loading...
            </div>
          )}

          {selectedPath && !loadingContent && fileContent !== null && (
            <pre
              style={{
                margin: 0,
                padding: "16px",
                fontSize: "13px",
                fontFamily: "var(--font-mono)",
                color: "var(--text-primary)",
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {fileContent}
            </pre>
          )}

          {selectedPath && !loadingContent && fileContent === null && (
            <div
              style={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-muted)",
                fontSize: "13px",
              }}
            >
              Cannot display this file (binary or too large)
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
