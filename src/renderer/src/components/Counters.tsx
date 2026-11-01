import { LEVEL_NAMES, LEVELS, levelMark, type Counter } from "../../../shared/ctdp";

/** `#3 ##1 …` for every level that has ever been reached; `#` always shows. */
export function Counters({ counters }: { counters: Counter[] }) {
  return (
    <span className="counters">
      {LEVELS.filter((l) => l === 1 || counters[l - 1].best > 0).map((l) => (
        <span key={l} className="counter" title={`${LEVEL_NAMES[l]} · best ${levelMark(l)}${counters[l - 1].best}`}>
          {levelMark(l)}
          {counters[l - 1].current}
        </span>
      ))}
    </span>
  );
}
