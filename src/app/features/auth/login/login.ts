import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { AuthService } from '../../../core/services/auth.service';
import { MemberService } from '../../../core/services/member.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatCardModule,
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly memberService = inject(MemberService);
  readonly auth = inject(AuthService);

  readonly hidePassword = signal(true);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  togglePasswordVisibility(): void {
    this.hidePassword.update((v) => !v);
  }

  get emailErrorMessage(): string {
    const c = this.form.controls.email;
    if (c.hasError('required')) return 'Email is required';
    if (c.hasError('email')) return 'Enter a valid email address';
    return '';
  }

  get passwordErrorMessage(): string {
    const c = this.form.controls.password;
    if (c.hasError('required')) return 'Password is required';
    if (c.hasError('minlength')) return 'Password must be at least 6 characters';
    return '';
  }

  async submit(): Promise<void> {
    if (this.form.invalid || this.auth.loading()) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, password } = this.form.getRawValue();
    const success = await this.auth.login(email, password);
    if (!success) return;

    await this.memberService.whenLoaded();
    const profile = this.memberService.members().find((m) => m.uid === this.auth.user()?.uid);

    if (profile?.status === 'inactive') {
      await this.auth.logout();
      this.auth.error.set('Your account has been deactivated. Contact an admin.');
      return;
    }

    this.router.navigateByUrl('/dashboard');
  }
}