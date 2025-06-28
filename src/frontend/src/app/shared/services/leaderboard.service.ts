import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { 
  LeaderboardResponse, 
  LeaderboardParams,
  LeaderboardTimeRange,
  LeaderboardUser,
  LeaderboardStats
} from '../models/leaderboard.model';

@Injectable({
  providedIn: 'root'
})
export class LeaderboardService {
  private apiUrl = `${environment.backendApi}/leaderboard`;
  private leaderboardData = new BehaviorSubject<LeaderboardResponse | null>(null);
  public leaderboardData$ = this.leaderboardData.asObservable();
  
  // Add a new BehaviorSubject for statistics
  private statisticsSubject = new BehaviorSubject<{
    totalDiscoveries: number;
    totalSitesAnalyzed: number;
    averageAccuracy: number;
  }>({
    totalDiscoveries: 0,
    totalSitesAnalyzed: 0,
    averageAccuracy: 0
  });
  public statistics$ = this.statisticsSubject.asObservable();
  
  constructor(private http: HttpClient) { }
  
  getLeaderboard(params: LeaderboardParams): Observable<LeaderboardResponse> {
    let httpParams = new HttpParams()
      .set('timeRange', params.timeRange)
      .set('page', params.page.toString())
      .set('pageSize', params.pageSize.toString());
      
    if (params.search) {
      httpParams = httpParams.set('search', params.search);
    }
    
    return this.http.get<LeaderboardResponse>(`${this.apiUrl}`, { params: httpParams })
      .pipe(
        tap(response => {
          this.leaderboardData.next(response);
          
          // Update statistics from the main response
          if (response.stats) {
            this.updateStatistics(response.stats);
          }
        }),
        catchError(error => {
          console.error('Error fetching leaderboard data:', error);
          throw error;
        })
      );
  }
  
  getUserRank(userId: string): Observable<{ rank: number; score: number }> {
    return this.http.get<{ rank: number; score: number }>(`${this.apiUrl}/user/${userId}/rank`)
      .pipe(
        catchError(error => {
          console.error('Error fetching user rank:', error);
          throw error;
        })
      );
  }
  
  getTopPerformers(limit: number = 3): Observable<LeaderboardUser[]> {
    return this.http.get<LeaderboardUser[]>(`${this.apiUrl}/top?limit=${limit}`)
      .pipe(
        catchError(error => {
          console.error('Error fetching top performers:', error);
          throw error;
        })
      );
  }

  public getUserLeaderboardData(): Observable<LeaderboardUser> {
    return this.http.get<LeaderboardUser>(`${this.apiUrl}/user`)
      .pipe(
        tap(userData => {
          if (userData) {
            // Update statistics with user-specific data if applicable
            this.updateUserSpecificStats(userData);
          }
        }),
        catchError(error => {
          console.error('Error fetching user leaderboard data:', error);
          return throwError(() => new Error('Failed to load user leaderboard data'));
        })
      );
  }

  private updateUserSpecificStats(userData: LeaderboardUser): void {
    if (userData.discoveries && userData.discoveries.length > 0) {
      // Calculate user-specific stats
      const uniqueSites = new Set(userData.discoveries.map(d => d.siteId)).size;
      const avgAccuracy = userData.discoveries.reduce((sum, d) => sum + d.accuracy, 0) / userData.discoveries.length;
      
      // You might want to emit these for components that subscribe to user-specific stats
      // This is optional and depends on your application's architecture
    }
  }

  private updateStatistics(stats: LeaderboardStats): void {
    this.statisticsSubject.next({
      totalDiscoveries: stats.totalDiscoveries || 0,
      totalSitesAnalyzed: stats.totalSitesAnalyzed || 0,
      averageAccuracy: stats.averageAccuracy || 0
    });
  }
}