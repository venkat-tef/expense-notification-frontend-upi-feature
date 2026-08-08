import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { noAuthGuard } from './core/guards/no-auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
    canActivate: [noAuthGuard],
    title: 'Login • RoomMate Manager',
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
    canActivate: [authGuard],
    title: 'RoomMate Manager',
  },
  {
    path: 'water',
    loadComponent: () => import('./features/water/water').then((m) => m.Water),
    canActivate: [authGuard],
    title: 'Water • RoomMate Manager',
  },
  {
    path: 'cooking',
    loadComponent: () => import('./features/cooking/cooking').then((m) => m.Cooking),
    canActivate: [authGuard],
    title: 'Cooking • RoomMate Manager',
  },
  {
    path: 'expenses',
    loadComponent: () => import('./features/expenses/expenses').then((m) => m.Expenses),
    canActivate: [authGuard],
    title: 'Expenses • RoomMate Manager',
  },
  {
    path: 'history',
    loadComponent: () => import('./features/history/history').then((m) => m.History),
    canActivate: [authGuard],
    title: 'History • RoomMate Manager',
  },
  {
    path: 'settings',
    loadComponent: () => import('./features/settings/settings').then((m) => m.Settings),
    canActivate: [authGuard],
    title: 'Settings • RoomMate Manager',
  },
  { path: '**', redirectTo: 'dashboard' },
];