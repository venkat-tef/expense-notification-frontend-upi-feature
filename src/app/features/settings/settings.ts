import { Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MemberService } from '../../core/services/member.service';
import { MembersTab } from './members-tab/members-tab';
import { AnnouncementsTab } from './announcements-tab/announcements-tab';
import { ConfigurationTab } from './configuration-tab/configuration-tab';
import { ThemesTab } from './themes-tab/themes-tab';
import { SiriService } from '../../core/services/siri.service';

type SettingsTabId = 'members' | 'announcements' | 'configuration' | 'themes' | 'siri';

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
  private readonly siriService = inject(SiriService);

  readonly siriConnected = signal(false);
  readonly siriBusy = signal(false);
  readonly siriToken = signal<string | null>(null);
  readonly siriCopied = signal(false);
  readonly siriError = signal<string | null>(null);

  /** Admin: Members / Announcements / Configuration. Member: Members / Themes. */
  readonly tabs = computed<SettingsTabDef[]>(() =>
    this.memberService.isAdmin()
      ? [
          { id: 'members', label: 'Members', icon: 'group' },
          { id: 'announcements', label: 'Announcements', icon: 'campaign' },
          { id: 'configuration', label: 'Configuration', icon: 'tune' },
          { id: 'siri', label: 'Siri', icon: 'record_voice_over' },
        ]
      : [
          { id: 'members', label: 'Members', icon: 'group' },
          { id: 'themes', label: 'Configuration', icon: 'tune' },
          { id: 'siri', label: 'Siri', icon: 'record_voice_over' },
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

    if (id === 'siri') {
      void this.loadSiriStatus();
    }
  }

  private async loadSiriStatus(): Promise<void> {
    if (this.siriBusy()) return;

    try {
      this.siriError.set(null);
      this.siriConnected.set(await this.siriService.getStatus());
    } catch (err: any) {
      this.siriConnected.set(false);
      this.siriError.set(err?.message || 'Could not check Siri connection.');
    }
  }

  async connectSiri(): Promise<void> {
    if (this.siriBusy()) return;

    this.siriBusy.set(true);
    this.siriError.set(null);
    this.siriCopied.set(false);
    this.siriToken.set(null);

    try {
      const result = await this.siriService.connect();
      this.siriConnected.set(true);
      this.siriToken.set(result.token ?? null);
    } catch (err: any) {
      this.siriConnected.set(false);
      this.siriError.set(err?.message || 'Could not connect Siri to Nestly.');
    } finally {
      this.siriBusy.set(false);
    }
  }

  async disconnectSiri(): Promise<void> {
    if (this.siriBusy()) return;

    const confirmed = window.confirm(
      'Disconnect Siri from this Nestly account? The current Shortcut credential will stop working.'
    );

    if (!confirmed) return;

    this.siriBusy.set(true);
    this.siriError.set(null);
    this.siriToken.set(null);
    this.siriCopied.set(false);

    try {
      await this.siriService.disconnect();
      this.siriConnected.set(false);
    } catch (err: any) {
      this.siriError.set(err?.message || 'Could not disconnect Siri.');
    } finally {
      this.siriBusy.set(false);
    }
  }

  async copySiriToken(): Promise<void> {
    const token = this.siriToken();
    if (!token) return;

    try {
      await navigator.clipboard.writeText(token);
      this.siriCopied.set(true);
      window.setTimeout(() => this.siriCopied.set(false), 2200);
    } catch {
      this.siriError.set(
        'Copy was blocked by the browser. Please select and copy the credential manually.'
      );
    }
  }
}
