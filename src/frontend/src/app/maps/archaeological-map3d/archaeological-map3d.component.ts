import { SearcherService } from './../../core/services/searcher.service';
import { Connection } from 'src/app/maps/models/connection.model';
import { ArchaeologicalSitesService } from './archaeological-sites.service';
import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  Input,
  OnInit,
  ViewChild,
} from '@angular/core';
import { ArchaeologyLocationMap } from  '../models/archaeology-location.model';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { ArchaeologicalMap3dService } from './archaeological-map3d.service';

@Component({
  selector: 'archaios-map3d',
  templateUrl: './archaeological-map3d.component.html',
  styleUrls: ['./archaeological-map3d.component.scss'],
})
export class ArchaeologicalMap3dComponent implements OnInit, AfterViewInit {
  locations: ArchaeologyLocationMap[];
  connections: Connection[];
  filteredLocations: ArchaeologyLocationMap[]; // For filtered sites
  filteredConnections: Connection[] = []; // For filtered connections
  unsubscribe = new Subject<void>();
  mapInitialized = false;
  isLoading = true;
  showSideMenu = false; // For toggling the side menu
  selectedFilter: 'heritage' | 'archaios' | 'all' | 'myupload' | 'potential' = 'potential'; // Changed default to potential
  siteCounts = { heritage: 0, archaios: 0, potential: 0 }; // Add this property

  constructor(
    private readonly archaeologicalMap3dService: ArchaeologicalMap3dService,
    private readonly archaeologicalSitesService: ArchaeologicalSitesService,
    private readonly searcherService: SearcherService
  ) {}

  ngOnInit(): void {
    this.isLoading = true;
  }

  ngOnDestroy(): void {
    this.unsubscribe.next();
    this.unsubscribe.complete();
  }

  ngAfterViewInit(): void {
    this.archaeologicalSitesService
      .getArchaeologicalSites()
      .subscribe(({ locations, connections }) => {
        this.locations = locations;
        this.connections = connections;

        // Apply default filter (Potential sites)
        this.filteredLocations = this.locations.filter(site => site.isPossibleArchaeologicalSite);
        this.filteredConnections = this.connections.filter(connection => {
          return this.filteredLocations.some(site => site.id === connection.fromSiteId || site.id === connection.toSiteId);
        });
        this.archaeologicalMap3dService.initMap3D();
        this.archaeologicalMap3dService.addMarkers(this.filteredLocations);

        setTimeout(() => {
          this.archaeologicalMap3dService.showLines(this.filteredConnections);
          this.mapInitialized = true;
          this.isLoading = false;
        }, 100);
      });

    this.archaeologicalSitesService.siteCounts$.subscribe(counts => {
      this.siteCounts = counts; // Update site counts
      // Emit or pass these counts to the footer component as needed
    });

    this.searcherService.searched.subscribe((site) => {
      if (site) {
        this.archaeologicalMap3dService.flyTo(site.latitude, site.longitude);
      }
    });
  }

  toggleSideMenu(): void {
    this.showSideMenu = !this.showSideMenu;
  }

  filterSites(filter: 'heritage' | 'archaios' | 'all' | 'myupload' | 'potential'): void {
    this.selectedFilter = filter;

    if (filter === 'heritage') {
      this.filteredLocations = this.locations.filter(site => site.isKnownSite);
    } else if (filter === 'archaios') {
      this.filteredLocations = this.locations.filter(site => !site.isKnownSite);
    } else if (filter === 'myupload') {
      this.filteredLocations = this.locations.filter(site => site.isMyUpload);
      this.filteredConnections = this.connections.filter(connection => {
        return this.filteredLocations.some(site => site.id === connection.fromSiteId || site.id === connection.toSiteId);
      });
    } else if (filter === 'potential') {
      this.filteredLocations = this.locations.filter(site => site.isPossibleArchaeologicalSite);
      this.filteredConnections = this.connections.filter(connection => {
        return this.filteredLocations.some(site => site.id === connection.fromSiteId || site.id === connection.toSiteId);
      });
    } else {
      this.filteredLocations = this.locations;
      this.filteredConnections = this.connections;
    }

    
    this.archaeologicalMap3dService.addMarkers(this.filteredLocations);
    if (filter === 'all' || filter === 'archaios' || filter === 'myupload' || filter === 'potential') {
      this.archaeologicalMap3dService.showLines(this.filteredConnections);
    }
    setTimeout(() => {
      this.showSideMenu = false; // Close the side menu after filtering
    }, 100);
  }

  // Add a method to handle site selection
  selectSite(site: ArchaeologyLocationMap): void {
    // First fly to the site location
    this.archaeologicalMap3dService.flyTo(site.position.lat, site.position.lng);
    
    // Then load detailed site information
    this.archaeologicalSitesService.getSiteDetails(site.id).subscribe(
      (siteDetails) => {
        console.log('Loaded site details:', siteDetails);
        // Handle site details (could emit event or update UI)
      },
      (error) => {
        console.error(`Error loading site details for ID ${site.id}:`, error);
      }
    );
  }
}