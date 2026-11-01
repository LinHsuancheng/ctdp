import type { Chain } from "../../../shared/ctdp";

export function ChainPicker(props: { chains: Chain[]; primaryId: string | null; selectedId: string; onSelect: (id: string) => void }) {
  if (props.chains.length < 2) return null;
  return (
    <div className="chips" role="tablist">
      {props.chains.map((c) => (
        <button key={c.id} className={c.id === props.selectedId ? "chip active" : "chip"} onClick={() => props.onSelect(c.id)}>
          {c.name}
          {c.id === props.primaryId && " ★"}
        </button>
      ))}
    </div>
  );
}
