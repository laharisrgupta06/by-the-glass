import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  template: `
    <h1>Welcome to By the Glass</h1>
    <p>Discover cocktails and drinks. <a routerLink="/drinks">Browse drinks</a></p>
  `,
})
export class HomeComponent {}
