import { Component, OnInit, ViewChild } from '@angular/core';
import { LeafletEvent } from 'leaflet';
import { ActivatedRoute, Router } from '@angular/router';
import { Connection } from 'src/app/maps/models/connection.model';
import { ArchaeologyLocationMap } from '../models/archaeology-location.model';

import { ArchaeologicalSitesService, BasicSiteInfo } from '../archaeological-map3d/archaeological-sites.service';
import { ArchaeologicalMapComponent } from './archaeological-map/archaeological-map.component';
import { ArchaeologicalSite } from '../models/archaeological-site.model';

@Component({
  selector: 'app-archaeological-map2d',
  templateUrl: './archaeological-map2d.component.html',
  styleUrls: ['./archaeological-map2d.component.scss'],
})
export class ArchaeologicalMap2dComponent implements OnInit {
  @ViewChild(ArchaeologicalMapComponent) map: ArchaeologicalMapComponent; // Reference the child component
  connections: Connection[];
  allLocations: ArchaeologyLocationMap[] = [];
  locations: ArchaeologyLocationMap[] = [];
  filteredLocations: ArchaeologyLocationMap[] = [];
  allSites: ArchaeologicalSite[] = [];
  showMap: boolean;
  showSideMenu = false;
  showLegend = true;
  selectedPlace: any;
  zoomLevelChangedDetect: any;
  zoomLevel: number;
  dragOver = false;
  selectedFilter: 'heritage' | 'archaios' | 'all' | 'myupload' | 'potential' = 'potential'; // Default
  idMarkerFrom3D: string;
  selectedSite: ArchaeologicalSite | null = null;
  showSitePopup: boolean = false;
  private routeSubscription: any;

  constructor(
    private activateRoute: ActivatedRoute,
    private router: Router,
    private archaeologicalSitesService: ArchaeologicalSitesService
  ) {}

  ngOnInit(): void {
    // Retrieve the last selected filter from localStorage
    const savedFilter = localStorage.getItem('archaios-map2d-filter');
    if (savedFilter && ['heritage', 'archaios', 'all', 'myupload', 'potential'].includes(savedFilter)) {
      this.selectedFilter = savedFilter as 'heritage' | 'archaios' | 'all' | 'myupload' | 'potential';
    }

    // Subscribe to route parameter changes instead of just reading once
    this.routeSubscription = this.activateRoute.paramMap.subscribe(params => {
      this.idMarkerFrom3D = params.get('id') || '';
      console.log('ID from route params:', this.idMarkerFrom3D);
      
      // If we already have site data, handle the new ID immediately
      if (this.allSites.length > 0 && this.idMarkerFrom3D) {
        this.handleSiteFromId(this.idMarkerFrom3D);
      }
      // Otherwise, data will be loaded in initViewAllMarkers
    });
  }

  ngAfterViewInit(): void {
    // Ensure the map instance is initialized after the view is loaded
    this.initViewAllMarkers();
  }

  ngOnDestroy(): void {
    if (this.zoomLevelChangedDetect) {
      this.zoomLevelChangedDetect.unsubscribe();
    }
    if (this.routeSubscription) {
      this.routeSubscription.unsubscribe();
    }
  }

  private initViewAllMarkers(restore = false): void {
    this.archaeologicalSitesService.getArchaeologicalSites().subscribe(({ sites, locations, connections }) => {
      this.allLocations = locations;
      this.connections = connections;
      this.allSites = sites; // These are now BasicSiteInfo objects
      console.log('All sites loaded:', this.allSites.length);
      
      // Apply the current filter instead of the default potential sites filter
      this.applyCurrentFilter();
      
      this.showMap = true;     
      if (restore && this.map) {
        this.map.restoreMap();
      }

      // Check if we need to display a specific site from the route
      if (this.idMarkerFrom3D) {
        this.handleSiteFromId(this.idMarkerFrom3D);
      }
    });
  }

  // Helper method to apply the current filter
  private applyCurrentFilter(): void {
    if (this.selectedFilter === 'heritage') {
      this.locations = this.allLocations.filter(site => site.isKnownSite);
    } else if (this.selectedFilter === 'archaios') {
      this.locations = this.allLocations.filter(site => !site.isKnownSite);
      if (this.map) {
        this.map.paintConnection(this.connections);
      }
    } else if (this.selectedFilter === 'myupload') {
      this.locations = this.allLocations.filter(site => site.isMyUpload);
      if (this.map) {
        this.map.paintConnection(this.connections);
      }
    } else if (this.selectedFilter === 'potential') {
      this.locations = this.allLocations.filter(site => site.isPossibleArchaeologicalSite);
      if (this.map) {
        this.map.paintConnection(this.connections);
      }
    } else { // 'all'
      this.locations = this.allLocations;
      if (this.map) {
        this.map.paintConnection(this.connections);
      }
    }
    
    // Update filteredLocations for consistency
    this.filteredLocations = this.locations;
  }

