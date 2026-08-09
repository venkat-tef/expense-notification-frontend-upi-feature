import { Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MemberService } from '../../core/services/member.service';
import { MembersTab } from './members-tab/members-tab';
import { AnnouncementsTab } from './announcements-tab/announcements-tab';
import { ConfigurationTab } from './configuration-tab/configuration-tab';
import { ThemesTab } from './themes-tab/themes-tab';

type SettingsTabId = 'members' | 'announcements' | 'configuration' | 'themes';

interface SettingsTabDef {
  id: SettingsTabId;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [MatIconModule, MembersTab, AnnouncementsTab, ConfigurationTab, ThemesTab],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings {
  readonly memberService = inject(MemberService);

  /** Admin: Members / Announcements / Configuration. Member: Members / Themes. */
  readonly tabs = computed<SettingsTabDef[]>(() =>
    this.memberService.isAdmin()
      ? [
          { id: 'members', label: 'Members', icon: 'group' },
          { id: 'announcements', label: 'Announcements', icon: 'campaign' },
          { id: 'configuration', label: 'Configuration', icon: 'tune' },
        ]
      : [
          { id: 'members', label: 'Members', icon: 'group' },
          { id: 'themes', label: 'Themes', icon: 'palette' },
        ]
  );

  private readonly requestedTab = signal<SettingsTabId>('members');

  /** Falls back to 'members' if the requested tab isn't in the role-appropriate set
   *  (e.g. role changes mid-session, or a member had 'configuration' selected before
   *  losing admin). */
  readonly activeTab = computed<SettingsTabId>(() => {
    const requested = this.requestedTab();
    return this.tabs().some((t) => t.id === requested) ? requested : 'members';
  });

  selectTab(id: SettingsTabId): void {
    this.requestedTab.set(id);
  }
}
