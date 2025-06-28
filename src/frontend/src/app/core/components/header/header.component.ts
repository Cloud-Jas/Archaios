import { AuthService } from '../../../auth/services/auth.service';
import { SearcherService } from './../../services/searcher.service';
import { FormBuilder } from '@angular/forms';
import { Component, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { Router } from '@angular/router';
import { ArchaeologicalMap3dService } from '../../../maps/archaeological-map3d/archaeological-map3d.service';
import { ArchaeologicalDataService } from '../../../shared/services/archaeological-data.service';
import { ArchaeologicalSite } from '../../../maps/archaeological-map3d/archaeological-sites.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'neo4j-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
})
export class HeaderComponent implements OnInit, OnDestroy {
  form = this.fb.group({
    searcher: [],
  });

  isOpen: boolean = false;
  showProfileMenu = false;
  is3DView = false;
  showSiteDropdown = false;
  currentSite: ArchaeologicalSite | null = null;
  userSites: ArchaeologicalSite[] = [];
  recentUploads: ArchaeologicalSite[] = [];
  isLoadingSites = true;
  
  private subscriptions: Subscription[] = [];

  @Output() openChat = new EventEmitter<void>();
  @Output() openLidarMenu = new EventEmitter<void>();

  user$ = this.authService.currentUser$;

  defaultUser = {
    name: 'Guest User',
    email: 'guest@archaios.org',
    role: 'Lead Archaeologist',
    avatar: 'assets/images/avatar.png'
  };

  constructor(
    private fb: FormBuilder,
    private searcherService: SearcherService,
    private router: Router,
    private authService: AuthService,
    private map3dService: ArchaeologicalMap3dService,
    private dataService: ArchaeologicalDataService
  ) {
    // Initialize view state based on current URL correctly
    this.updateViewState();
    
    // Subscribe to router events to update view state when navigation occurs
    this.subscriptions.push(
      this.router.events.subscribe(() => {
        this.updateViewState();
      })
    );
  }
  
  // Create a separate method to update the view state
  private updateViewState(): void {
    // Check if URL starts with /2d to determine if in 2D view
    this.is3DView = !this.router.url.startsWith('/2d');
    console.log('Updated view state. is3DView =', this.is3DView);
  }

  ngOnInit(): void {
    // Initialize user data from localStorage if exists
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      this.authService.updateUserState(JSON.parse(savedUser));
    }

    // Add global event listener to close dropdowns
    document.addEventListener('archaios:closeDropdowns', () => {
      this.closeAllDropdowns();
    });

    // Subscribe to user sites from the shared service
    this.subscriptions.push(
      this.dataService.userSites$.subscribe(sites => {
        this.userSites = sites.sort((a, b) => {
          // Handle potentially undefined lastUpdated values
          const dateA = a.lastUpdated ? new Date(a.lastUpdated) : new Date(0);
          const dateB = b.lastUpdated ? new Date(b.lastUpdated) : new Date(0);
          return dateB.getTime() - dateA.getTime();
        });
        
        this.recentUploads = [...this.userSites].slice(0, 2); // Show only top 2
        
        if (this.userSites.length > 0 && !this.currentSite) {
          this.currentSite = this.userSites[0];
        }
        
        this.isLoadingSites = false;
      })
    );
    
