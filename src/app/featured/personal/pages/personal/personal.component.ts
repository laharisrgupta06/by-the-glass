import { Component, inject, signal } from '@angular/core';

import { AuthDialogService } from 'src/app/core/auth/auth-dialog.service';
import { AuthService } from 'src/app/core/auth/auth.service';
import { NoticeService } from 'src/app/core/notice/notice.service';
import { FavoritesSectionComponent } from '../../components/favorites-section/favorites-section.component';

/**
 * Personal is open to everyone, but its content is the signed-in user's own.
 * Sections: Favorites now; Saved AI Recipes and My Drinks will sit alongside it.
 */
@Component({
  selector: 'app-personal',
  standalone: true,
  imports: [FavoritesSectionComponent],
  templateUrl: './personal.component.html',
  styleUrl: './personal.component.scss',
})
export class PersonalComponent {
  readonly auth = inject(AuthService);
  private authDialog = inject(AuthDialogService);
  private notice = inject(NoticeService);
  readonly signingOut = signal(false);

  signIn(): void {
    this.authDialog.open({ mode: 'sign-in' });
  }

  createAccount(): void {
    this.authDialog.open({ mode: 'sign-up' });
  }

  async signOut(): Promise<void> {
    this.signingOut.set(true);
    const error = await this.auth.signOut();
    this.signingOut.set(false);
    if (error) this.notice.show(error);
  }
}
