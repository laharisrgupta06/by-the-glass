import { Injectable, signal } from '@angular/core';

const NOTICE_DURATION_MS = 5000;

/** Short, human status messages for actions that fail away from a form. */
@Injectable({ providedIn: 'root' })
export class NoticeService {
  readonly message = signal<string | null>(null);
  private timer?: ReturnType<typeof setTimeout>;

  show(message: string): void {
    clearTimeout(this.timer);
    this.message.set(message);
    this.timer = setTimeout(() => this.message.set(null), NOTICE_DURATION_MS);
  }

  dismiss(): void {
    clearTimeout(this.timer);
    this.message.set(null);
  }
}
