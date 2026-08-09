import { Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ThemeService } from '../../../core/services/theme.service';

@Component({
  selector: 'app-theme-picker',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './theme-picker.html',
  styleUrl: './theme-picker.scss',
})
export class ThemePicker {
  readonly themeService = inject(ThemeService);
  private readonly snackBar = inject(MatSnackBar);

  select(themeId: string): void {
    if (themeId === this.themeService.activeThemeId()) return;
    this.themeService.select(themeId);
    this.snackBar.open('Theme applied.', undefined, { duration: 1500, panelClass: 'rm-snack-success' });
  }
}
