import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { WorkDay, addDays, dayTotals, localDate, mondayOf } from './time.utils';

const SELECT = '*, breaks(*)';
type Result = { error: { message: string } | null };

@Injectable({ providedIn: 'root' })
export class WorkService {
  private sb = inject(SupabaseService);

  readonly now = signal(Date.now());
  readonly today = signal<WorkDay | null>(null);
  readonly weekStart = signal(mondayOf(new Date()));
  readonly weekDays = signal<WorkDay[]>([]);
  readonly busy = signal(false);
  readonly error = signal('');

  readonly state = computed<'idle' | 'working' | 'break' | 'ended'>(() => {
    const d = this.today();
    if (!d) return 'idle';
    if (d.ended_at) return 'ended';
    return d.breaks.some((b) => !b.ended_at) ? 'break' : 'working';
  });

  readonly totals = computed(() => {
    const d = this.today();
    return d ? dayTotals(d, this.now()) : { office: 0, brk: 0, work: 0 };
  });

  constructor() {
    setInterval(() => this.now.set(Date.now()), 1000);

    effect(() => {
      if (this.sb.session()) {
        this.loadToday();
      } else {
        this.today.set(null);
        this.weekDays.set([]);
      }
    });

    effect(() => {
      this.weekStart();
      if (this.sb.session()) this.loadWeek();
    });
  }

  async loadToday() {
    const { data, error } = await this.sb.client
      .from('work_days')
      .select(SELECT)
      .eq('work_date', localDate())
      .maybeSingle();
    if (error) this.error.set(error.message);
    this.today.set((data as WorkDay | null) ?? null);
  }

  async loadWeek() {
    const start = this.weekStart();
    const { data, error } = await this.sb.client
      .from('work_days')
      .select(SELECT)
      .gte('work_date', localDate(start))
      .lte('work_date', localDate(addDays(start, 6)))
      .order('work_date');
    if (error) this.error.set(error.message);
    this.weekDays.set((data as WorkDay[] | null) ?? []);
  }

  async fetchRange(from: Date, to: Date): Promise<WorkDay[]> {
    const { data, error } = await this.sb.client
      .from('work_days')
      .select(SELECT)
      .gte('work_date', localDate(from))
      .lte('work_date', localDate(to))
      .order('work_date')
      .limit(2000);
    if (error) this.error.set(error.message);
    return (data as WorkDay[] | null) ?? [];
  }

  private async run(fn: () => PromiseLike<Result>) {
    this.busy.set(true);
    this.error.set('');
    const res = await fn();
    if (res.error) this.error.set(res.error.message);
    await Promise.all([this.loadToday(), this.loadWeek()]);
    this.busy.set(false);
  }

  startDay() {
    return this.run(() =>
      this.sb.client
        .from('work_days')
        .insert({ work_date: localDate(), started_at: new Date().toISOString() }),
    );
  }

  startBreak() {
    const d = this.today();
    if (!d) return;
    return this.run(() =>
      this.sb.client
        .from('breaks')
        .insert({ work_day_id: d.id, started_at: new Date().toISOString() }),
    );
  }

  endBreak() {
    const open = this.today()?.breaks.find((b) => !b.ended_at);
    if (!open) return;
    return this.run(() =>
      this.sb.client.from('breaks').update({ ended_at: new Date().toISOString() }).eq('id', open.id),
    );
  }

  endDay() {
    const d = this.today();
    if (!d) return;
    return this.run(async () => {
      const iso = new Date().toISOString();
      const open = d.breaks.find((b) => !b.ended_at);
      if (open) {
        const r = await this.sb.client.from('breaks').update({ ended_at: iso }).eq('id', open.id);
        if (r.error) return r;
      }
      return this.sb.client.from('work_days').update({ ended_at: iso }).eq('id', d.id);
    });
  }

  reopenDay() {
    const d = this.today();
    if (!d) return;
    return this.run(() =>
      this.sb.client.from('work_days').update({ ended_at: null }).eq('id', d.id),
    );
  }

  /** Close a past day you forgot to end, at the given local time (HH:MM). */
  closeDay(day: WorkDay, time: string) {
    const end = new Date(`${day.work_date}T${time}:00`);
    if (isNaN(end.getTime()) || end.getTime() <= Date.parse(day.started_at)) {
      this.error.set('End time must be after the start time.');
      return;
    }
    return this.run(async () => {
      const iso = end.toISOString();
      const r = await this.sb.client
        .from('breaks')
        .update({ ended_at: iso })
        .eq('work_day_id', day.id)
        .is('ended_at', null);
      if (r.error) return r;
      return this.sb.client.from('work_days').update({ ended_at: iso }).eq('id', day.id);
    });
  }
}
