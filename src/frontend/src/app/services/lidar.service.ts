import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../auth/services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class LidarService {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  async handleLidarFile(file: File): Promise<boolean> {
    if (!this.authService.isAuthenticated()) {
      localStorage.setItem('redirectUrl', '/lidar-upload');
      this.router.navigate(['/auth/signin']);
      return false;
    }
    // Handle file upload for authenticated users
    return true;
  }
}
