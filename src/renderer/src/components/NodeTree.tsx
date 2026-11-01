import { levelMark, type ChunkSnapshot, type RunNode, type Seat } from "../../../shared/ctdp";

function Planned({ spec }: { spec: ChunkSnapshot }) {
  return (
    <li className="node pending">
      <span className="node-label">{levelMark(spec.level)}? {spec.name}</span>
      {spec.children.length > 0 && (
        <ul>
          {spec.children.map((c, i) => (
            <Planned key={i} spec={c} />
          ))}
        </ul>
      )}
    </li>
  );
}

function Node({ node, seat }: { node: RunNode; seat: Seat | null }) {
  const seated = seat?.parentId === node.id ? seat.node : null;
  const started = node.children.length + (seated ? 1 : 0);
  return (
    <li className={`node ${node.status}`}>
      <span className="node-label">
        {levelMark(node.spec.level)}
        {node.number} {node.spec.name}
        {node.task && node.task !== node.spec.name && <span className="node-task"> · {node.task}</span>}
      </span>
      {node.spec.children.length > 0 && (
        <ul>
          {node.children.map((c) => (
            <Node key={c.id} node={c} seat={seat} />
          ))}
          {seated && <Node node={seated} seat={null} />}
          {node.spec.children.slice(started).map((c, i) => (
            <Planned key={i} spec={c} />
          ))}
        </ul>
      )}
    </li>
  );
}

/** A main-track run: solid nodes are kept, dashed ones are virtual, faded ones are still to come. */
export function NodeTree({ root, seat }: { root: RunNode; seat: Seat | null }) {
  return (
    <ul className="node-tree">
      <Node node={root} seat={seat} />
    </ul>
  );
}
