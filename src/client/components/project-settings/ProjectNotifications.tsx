import { useState } from "react";

interface ProjectNotificationsProps {
  projectSlug?: string;
}

function loadMuted(slug: string): boolean {
  return localStorage.getItem("lattice-mute-" + slug) === "1";
}

function saveMuted(slug: string, muted: boolean): void {
  localStorage.setItem("lattice-mute-" + slug, muted ? "1" : "0");
}

export function ProjectNotifications({ projectSlug }: ProjectNotificationsProps) {
  const slug = projectSlug ?? "";
  const [muted, setMuted] = useState(function () { return loadMuted(slug); });

  function toggle() {
    const next = !muted;
    setMuted(next);
    saveMuted(slug, next);
  }

  return (
    <div className="py-2 space-y-6">
      <div>
        <h2 className="text-[12px] font-semibold text-base-content/40 mb-3">
          Project Notifications
        </h2>
        <div className="flex items-center justify-between py-2 px-3 bg-base-300 border border-base-content/15 rounded-xl">
          <div>
            <div className="text-[13px] text-base-content">Mute all notifications</div>
            <div className="text-[11px] text-base-content/30 mt-0.5">
              Suppress all browser notifications from this project
            </div>
          </div>
          <input
            type="checkbox"
            className="toggle toggle-sm toggle-primary"
            checked={muted}
            onChange={toggle}
          />
        </div>
      </div>
    </div>
  );
}
