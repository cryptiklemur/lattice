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
        className={
          "flex items-center gap-1.5 py-[3px] pr-2 cursor-pointer text-[13px] rounded select-none " +
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
    <div className="flex h-full w-full overflow-hidden bg-base-100">
      <div className="w-[220px] flex-shrink-0 border-r border-base-300 overflow-y-auto p-2">
        <div className="text-[11px] font-semibold tracking-[0.06em] uppercase text-base-content/40 px-2 pb-2 pt-1">
          Files
        </div>
        {rootNodes.length === 0 ? (
          <div className="px-2 py-3 text-[12px] text-base-content/40">
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

      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedPath && (
          <div className="h-9 flex-shrink-0 flex items-center px-4 border-b border-base-300 bg-base-200 text-[12px] text-base-content/60 font-mono overflow-hidden">
            <span className="truncate">{selectedPath}</span>
          </div>
        )}

        <div className="flex-1 overflow-auto">
          {!selectedPath && (
            <div className="h-full flex items-center justify-center text-base-content/40 text-[13px]">
              Select a file to view its contents
            </div>
          )}

          {selectedPath && loadingContent && (
            <div className="h-full flex items-center justify-center text-base-content/40 text-[13px]">
              Loading...
            </div>
          )}

          {selectedPath && !loadingContent && fileContent !== null && (
            <pre className="m-0 p-4 text-[13px] font-mono text-base-content leading-relaxed whitespace-pre-wrap break-words">
              {fileContent}
            </pre>
          )}

          {selectedPath && !loadingContent && fileContent === null && (
            <div className="h-full flex items-center justify-center text-base-content/40 text-[13px]">
              Cannot display this file (binary or too large)
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
