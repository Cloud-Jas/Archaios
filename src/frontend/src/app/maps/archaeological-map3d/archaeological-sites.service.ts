import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { LocationMap } from '../models/location.model';
import { Connection } from '../models/connection.model';
import { Coordinates } from '../models/coordinates.model';
import { ArchaeologyLocationMap } from '../models/archaeology-location.model';
import { MarkerColor } from '../enums';
import { ArchaeologicalDataService } from '../../shared/services/archaeological-data.service';
import { AuthService } from '../../auth/services/auth.service';

export interface ArchaeologicalSite {
  id: string;
  name: string;
  siteId: string;
  description?: string;
  size: string;
  imageUrl?: string;
  type?: string;
  dangerLevel?: number;
  status?: string;
  latitude: number;
  longitude: number;
  location?: string;
  category?: string;
  lastUpdated?: string;
  components?: SiteComponent[];
  isKnownSite?: boolean;
  isPossibleArchaeologicalSite?: boolean;
  archaiosUser?: ArchaiosUser;
}
export interface ArchaiosUser
{
  id: string;
  name: string;
  username: string;
  email: string;
  role: string;
  photoUrl?: string;
  oid?: string; 
  provider?: string;
  isArchaeologist?: boolean;
}
export interface SiteComponent {
  name: string;
  state: string;
  latitude: number;
  longitude: number;
  imageUrl?: string;
  siteId: string;
}

export interface ArchaeologicalSitesResponse {
  sites: ArchaeologicalSite[];
  count: number;
  timestamp: string;
}

export interface BasicSiteInfo {
  id: string;
  name: string;
  siteId: string;
  type?: string;
  latitude: number;
  longitude: number;
  isKnownSite?: boolean;
  isPossibleArchaeologicalSite?: boolean;
  size: string;
  lastUpdated?: string; // Make sure lastUpdated is included
  archaiosUser?: ArchaiosUser;
}

export interface ArchaeologicalSitesBasicResponse {
  sites: BasicSiteInfo[];
  count: number;
  timestamp: string;
}

