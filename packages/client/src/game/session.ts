import type { WorldSession } from "../contracts/game-ui.js";
import { sameIdentity } from "./world-save.js";

export function sameSession(a: WorldSession | null, b: WorldSession): boolean {
  return a !== null && a.id === b.id && sameIdentity(a.identity, b.identity);
}

/** Only the newest request in the current world may cross an asynchronous commit. */
export class NavigationGate {
  private serial = 0;
  private active: Readonly<{ sessionId: number; serial: number }> | null = null;
  begin(sessionId: number): Readonly<{ sessionId: number; serial: number }> {
    this.active = Object.freeze({ sessionId, serial: ++this.serial });
    return this.active;
  }
  current(
    ticket: Readonly<{ sessionId: number; serial: number }>,
    sessionId: number,
  ): boolean {
    return this.active === ticket && ticket.sessionId === sessionId;
  }
  cancel(sessionId?: number): void {
    if (sessionId === undefined || this.active?.sessionId === sessionId)
      this.active = null;
  }
  finish(ticket: Readonly<{ sessionId: number; serial: number }>): void {
    if (this.active === ticket) this.active = null;
  }
  get pending(): boolean {
    return this.active !== null;
  }
}
