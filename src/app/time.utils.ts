export interface Break {
  id: string;
  work_day_id: string;
  started_at: string;
  ended_at: string | null;
}

export interface WorkDay {
  id: string;
  work_date: string; // YYYY-MM-DD (local date)
  started_at: string;
  ended_at: string | null;
  breaks: Break[];
}

export const DAY_TARGET = 8 * 3600;
export const WEEK_TARGET = 40 * 3600;

export interface Totals {
  office: number; // seconds in office (start -> end/now)
  brk: number; // seconds on break
  work: number; // office - break
}

export function dayTotals(d: WorkDay, nowMs: number): Totals {
  const start = Date.parse(d.started_at);
  const end = d.ended_at ? Date.parse(d.ended_at) : nowMs;
  const office = Math.max(0, Math.floor((end - start) / 1000));
  let brk = 0;
  for (const b of d.breaks) {
    const bs = Math.max(Date.parse(b.started_at), start);
    const be = Math.min(b.ended_at ? Date.parse(b.ended_at) : end, end);
    if (be > bs) brk += Math.floor((be - bs) / 1000);
  }
  return { office, brk, work: Math.max(0, office - brk) };
}

export const pad = (n: number) => String(n).padStart(2, '0');

export function hms(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

export function hm(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 3600)}h ${pad(Math.floor((s % 3600) / 60))}m`;
}

export function clock(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function localDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function mondayOf(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

export function weekdaysBetween(from: Date, to: Date): number {
  let n = 0;
  for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
    const g = d.getDay();
    if (g !== 0 && g !== 6) n++;
  }
  return n;
}
