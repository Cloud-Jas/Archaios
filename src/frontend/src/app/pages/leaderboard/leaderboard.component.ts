import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormControl } from '@angular/forms';
import { debounceTime, distinctUntilChanged, switchMap, catchError, takeUntil } from 'rxjs/operators';
import { of, Subject, Observable } from 'rxjs';
import { LeaderboardService } from '../../shared/services/leaderboard.service';
import { 
  LeaderboardUser, 
  LeaderboardResponse, 
  LeaderboardTimeRange,
  Discovery
} from '../../shared/models/leaderboard.model';

@Component({
  selector: 'app-leaderboard',
  templateUrl: './leaderboard.component.html',
  styleUrls: ['./leaderboard.component.scss']
})
export class LeaderboardComponent implements OnInit, OnDestroy {
  timeFilter: LeaderboardTimeRange = 'all-time';
  archaeologists: LeaderboardUser[] = [];
  loading = true;
  error: string | null = null;
  
  // Pagination
  currentPage = 1;
  pageSize = 10;
  totalUsers = 0;
  
  // Search
  searchControl = new FormControl('');
  private searchTerms = new Subject<string>();
  
  // Statistics
  stats: {
    totalDiscoveries: number;
    totalSitesAnalyzed: number;
    averageAccuracy: number;
  } = {
    totalDiscoveries: 0,
    totalSitesAnalyzed: 0,
    averageAccuracy: 0
  };

  // Add destroy subject for cleanup
  private destroy$ = new Subject<void>();
  
  constructor(private leaderboardService: LeaderboardService) {}

  ngOnInit(): void {
    // Setup search with debounce
    this.searchControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(value => {
      this.searchTerms.next(value || '');
    });

    this.searchTerms.pipe(
      debounceTime(500),
      takeUntil(this.destroy$),
      switchMap(term => {
        this.loading = true;
        return this.loadLeaderboardData(this.timeFilter, term);
      })
    ).subscribe();
    
    // Subscribe to statistics updates
    this.leaderboardService.statistics$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(stats => {
      this.stats = stats;
    });
    
    // Load initial data and statistics
    this.loadLeaderboardData(this.timeFilter).subscribe();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  filterByTime(period: LeaderboardTimeRange): void {
    this.timeFilter = period;
    this.currentPage = 1; // Reset to first page when changing filters
    this.loading = true;
    this.loadLeaderboardData(period, this.searchControl.value || undefined).subscribe();
  }

  loadPage(page: number): void {
    this.currentPage = page;
    this.loading = true;
    this.loadLeaderboardData(
      this.timeFilter, 
      this.searchControl.value || undefined, 
      page
    ).subscribe();
  }

  // Add public method to retry loading data
  public retryLoading(): void {
    this.loading = true;
    this.loadLeaderboardData(this.timeFilter).subscribe();
  }

  private loadLeaderboardData(
    timeRange: LeaderboardTimeRange = 'all-time', 
    search?: string,
    page: number = 1
  ): Observable<LeaderboardResponse> {
    return this.leaderboardService.getLeaderboard({
      timeRange,
      search,
      page,
      pageSize: this.pageSize
    }).pipe(
      catchError(err => {
        this.error = 'Failed to load leaderboard data. Please try again later.';
        this.loading = false;
        return of({
          users: [],
          totalUsers: 0,
          timeRange,
          stats: { totalDiscoveries: 0, totalSitesAnalyzed: 0, averageAccuracy: 0 }
        });
      }),
      switchMap(response => {
        this.archaeologists = response.users;
        this.totalUsers = response.totalUsers;
        this.stats = response.stats || this.stats; // Use stats from the response directly
        this.loading = false;
        this.error = null;
        return of(response);
      })
    );
  }

  getTotalPages(): number {
    return Math.ceil(this.totalUsers / this.pageSize);
  }

  getPageNumbers(): number[] {
    const totalPages = this.getTotalPages();
    const visiblePages = Math.min(5, totalPages);
    const halfVisible = Math.floor(visiblePages / 2);
    
    let startPage = Math.max(1, this.currentPage - halfVisible);
    const endPage = Math.min(totalPages, startPage + visiblePages - 1);
    
    if (endPage - startPage + 1 < visiblePages) {
      startPage = Math.max(1, endPage - visiblePages + 1);
    }
    
    return Array.from({length: endPage - startPage + 1}, (_, i) => startPage + i);
  }
}