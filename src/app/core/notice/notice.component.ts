import { Component, inject } from '@angular/core';

import { NoticeService } from './notice.service';

@Component({
  selector: 'app-notice',
  standalone: true,
  template: `
    <div class="notice" role="status" aria-live="polite">
      @if (notice.message(); as message) {
        <p>
          {{ message }}
          <button type="button" aria-label="Dismiss" (click)="notice.dismiss()">
            &times;
          </button>
        </p>
      }
    </div>
  `,
  styles: `
    .notice {
      position: fixed;
      left: 50%;
      bottom: 24px;
      z-index: 10;
      width: max-content;
      max-width: calc(100vw - 32px);
      transform: translateX(-50%);
    }
    p {
      display: flex;
      align-items: center;
      gap: 16px;
      margin: 0;
      padding: 12px 16px;
      border: 1px solid rgba(233, 184, 114, 0.4);
      border-radius: 3px;
      background: #1a1410;
      color: #f6efe6;
      font-size: 0.9rem;
    }
    button {
      border: 0;
      background: none;
      color: #e9b872;
      font-size: 1.2rem;
      cursor: pointer;
    }
  `,
})
export class NoticeComponent {
  readonly notice = inject(NoticeService);
}
