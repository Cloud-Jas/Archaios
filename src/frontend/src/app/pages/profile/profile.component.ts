import { Component, OnInit, OnDestroy } from '@angular/core';
import { AuthService } from '../../auth/services/auth.service';
import { LeaderboardService } from '../../shared/services/leaderboard.service';
import { LeaderboardUser, LeaderboardStats } from '../../shared/models/leaderboard.model';
import { Observable, Subject, of } from 'rxjs';
import { takeUntil, catchError } from 'rxjs/operators';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit, OnDestroy {
  user$ = this.authService.currentUser$;
  userStats: LeaderboardUser | null = null;
  loading = false;
  error: string | null = null;
  private destroy$ = new Subject<void>();
  
  defaultUser = {
    name: 'Guest User',
    email: 'guest@archaios.org',
    role: 'Lead Archaeologist',
    avatar: 'assets/images/avatar.png',
    discoveries: 0,
    sitesAnalyzed: 0,
    accuracy: 0
  };

  constructor(
    private authService: AuthService,
    private leaderboardService: LeaderboardService
  ) {}

  ngOnInit() {
    // Check local storage for profile image
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      this.authService.updateUserState(JSON.parse(savedUser));
    }
    
    this.loadUserStats();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadUserStats() {
    this.loading = true;
    this.leaderboardService.getUserLeaderboardData()
      .pipe(
        takeUntil(this.destroy$),
        catchError(err => {
          this.error = 'Failed to load your statistics. Please try again later.';
          this.loading = false;
          return of(null);
        })
      )
      .subscribe(userData => {
        this.loading = false;
        if (userData) {
          this.userStats = userData;
        }
      });
  }

  getTotalSitesAnalyzed(): number {
    if (!this.userStats?.discoveries) return 0;
    
    // Count unique site IDs from discoveries
    const uniqueSites = new Set(this.userStats.discoveries.map(d => d.siteId));
    return uniqueSites.size;
  }
  
  getAverageAccuracy(): number {
    if (!this.userStats?.discoveries || this.userStats.discoveries.length === 0) return 0;
    
    const totalAccuracy = this.userStats.discoveries.reduce((sum, d) => sum + d.accuracy, 0);
    return Math.round((totalAccuracy / this.userStats.discoveries.length) * 100) / 100;
  }
  
  getRecentDiscoveries(count: number = 2): any[] {
    if (!this.userStats?.discoveries) return [];
    
    return this.userStats.discoveries
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, count)
      .map(d => ({
        title: `Discovery at ${d.siteName || 'Archaeological Site'}`,
        description: `Points awarded: ${d.pointsAwarded}`,
        date: d.timestamp,
        image: d.imageUrl
      }));
  }

  onLogout() {
    this.authService.logout();
  }
}
