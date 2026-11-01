import { DatePipe } from '@angular/common';
import { Component, ElementRef, OnDestroy, computed, effect, inject, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Chart, registerables } from 'chart.js';
import { WorkService } from '../work.service';
import {
  DAY_TARGET, WEEK_TARGET, WorkDay, addDays, dayTotals, hm, localDate, mondayOf,
} from '../time.utils';

Chart.register(...registerables);

interface Row {
  key: string;
  date: Date;
  day: WorkDay | undefined;
  stale: boolean;
  running: boolean;
  office: number;
  brk: number;
  work: number;
}

@Component({
  selector: 'app-report',
  imports: [DatePipe, FormsModule],
  template: `
    <div class="weeknav">
      <button class="btn" (click)="shift(-1)">‹ Prev</button>
      <strong>
        {{ w.weekStart() | date: 'd MMM' }} – {{ end() | date: 'd MMM y' }}
      </strong>
      <button class="btn" (click)="shift(1)">Next ›</button>
      @if (!isCurrentWeek()) {
        <button class="link" (click)="thisWeek()">This week</button>
      }
    </div>

    <div class="grid3">
      <section class="card">
        <div class="muted">Worked</div>
        <div class="mid">{{ hm(total()) }}</div>
      </section>
      <section class="card">
        <div class="muted">Target</div>
        <div class="mid">40h 00m</div>
      </section>
      <section class="card" [class.done]="balance() <= 0">
        <div class="muted">{{ balance() > 0 ? 'Balance left' : 'Overtime' }}</div>
        <div class="mid">{{ hm(balance() > 0 ? balance() : -balance()) }}</div>
      </section>
    </div>

    <section class="card">
      <div class="bar"><div class="fill" [style.width.%]="pct()"></div></div>
      <div class="muted">
        @if (balance() > 0) {
          {{ pct().toFixed(0) }}% of 40 hours done.
          @if (perDay() > 0) {
            Stay about {{ hm(perDay()) }} of working time on each of the {{ daysLeft() }} remaining
            working day(s), including today, to finish the week.
          }
        } @else {
          40 hours completed for this week.
        }
      </div>
    </section>

    <section class="card chart">
      <canvas #chart></canvas>
    </section>

    <section class="card">
      <h2>Timesheet</h2>
      <div class="scroll">
        <table>
          <thead>
            <tr>
              <th>Date</th><th>In</th><th>Out</th><th>Office</th><th>Break</th><th>Working</th><th>vs 8h</th>
            </tr>
          </thead>
          <tbody>
            @for (r of rows(); track r.key) {
              <tr>
                <td>{{ r.date | date: 'EEE, d MMM' }}</td>
                @if (!r.day) {
                  <td colspan="6" class="muted">No entry</td>
                } @else {
                  <td>{{ r.day.started_at | date: 'shortTime' }}</td>
                  <td>
                    @if (r.stale) {
                      <input type="time" [(ngModel)]="closeTimes[r.key]" />
                      <button class="btn small" (click)="close(r)">Save</button>
                    } @else if (r.running) {
                      running
                    } @else {
                      {{ r.day.ended_at | date: 'shortTime' }}
                    }
                  </td>
                  @if (r.stale) {
                    <td colspan="4" class="warn-text">Day was not ended. Set the time you left.</td>
                  } @else {
                    <td>{{ hm(r.office) }}</td>
                    <td>{{ hm(r.brk) }}</td>
                    <td><strong>{{ hm(r.work) }}</strong></td>
                    <td [class.pos]="r.work >= dayTarget" [class.neg]="r.work < dayTarget && !r.running">
                      {{ diff(r) }}
                    </td>
                  }
                }
              </tr>
            }
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3">Week total</td>
              <td>{{ hm(totalOffice()) }}</td>
              <td>{{ hm(totalBreak()) }}</td>
              <td><strong>{{ hm(total()) }}</strong></td>
              <td>{{ balance() > 0 ? '-' + hm(balance()) : '+' + hm(-balance()) }}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      @if (w.error()) {
        <p class="error">{{ w.error() }}</p>
      }
    </section>
  `,
})
export class Report implements OnDestroy {
  w = inject(WorkService);
  hm = hm;
  dayTarget = DAY_TARGET;
  closeTimes: Record<string, string> = {};

