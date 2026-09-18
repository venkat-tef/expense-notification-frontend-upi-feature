import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';

export interface SiriConnectionResponse {
  ok: boolean;
  connected?: boolean;
  token?: string;
  memberName?: string;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class SiriService {
  private readonly auth = inject(AuthService);

  private readonly backendUrl =
    'https://expense-notification-backend.onrender.com';

  private async idToken(): Promise<string> {
    const user = this.auth.user();

    if (!user) {
      throw new Error('Please sign in to Nestly first.');
    }

    return user.getIdToken();
  }

  async getStatus(): Promise<boolean> {
    const token = await this.idToken();

    const response = await fetch(`${this.backendUrl}/api/voice/status`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = (await response.json()) as SiriConnectionResponse;

    if (!response.ok) {
      throw new Error(data.error || 'Could not check Siri status.');
    }

    return data.connected === true;
  }

  async connect(): Promise<SiriConnectionResponse> {
    const token = await this.idToken();

    const response = await fetch(`${this.backendUrl}/api/voice/connect`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    const data = (await response.json()) as SiriConnectionResponse;

    if (!response.ok) {
      throw new Error(data.error || 'Could not connect Siri to Nestly.');
    }

    return data;
  }

  async disconnect(): Promise<void> {
    const token = await this.idToken();

    const response = await fetch(`${this.backendUrl}/api/voice/disconnect`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    const data = (await response.json()) as SiriConnectionResponse;

    if (!response.ok) {
      throw new Error(data.error || 'Could not disconnect Siri from Nestly.');
    }
  }
}
