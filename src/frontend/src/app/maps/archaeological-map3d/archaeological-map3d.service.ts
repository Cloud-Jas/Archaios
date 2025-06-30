import { MarkerColor } from '../enums/marker-color.enum';
import { DOCUMENT } from '@angular/common';
import {
  EventEmitter,
  Inject,
  Injectable,
  Renderer2,
  RendererFactory2,
} from '@angular/core';
import { Connection } from '../models/connection.model';
import { ArchaeologyLocationMap } from '../models/archaeology-location.model';
import { Router } from '@angular/router';
declare const Earth: any;

@Injectable({
  providedIn: 'root',
})
export class ArchaeologicalMap3dService {
  renderer: Renderer2;
  earth: any;
  earthClicked = new EventEmitter<void>();
  alreadyInit: any;
  private markers: any[] = []; // Store markers for management
  private clusterThreshold = 4; // Minimum markers to form a cluster
  private clusterRadiusKm = 500; // Radius in km for clustering
  private _currentLocations: ArchaeologyLocationMap[] = []; // Store current locations

  constructor(
    private readonly router: Router,
    private readonly rendererFactory: RendererFactory2,
    @Inject(DOCUMENT) private document: any
  ) {
    this.renderer = this.rendererFactory.createRenderer(null, null);
    const script = this.renderer.createElement('script');
    this.renderer.appendChild(this.document.body, script);
    script.src = '../assets/js/miniature.earth.core.js';
  }

  initMap3D(): void {
    this.earth = new Earth('myearth', {
      location: { lat: 20.5937, lng: 78.9629 },
      zoom: 0.7, // Start with a more zoomed-out view to show the globe
      mapLandColor: '#d9c7a3', // Matches dot-earth land color
      mapSeaColor: '#e8dfd0',  // Matches dot-earth background color
      mapBorderColor: '#bfa76a', // Archaeological theme border
      mapBorderWidth: 0.05,
      light: 'sun',
      transparent: true,
      zoomable: true,
      maxZoom: 20, // Increase maximum zoom level to allow closer zooming
      autoRotate: true,  // Enable auto-rotation initially
     autoRotateSpeed: 2,
      autoRotateDelay: 100,
      autoRotateStart: 2000,
    });

    // Add a listener to disable auto-rotation when the user interacts with the globe
    this.earth.addEventListener('click', () => {
      this.earth.autoRotate = false;
    });

    this.earth.addEventListener('dragstart', () => {
      this.earth.autoRotate = false;
    });

    // Add zoom event handling for cluster management
    this.earth.addEventListener('zoom', (event: { zoom: number }) => {
      this.handleZoomChange(event.zoom);
    });

    // Add click handler but don't require it for showing markers
    this.renderer.listen(this.earth, 'click', () => {
      this.earth.goTo(
        { lat: -1.61, lng: -56.21 },
        {
          zoom: 3,
          duration: 5000,
          easing: 'out-quad',
          complete: () => {
            // Emit click event for compatibility with existing code
            if (!this.alreadyInit) {
              this.earthClicked.emit();
            }
            this.alreadyInit = true;
          },
        }
      );
    });
  }

  reinitializeEarth(): void {
    // Define an interface for the position type
    interface EarthPosition {
      lat: number;
      lng: number;
      zoom: number;
    }

    // Store current position and zoom if earth exists
    let currentPosition: EarthPosition | null = null;
    if (this.earth) {
      try {
        currentPosition = {
          lat: this.earth.location ? this.earth.location.lat : 20.5937,
          lng: this.earth.location ? this.earth.location.lng : 78.9629,
          zoom: this.earth.zoom || 0.7
        };
      } catch (e) {
        console.log('Error saving earth position', e);
        // Use defaults if we can't get current position
        currentPosition = {
          lat: 20.5937,
          lng: 78.9629,
          zoom: 0.7
        };
      }
      
      // Properly clean up existing markers first
      this.cleanupEarthElements();
      
      // Destroy earth instance carefully
      try {
        this.earth.destroy();
      } catch (e) {
        console.log('Error destroying earth', e);
      }
    }
    
    // Wait a moment for DOM to stabilize
    setTimeout(() => {
      // Check if the earth container exists
      const earthContainer = document.getElementById('myearth');
      if (!earthContainer) {
        console.error('Earth container not found, cannot initialize Earth');
        return;
      }
      
      // Create a new Earth instance
      this.initMap3D();
      
      // Restore position and zoom if we had a previous state
      if (currentPosition && this.earth) {
        try {
          setTimeout(() => {
            // Add a non-null assertion since we already checked above that currentPosition is not null
            this.earth.goTo(
              { lat: currentPosition!.lat, lng: currentPosition!.lng },
              { zoom: currentPosition!.zoom, duration: 0 }
            );
          }, 100);
        } catch (e) {
          console.log('Error restoring earth position', e);
        }
      }
    }, 50);
  }