  private canvas = viewChild<ElementRef<HTMLCanvasElement>>('chart');
  private chart?: Chart;

  private minute = computed(() => Math.floor(this.w.now() / 60000));
  end = computed(() => addDays(this.w.weekStart(), 6));
  isCurrentWeek = computed(() => localDate(this.w.weekStart()) === localDate(mondayOf(new Date())));

  rows = computed<Row[]>(() => {
    const now = this.minute() * 60000;
    const today = localDate();
    const map = new Map(this.w.weekDays().map((d) => [d.work_date, d]));
    const out: Row[] = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(this.w.weekStart(), i);
      const key = localDate(date);
      const day = map.get(key);
      if (!day && i >= 5) continue; // hide empty weekend days
      const stale = !!day && !day.ended_at && key < today;
      const t = day && !stale ? dayTotals(day, now) : { office: 0, brk: 0, work: 0 };
      out.push({ key, date, day, stale, running: !!day && !day.ended_at && !stale, ...t });
    }
    return out;
  });

  total = computed(() => this.rows().reduce((a, r) => a + r.work, 0));
  totalOffice = computed(() => this.rows().reduce((a, r) => a + r.office, 0));
  totalBreak = computed(() => this.rows().reduce((a, r) => a + r.brk, 0));
  balance = computed(() => WEEK_TARGET - this.total());
  pct = computed(() => Math.min(100, (this.total() / WEEK_TARGET) * 100));

  daysLeft = computed(() => (this.isCurrentWeek() ? Math.max(0, 5 - ((new Date().getDay() + 6) % 7)) : 0));
  perDay = computed(() => (this.daysLeft() > 0 && this.balance() > 0 ? this.balance() / this.daysLeft() : 0));

  constructor() {
    effect(() => {
      const el = this.canvas()?.nativeElement;
      const rows = this.rows();
      if (!el) return;
      const labels = rows.map((r) => r.date.toLocaleDateString([], { weekday: 'short', day: 'numeric' }));
      const work = rows.map((r) => +(r.work / 3600).toFixed(2));
      const office = rows.map((r) => +(r.office / 3600).toFixed(2));
      const target = rows.map(() => 8);
      if (this.chart) {
        this.chart.data.labels = labels;
        this.chart.data.datasets[0].data = work;
        this.chart.data.datasets[1].data = office;
        this.chart.data.datasets[2].data = target;
        this.chart.update();
        return;
      }
      this.chart = new Chart(el, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            { label: 'Working hours', data: work, backgroundColor: '#4f46e5', borderRadius: 6 },
            { label: 'Office hours', data: office, backgroundColor: '#c7d2fe', borderRadius: 6 },
            {
              type: 'line', label: '8h target', data: target, borderColor: '#ef4444',
              borderDash: [6, 4], pointRadius: 0, borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: { y: { beginAtZero: true, title: { display: true, text: 'Hours' } } },
          plugins: { legend: { position: 'bottom' } },
        },
      });
    });
  }

  shift(weeks: number) {
    this.w.weekStart.update((d) => addDays(d, weeks * 7));
  }

  thisWeek() {
    this.w.weekStart.set(mondayOf(new Date()));
  }

  diff(r: Row): string {
    if (r.running) return 'running';
    const d = r.work - DAY_TARGET;
    return (d >= 0 ? '+' : '-') + hm(Math.abs(d));
  }

  close(r: Row) {
    const t = this.closeTimes[r.key];
    if (r.day && t) this.w.closeDay(r.day, t);
  }

  ngOnDestroy() {
    this.chart?.destroy();
  }
}
