import { useCallback, useEffect, useRef, useState } from "react";
import { FileCode, FileX } from "lucide-react";
import type { FsListResultMessage, FsReadResultMessage, ServerMessage } from "@lattice/shared";
import { useWebSocket } from "../../hooks/useWebSocket";
import { useSidebar } from "../../hooks/useSidebar";
import { FileTree, buildNodes } from "./FileTree";
import { FileViewer } from "./FileViewer";
import type { TreeNode } from "./FileTree";

export function FileBrowser() {
  var { send, subscribe, unsubscribe } = useWebSocket();
  var { activeProjectSlug } = useSidebar();
  var projectSlugRef = useRef<string | null>(null);
  projectSlugRef.current = activeProjectSlug;
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

  var selectedPathRef = useRef<string | null>(null);
  selectedPathRef.current = selectedPath;

  var handleFsChanged = useCallback(function (msg: ServerMessage) {
    var changedPath = (msg as { path: string }).path;
    if (changedPath === selectedPathRef.current) {
      send({ type: "fs:read", path: changedPath, projectSlug: projectSlugRef.current || undefined });
    }
  }, [send]);

  useEffect(function () {
    subscribe("fs:list_result", handleListResult);
    subscribe("fs:read_result", handleReadResult);
    subscribe("fs:changed", handleFsChanged);

    send({ type: "fs:list", path: ".", projectSlug: projectSlugRef.current || undefined });

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
            send({ type: "fs:list", path: path, projectSlug: projectSlugRef.current || undefined });
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
    send({ type: "fs:read", path: path, projectSlug: activeProjectSlug || undefined });
  }

  function handleOpenInIDE(path: string, line?: number) {
    send({ type: "editor:open", path, line });
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-base-100">
      <div className="w-[220px] flex-shrink-0 border-r border-base-content/15 overflow-y-auto p-2">
        <div className="text-[11px] font-semibold tracking-[0.06em] uppercase text-base-content/40 px-2 pb-2 pt-1">
          Files
        </div>
        <FileTree
          nodes={rootNodes}
          selectedPath={selectedPath}
          onToggle={handleToggle}
          onSelect={handleSelect}
        />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {!selectedPath && (
          <div className="h-full flex flex-col items-center justify-center gap-3">
            <FileCode size={28} className="text-base-content/15" />
            <div className="text-base-content/40 text-[13px]">Select a file from the tree to view its contents</div>
          </div>
        )}

        {selectedPath && loadingContent && (
          <div className="h-full flex items-center justify-center text-base-content/40 text-[13px]">
            Loading...
          </div>
        )}

        {selectedPath && !loadingContent && fileContent !== null && (
          <FileViewer
            path={selectedPath}
            content={fileContent}
            onOpenInIDE={handleOpenInIDE}
          />
        )}

        {selectedPath && !loadingContent && fileContent === null && (
          <div className="h-full flex flex-col items-center justify-center gap-3">
            <FileX size={28} className="text-base-content/15" />
            <div className="text-base-content/40 text-[13px]">Cannot display this file</div>
            <div className="text-base-content/30 text-[11px]">Binary files and files over 512KB are not shown</div>
          </div>
        )}
      </div>
    </div>
  );
}
