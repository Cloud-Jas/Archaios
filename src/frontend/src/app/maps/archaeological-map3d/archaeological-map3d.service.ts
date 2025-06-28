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
    if (this.earth) {
      this.earth.destroy();
    }
    this.initMap3D();
  }

  addMarkers(locations: ArchaeologyLocationMap[]): void {
    this.reinitializeEarth(); // Reinitialize Earth to clear existing markers
    
    // Group markers by location to detect overlaps
    const locationGroups = this.groupNearbyLocations(locations);

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
  
  private addSingleMarker(location: ArchaeologyLocationMap): void {
    const marker = this.earth.addImage({
      location: { lat: location.position.lat, lng: location.position.lng },
      image: location.color,
      scale: 0.5,
      offset: location.isKnownSite ? 0.05 : 0,
      hotspot: true,
    });

    this.setupMarkerInteraction(marker, location);
    this.markers.push(marker);
  }
  
  private addClusteredMarkers(locations: ArchaeologyLocationMap[]): void {
    // Calculate the base position as the average of all markers in the group
    const basePosition = this.calculateAveragePosition(locations);
    
    // Place markers in a circular pattern around the base position
    const radius = 0.01; // Small radius for offset (adjust as needed)
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
  
  private groupNearbyLocations(locations: ArchaeologyLocationMap[]): { [key: string]: ArchaeologyLocationMap[] } {
    const proximityThreshold = 0.005; // Threshold for grouping nearby markers (about 500m)
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

  removeMarkers(): void {
    this.markers.forEach(marker => {
      if (marker && marker.destroy) {
        marker.destroy(); // Use the destroy method provided by the marker object
      }
    });
    this.markers = []; // Clear the markers array
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