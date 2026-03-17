import type { NodeInfo } from "@lattice/shared";

interface NodeBadgeProps {
  node: NodeInfo;
}

export function NodeBadge(props: NodeBadgeProps) {
  var initials = props.node.name.slice(0, 2).toUpperCase();

  return (
    <span
      title={props.node.name + (props.node.online ? " (online)" : " (offline)")}
      className="inline-flex items-center gap-[3px] px-[5px] py-[1px] rounded-full bg-base-300 border border-base-content/15 text-[10px] font-semibold text-base-content/40 tracking-[0.03em] flex-shrink-0"
    >
      <span
        className={
          "w-[5px] h-[5px] rounded-full flex-shrink-0 inline-block " +
          (props.node.online ? "bg-success" : "bg-base-content/30")
        }
      />
      {initials}
    </span>
  );
}
