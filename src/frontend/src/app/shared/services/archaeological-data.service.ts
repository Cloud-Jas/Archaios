import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { ArchaeologicalSite, ArchaiosUser } from '../../maps/archaeological-map3d/archaeological-sites.service';
import { AuthService } from '../../auth/services/auth.service';
import { map, tap } from 'rxjs/operators';
import { SiteComponent } from '../../maps/models/archaeological-site.model';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { LocationMap } from '../../maps/models/location.model';
import { Connection } from '../../maps/models/connection.model';
import { MarkerColor } from '../../maps/enums';

// Define a typed version of the location object that matches LocationMap
interface MapLocation {
  id: string | number; // Allow both string and number to be compatible with LocationMap
  name: string;
  type: string;
  position: {
    lat: number;
    lng: number;
  };
  color: MarkerColor | string;
  hasProblem: boolean | number;
}

@Injectable({
  providedIn: 'root'
})
export class ArchaeologicalDataService {
  private sitesSubject = new BehaviorSubject<ArchaeologicalSite[]>([]);
  private userSitesSubject = new BehaviorSubject<ArchaeologicalSite[]>([]);
  private selectedSiteSubject = new BehaviorSubject<ArchaeologicalSite | null>(null);
  private uniqueUsersCountSubject = new BehaviorSubject<number>(0);
  
  sites$ = this.sitesSubject.asObservable();
  userSites$ = this.userSitesSubject.asObservable();
  selectedSite$ = this.selectedSiteSubject.asObservable();
  uniqueUsersCount$ = this.uniqueUsersCountSubject.asObservable();

  constructor(
    private authService: AuthService,
    private http: HttpClient
  ) {}

  /**
   * Update stored archaeological sites
   */
  setSites(sites: ArchaeologicalSite[]): void {
    this.sitesSubject.next(sites);
    this.updateUserSites();
    this.updateUniqueUsersCount();
  }

  /**
   * Get current value of sites
   */
  getSites(): ArchaeologicalSite[] {
    return this.sitesSubject.getValue();
  }

  /**
   * Get site by ID from already loaded sites
   * @param siteId ID of the site to retrieve
   * @returns Observable of the site or null if not found
   */
  getSiteById(siteId: string): Observable<ArchaeologicalSite | null> {
    const sites = this.sitesSubject.getValue();
    const site = sites.find(s => s.id === siteId || s.siteId === siteId);
    
    if (site) {
      this.selectedSiteSubject.next(site);
      return of(site);
    }
    
    return of(null);
  }

  /**
   * Get components for a specific site from already loaded data
   * @param siteId ID of the site
   * @returns Site components or empty array if site not found
   */
  getSiteComponents(siteId: string): SiteComponent[] {
    const sites = this.sitesSubject.getValue();
    const site = sites.find(s => s.id === siteId || s.siteId === siteId);
    return site?.components || [];
  }

  /**
   * Select a site as the currently active site
   * @param site Site to select
   */
  selectSite(site: ArchaeologicalSite): void {
    this.selectedSiteSubject.next(site);
  }

  /**
   * Clear the currently selected site
   */
  clearSelectedSite(): void {
    this.selectedSiteSubject.next(null);
  }

  /**
   * Calculate unique users count by grouping sites by user OIDs
   */
  private updateUniqueUsersCount(): void {
    const sites = this.sitesSubject.getValue();
    
    // Use Set to track unique OIDs (excluding null/undefined values and system users)
    const uniqueUserOids = new Set<string>();
    
    sites.forEach(site => {
      if (site.archaiosUser?.oid && 
          site.archaiosUser.oid !== 'archaios-oid' && // Exclude system user
          site.archaiosUser.oid.trim() !== '') {
        uniqueUserOids.add(site.archaiosUser.oid);
      }
    });
    
    this.uniqueUsersCountSubject.next(uniqueUserOids.size);
  }
  
  /**
   * Get the unique archaeological contributors count
   * @returns Number of unique users who have contributed archaeological sites
   */
  getUniqueUsersCount(): number {
    return this.uniqueUsersCountSubject.getValue();
  }

  /**
   * Get unique users that have uploaded archaeological sites
   * @returns Array of unique users
   */
  getUniqueUsers(): ArchaiosUser[] {
    const sites = this.sitesSubject.getValue();
    const uniqueUsersMap = new Map<string, ArchaiosUser>();
    
    sites.forEach(site => {
      if (site.archaiosUser?.oid && 
          site.archaiosUser.oid !== 'archaios-oid' &&
          site.archaiosUser.oid.trim() !== '') {
        // Only add each user once using their OID as the key
        uniqueUsersMap.set(site.archaiosUser.oid, site.archaiosUser);
      }
    });
    
    // Convert the Map values to an array
    return Array.from(uniqueUsersMap.values());
  }

  /**
   * Filter sites for the current user
   */
  private updateUserSites(): void {
    // Use the async version with subscription instead of currentUserValue
    this.authService.currentUser$.subscribe(currentUser => {
      if (!currentUser) {
        this.userSitesSubject.next([]);
        return;
      }

      const sites = this.sitesSubject.getValue();
      const userSites = sites.filter(site => 
        site.archaiosUser?.id === currentUser.id || 
        site.archaiosUser?.oid === currentUser.oid
      );
      
      this.userSitesSubject.next(userSites);
    });
  }

  /**
   * Check if a site with a given ID belongs to the current user
   * @param siteId Site ID to check
   * @returns Observable boolean indicating if site belongs to current user
   */
  isUserSite(siteId: string): Observable<boolean> {
    return this.userSites$.pipe(
      map(sites => sites.some(site => site.id === siteId || site.siteId === siteId))
    );
  }

  /**
   * Get site marker color based on site properties
   */
  private getSiteMarkerColor(site: ArchaeologicalSite): MarkerColor {

    var color= MarkerColor.YELLOW;
    if (site.isPossibleArchaeologicalSite) {
      color = MarkerColor.RED;
    }
    else if (site.isKnownSite) {
      color = MarkerColor.TURQUOISE;
    }
    return color;
  }
}
