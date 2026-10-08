import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './core/components/navbar/navbar.component';
import { AuthDialogComponent } from './core/auth/auth-dialog/auth-dialog.component';
import { NoticeComponent } from './core/notice/notice.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    NavbarComponent,
    AuthDialogComponent,
    NoticeComponent,
  ],
  template: `
    <app-navbar></app-navbar>
    <section class="container">
      <router-outlet></router-outlet>
    </section>
    <app-auth-dialog></app-auth-dialog>
    <app-notice></app-notice>
  `,
})
export class AppComponent {
  title = 'by-the-glass';
}
