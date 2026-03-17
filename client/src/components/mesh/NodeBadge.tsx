import type { NodeInfo } from "@lattice/shared";

interface NodeBadgeProps {
  node: NodeInfo;
}

export function NodeBadge(props: NodeBadgeProps) {
  var initials = props.node.name.slice(0, 2).toUpperCase();

  return (
    <span
      title={props.node.name + (props.node.online ? " (online)" : " (offline)")}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "3px",
        padding: "1px 5px",
        borderRadius: "999px",
        background: "var(--bg-overlay)",
        border: "1px solid var(--border-subtle)",
        fontSize: "10px",
        fontWeight: 600,
        color: "var(--text-muted)",
        fontFamily: "var(--font-ui)",
        letterSpacing: "0.03em",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: "5px",
          height: "5px",
          borderRadius: "50%",
          background: props.node.online ? "var(--green)" : "var(--text-muted)",
          flexShrink: 0,
          display: "inline-block",
        }}
      />
      {initials}
    </span>
  );
}
