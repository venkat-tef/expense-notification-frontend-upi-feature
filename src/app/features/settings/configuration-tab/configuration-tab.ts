import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ThemePicker } from '../../../shared/components/theme-picker/theme-picker';

interface FutureConfigCategory {
  icon: string;
  title: string;
  description: string;
}

@Component({
  selector: 'app-configuration-tab',
  standalone: true,
  imports: [MatIconModule, ThemePicker],
  templateUrl: './configuration-tab.html',
  styleUrl: './configuration-tab.scss',
})
export class ConfigurationTab {
  // Placeholder cards only — no functionality yet. This is the "expandable architecture"
  // the spec asked for: each of these becomes a real section later without restructuring
  // the page, exactly like Appearance already is.
  readonly futureCategories: FutureConfigCategory[] = [
    { icon: 'apartment', title: 'Community', description: 'Building details, contact info' },
    { icon: 'autorenew', title: 'Rotation & Responsibilities', description: 'Water/garbage rules' },
    { icon: 'notifications_active', title: 'Notifications', description: 'Reminders, preferences' },
    { icon: 'admin_panel_settings', title: 'Users & Access', description: 'Roles, permissions' },
    { icon: 'settings_suggest', title: 'System', description: 'Backup, export, general' },
  ];
}