  // New method to handle site ID from route
  private handleSiteFromId(siteId: string): void {
    // Load detailed site information
    this.archaeologicalSitesService.getSiteDetails(siteId).subscribe(
      (siteDetails) => {
        console.log('Target site details loaded:', siteDetails);
        this.showSiteDetails(siteDetails);
        
        // Find the corresponding location to center map
        const targetLocation = this.allLocations.find(loc => loc.id === siteId);
        if (targetLocation) {
          this.selectSite(targetLocation);
        }
      },
      (error) => {
        console.error(`Error loading site details for ID ${siteId}:`, error);
      }
    );
  }

  // Update showSiteDetails method
  showSiteDetails(site: BasicSiteInfo | ArchaeologicalSite): void {
    console.log('Showing site details for:', site);
    
    // If we only have basic info, get full details
    if (!('components' in site)) {
      this.archaeologicalSitesService.getSiteDetails(site.id).subscribe(
        (fullSiteDetails) => {
          this.displaySitePopup(fullSiteDetails);
        },
        (error) => {
          console.error(`Error loading site details for ID ${site.id}:`, error);
        }
      );
    } else {
      // We already have full details
      this.displaySitePopup(site as ArchaeologicalSite);
    }
  }

  private displaySitePopup(site: ArchaeologicalSite): void {
    // Close any open dropdowns in the header
    this.closeSiteDropdowns();
    
    // Force closing and reopening if showing the same site again
    if (this.selectedSite?.id === site.id && this.showSitePopup) {
      this.showSitePopup = false;
      setTimeout(() => {
        this.selectedSite = site;
        this.showSitePopup = true;
      }, 50);
    } else {
      this.selectedSite = site;
      this.showSitePopup = true;
    }
  }

  // Method to ensure site dropdowns in the header are closed
  private closeSiteDropdowns(): void {
    // Close dropdowns in header by dispatching a custom event
    const closeEvent = new CustomEvent('archaios:closeDropdowns');
    document.dispatchEvent(closeEvent);
  }

  // Method to close site details
  closeSiteDetails(): void {
    console.log('Closing site details');
    this.selectedSite = null;
    this.showSitePopup = false;
  }

  toggleSideMenu() {
    this.showSideMenu = !this.showSideMenu;
  }

  toggleLegend() {
    this.showLegend = !this.showLegend;
  }

  emitLidarMenu() {
    // This method should trigger the LIDAR menu to open
  }

  selectSite(site: ArchaeologyLocationMap): void {
    setTimeout(() => {
      if (this.map) {
        try {
          const mapInstance = this.map.getMapInstance();
          if (mapInstance) {
            mapInstance.setView([site.position.lat, site.position.lng], 15);
          }
        } catch (error) {
          console.error('Error accessing map instance:', error);
        }
      } else {
        console.log('Map component not available');
      }
    }, 0);
  }

  onClickMarker(marker: LeafletEvent): void {
    console.log('Marker clicked:', marker);
    // Use the map instance's proper method to set the view
    const mapInstance = this.map.getMapInstance();
    console.log('Map instance:', mapInstance);
    // Fix the marker.latlng property access using type assertion
    const markerWithLatLng = marker as any;
    
    // Center the map on the marker
    if (markerWithLatLng.latlng) {
      mapInstance.setView([markerWithLatLng.latlng.lat, markerWithLatLng.latlng.lng], 15);
    } else if (marker.target && (marker.target as any).getLatLng) {
      // Alternative approach if marker.latlng doesn't exist
      const latLng = (marker.target as any).getLatLng();
      mapInstance.setView([latLng.lat, latLng.lng], 15);
    }
    
    // Get site details and display popup
    const targetSiteId = markerWithLatLng.target.customId;
    if (targetSiteId) {
      this.archaeologicalSitesService.getSiteDetails(targetSiteId).subscribe(
        (siteDetails) => {
          console.log('Loaded site details:', siteDetails);
          this.showSiteDetails(siteDetails);
        },
        (error) => {
          console.error(`Error loading site details for ID ${targetSiteId}:`, error);
        }
      );
    }
  }

  handleDragOver(event: DragEvent) {
    event.preventDefault();
    this.dragOver = true;
  }

  handleDragLeave() {
    this.dragOver = false;
  }
  filterSites(filter: 'heritage' | 'archaios' | 'all' | 'myupload' | 'potential'): void {
    this.selectedFilter = filter;
    
    // Save the selected filter to localStorage
    localStorage.setItem('archaios-map2d-filter', filter);
    
    if (this.map) {
      this.map.removeAllMarkers(); // Remove all markers and connections
    }

    // Apply the selected filter
    this.applyCurrentFilter();
    
    // Add a small delay to allow markers to be properly clustered after filtering
    setTimeout(() => {
      if (this.map) {
        // Force cluster recalculation
        this.map.centerMapBounds(false);
      }
    }, 100);
    
    this.showSideMenu = false;
  }
}
