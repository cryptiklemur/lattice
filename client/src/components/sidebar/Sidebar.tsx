import { type ReactNode } from "react";

function SidebarSection({ children, flex }: { children: ReactNode; flex?: number }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: flex ?? "none",
        overflow: "hidden",
        minHeight: 0,
      }}
    >
      {children}
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div
      style={{
        padding: "8px 12px 4px",
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--text-muted)",
        fontFamily: "var(--font-ui)",
      }}
    >
      {label}
    </div>
  );
}

function PlaceholderItem({ label }: { label: string }) {
  return (
    <div
      style={{
        padding: "6px 12px",
        fontSize: "13px",
        color: "var(--text-muted)",
        borderRadius: "var(--radius-sm)",
        margin: "1px 6px",
      }}
    >
      {label}
    </div>
  );
}

export function Sidebar() {
  return (
    <div
      className="sidebar-inner"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        overflow: "hidden",
        background: "var(--bg-secondary)",
        borderRight: "1px solid var(--border-subtle)",
      }}
    >
      <SidebarSection>
        <div
          style={{
            height: "48px",
            display: "flex",
            alignItems: "center",
            padding: "0 12px",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <span
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--text-secondary)",
              letterSpacing: "0.04em",
              fontFamily: "var(--font-ui)",
            }}
          >
            Node Rail
          </span>
        </div>
      </SidebarSection>

      <SidebarSection flex={1}>
        <SectionLabel label="Projects" />
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "2px 0",
          }}
        >
          <PlaceholderItem label="No projects yet" />
        </div>
      </SidebarSection>

      <div
        style={{
          height: "1px",
          background: "var(--border-subtle)",
          margin: "4px 0",
        }}
      />

      <SidebarSection flex={1}>
        <SectionLabel label="Sessions" />
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "2px 0",
          }}
        >
          <PlaceholderItem label="Select a project" />
        </div>
      </SidebarSection>

      <div
        style={{
          height: "1px",
          background: "var(--border-subtle)",
        }}
      />

      <SidebarSection>
        <div
          style={{
            padding: "10px 12px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              background: "var(--accent-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
              fontWeight: 700,
              color: "#fff",
              flexShrink: 0,
            }}
          >
            L
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "var(--text-primary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              localhost
            </div>
            <div
              style={{
                fontSize: "11px",
                color: "var(--text-muted)",
              }}
            >
              Lattice Node
            </div>
          </div>
          <button
            aria-label="Settings"
            style={{
              width: "24px",
              height: "24px",
              borderRadius: "var(--radius-sm)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-muted)",
              flexShrink: 0,
              transition: "color var(--transition-fast), background var(--transition-fast)",
            }}
            onMouseEnter={function (e) {
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
              (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-overlay)";
            }}
            onMouseLeave={function (e) {
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M8 10a2 2 0 100-4 2 2 0 000 4z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M13.3 7a5.3 5.3 0 00-.1-1l1.1-.9a.3.3 0 000-.4l-1-1.7a.3.3 0 00-.4-.1l-1.3.5a5 5 0 00-.9-.5L10.5 1.7a.3.3 0 00-.3-.2H8.2a.3.3 0 00-.3.2L7.6 3a5 5 0 00-.9.5L5.4 3a.3.3 0 00-.4.1L4 4.8a.3.3 0 000 .4L5 6.1A5.3 5.3 0 005 7v.5l-1.1.8a.3.3 0 000 .4l1 1.7a.3.3 0 00.4.1l1.3-.5a5 5 0 00.9.5L7.8 12a.3.3 0 00.3.2h2a.3.3 0 00.3-.2l.3-1.5a5 5 0 00.9-.5l1.3.5a.3.3 0 00.4-.1l1-1.7a.3.3 0 000-.4L13.4 7.5A5.3 5.3 0 0013.3 7z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </SidebarSection>
    </div>
  );
}
