import { Component, computed, inject, signal } from '@angular/core';
import { SupabaseService } from '../supabase.service';
import { PasswordInput } from '../shared/password-input';
import { GOOGLE_ENABLED } from '../supabase.config';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

@Component({
  selector: 'app-login',
  imports: [PasswordInput],
  template: `
    <div class="card login">
      <h1>⏱ Work Timer</h1>
      <p class="muted">
        @switch (mode()) {
          @case ('in') { Sign in to track your working hours }
          @case ('up') { Create your account }
          @case ('forgot') { Enter your email and we will send a reset link }
        }
      </p>

      @if (mode() !== 'forgot' && googleEnabled) {
        <button class="btn google" type="button" (click)="google()" [disabled]="busy()">
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
            <path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z" />
            <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
          </svg>
          Continue with Google
        </button>
        <div class="divider"><span>or use email</span></div>
      }

      <label class="field">
        <input
          type="email"
          placeholder="Email"
          autocomplete="email"
          [value]="email()"
          [class.invalid]="submitted() && emailError()"
          (input)="email.set($any($event.target).value)"
          (keyup.enter)="submit()"
        />
        @if (submitted() && emailError()) { <span class="hint error">{{ emailError() }}</span> }
      </label>

      @if (mode() !== 'forgot') {
        <div class="field">
          <app-password-input
            [(value)]="password"
            [placeholder]="mode() === 'up' ? 'Create a password' : 'Password'"
            [autocomplete]="mode() === 'up' ? 'new-password' : 'current-password'"
            [invalid]="submitted() && !!passwordError()"
            (enter)="submit()"
          />
          @if (submitted() && passwordError()) { <span class="hint error">{{ passwordError() }}</span> }
        </div>
      }

      @if (mode() === 'up') {
        <ul class="rules">
          <li [class.pass]="password().length >= 8">At least 8 characters</li>
          <li [class.pass]="hasLetter() && hasDigit()">At least one letter and one number</li>
        </ul>
        <div class="field">
          <app-password-input
            [(value)]="confirm"
            placeholder="Confirm password"
            autocomplete="new-password"
            [invalid]="submitted() && !!confirmError()"
            (enter)="submit()"
          />
          @if (submitted() && confirmError()) { <span class="hint error">{{ confirmError() }}</span> }
        </div>
      }

      @if (mode() === 'in') {
        <button class="link right" type="button" (click)="go('forgot')">Forgot password?</button>
      }

      @if (msg()) { <p [class]="isError() ? 'error' : 'ok'">{{ msg() }}</p> }

      @if (canResend()) {
        <button class="btn" type="button" (click)="resend()" [disabled]="busy() || cooldown() > 0">
          {{ cooldown() > 0 ? 'Resend email in ' + cooldown() + 's' : 'Resend confirmation email' }}
        </button>
      }

      <button class="btn primary" type="button" (click)="submit()" [disabled]="busy() || (mode() === 'forgot' && cooldown() > 0)">
        @switch (mode()) {
          @case ('in') { Sign in }
          @case ('up') { Sign up }
          @case ('forgot') { {{ cooldown() > 0 ? 'Resend in ' + cooldown() + 's' : 'Send reset link' }} }
        }
      </button>

      @if (mode() === 'in') {
        <button class="link" type="button" (click)="go('up')">New here? Create an account</button>
      } @else {
        <button class="link" type="button" (click)="go('in')">Back to sign in</button>
      }
    </div>
  `,
})
export class Login {
  private sb = inject(SupabaseService);
  googleEnabled = GOOGLE_ENABLED;

  email = signal('');
  password = signal('');
  confirm = signal('');
  mode = signal<'in' | 'up' | 'forgot'>('in');
  submitted = signal(false);
  msg = signal('');
  isError = signal(false);
  busy = signal(false);
  canResend = signal(false);
  cooldown = signal(0);

  hasLetter = computed(() => /[A-Za-z]/.test(this.password()));
  hasDigit = computed(() => /\d/.test(this.password()));

