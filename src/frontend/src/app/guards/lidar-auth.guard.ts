import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../auth/services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class LidarAuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(): boolean {
    if (!this.authService.isAuthenticated()) {
      // Store the attempted URL for redirecting
      localStorage.setItem('redirectUrl', '/lidar-upload');
      this.router.navigate(['/auth/signin']);
      return false;
    }
    return true;
  }
}
