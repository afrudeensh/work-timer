import { Component, effect, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Login } from './login/login';
import { Reset } from './reset/reset';
import { SupabaseService } from './supabase.service';
import { WorkService } from './work.service';
import { hms } from './time.utils';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Login, Reset],
  templateUrl: './app.html',
})
export class App {
  sb = inject(SupabaseService);
  private w = inject(WorkService);

  constructor() {
    effect(() => {
      const working = this.w.state() === 'working';
      document.title = working ? `${hms(this.w.totals().work)} · Work Timer` : 'Work Timer';
    });
  }

  signOut() {
    this.sb.client.auth.signOut();
  }
}
