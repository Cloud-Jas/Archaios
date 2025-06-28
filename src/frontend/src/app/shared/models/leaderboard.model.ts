export interface Discovery {
  id: string;
  siteId: string;
  userId: string;
  siteName: string;
  timestamp: string;
  pointsAwarded: number;
  accuracy: number;
  imageUrl?: string;
}

export interface LeaderboardUser {
  id: string;
  rank: number;
  name: string;
  username?: string;
  avatar: string;
  institution: string;
  score: number;
  recentDiscovery?: string;
  discoveries: Discovery[];
  sitesAnalyzed: number;
  accuracy: number;
  badge?: string;
  lastActive?: string;
  joinDate?: string;
}

export interface LeaderboardResponse {
  users: LeaderboardUser[];
  totalUsers: number;
  timeRange: LeaderboardTimeRange;
  stats: {
    totalDiscoveries: number;
    totalSitesAnalyzed: number;
    averageAccuracy: number;
  };
}

export type LeaderboardTimeRange = 'all-time' | 'yearly' | 'monthly' | 'weekly';

export interface LeaderboardParams {
  timeRange: LeaderboardTimeRange;
  page: number;
  pageSize: number;
  search?: string;
}

export interface LeaderboardStats {
  totalDiscoveries: number; 
  totalSitesAnalyzed: number;
  averageAccuracy: number;
}
