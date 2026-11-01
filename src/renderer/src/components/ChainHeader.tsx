import type { CtdpState } from "../../../shared/ctdp";

function Chain({ label, value, best, hint }: { label: string; value: number; best: number; hint: string }) {
  return (
    <div className="chain" title={hint}>
      <div className="chain-label">{label}</div>
      <div className="chain-value">#{value}</div>
      <div className="chain-best">最长 #{best}</div>
    </div>
  );
}

export function ChainHeader({ state }: { state: CtdpState }) {
  return (
    <header className="chains">
      <Chain label="主链" value={state.mainChain} best={state.bestMain} hint="每完成一节专注 +1，违规或放弃清零" />
      <Chain
        label="预约链"
        value={state.reserveChain}
        best={state.bestReserve}
        hint="每次在时限内落座 +1，超时或取消清零"
      />
    </header>
  );
}
