import { Component } from '@angular/core';
import { ThemePicker } from '../../../shared/components/theme-picker/theme-picker';

@Component({
  selector: 'app-themes-tab',
  standalone: true,
  imports: [ThemePicker],
  templateUrl: './themes-tab.html',
  styleUrl: './themes-tab.scss',
})
export class ThemesTab {}
