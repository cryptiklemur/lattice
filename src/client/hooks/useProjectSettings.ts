import { useState, useEffect } from "react";
import { useWebSocket } from "./useWebSocket";
import type { ServerMessage, ProjectSettings, ProjectSettingsDataMessage, ProjectSettingsErrorMessage } from "#shared";

export function useProjectSettings(projectSlug: string | null) {
  const { status, send, subscribe, unsubscribe } = useWebSocket();
  const [settings, setSettings] = useState<ProjectSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(function () {
    if (!projectSlug) return;

    function handleData(msg: ServerMessage) {
      if (msg.type !== "project-settings:data") return;
      const data = msg as ProjectSettingsDataMessage;
      if (data.projectSlug !== projectSlug) return;
      setSettings(data.settings);
      setLoading(false);
      setError(null);
    }

    function handleError(msg: ServerMessage) {
      if (msg.type !== "project-settings:error") return;
      const data = msg as ProjectSettingsErrorMessage;
      if (data.projectSlug !== projectSlug) return;
      setError(data.message);
      setLoading(false);
    }

    subscribe("project-settings:data", handleData);
    subscribe("project-settings:error", handleError);

    if (status === "connected") {
      setLoading(true);
      send({ type: "project-settings:get", projectSlug: projectSlug });
    }

    return function () {
      unsubscribe("project-settings:data", handleData);
      unsubscribe("project-settings:error", handleError);
    };
  }, [projectSlug, status]);

  function updateSection(section: string, data: Record<string, unknown>) {
    if (!projectSlug) return;
    send({
      type: "project-settings:update",
      projectSlug: projectSlug,
      section: section,
      settings: data,
    });
  }

  return { settings, loading, error, updateSection };
}