@Injectable({
  providedIn: 'root'
})
export class ArchaeologicalSitesService {
  private readonly baseUrl = environment.backendApi;
  private siteCountsSubject = new BehaviorSubject<{ 
    heritage: number; 
    archaios: number; 
    potential: number;
    myuploads: number; 
    myFileSize: string; 
    totalFileSize: string; 
    totalUsers: number;
    totalUploads: number;
  }>({ 
    heritage: 0, 
    archaios: 0, 
    potential: 0, 
    myuploads: 0, 
    myFileSize: '0 KB', 
    totalFileSize: '0 KB', 
    totalUsers: 0,
    totalUploads: 0
  });
  siteCounts$ = this.siteCountsSubject.asObservable();
  user$ = this.authService.currentUser$;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private dataService: ArchaeologicalDataService
  ) {}

  private updateSiteCounts(sites: ArchaeologicalSite[]): void {
    const heritage = sites.filter(site => site.isKnownSite).length;
    const archaios = sites.filter(site => !site.isKnownSite).length;
    const potential = sites.filter(site => site.isPossibleArchaeologicalSite).length;
    const myuploads = sites.filter(site => site.archaiosUser?.oid === this.authService.getCurrentUser()?.oid).length;
    const totalUploads = sites.filter(site => site.archaiosUser?.oid !== "archaios-oid").length;
    // Calculate total sizes in bytes
    const myFileSizeBytes = sites.filter(site => site.archaiosUser?.oid === this.authService.getCurrentUser()?.oid)
      .reduce((total, site) => total + (site.size ? parseInt(site.size, 10) : 0), 0);
    const totalFileSizeBytes = sites.filter(site=> site.archaiosUser?.oid !== "archaios-oid").reduce((total, site) => total + (site.size ? parseInt(site.size, 10) : 0), 0);

    // Format file sizes to human-readable format
    const myFileSize = this.formatFileSize(myFileSizeBytes);
    const totalFileSize = this.formatFileSize(totalFileSizeBytes);
    
    const totalUsers = this.dataService.getUniqueUsersCount();
    
    this.siteCountsSubject.next({ 
      heritage, 
      archaios, 
      potential, 
      myuploads, 
      myFileSize, 
      totalFileSize, 
      totalUsers,
      totalUploads
    });
  }
  
  /**
   * Format a file size in bytes to a human-readable string (KB, MB, GB)
   * @param bytes File size in bytes
   * @returns Formatted file size string
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 KB';
    
    const units = ['KB', 'MB', 'GB'];
    const base = 1024;
    const unitIndex = Math.floor(Math.log(bytes) / Math.log(base));
    const unitLevel = Math.min(unitIndex, units.length - 1); // Cap at the highest unit
    
    // Convert to appropriate unit and round to 2 decimal places
    const size = bytes / Math.pow(base, unitLevel + 1); // +1 because we're starting from KB
    return `${size.toFixed(2)} ${units[unitLevel]}`;
  }

  getArchaeologicalSites(): Observable<{ sites: BasicSiteInfo[], locations: ArchaeologyLocationMap[], connections: Connection[] }> {
    return this.http.get<ArchaeologicalSitesBasicResponse>(`${this.baseUrl}/archaiosSites`)
      .pipe(
        tap(response => {
          this.dataService.setBasicSiteInfo(response.sites);
          this.updateSiteCounts(response.sites); // Update counts here
        }),
        map(response => {
          const sites = response.sites;
          var currentUser = this.authService.getCurrentUser();
          const currentUserOid = currentUser?.oid;
          console.log('Current user OID:', currentUserOid);
          const locations = response.sites.map(site => this.mapBasicSiteToLocation(site, currentUserOid? currentUserOid : ''));
          const connections: Connection[] = [];
          
          const sitesByUser: { [userId: string]: BasicSiteInfo[] } = {};
          
          var filteredSites = response.sites.filter(site => site.archaiosUser?.oid !== 'archaios-oid');
          filteredSites.forEach(site => {
            if (site.archaiosUser?.id) {
              const userId = site.archaiosUser.id;
              if (!sitesByUser[userId]) {
                sitesByUser[userId] = [];
              }
              sitesByUser[userId].push(site);
            }
          });
          
          return { sites, locations, connections };
        })
      );
  }

  getSiteDetails(siteId: string): Observable<ArchaeologicalSite> {
    return this.http.get<ArchaeologicalSite>(`${this.baseUrl}/archaiosSites/${siteId}`)
      .pipe(
        tap(site => {
          // Cache the detailed site in the data service
          this.dataService.updateSiteDetails(site);
        })
      );
  }

  private mapBasicSiteToLocation(site: BasicSiteInfo, currentUserOid: string | null): ArchaeologyLocationMap {
    const isMyUpload = !!currentUserOid && 
                      !!site.archaiosUser?.oid && 
                      currentUserOid === site.archaiosUser.oid;
    return {
      id: site.id,
      name: site.name,
      type: site.type || 'archaios',
      isKnownSite: site.isKnownSite,
      isMyUpload: isMyUpload,
      isPossibleArchaeologicalSite: site.isPossibleArchaeologicalSite,
      color: this.getSiteMarkerColor(site),
      position: {
        lat: site.latitude,
        lng: site.longitude
      } as Coordinates
    };
  }

  private getSiteMarkerColor(site: BasicSiteInfo | ArchaeologicalSite): MarkerColor {
    var color = MarkerColor.YELLOW;
    if (site.isPossibleArchaeologicalSite) {
      color = MarkerColor.RED;
    }
    else if (site.isKnownSite) {
      color = MarkerColor.MAGIC_PLACE;
    }
    return color;
  }
  

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    return distance; // Distance in km
  }
  
  private toRadians(degrees: number): number {
    return degrees * Math.PI / 180;
  }
}
