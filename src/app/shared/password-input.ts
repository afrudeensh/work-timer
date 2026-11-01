import { Component, input, model, output, signal } from '@angular/core';

@Component({
  selector: 'app-password-input',
  template: `
    <div class="pw">
      <input
        [type]="show() ? 'text' : 'password'"
        [value]="value()"
        (input)="value.set($any($event.target).value)"
        [placeholder]="placeholder()"
        [attr.autocomplete]="autocomplete()"
        [class.invalid]="invalid()"
        (keyup.enter)="enter.emit()"
      />
      <button
        type="button"
        class="eye"
        (click)="show.set(!show())"
        [attr.aria-label]="show() ? 'Hide password' : 'Show password'"
        [title]="show() ? 'Hide password' : 'Show password'"
      >
        @if (show()) {
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        } @else {
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        }
      </button>
    </div>
  `,
})
export class PasswordInput {
  value = model('');
  placeholder = input('');
  autocomplete = input('current-password');
  invalid = input(false);
  enter = output<void>();
  show = signal(false);
}
