import {
  Component,
  ElementRef,
  ViewChild,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';

import { AuthDialogService, AuthMode } from '../auth-dialog.service';
import { AuthService, MIN_PASSWORD_LENGTH } from '../auth.service';

@Component({
  selector: 'app-auth-dialog',
  standalone: true,
  templateUrl: './auth-dialog.component.html',
  styleUrl: './auth-dialog.component.scss',
})
export class AuthDialogComponent {
  private dialogService = inject(AuthDialogService);
  private auth = inject(AuthService);
  @ViewChild('dialog', { static: true })
  dialog!: ElementRef<HTMLDialogElement>;
  @ViewChild('form', { static: true }) form!: ElementRef<HTMLFormElement>;

  readonly mode = signal<AuthMode>('sign-in');
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  readonly reason = computed(() => this.dialogService.request()?.reason);
  readonly minPassword = MIN_PASSWORD_LENGTH;

  constructor() {
    // A click on the backdrop lands on the <dialog> itself. Keyboard users have Esc and the close button.
    afterNextRender(() =>
      this.dialog.nativeElement.addEventListener('click', event => {
        if (event.target === this.dialog.nativeElement) this.dismiss();
      })
    );
    effect(
      () => {
        const request = this.dialogService.request();
        const dialog = this.dialog.nativeElement;
        if (request) {
          this.mode.set(request.mode);
          this.error.set(null);
          if (!dialog.open) dialog.showModal();
        } else if (dialog.open) {
          dialog.close();
          // Don't leave a typed password sitting in the page.
          this.form.nativeElement.reset();
        }
      },
      { allowSignalWrites: true }
    );
  }

  switchMode(mode: AuthMode): void {
    this.mode.set(mode);
    this.error.set(null);
  }

  async submit(event: Event, email: string, password: string): Promise<void> {
    event.preventDefault();
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    const error =
      this.mode() === 'sign-up'
        ? await this.auth.signUp(email, password)
        : await this.auth.signIn(email, password);
    this.busy.set(false);
    if (error) this.error.set(error);
    else this.dialogService.close(true);
  }

  /** Esc, the close button or a click on the backdrop. */
  dismiss(): void {
    if (this.dialogService.request()) this.dialogService.close(false);
  }
}
