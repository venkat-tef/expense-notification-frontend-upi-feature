import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, MatIconModule],
  templateUrl: './bottom-nav.html',
  styleUrl: './bottom-nav.scss',
})
export class BottomNav {
  readonly items: NavItem[] = [
    { path: '/dashboard', label: 'Home', icon: 'home' },
    { path: '/water', label: 'Water', icon: 'water_drop' },
    { path: '/cooking', label: 'Garbage', icon: 'delete' },
     { path: '/history', label: 'History', icon: 'history' },
    { path: '/expenses', label: 'Expenses', icon: 'payments' },
    { path: '/settings', label: 'Settings', icon: 'settings' },
  ];
}
