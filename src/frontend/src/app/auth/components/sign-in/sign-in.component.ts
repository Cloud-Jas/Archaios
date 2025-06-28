import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-sign-in',
  templateUrl: './sign-in.component.html',
  styleUrls: ['./sign-in.component.scss']
})
export class SignInComponent {
  signInForm: FormGroup;
  isAuthenticating$ = this.authService.isAuthenticating;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService
  ) {
    this.signInForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });
  }

  onSubmit() {
    if (this.signInForm.valid) {
      // Handle email/password sign in
    }
  }

  async signInWithMicrosoft() {
    if (this.isAuthenticating$.value) return;
    await this.authService.signInWithMicrosoft();
  }

  signInWithGoogle() {
    this.authService.signInWithGoogle();
  }
}
