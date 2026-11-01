import { Notification } from "electron";
import { formatClock, MINUTE, type CtdpState, type DomainEvent } from "../shared/ctdp";
import { iconPath } from "./paths";

const WARN_BEFORE = 2 * MINUTE;

export class Notifier {
  private warnedFor: number | null = null;

  onEvent(event: DomainEvent): void {
    switch (event.type) {
      case "reserved":
        return this.show("已预约", `请在 ${formatClock(event.deadline)} 前落座。`);
      case "reserveKept":
        return this.show("预约守约", `预约链 #${event.chain}`);
      case "reserveBroken":
        return this.show("预约链断开", `${event.reason}，预约链 #${event.chainLength} 清零。失败即数据。`);
      case "sessionCompleted":
        return this.show("本节完成", `主链 #${event.chain}，休息一下。`);
      case "mainBroken":
        return this.show("主链断开", `${event.reason}，主链 #${event.chainLength} 清零。失败即数据。`);
    }
  }

  /** Warns once per reservation shortly before its deadline. */
  onTick(state: CtdpState, now: number): void {
    const { phase } = state;
    if (phase.kind !== "reserved" || this.warnedFor === phase.reservedAt) return;
    if (phase.deadline - now <= WARN_BEFORE) {
      this.warnedFor = phase.reservedAt;
      this.show("快到时间了", `预约将在 ${formatClock(phase.deadline)} 到期，现在落座。`);
    }
  }

  private show(title: string, body: string): void {
    if (Notification.isSupported()) new Notification({ title, body, icon: iconPath() }).show();
  }
}