  emailError = computed(() => {
    const e = this.email().trim();
    if (!e) return 'Enter your email.';
    return EMAIL_RE.test(e) ? '' : 'Enter a valid email address.';
  });

  passwordError = computed(() => {
    const p = this.password();
    if (this.mode() === 'forgot') return '';
    if (!p) return 'Enter your password.';
    if (this.mode() === 'in') return '';
    if (p.length < 8) return 'Use at least 8 characters.';
    if (!this.hasLetter() || !this.hasDigit()) return 'Include at least one letter and one number.';
    return '';
  });

  confirmError = computed(() =>
    this.mode() === 'up' && this.confirm() !== this.password() ? 'Passwords do not match.' : '',
  );

  valid = computed(() => !this.emailError() && !this.passwordError() && !this.confirmError());

  go(mode: 'in' | 'up' | 'forgot') {
    this.mode.set(mode);
    this.submitted.set(false);
    this.msg.set('');
    this.canResend.set(false);
    this.password.set('');
    this.confirm.set('');
  }

  private fail(text: string) {
    this.isError.set(true);
    this.msg.set(text);
  }

  private info(text: string) {
    this.isError.set(false);
    this.msg.set(text);
  }

  private friendly(message: string): string {
    const m = message.toLowerCase();
    if (m.includes('invalid login')) return 'Wrong email or password.';
    if (m.includes('not confirmed')) return 'Your email is not confirmed yet. Open the confirmation email (check spam too), or resend it below.';
    if (m.includes('security purposes') || m.includes('rate limit')) return 'Too many requests. Please wait a minute and try once.';
    if (m.includes('not enabled')) return 'Google sign-in is not set up yet. Use email and password.';
    if (m.includes('already registered')) return 'An account with this email already exists. Try signing in.';
    return message;
  }

  private startCooldown(seconds = 60) {
    this.cooldown.set(seconds);
    const id = setInterval(() => {
      this.cooldown.update((v) => v - 1);
      if (this.cooldown() <= 0) clearInterval(id);
    }, 1000);
  }

  async submit() {
    this.submitted.set(true);
    this.msg.set('');
    this.canResend.set(false);
    if (!this.valid() || this.busy()) return;

    this.busy.set(true);
    const email = this.email().trim();
    const redirect = window.location.origin;

    if (this.mode() === 'in') {
      const { error } = await this.sb.client.auth.signInWithPassword({ email, password: this.password() });
      if (error) {
        this.fail(this.friendly(error.message));
        if (error.message.toLowerCase().includes('not confirmed')) this.canResend.set(true);
      }
    } else if (this.mode() === 'up') {
      const { data, error } = await this.sb.client.auth.signUp({
        email,
        password: this.password(),
        options: { emailRedirectTo: redirect },
      });
      if (error) {
        this.fail(this.friendly(error.message));
      } else if (data.user && data.user.identities?.length === 0) {
        this.fail('An account with this email already exists. Try signing in.');
      } else if (!data.session) {
        this.info(`Account created. We sent a confirmation link to ${email}. Click it and you will be signed in.`);
        this.canResend.set(true);
        this.startCooldown();
      }
      // If a session came back, the app signs you in automatically.
    } else {
      const { error } = await this.sb.client.auth.resetPasswordForEmail(email, { redirectTo: redirect });
      if (error) this.fail(this.friendly(error.message));
      else {
        this.info('If an account exists for this email, a reset link is on its way. Check your inbox and spam.');
        this.startCooldown();
      }
    }
    this.busy.set(false);
  }

  async resend() {
    if (this.emailError() || this.cooldown() > 0) return;
    this.busy.set(true);
    const { error } = await this.sb.client.auth.resend({
      type: 'signup',
      email: this.email().trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) this.fail(this.friendly(error.message));
    else this.info('Confirmation email sent again. Check your inbox and spam.');
    this.startCooldown();
    this.busy.set(false);
  }

  async google() {
    this.busy.set(true);
    this.msg.set('');
    const { error } = await this.sb.client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      this.fail(this.friendly(error.message));
      this.busy.set(false);
    }
  }
}
