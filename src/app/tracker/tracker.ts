import { DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { WorkService } from '../work.service';
import { DAY_TARGET, clock, hm, hms } from '../time.utils';

@Component({
  selector: 'app-tracker',
  imports: [DatePipe],
  template: `
    <section class="card hero">
      <div class="muted">{{ w.now() | date: 'fullDate' }}</div>
      <div class="status {{ w.state() }}">{{ label() }}</div>

      <div class="big">{{ hms(w.totals().work) }}</div>
      <div class="muted">Working hours</div>

      <div class="bar"><div class="fill" [style.width.%]="pct()"></div></div>
      <div class="muted">
        @if (remaining() > 0) {
          {{ hm(w.totals().work) }} of 8h · {{ hm(remaining()) }} left
        } @else {
          8h completed · overtime +{{ hm(-remaining()) }}
        }
      </div>

      <div class="actions">
        @switch (w.state()) {
          @case ('idle') {
            <button class="btn primary" [disabled]="w.busy()" (click)="w.startDay()">Start day</button>
          }
          @case ('working') {
            <button class="btn warn" [disabled]="w.busy()" (click)="w.startBreak()">Take a break</button>
            <button class="btn" [disabled]="w.busy()" (click)="w.endDay()">End day</button>
          }
          @case ('break') {
            <button class="btn primary" [disabled]="w.busy()" (click)="w.endBreak()">Resume work</button>
            <button class="btn" [disabled]="w.busy()" (click)="w.endDay()">End day</button>
          }
          @case ('ended') {
            <button class="btn" [disabled]="w.busy()" (click)="w.reopenDay()">Reopen day</button>
          }
        }
      </div>
      @if (w.error()) {
        <p class="error">{{ w.error() }}</p>
      }
    </section>

    <div class="grid2">
      <section class="card">
        <div class="muted">Office time</div>
        <div class="mid">{{ hms(w.totals().office) }}</div>
        <div class="muted small">
          @if (w.today(); as d) {
            In at {{ d.started_at | date: 'shortTime' }}
          } @else {
            Not started
          }
        </div>
      </section>
      <section class="card">
        <div class="muted">Break time</div>
        <div class="mid">{{ hms(w.totals().brk) }}</div>
        <div class="muted small">{{ w.today()?.breaks?.length ?? 0 }} break(s) today</div>
      </section>
    </div>

    @if (leaveBy(); as t) {
      <section class="card">
        <div class="muted">
          {{ w.state() === 'break' ? 'If you resume now, you reach 8 hours at' : 'You reach 8 working hours at' }}
        </div>
        <div class="mid">{{ t }}</div>
      </section>
    }
  `,
})
export class Tracker {
  w = inject(WorkService);
  hms = hms;
  hm = hm;

  remaining = computed(() => DAY_TARGET - this.w.totals().work);
  pct = computed(() => Math.min(100, (this.w.totals().work / DAY_TARGET) * 100));

  label = computed(() => {
    switch (this.w.state()) {
      case 'working': return 'Working';
      case 'break': return 'On break (working time paused)';
      case 'ended': return 'Day ended';
      default: return 'Not started';
    }
  });

  leaveBy = computed(() => {
    const s = this.w.state();
    const rem = this.remaining();
    if ((s !== 'working' && s !== 'break') || rem <= 0) return null;
    return clock(this.w.now() + rem * 1000);
  });
}