  /**
   * Find and remove any Earth.js elements that might be lingering in the DOM
   * This helps prevent old markers from appearing on top of new ones
   */
  private cleanupEarthElements(): void {
    // Find the earth container
    const earthContainer = document.getElementById('myearth');
    if (earthContainer) {
      // Don't remove the container itself, just clear its contents
      // while preserving the main canvas that Earth.js needs
      
      // Carefully remove only overlays, markers, and lines
      const overlays = earthContainer.querySelectorAll('.earth-overlay');
      overlays.forEach(overlay => overlay.parentNode?.removeChild(overlay));
      
      const images = earthContainer.querySelectorAll('.earth-image');
      images.forEach(image => image.parentNode?.removeChild(image));
      
      const lines = earthContainer.querySelectorAll('.earth-line');
      lines.forEach(line => line.parentNode?.removeChild(line));
      
      // Don't clear or remove canvas elements - Earth.js needs them
      // Just ensure the Earth.js instance is properly destroyed
    }
    
    // Clear the markers array as well to ensure complete cleanup
    this.markers = [];
  }

  /**
   * Remove all markers and connections from the map
   * This ensures a complete reset when changing filters
   */
  removeAllMarkersAndConnections(): void {
    try {
      // Destroy each marker through the Earth.js API first
      if (this.markers && this.markers.length > 0) {
        // Create a copy of the array to avoid modification during iteration
        const markersCopy = [...this.markers];
        
        markersCopy.forEach(marker => {
          if (marker && typeof marker.remove === 'function') {
            try {
              marker.remove();
            } catch (e) {
              console.error('Error removing marker:', e);
            }
          }
        });
      }
      
      // Then clean up any remaining DOM elements
      this.cleanupEarthElements();
      
      // Reset current locations
      this._currentLocations = [];
      
      // Handle connections carefully - only if earth instance is valid
      if (this.earth && this.earth.getObjects) {
        try {
          // Get all Earth objects and destroy connections/lines
          const allEarthObjects = this.earth.getObjects();
          if (allEarthObjects && Array.isArray(allEarthObjects)) {
            allEarthObjects.forEach((obj: any) => {
              // Destroy all Earth objects of any type to ensure complete cleanup
              if (obj && typeof obj.destroy === 'function') {
                try {
                  obj.destroy();
                } catch (e) {
                  console.error('Error destroying Earth object:', e);
                }
              }
            });
          }
        } catch (e) {
          console.log('Error cleaning up Earth objects:', e);
        }
      }
    } catch (e) {
      console.error('Error in removeAllMarkersAndConnections:', e);
    }
  }

  removeMarkers(): void {
    // Create a copy of the markers array to avoid modification during iteration
    const markersCopy = [...this.markers];
    
    markersCopy.forEach(marker => {
      try {
        if (marker && typeof marker.destroy === 'function') {
          marker.destroy(); // Use the destroy method provided by the marker object
        }
      } catch (error) {
        console.error('Error destroying marker:', error);
      }
    });
    
    this.markers = []; // Clear the markers array
    
    // Also clean up any remaining DOM elements that might not have been properly destroyed
    this.cleanupEarthElements();
  }

  // Handle individual marker
  private addSingleMarker(location: ArchaeologyLocationMap): void {
    if (!this.earth || !this.earth.addImage) {
      console.error('Earth instance not properly initialized');
      return;
    }

    try {
      const marker = this.earth.addImage({
        location: { lat: location.position.lat, lng: location.position.lng },
        image: location.color,
        scale: 0.5,
        offset: location.isKnownSite ? 0.05 : 0,
        hotspot: true,
      });

      // Only set up interaction if marker was successfully created
      if (marker) {
        this.setupMarkerInteraction(marker, location);
        this.markers.push(marker);
      }
    } catch (error) {
      console.error('Error adding marker to Earth:', error);
    }
  }

