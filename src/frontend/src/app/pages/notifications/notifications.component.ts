import { Component, OnInit, OnDestroy } from '@angular/core';
import { NotificationService } from '../../shared/services/notification.service';
import { LeaderboardService } from '../../shared/services/leaderboard.service';
import { Subject, of } from 'rxjs';
import { takeUntil, catchError } from 'rxjs/operators';

interface Notification {
  id: string;
  type: 'discovery' | 'analysis' | 'artifact' | 'alert';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  priority: 'high' | 'medium' | 'low';
  link?: string;
}

interface NotificationIcons {
  [key: string]: string;
  discovery: string;
  analysis: string;
  artifact: string;
  alert: string;
}

interface Activity {
  title: string;
  description: string;
  date: Date;
  image?: string;
  type: 'discovery' | 'analysis' | 'artifact' | 'system';
}

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.scss']
})
export class NotificationsComponent implements OnInit, OnDestroy {
  currentFilter: string = 'all';
  notifications: Notification[] = [
    {
      id: '1',
      type: 'discovery',
      title: 'Welcome to Archaios',
      message: 'Your journey begins here. Explore archaeological sites and uncover ancient artifacts.',
      timestamp: new Date(),
      read: false,
      priority: 'medium',
      link: '/explore'
    }
  ];
  
  // Activities related properties
  recentActivities: Activity[] = [];
  loadingActivities = false;
  activityError: string | null = null;
  private destroy$ = new Subject<void>();

  constructor(
    private notificationService: NotificationService,
    private leaderboardService: LeaderboardService
  ) {}

  ngOnInit() {
    this.loadRecentActivities();
    
    // Subscribe to notification changes
    this.notificationService.notifications$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(notification => {
      // Convert system notifications to our internal format
      if (notification) {
        const newNotification: Notification = {
          id: new Date().getTime().toString(),
          type: this.mapNotificationType(notification.type),
          title: this.generateTitle(notification),
          message: notification.message,
          timestamp: notification.timestamp,
          read: false,
          priority: this.determinePriority(notification.type)
        };
        
        this.notifications.unshift(newNotification);
      }
    });
  }
  
  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadRecentActivities() {
    this.loadingActivities = true;
    this.activityError = null;
    
    this.leaderboardService.getUserLeaderboardData()
      .pipe(
        takeUntil(this.destroy$),
        catchError(err => {
          this.activityError = 'Failed to load your recent activities.';
          this.loadingActivities = false;
          return of(null);
        })
      )
      .subscribe(userData => {
        this.loadingActivities = false;
        if (userData && userData.discoveries) {
          this.recentActivities = userData.discoveries
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 5)
            .map(d => ({
              title: `Discovery at ${d.siteName || 'Archaeological Site'}`,
              description: `Points awarded: ${d.pointsAwarded}`,
              date: new Date(d.timestamp),
              image: d.imageUrl,
              type: 'discovery'
            }));
        }
      });
  }

  private mapNotificationType(type: string): 'discovery' | 'analysis' | 'artifact' | 'alert' {
    switch (type) {
      case 'success': return 'discovery';
      case 'info': return 'analysis';
      case 'start': return 'artifact';
      case 'error': return 'alert';
      default: return 'alert';
    }
  }
  
  private generateTitle(notification: any): string {
    if (notification.type === 'success') return 'Discovery Complete';
    if (notification.type === 'start') return 'Processing Started';
    if (notification.type === 'error') return 'Error';
    return 'System Notification';
  }
  
  private determinePriority(type: string): 'high' | 'medium' | 'low' {
    switch (type) {
      case 'error': return 'high';
      case 'success': return 'medium';
      default: return 'low';
    }
  }

  filterNotifications(filter: string): void {
    this.currentFilter = filter;
    // Implement filtering logic here
  }

  markAsRead(id: string): void {
    // Find notification and mark as read
    const notification = this.notifications.find(n => n.id === id);
    if (notification) {
      notification.read = true;
    }
  }

  retryLoadingActivities(): void {
    this.loadRecentActivities();
  }

  getIconPath(type: keyof NotificationIcons): string {
    const icons: NotificationIcons = {
      discovery: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
      analysis: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
      artifact: 'M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z',
      alert: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z'
    };
    return icons[type] || '';
  }

  getActivityIconPath(type: string): string {
    switch (type) {
      case 'discovery':
        return 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5';
      case 'analysis':
        return 'M22 12h-4l-3 9L9 3l-3 9H2';
      case 'artifact':
        return 'M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2z';
      case 'system':
      default:
        return 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z';
    }
  }
  
  formatDate(date: Date): string {
    if (!date) return '';
    
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diff < 1) return 'Today';
    if (diff < 2) return 'Yesterday';
    if (diff < 7) return `${diff} days ago`;
    
    return date.toLocaleDateString();
  }
}