    // Subscribe to all sites to handle loading state
    this.subscriptions.push(
      this.dataService.sites$.subscribe(sites => {
        if (sites.length > 0) {
          this.isLoadingSites = false;
        }
      })
    );
  }
  
  ngOnDestroy(): void {
    // Clean up subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
    
    // Remove event listener
    document.removeEventListener('archaios:closeDropdowns', () => {
      this.closeAllDropdowns();
    });
  }

  // Add method to close all dropdowns
  closeAllDropdowns(): void {
    this.showSiteDropdown = false;
    this.showProfileMenu = false;
  }
  
  toggleSiteDropdown(event?: Event): void {
    // Stop propagation to prevent immediate closing due to document click
    if (event) {
      event.stopPropagation();
    }
    this.showSiteDropdown = !this.showSiteDropdown;
    
    // Close profile menu if open
    if (this.showSiteDropdown) {
      this.showProfileMenu = false;
    }
  }
  
  closeSiteDropdown(): void {
    this.showSiteDropdown = false;
  }
  
  // Modify selectSite to use this method
  selectSite(site: ArchaeologicalSite): void {
    console.log('Site selected:', site.name);
    this.currentSite = site;
    
    // Close dropdowns immediately
    this.closeAllDropdowns();
    
    // Make sure we know the current view state
    this.updateViewState();
    
    // Navigate after UI has updated
    setTimeout(() => {
      this.navigateToSite(site);
    }, 10);
  }
  
  navigateToSite(site: ArchaeologicalSite): void {
    console.log('Navigating to site:', site.name);
    console.log('Current URL:', this.router.url);
    console.log('Is 3D View:', this.is3DView);
    // Navigate to the site location in 3D or 2D view
    if (this.is3DView) {
      // If we're in 3D view, navigate to the site via the 3D service
      this.map3dService.flyTo(site.latitude, site.longitude);
    } else {
      // If we're already on the 2D page but with a different ID, use special navigation
      if (this.router.url.startsWith('/2d/')) {
        // We're already on a /2d/:id page, need to handle navigation differently
        const currentUrl = this.router.url;
        const newUrl = `/2d/${site.id}`;
        
        // If navigating to the same URL, force reload the component
        if (currentUrl === newUrl) {
          this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
            this.router.navigate(['/2d', site.id]);
          });
        } else {
          // Different URL, normal navigation
          this.router.navigate(['/2d', site.id]);
        }
      } else {
        // Standard navigation to 2D view with site ID
        this.router.navigate(['/2d', site.id]);
      }
    }
  }

  onSubmit(): void {
    const searchTerm = this.form.get('searcher')?.value;
    if (searchTerm) {
      this.searcherService
        .search(searchTerm)
        .subscribe((site) => {
          this.searcherService.searched.emit(site ?? undefined);
        });
    }
    this.isOpen = false;
  }

  openSearcher(): void {
    this.isOpen = true;
  }

  closeSearcher(): void {
    this.isOpen = false;
  }

  onProfileClick(event: Event): void {
    // Prevent immediate closing due to document click
    event.stopPropagation();
    
    this.showProfileMenu = !this.showProfileMenu;
    // Close site dropdown if open
    if (this.showProfileMenu) {
      this.showSiteDropdown = false;
    }
  }

  closeProfileMenu(): void {
    this.showProfileMenu = false;
  }

  onProfileMenuAction(action: string): void {
    switch(action) {
      case 'logout':
        this.authService.logout();
        this.closeProfileMenu();
        break;
      case 'profile':
        this.router.navigate(['/profile']);
        this.closeProfileMenu();
        break;
      // ...handle other menu actions...
    }
  }

  emitLidarMenu() {
    console.log('Emitting openLidarMenu event'); // Debug log
    this.openLidarMenu.emit();
  }

  toggleView() {
    this.is3DView = !this.is3DView;
    const route = this.is3DView ? '/' : '/2d';
    // Force navigation with skipLocationChange to ensure component is reloaded
    this.router.navigateByUrl(route, { skipLocationChange: false }).then(() => {
      // Update view state after navigation
      this.updateViewState();
    });
  }

  onAnalysisClick(): void {
    this.router.navigate(['/analysis']);
  }

  onNotificationsClick(): void {
    this.router.navigate(['/notifications']);
  }

  /**
 * Returns the appropriate icon class based on site properties 
 */
getSiteIconClass(site: ArchaeologicalSite): string {
  if (site.isKnownSite) {
    // Further differentiate known sites by type if available
    if (site.type) {
      const type = site.type.toLowerCase();
      if (type.includes('settlement') || type.includes('habitation')) {
        return 'settlement';
      }
      if (type.includes('ruin') || type.includes('structure')) {
        return 'ruin';
      }
      if (type.includes('artifact') || type.includes('object')) {
        return 'artifact';
      }
    }
    return 'ruin'; // Default for known sites
  }
  
  if (site.isPossibleArchaeologicalSite) {
    return 'potential';
  }
  
  return 'site'; // Default class
}
}