  addMarkers(locations: ArchaeologyLocationMap[]): void {
    // First make sure the Earth instance is ready and properly initialized
    if (!this.earth || !this.earth.addImage) {
      console.error('Earth instance not available for adding markers');
      // Initialize Earth if needed
      setTimeout(() => {
        this.initMap3D();
        setTimeout(() => {
          this.addMarkers(locations); // Retry after initialization
        }, 500);
      }, 100);
      return;
    }
    
    // Ensure we've fully cleaned up any previous markers
    this.removeAllMarkersAndConnections();
    
    // Store locations for future reference
    this._currentLocations = [...locations];
    
    // Use clustering based on current zoom level - lower threshold to 1.8 to break clusters sooner
    const currentZoom = this.earth ? this.earth.zoom : 0.7;
    if (currentZoom < 1.8) { // Decreased threshold from 2.5 to 1.8 to break clusters sooner
      this.addClusteredMarkers(locations);
    } else {
      this.addIndividualMarkers(locations);
    }
  }
  
  private addIndividualMarkers(locations: ArchaeologyLocationMap[]): void {
    // Group markers by location to detect overlaps
    const locationGroups = this.groupNearbyLocations(locations, 0.005); // Small radius for very close markers
    
    // Process each group of markers
    Object.values(locationGroups).forEach(group => {
      // If it's a single marker, add it normally
      if (group.length === 1) {
        this.addSingleMarker(group[0]);
      } else {
        // If multiple markers at same/nearby location, add with offsets
        this.addClusteredMarkers(group);
      }
    });
  }
  
  private addClusteredMarkers(locations: ArchaeologyLocationMap[]): void {
    // For 3D globe clustering, we want larger clusters based on geographical proximity
    const clusterGroups = this.createClusterGroups(locations);
    
    Object.values(clusterGroups).forEach(group => {
      if (group.length === 1) {
        // Single marker, no clustering needed
        this.addSingleMarker(group[0]);
      } else if (group.length < this.clusterThreshold) {
        // Small group, spread them out slightly
        this.addSmallGroup(group);
      } else {
        // Large enough group to warrant a cluster
        this.addCluster(group);
      }
    });
  }
  
  // Create geographical cluster groups based on proximity
  private createClusterGroups(locations: ArchaeologyLocationMap[]): { [key: string]: ArchaeologyLocationMap[] } {
    const clusters: { [key: string]: ArchaeologyLocationMap[] } = {};
    const assigned = new Set<string>();
    
    // First pass: create initial clusters
    locations.forEach((location, idx) => {
      if (assigned.has(location.id)) return;
      
      const clusterId = `cluster_${Object.keys(clusters).length}`;
      clusters[clusterId] = [location];
      assigned.add(location.id);
      
      // Find nearby locations for this cluster
      locations.forEach((otherLoc, otherIdx) => {
        if (idx === otherIdx || assigned.has(otherLoc.id)) return;
        
        const distance = this.calculateDistance(
          location.position.lat, location.position.lng,
          otherLoc.position.lat, otherLoc.position.lng
        );
        
        if (distance <= this.clusterRadiusKm) {
          clusters[clusterId].push(otherLoc);
          assigned.add(otherLoc.id);
        }
      });
    });
    
    return clusters;
  }
  
  // Handle a small group (less than threshold) with slight offsets
  private addSmallGroup(locations: ArchaeologyLocationMap[]): void {
    // Calculate the base position as the average of all markers in the group
    const basePosition = this.calculateAveragePosition(locations);
    
    // Place markers in a circular pattern around the base position
    const radius = 0.01; // Small radius for offset
    const angleStep = (2 * Math.PI) / locations.length;
    
    locations.forEach((location, index) => {
      // Calculate offset position in circular pattern
      const angle = angleStep * index;
      const offsetLat = basePosition.lat + radius * Math.cos(angle);
      const offsetLng = basePosition.lng + radius * Math.sin(angle);
      
      // Create marker with calculated offset
      const marker = this.earth.addImage({
        location: { lat: offsetLat, lng: offsetLng },
        image: location.color,
        scale: 0.5,
        offset: location.isKnownSite ? 0.05 : 0,
        hotspot: true,
      });
      
      this.setupMarkerInteraction(marker, location);
      this.markers.push(marker);
    });
  }
  
