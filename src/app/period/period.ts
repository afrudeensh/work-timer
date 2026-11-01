import { DatePipe } from '@angular/common';
import { Component, ElementRef, OnDestroy, computed, effect, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { WorkService } from '../work.service';
import { DAY_TARGET, WorkDay, addDays, dayTotals, hm, localDate, mondayOf, weekdaysBetween } from '../time.utils';

Chart.register(...registerables);

interface Entry {
  day: WorkDay;
  date: Date;
  stale: boolean;
  running: boolean;
  office: number;
  brk: number;
  work: number;
}

@Component({
  selector: 'app-period',
  imports: [DatePipe],
  template: `
    <div class="weeknav">
      <button class="btn" (click)="shift(-1)">‹ Prev</button>
      <strong>
        @if (mode === 'month') { {{ anchor() | date: 'MMMM y' }} } @else { {{ anchor() | date: 'y' }} }
      </strong>
      <button class="btn" (click)="shift(1)">Next ›</button>
      @if (!isCurrent()) {
        <button class="link" (click)="goNow()">{{ mode === 'month' ? 'This month' : 'This year' }}</button>
      }
    </div>

    <div class="grid3">
      <section class="card">
        <div class="muted">Worked</div>
        <div class="mid">{{ hm(total()) }}</div>
      </section>
      <section class="card">
        <div class="muted">Target ({{ workdays() }} weekdays × 8h)</div>
        <div class="mid">{{ hm(target()) }}</div>
      </section>
      <section class="card" [class.done]="balance() <= 0">
        <div class="muted">{{ balance() > 0 ? 'Balance left' : 'Overtime' }}</div>
        <div class="mid">{{ hm(balance() > 0 ? balance() : -balance()) }}</div>
      </section>
    </div>

    <div class="grid3">
      <section class="card">
        <div class="muted">Days worked</div>
        <div class="mid">{{ daysWorked() }}</div>
      </section>
      <section class="card">
        <div class="muted">Average per day</div>
        <div class="mid">{{ hm(daysWorked() ? total() / daysWorked() : 0) }}</div>
      </section>
      <section class="card">
        <div class="muted">Office / Break</div>
        <div class="mid small2">{{ hm(totalOffice()) }} / {{ hm(totalBreak()) }}</div>
      </section>
    </div>

    <section class="card">
      <div class="bar"><div class="fill" [style.width.%]="pct()"></div></div>
      <div class="muted">
        {{ pct().toFixed(0) }}% of the {{ mode === 'month' ? 'month' : 'year' }} target done.
        Targets count Monday to Friday only and do not subtract holidays or leave.
      </div>
      @if (staleCount() > 0) {
        <p class="warn-text">
          {{ staleCount() }} past day(s) were not ended and are not counted. Fix them in the Weekly report.
        </p>
      }
    </section>

    <section class="card chart"><canvas #chart></canvas></section>

    @if (mode === 'month') {
      <section class="card">
        <h2>Weekly breakdown</h2>
        <div class="scroll">
          <table>
            <thead><tr><th>Week of</th><th>Days</th><th>Office</th><th>Break</th><th>Working</th></tr></thead>
            <tbody>
              @for (w of weeks(); track w.key) {
                <tr>
                  <td>{{ w.date | date: 'EEE, d MMM' }}</td>
                  <td>{{ w.days }}</td>
                  <td>{{ hm(w.office) }}</td>
                  <td>{{ hm(w.brk) }}</td>
                  <td><strong>{{ hm(w.work) }}</strong></td>
                </tr>
              } @empty {
                <tr><td colspan="5" class="muted">No entries this month</td></tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      <section class="card">
        <h2>Daily timesheet</h2>
        <div class="scroll">
          <table>
            <thead>
              <tr><th>Date</th><th>In</th><th>Out</th><th>Office</th><th>Break</th><th>Working</th><th>vs 8h</th></tr>
            </thead>
            <tbody>
              @for (e of entries(); track e.day.id) {
                <tr>
                  <td>{{ e.date | date: 'EEE, d MMM' }}</td>
                  <td>{{ e.day.started_at | date: 'shortTime' }}</td>
                  <td>
                    @if (e.stale) { not ended } @else if (e.running) { running } @else { {{ e.day.ended_at | date: 'shortTime' }} }
                  </td>
                  @if (e.stale) {
                    <td colspan="4" class="warn-text">Not counted</td>
                  } @else {
                    <td>{{ hm(e.office) }}</td>
                    <td>{{ hm(e.brk) }}</td>
                    <td><strong>{{ hm(e.work) }}</strong></td>
                    <td [class.pos]="e.work >= dayTarget" [class.neg]="e.work < dayTarget && !e.running">
                      {{ diff(e) }}
                    </td>
                  }
                </tr>
              } @empty {
                <tr><td colspan="7" class="muted">No entries this month</td></tr>
              }
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3">Total</td>
                <td>{{ hm(totalOffice()) }}</td>
                <td>{{ hm(totalBreak()) }}</td>
                <td><strong>{{ hm(total()) }}</strong></td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    } @else {
      <section class="card">
        <h2>Month by month</h2>
        <div class="scroll">
          <table>
            <thead>
              <tr><th>Month</th><th>Days</th><th>Office</th><th>Break</th><th>Working</th><th>Target</th><th>Balance</th></tr>
            </thead>
            <tbody>
              @for (m of months(); track m.m) {
                <tr [class.muted]="m.future">
                  <td>{{ m.from | date: 'MMMM' }}</td>
                  <td>{{ m.days }}</td>
                  <td>{{ hm(m.office) }}</td>
                  <td>{{ hm(m.brk) }}</td>
                  <td><strong>{{ hm(m.work) }}</strong></td>
                  <td>{{ hm(m.target) }}</td>
                  <td [class.pos]="!m.future && m.work >= m.target" [class.neg]="!m.future && m.work < m.target">
                    @if (m.future) { - } @else { {{ m.work >= m.target ? '+' : '-' }}{{ hm(abs(m.work - m.target)) }} }
                  </td>
                </tr>
              }
            </tbody>
            <tfoot>
              <tr>
                <td>Year</td>
                <td>{{ daysWorked() }}</td>
                <td>{{ hm(totalOffice()) }}</td>
                <td>{{ hm(totalBreak()) }}</td>
                <td><strong>{{ hm(total()) }}</strong></td>
                <td>{{ hm(target()) }}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    }
    @if (w.error()) { <p class="error">{{ w.error() }}</p> }
  `,
})
export class Period implements OnDestroy {
  w = inject(WorkService);
  mode = inject(ActivatedRoute).snapshot.data['mode'] as 'month' | 'year';
  hm = hm;
  dayTarget = DAY_TARGET;
  abs = Math.abs;

  anchor = signal(new Date());
  private days = signal<WorkDay[]>([]);
  private canvas = viewChild<ElementRef<HTMLCanvasElement>>('chart');
  private chart?: Chart;
  private minute = computed(() => Math.floor(this.w.now() / 60000));

  range = computed<[Date, Date]>(() => {
    const a = this.anchor();
    return this.mode === 'month'
      ? [new Date(a.getFullYear(), a.getMonth(), 1), new Date(a.getFullYear(), a.getMonth() + 1, 0)]
      : [new Date(a.getFullYear(), 0, 1), new Date(a.getFullYear(), 11, 31)];
  });

  isCurrent = computed(() => {
    const n = new Date(), a = this.anchor();
    return a.getFullYear() === n.getFullYear() && (this.mode === 'year' || a.getMonth() === n.getMonth());
  });

  entries = computed<Entry[]>(() => {
    const now = this.minute() * 60000;
    const today = localDate();
    return this.days().map((day) => {
      const stale = !day.ended_at && day.work_date < today;
      const t = stale ? { office: 0, brk: 0, work: 0 } : dayTotals(day, now);
      return { day, date: new Date(day.work_date + 'T00:00:00'), stale, running: !day.ended_at && !stale, ...t };
    });
  });

  total = computed(() => this.entries().reduce((a, e) => a + e.work, 0));
  totalOffice = computed(() => this.entries().reduce((a, e) => a + e.office, 0));
  totalBreak = computed(() => this.entries().reduce((a, e) => a + e.brk, 0));
  daysWorked = computed(() => this.entries().filter((e) => !e.stale).length);
  staleCount = computed(() => this.entries().filter((e) => e.stale).length);
  workdays = computed(() => weekdaysBetween(...this.range()));
  target = computed(() => this.workdays() * DAY_TARGET);
  balance = computed(() => this.target() - this.total());
  pct = computed(() => (this.target() ? Math.min(100, (this.total() / this.target()) * 100) : 0));

  weeks = computed(() => {
    const map = new Map<string, { key: string; date: Date; days: number; office: number; brk: number; work: number }>();
    for (const e of this.entries()) {
      if (e.stale) continue;
      const mon = mondayOf(e.date), key = localDate(mon);
      const w = map.get(key) ?? { key, date: mon, days: 0, office: 0, brk: 0, work: 0 };
      w.days++; w.office += e.office; w.brk += e.brk; w.work += e.work;
      map.set(key, w);
    }
    return [...map.values()];
  });

  months = computed(() => {
    const y = this.anchor().getFullYear(), today = localDate();
    return Array.from({ length: 12 }, (_, m) => {
      const from = new Date(y, m, 1), to = new Date(y, m + 1, 0);
      const es = this.entries().filter((e) => e.date.getMonth() === m && !e.stale);
      return {
        m, from, future: localDate(from) > today, days: es.length,
        office: es.reduce((a, e) => a + e.office, 0),
        brk: es.reduce((a, e) => a + e.brk, 0),
        work: es.reduce((a, e) => a + e.work, 0),
        target: weekdaysBetween(from, to) * DAY_TARGET,
      };
    });
  });

  constructor() {
    effect(() => {
      const [from, to] = this.range();
      this.w.fetchRange(from, to).then((d) => this.days.set(d));
    });

    effect(() => {
      const el = this.canvas()?.nativeElement;
      const entries = this.entries();
      if (!el) return;
      const cfg = this.mode === 'month' ? this.monthChart(entries) : this.yearChart();
      if (this.chart) {
        this.chart.data = cfg.data;
        this.chart.update('none');
      } else {
        this.chart = new Chart(el, cfg);
      }
    });
  }

  private monthChart(entries: Entry[]): ChartConfiguration {
    const [from, to] = this.range();
    const n = to.getDate();
    const work = Array<number>(n).fill(0), office = Array<number>(n).fill(0);
    for (const e of entries) {
      if (e.stale) continue;
      work[e.date.getDate() - 1] = +(e.work / 3600).toFixed(2);
      office[e.date.getDate() - 1] = +(e.office / 3600).toFixed(2);
    }
    const target = Array.from({ length: n }, (_, i) => {
      const g = new Date(from.getFullYear(), from.getMonth(), i + 1).getDay();
      return g === 0 || g === 6 ? null : 8;
    });
    return this.config(
      Array.from({ length: n }, (_, i) => String(i + 1)), work, office, target, 'Day of month', '8h target',
    );
  }

  private yearChart(): ChartConfiguration {
    const ms = this.months();
    return this.config(
      ms.map((m) => m.from.toLocaleDateString([], { month: 'short' })),
      ms.map((m) => +(m.work / 3600).toFixed(1)),
      ms.map((m) => +(m.office / 3600).toFixed(1)),
      ms.map((m) => +(m.target / 3600).toFixed(1)),
      'Month', 'Monthly target',
    );
  }

  private config(
    labels: string[], work: number[], office: number[], target: (number | null)[], xTitle: string, targetLabel: string,
  ): ChartConfiguration {
    return {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Working hours', data: work, backgroundColor: '#4f46e5', borderRadius: 4 },
          { label: 'Office hours', data: office, backgroundColor: '#c7d2fe', borderRadius: 4 },
          {
            type: 'line', label: targetLabel, data: target, borderColor: '#ef4444',
            borderDash: [6, 4], pointRadius: 0, borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'Hours' } },
          x: { title: { display: true, text: xTitle } },
        },
        plugins: { legend: { position: 'bottom' } },
      },
    };
  }

  shift(n: number) {
    const a = this.anchor();
    this.anchor.set(this.mode === 'month' ? new Date(a.getFullYear(), a.getMonth() + n, 1) : new Date(a.getFullYear() + n, 0, 1));
  }

  goNow() {
    this.anchor.set(new Date());
  }

  diff(e: Entry): string {
    if (e.running) return 'running';
    const d = e.work - DAY_TARGET;
    return (d >= 0 ? '+' : '-') + hm(Math.abs(d));
  }

  ngOnDestroy() {
    this.chart?.destroy();
  }
}
