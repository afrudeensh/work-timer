import { Routes } from '@angular/router';
import { Period } from './period/period';
import { Report } from './report/report';
import { Tracker } from './tracker/tracker';

export const routes: Routes = [
  { path: '', component: Tracker },
  { path: 'report', component: Report },
  { path: 'monthly', component: Period, data: { mode: 'month' } },
  { path: 'yearly', component: Period, data: { mode: 'year' } },
  { path: '**', redirectTo: '' },
];