  // Handle a proper cluster with a special cluster marker
  private addCluster(locations: ArchaeologyLocationMap[]): void {
    const basePosition = this.calculateAveragePosition(locations);
    const clusterType = this.determineClusterType(locations);
    
    // Create a special cluster marker
    const clusterMarker = this.earth.addOverlay({
      location: { lat: basePosition.lat, lng: basePosition.lng },
      content: this.createClusterHtml(locations.length, clusterType),
      className: 'archaeological-cluster-marker',
      depthScale: 0.5,
      hotspot: true
    });
    
    // Set up cluster interaction
    clusterMarker.addEventListener('click', () => {
      // When clicked, zoom in to this area at a higher zoom level
      this.earth.goTo(
        { lat: basePosition.lat, lng: basePosition.lng },
        {
          zoom: 4.0, // Increased zoom level from 3.0 to 4.0 for even higher detail
          duration: 1500,
          easing: 'out-quad',
          complete: () => {
            // After zooming, break apart the cluster by forcing a refresh
            setTimeout(() => {
              this.cleanupEarthElements();
              this.addIndividualMarkers(locations); // Add individual markers for this specific cluster
            }, 200);
          },
        }
      );
    });
    
    // Add pulse animation to cluster
    clusterMarker.animate('scale', 0.1, {
      loop: true,
      oscillate: true,
      duration: 2000,
      easing: 'in-out-quad',
    });
    
    this.markers.push(clusterMarker);
  }
  
  // Create HTML for cluster marker
  private createClusterHtml(count: number, type: 'heritage' | 'archaios' | 'potential'): string {
    let backgroundColor, borderColor, textColor;
    
    switch(type) {
      case 'heritage':
        backgroundColor = 'rgba(75, 181, 67, 0.8)';
        borderColor = '#4bb543';
        textColor = '#fff';
        break;
      case 'potential':
        backgroundColor = 'rgba(255, 166, 0, 0.8)';
        borderColor = '#ffa600';
        textColor = '#fff';
        break;
      default: // archaios
        backgroundColor = 'rgba(191, 167, 106, 0.8)';
        borderColor = '#bfa76a';
        textColor = '#fff';
    }
    
    return `<div style="
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background-color: ${backgroundColor};
      color: ${textColor};
      border: 2px solid ${borderColor};
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      box-shadow: 0 0 10px rgba(0,0,0,0.3);
      font-family: 'Georgia', serif;
    ">${count}</div>`;
  }
  
  // Determine the dominant type in a cluster
  private determineClusterType(locations: ArchaeologyLocationMap[]): 'heritage' | 'archaios' | 'potential' {
    let heritageSites = 0;
    let archaiosSites = 0;
    let potentialSites = 0;
    
    locations.forEach(loc => {
      if (loc.isKnownSite) {
        heritageSites++;
      } else if (loc.isPossibleArchaeologicalSite) {
        potentialSites++;
      } else {
        archaiosSites++;
      }
    });
    
    if (heritageSites >= archaiosSites && heritageSites >= potentialSites) {
      return 'heritage';
    } else if (potentialSites >= heritageSites && potentialSites >= archaiosSites) {
      return 'potential';
    } else {
      return 'archaios';
    }
  }
  
  private setupMarkerInteraction(marker: any, location: ArchaeologyLocationMap): void {
    marker.addEventListener('click', () => {
      this.earth.goTo(
        { lat: location.position.lat, lng: location.position.lng },
        {
          zoom: 10,
          duration: 2000,
          easing: 'out-quad',
          complete: () => {
            this.router.navigate(['/2d/' + location.id]);
          },
        }
      );
    });

    if (location.isPossibleArchaeologicalSite) {
      marker.animate('scale', 0.25, {
        loop: true,
        oscillate: true,
        duration: 2000,
        easing: 'in-out-quad',
      });
      marker.animate('opacity', 0.25, {
        loop: true,
        oscillate: true,
        duration: 2000,
        easing: 'in-out-quad',
      });
    }
  }
  
