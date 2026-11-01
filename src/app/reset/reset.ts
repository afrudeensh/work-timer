import { Component, computed, inject, signal } from '@angular/core';
import { SupabaseService } from '../supabase.service';
import { PasswordInput } from '../shared/password-input';

@Component({
  selector: 'app-reset',
  imports: [PasswordInput],
  template: `
    <div class="card login">
      <h1>Set a new password</h1>
      <p class="muted">Choose a new password for your account.</p>

      <div class="field">
        <app-password-input [(value)]="password" placeholder="New password" autocomplete="new-password"
          [invalid]="submitted() && !!pwError()" (enter)="save()" />
        @if (submitted() && pwError()) { <span class="hint error">{{ pwError() }}</span> }
      </div>
      <div class="field">
        <app-password-input [(value)]="confirm" placeholder="Confirm new password" autocomplete="new-password"
          [invalid]="submitted() && !!confirmError()" (enter)="save()" />
        @if (submitted() && confirmError()) { <span class="hint error">{{ confirmError() }}</span> }
      </div>

      @if (msg()) { <p class="error">{{ msg() }}</p> }

      <button class="btn primary" (click)="save()" [disabled]="busy()">Save password</button>
      <button class="link" (click)="cancel()">Cancel</button>
    </div>
  `,
})
export class Reset {
  private sb = inject(SupabaseService);
  password = signal('');
  confirm = signal('');
  submitted = signal(false);
  busy = signal(false);
  msg = signal('');

  pwError = computed(() => {
    const p = this.password();
    if (p.length < 8) return 'Use at least 8 characters.';
    if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'Include at least one letter and one number.';
    return '';
  });
  confirmError = computed(() => (this.confirm() !== this.password() ? 'Passwords do not match.' : ''));

  async save() {
    this.submitted.set(true);
    this.msg.set('');
    if (this.pwError() || this.confirmError()) return;
    this.busy.set(true);
    const { error } = await this.sb.client.auth.updateUser({ password: this.password() });
    this.busy.set(false);
    if (error) this.msg.set(error.message);
    else this.sb.recovery.set(false);
  }

  async cancel() {
    this.sb.recovery.set(false);
    await this.sb.client.auth.signOut();
  }
}