  private groupNearbyLocations(locations: ArchaeologyLocationMap[], proximityThreshold: number): { [key: string]: ArchaeologyLocationMap[] } {
    const groups: { [key: string]: ArchaeologyLocationMap[] } = {};
    
    // Process each location
    locations.forEach(location => {
      // Find if this location belongs to an existing group
      let foundGroup = false;
      
      Object.values(groups).forEach(group => {
        // Check against the first marker in the group
        if (this.calculateDistance(
          location.position.lat, location.position.lng,
          group[0].position.lat, group[0].position.lng
        ) <= proximityThreshold) {
          group.push(location);
          foundGroup = true;
        }
      });
      
      // If no matching group, create a new one
      if (!foundGroup) {
        const groupId = `group_${Object.keys(groups).length}`;
        groups[groupId] = [location];
      }
    });
    
    return groups;
  }
  
  // Handle zoom level changes to manage clustering
  private handleZoomChange(newZoom: number): void {
    // If we cross the threshold between clustered and individual views, refresh markers
    const wasClustered = this.earth && this.earth.prevZoom ? this.earth.prevZoom < 1.8 : true; // Lower threshold from 2.5 to 1.8
    const isClustered = newZoom < 1.8; // Lower threshold from 2.5 to 1.8
    
    if (wasClustered !== isClustered && this.markers.length > 0) {
      // Store current locations
      const currentLocations = this.getCurrentLocations();
      if (currentLocations.length > 0) {
        // Remove existing markers
        this.cleanupEarthElements();
        // Re-add them in the appropriate mode
        if (isClustered) {
          this.addClusteredMarkers(currentLocations);
        } else {
          this.addIndividualMarkers(currentLocations);
        }
      }
    }
    
    // Store the current zoom for future comparison
    if (this.earth) {
      this.earth.prevZoom = newZoom;
    }
  }
  
  // Helper to get current marker locations
  private getCurrentLocations(): ArchaeologyLocationMap[] {
    // This should be implemented to return the current set of locations
    // As a fallback, we could store this separately when markers are first added
    return this._currentLocations; // Return the stored current locations
  }
  
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    // Haversine formula to calculate distance between two points
    const R = 6371; // Earth radius in km
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * 
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
      
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  }
  
  private toRadians(degrees: number): number {
    return degrees * Math.PI / 180;
  }
  
  private calculateAveragePosition(locations: ArchaeologyLocationMap[]): {lat: number, lng: number} {
    const sumLat = locations.reduce((sum, loc) => sum + loc.position.lat, 0);
    const sumLng = locations.reduce((sum, loc) => sum + loc.position.lng, 0);
    
    return {
      lat: sumLat / locations.length,
      lng: sumLng / locations.length
    };
  }

  showLines(connections: Connection[]): void {
    const line: any = {
      color: '#006767',
      opacity: 0.35,
      offset: 0,
      width: 0.15,
      alwaysBehind: false,
      offsetFlow: 0.5,
      transparent: false,
      clip: 0,
    };
    for (let connection of connections) {
      line.locations = [
        { lat: connection.startPoint.lat, lng: connection.startPoint.lng },
        { lat: connection.endPoint.lat, lng: connection.endPoint.lng },
      ];
      const t = this.earth.addLine(line);
      t.animate('clip', 1, { loop: false, oscillate: false, duration: 2000 });
    }
  }

  /**
   * Fly to a specific location with custom zoom and animation parameters
   * @param lat Latitude to fly to
   * @param lng Longitude to fly to
   * @param options Optional parameters for the animation
   */
  flyTo(lat: number, lng: number, options?: { zoom?: number, duration?: number }): void {
    const zoom = options?.zoom || 10;
    const duration = options?.duration || 2000;
    
    this.earth.goTo(
      {
        lat,
        lng
      },
      {
        zoom: zoom,
        duration: duration,
        easing: 'out-quad',
      }
    );
  }

  /**
   * Reset the view to show the whole Earth
   */
  resetView(): void {
    this.earth.goTo(
      { lat: 20, lng: 0 },
      {
        zoom: 0.5,
        duration: 1500,
        easing: 'out-quad'
      }
    );
  }
}