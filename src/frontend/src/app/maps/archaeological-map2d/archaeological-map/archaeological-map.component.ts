import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnInit,
  Output,
  Renderer2,
} from '@angular/core';
import * as L from 'leaflet';
import {
  icon,
  LatLng,
  latLng,
  LatLngExpression,
  Map,
  tileLayer,
  Marker,
} from 'leaflet';
import { MarkerColor } from '../../enums';
import { Connection } from '../../models/connection.model';
import { Coordinates } from '../../models/coordinates.model';
import { CustomMarker } from '../../models/customMarker';
import { ArchaeologyLocationMap } from '../../models/archaeology-location.model';
import { BehaviorSubject } from 'rxjs';
import { SearcherService } from '../../../core/services/searcher.service';
import { ArchaeologicalSiteType } from '../../enums/archaeological-site-type.enum';
import { ArchaeologicalStatus } from '../../enums/archaeological-status.enum';
import { environment } from '../../../../environments/environment';
import { UtilMapService } from '../../map2d/map/util-map.service';
import 'leaflet.markercluster';

@Component({
  selector: 'archaios-map',
  templateUrl: './archaeological-map.component.html',
  styleUrls: ['./archaeological-map.component.scss'],
})
export class ArchaeologicalMapComponent implements OnInit {
  connectionsLayers: L.Polyline[] = [];
  markerSelected: any;

  _connections: Connection[];
  tooltipLine: any;
  tooltip: any;
  tooltipName: any;
  clickedOnMarker: boolean;
  borderSelected: any;
  containerParent: any;
  idMarker: string;
  isNecesaryAddOpacity: boolean;
  isNecesaryCenterBounds: boolean;
  
  // Add markerClusterGroup property to manage the clusters
  private markerClusterGroup: L.MarkerClusterGroup;

  get connections(): Connection[] {
    return this._connections;
  }
  @Input() set connections(value: Connection[]) {
    this._connections = value;
    if (value && this.map) {
      this.paintConnection(value);
    }
  }

  _places: ArchaeologyLocationMap[];
  get places(): ArchaeologyLocationMap[] {
    return this._places;
  }

  @Input() set places(value: ArchaeologyLocationMap[]) {
    this._places = value;
    if (value && this.map) {
      this.paintMarkers(value);
    }
  }

  @Output() markerClick = new EventEmitter<any>();
  map: Map;
  mapOptions: any;
  initialMap: {
    markers: CustomMarker[];
    connections: L.Polyline[];
    idMarkerSelected: string;
    layers: any[];
  } = { markers: [], idMarkerSelected: '', connections: [], layers: [] };

  // Method to get the map instance
  getMapInstance(): Map {
    return this.map;
  }

  constructor(
    private searcherService: SearcherService,
    private zone: NgZone,
    private renderer: Renderer2,
    private elem: ElementRef,
    private utilMapCommuService: UtilMapService
  ) {
    this.initializeMap();
  }

  createTooltipElement(): void {
    this.tooltip = this.renderer.createElement('div');
    this.tooltipLine = this.renderer.createElement('img');
    this.tooltipName = this.renderer.createElement('span');
    this.renderer.setAttribute(this.tooltip, 'id', 'tooltip-id');
    this.renderer.setAttribute(
      this.tooltipLine,
      'src',
      'assets/images/map/border_city.svg'
    );
    this.renderer.addClass(this.tooltip, 'custom-tooltip-map-name-border-dos');
    this.renderer.addClass(this.tooltipName, 'custom-tooltip-map-name-city');
    this.renderer.appendChild(this.tooltip, this.tooltipLine);
    this.renderer.appendChild(this.tooltip, this.tooltipName);
  }

  ngOnInit(): void {
    this.createTooltipElement();
    this.borderSelected = this.renderer.createElement('img');

    this.renderer.setAttribute(
      this.borderSelected,
      'src',
      'assets/images/map/border_problem.svg'
    );

    this.renderer.addClass(
      this.borderSelected,
      'custom-detail-modal-marker-border'
    );
  }

  onMapReady(map: any): void {
    this.map = map;
    
    // Initialize the marker cluster group
    this.markerClusterGroup = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 40,
      disableClusteringAtZoom: 10, // Disable clustering at high zoom levels
      spiderfyOnMaxZoom: true,
      iconCreateFunction: this.createClusterIcon.bind(this)
    });
    
    this.map.addLayer(this.markerClusterGroup);
    
    this.paintMarkers(this.places);
    this.paintConnection(this.connections);
    
    this.map.on('zoomend', (e) => {
      const zoomLevel = this.map.getZoom();
      
      if (this.clickedOnMarker) {
        this.addBorderSelected();
      } else {
        this.removeTooltip();
        this.removeAllBorderSelected();
        
        if (zoomLevel < 5) {
          this.markerSelected = null;
          this.idMarker = '';
        }
        this.utilMapCommuService.zoomLevelSubject.next(zoomLevel < 5 ? 1 : 2);
      }
      this.clickedOnMarker = false;
    });

    this.searcherService.searched.subscribe((site) => {
      if(site && site.latitude && site.longitude) {
        this.map.flyTo(latLng(site.latitude, site.longitude), 8);
      }
    });
  }
  
  // Custom cluster icon creator
  private createClusterIcon(cluster: any): L.DivIcon {
    const markers = cluster.getAllChildMarkers();
    
    // Determine the dominant marker type in this cluster
    let heritageSites = 0;
    let archaiosSites = 0;
    let potentialSites = 0;
    
    markers.forEach((marker: any) => {
      if (marker.isKnownSite) {
        heritageSites++;
      } else if (marker.isPossibleArchaeologicalSite) {
        potentialSites++;
      } else {
        archaiosSites++;
      }
    });
    
    // Determine the dominant class
    let dominantClass = 'archaeological-cluster';
    if (heritageSites >= archaiosSites && heritageSites >= potentialSites) {
      dominantClass += ' heritage-dominant';
    } else if (potentialSites >= heritageSites && potentialSites >= archaiosSites) {
      dominantClass += ' potential-dominant';
    } else {
      dominantClass += ' archaios-dominant';
    }
    
    // Create SVG marker with count
    const count = cluster.getChildCount();
    
    return L.divIcon({
      html: `<div class="cluster-marker"><span>${count}</span></div>`,
      className: dominantClass,
      iconSize: L.point(40, 40)
    });
  }

  private groupNearbyLocations(locations: ArchaeologyLocationMap[], proximityThreshold: number): { [key: string]: ArchaeologyLocationMap[] } {
    const groups: { [key: string]: ArchaeologyLocationMap[] } = {};
    
    // Process each location
    locations.forEach(location => {
      // Find if this location belongs to an existing group
      let foundGroup = false;
      
      Object.entries(groups).forEach(([groupId, group]) => {
        // Check against the first marker in the group
        if (this.calculateDistance(
          location.position.lat, location.position.lng,
          group[0].position.lat, group[0].position.lng
        ) <= proximityThreshold) {
          group.push(location);
          foundGroup = true;
          return;
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

  paintMarkers(places: ArchaeologyLocationMap[]) {
    // Clear existing markers first
    if (this.markerClusterGroup) {
      this.markerClusterGroup.clearLayers();
    }
    
    this.initialMap.markers = [];
    
    // Process each place and add it to the cluster group
    if (places && places.length) {
      // First, group very close locations to handle overlaps
      const locationGroups = this.groupNearbyLocations(places, 0.0005); // Very small threshold for exact overlaps
      
      // Process each group
      Object.values(locationGroups).forEach(group => {
        if (group.length === 1) {
          // Single marker - add normally
          const marker = this.createMarker(
            group[0].name,
            group[0].id,
            group[0].type,
            new LatLng(group[0].position.lat, group[0].position.lng),
            group[0].color,
            group[0]
          );
          
          this.initialMap.markers.push(marker);
          this.markerClusterGroup.addLayer(marker);
        } else {
          // Multiple markers at same/similar position - spread them out slightly
          this.addOffsetMarkers(group);
        }
      });
    }
  }
  
  // Add a new method to handle multiple markers at the same position
  private addOffsetMarkers(locations: ArchaeologyLocationMap[]): void {
    // Calculate base position (center point)
    const basePosition = {
      lat: locations.reduce((sum, loc) => sum + loc.position.lat, 0) / locations.length,
      lng: locations.reduce((sum, loc) => sum + loc.position.lng, 0) / locations.length
    };
    
    // Calculate offsets in a circle around the base position
    const radius = 0.0002 + (locations.length * 0.0001); // Dynamic radius based on marker count
    const angleStep = (2 * Math.PI) / locations.length;
    
    locations.forEach((location, index) => {
      // Calculate offset position in circular pattern
      const angle = angleStep * index;
      const offsetLat = basePosition.lat + radius * Math.cos(angle);
      const offsetLng = basePosition.lng + radius * Math.sin(angle);
      
      // Create marker with offset position
      const marker = this.createMarker(
        location.name,
        location.id,
        location.type,
        new LatLng(offsetLat, offsetLng),
        location.color,
        location
      );
      
      this.initialMap.markers.push(marker);
      this.markerClusterGroup.addLayer(marker);
    });
  }
  
  // Helper method to calculate distance between two points
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    // Haversine formula to calculate distance between two points
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
      
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  }

  private createMarker(
    name: string,
    id: string | number,
    type: string,
    point: LatLng,
    iconType: string,
    siteData?: ArchaeologyLocationMap
  ): CustomMarker {
    const marker = L.marker(point)
      .setIcon(
        L.icon({
          iconSize: [40, 40],
          iconAnchor: [20, 40],
          iconUrl: iconType,
        })
      )
      .on('mouseout', (ev) => {
        if (this.markerSelected?.target) return;
        this.removeTooltip();
        this.removeOpacity();
      })
      .on('mouseover', (ev: any) => {
        if (this.markerSelected?.target) return;
        if (!this.containerParent)
          this.containerParent = ev.originalEvent.target.parentElement;
        
        this.addOpacity();
      })
      .on('click', (marker: any) => {
        this.clickedOnMarker = true;
        this.idMarker = id.toString();
        this.containerParent = marker.originalEvent?.target.parentElement || 
                              marker.target._icon.parentElement;
        this.clickMarker(marker);
      }) as CustomMarker;

    marker.customId = id.toString();
    marker.name = name;
    marker.type = type;
    
    // Add archaeology-specific data to marker
    if (siteData) {
      marker.isKnownSite = siteData.isKnownSite;
      marker.isPossibleArchaeologicalSite = siteData.isPossibleArchaeologicalSite;
      marker.period = siteData.period;
      marker.siteType = siteData.siteType;
      
      // Add archaeological tooltip with themed display
      this.bindArchaeologicalTooltip(marker, siteData);
    }
    
    // Add custom CSS class for archaeological markers for styling
    const icon = marker.getIcon();
    const oldIconOptions = { ...icon.options, className: this.getMarkerStatusClass(siteData) };
    // Ensure iconUrl is always a string
    if (!oldIconOptions.iconUrl) {
      oldIconOptions.iconUrl = iconType as string;
    }
    marker.setIcon(L.icon(oldIconOptions as L.IconOptions));
    
    return marker;
  }

  removeAllBorderSelected(): void {
    try {
      this.renderer.removeChild(this.containerParent, this.borderSelected);
      this.markerSelected = null;
      this.idMarker = '';
    } catch {
      return;
    }
  }

  removeAllMarkers(): void {
    // Clear marker cluster group first
    if (this.markerClusterGroup) {
      this.markerClusterGroup.clearLayers();
    }
    
    // Remove individual markers that might not be in clusters
    for (const marker of this.initialMap.markers) {
      if (this.map.hasLayer(marker)) {
        this.map.removeLayer(marker);
      }
    }
    this.initialMap.markers = [];

    // Remove all connection lines
    for (const connection of this.initialMap.connections) {
      if (this.map && connection && this.map.hasLayer(connection)) {
        this.map.removeLayer(connection);
      }
    }
    this.initialMap.connections = [];
    
    // Reset selection state
    this.markerSelected = null;
    this.idMarker = '';
  }

  centerMapBounds(removeSelected: boolean = true): void {
    if(removeSelected) this.removeAllBorderSelected();
    
    // Fix bounds calculation by using the marker cluster group if it has markers
    let boundsGroup;
    if (this.markerClusterGroup && this.markerClusterGroup.getLayers().length > 0) {
      boundsGroup = this.markerClusterGroup;
    } else if (this.initialMap.markers.length > 0) {
      boundsGroup = L.featureGroup(this.initialMap.markers);
    }
    
    if (boundsGroup) {
      this.clickedOnMarker = true;
      this.map.flyToBounds(boundsGroup.getBounds(), { maxZoom: 8 });
    }
  }

  // New method to completely reset all map layers
  resetAllLayers(): void {
    // Remove all markers including clusters
    this.removeAllMarkers();
    
    // Remove all other custom layers that might exist
    this.map.eachLayer((layer) => {
      if (layer instanceof L.Polyline || layer instanceof L.Marker) {
        this.map.removeLayer(layer);
      }
    });
  }

  public restoreMap(): void {
    this.markerSelected = undefined;
    this.idMarker = '';
    this.removeOpacity();
  }

  private initializeMap(): void {
    this.mapOptions = {
      maxBounds: [
        [90, 180],
        [-90, -180],
      ],
      layers: [
        tileLayer(
          'https://api.mapbox.com/styles/v1/{id}/tiles/256/{z}/{x}/{y}?access_token={accessToken}',
          {
            maxZoom: 18,
            minZoom: 3,
            noWrap: false,
            bounds: [
              [-90, -180],
              [90, 180],
            ],
            id: 'mapbox/satellite-streets-v12', // Satellite view for archaeological context
            accessToken: environment.mapboxToken || 'YOUR_MAPBOX',
            tileSize: 256,
            className: 'arch-map-tiles'
          } as any
        ),
      ],
      zoom: 5,
      center: latLng(41.9028, 12.4964), // Rome center - archaeological significance
      zoomControl: true,
      attributionControl: false
    };
  }

  private addMarker(
    name: string,
    id: string | number,
    type: string,
    point: LatLng,
    iconType: string,
    siteData?: ArchaeologyLocationMap
  ): void {
    const marker = L.marker(point)
      .setIcon(
        L.icon({
          iconSize: [50, 50],
          iconAnchor: [50, 50],
          iconUrl: iconType,
        })
      )
      .on('mouseout', (ev) => {
        if (this.markerSelected?.target) return;
        this.removeTooltip();
        this.removeOpacity();
      })
      .on('mouseover', (ev: any) => {
        if (this.markerSelected?.target) return;
        if (!this.containerParent)
          this.containerParent = ev.originalEvent.target.parentElement;
        
        // Don't need to check if archaeological marker - all are archaeological now
        this.addOpacity();
      })
      .on('click', (marker: any) => {
        this.clickedOnMarker = true;
        this.idMarker = id.toString();
        this.containerParent = marker.originalEvent?.target.parentElement || 
                              marker.target._icon.parentElement;
        this.clickMarker(marker);
      }) as CustomMarker;

    marker.customId = id.toString();
    marker.name = name;
    marker.type = type;
    
    // Add archaeology-specific data to marker
    if (siteData) {
      marker.isKnownSite = siteData.isKnownSite;
      marker.isPossibleArchaeologicalSite = siteData.isPossibleArchaeologicalSite;
      marker.period = siteData.period;
      marker.siteType = siteData.siteType;
      
      // Add archaeological tooltip with themed display
      this.bindArchaeologicalTooltip(marker, siteData);
    }
    
    // Add custom CSS class for archaeological markers for styling
    const icon = marker.getIcon();
    const oldIconOptions = { ...icon.options, className: this.getMarkerStatusClass(siteData) };
    // Ensure iconUrl is always a string
    if (!oldIconOptions.iconUrl) {
      oldIconOptions.iconUrl = iconType as string;
    }
    marker.setIcon(L.icon(oldIconOptions as L.IconOptions));
    
    this.initialMap.markers.push(marker);
    this.map.addLayer(marker);
  }

  private getMarkerStatusClass(site?: ArchaeologyLocationMap): string {
    let className = 'archaeological-marker';
    
    if (site?.isKnownSite) {
      className += ' confirmed';
    } else if (site?.isPossibleArchaeologicalSite) {
      className += ' potential';
    } else {
      className += ' investigation';
    }
    
    return className;
  }

  private isArchaeologicalMarker(marker: any): boolean {
    // Now we're only dealing with archaeological markers
    return true;
  }

  private bindArchaeologicalTooltip(marker: CustomMarker, site: ArchaeologyLocationMap): void {
    // Create tooltip content
    const tooltipContent = this.createArchaeologicalTooltipContent(marker, site);
    
    // Determine tooltip class
    let tooltipClass = 'archaeological-tooltip';
    if (site.isKnownSite) tooltipClass += ' confirmed';
    else if (site.isPossibleArchaeologicalSite) tooltipClass += ' potential';
    else tooltipClass += ' investigation';
    
    // Create leaflet tooltip
    marker.bindTooltip(tooltipContent, {
      className: tooltipClass,
      permanent: false,
      direction: 'top',
      offset: [0, -10]
    });
  }
  
  private createArchaeologicalTooltipContent(marker: CustomMarker, site: ArchaeologyLocationMap): string {
    // Get icon based on site type
    const iconSvg = this.getIconSvgForSiteType(site.siteType || site.type);
    const status = site.isKnownSite ? 'Confirmed' : 
                  (site.isPossibleArchaeologicalSite ? 'Potential' : 'Under Investigation');
    
    // Create tooltip content with archaeological theme
    return `
      <div class="tooltip-content">
        <div class="tooltip-icon">
          ${iconSvg}
        </div>
        <div class="tooltip-info">
          <div class="tooltip-title">${marker.name}</div>
          <div class="tooltip-meta">
            ${site.period ? `<span class="tooltip-period">${site.period}</span>` : ''}
            ${site.siteType ? `<span class="tooltip-tag">${site.siteType}</span>` : 
                            (site.type ? `<span class="tooltip-tag">${site.type}</span>` : '')}
            <span class="tooltip-status">${status}</span>
          </div>
        </div>
      </div>
    `;
  }
  
  private getIconSvgForSiteType(siteType?: string): string {
    if (!siteType) return this.getDefaultIcon();
    
    switch (siteType.toLowerCase()) {
      case 'settlement':
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"></path></svg>';
      case 'ritual':
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line><line x1="19.07" y1="4.93" x2="4.93" y2="19.07"></line></svg>';
      case 'religious':
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>';
      case 'astronomical':
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="22" y1="12" x2="18" y2="12"></line><line x1="6" y1="12" x2="2" y2="12"></line><line x1="12" y1="6" x2="12" y2="2"></line><line x1="12" y1="22" x2="12" y2="18"></line></svg>';
      case 'burial':
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="8" y1="10" x2="16" y2="10"></line><line x1="12" y1="6" x2="12" y2="14"></line></svg>';
      case 'megalithic':
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="1"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="2" x2="9" y2="4"></line><line x1="15" y1="2" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="22"></line><line x1="15" y1="20" x2="15" y2="22"></line><line x1="20" y1="9" x2="22" y2="9"></line><line x1="20" y1="14" x2="22" y2="14"></line><line x1="2" y1="9" x2="4" y2="9"></line><line x1="2" y1="14" x2="4" y2="14"></line></svg>';
      default:
        return this.getDefaultIcon();
    }
  }
  
  private getDefaultIcon(): string {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>';
  }

  clickMarker(marker: L.LeafletEvent) {
    this.zone.run(() => {
      if (!this.markerSelected?.target) {
        this.removeTooltip();
        this.markerSelected = marker;
        
        // Fly to marker position
        if ((marker as any).latlng) {
          this.map.flyTo((marker as any).latlng, 7, { duration: 1 });
        } else if (marker.target && marker.target.getLatLng) {
          this.map.flyTo(marker.target.getLatLng(), 7, { duration: 1 });
        }
        
        // Emit marker click event to parent component
        this.markerClick.emit(marker);
      }
    });
  }

  private addBorderSelected() {
    try {
      // Only add border if we're zoomed in enough
      if (this.map.getZoom() < 5) {
        this.removeAllBorderSelected();
        return;
      }

      let markerSelected: any;
      this.map.eachLayer((layer: any) => {
        if (layer.customId == this.idMarker) {
          markerSelected = layer;
          return;
        }
      });
      this.removeTooltip();

      this.renderer.insertBefore(
        this.containerParent,
        this.borderSelected,
        markerSelected._icon
      );
      this.renderer.setAttribute(
        this.borderSelected,
        'style',
        markerSelected._icon.style.cssText
      );
      
      this.renderer.removeClass(markerSelected._icon, 'opacity-2');
    } catch {}
  }

  private addOpacity(): void {
    const elementToOpacity = this.elem.nativeElement.querySelectorAll(
      '.leaflet-interactive'
    );
    elementToOpacity.forEach((layer: any) => {
      this.renderer.addClass(layer, 'opacity-2');
    });
  }

  removeOpacity(): void {
    const elementToOpacity = this.elem.nativeElement.querySelectorAll(
      '.leaflet-interactive'
    );
    elementToOpacity.forEach((layer: any) => {
      this.renderer.removeClass(layer, 'opacity-2');
    });
  }

  private removeTooltip() {
    try {
      this.renderer.selectRootElement(
        '.custom-tooltip-map-name-border-dos',
        true
      );
      this.renderer.removeChild(this.containerParent, this.tooltip);
    } catch {
      return;
    }
  }

  private addToltip(id: string, marker: any) {
    const tooltipSrc = marker.target.city === 'Magic Place' 
      ? 'assets/images/map/border_city_mp.svg' 
      : 'assets/images/map/border_city.svg';
    
    if (marker.target.city === 'Magic Place') {
      this.renderer.addClass(this.tooltipName, 'black');
    } else {
      this.renderer.removeClass(this.tooltipName, 'black');
    }
    
    this.renderer.setAttribute(this.tooltipLine, 'src', tooltipSrc);
    this.renderer.insertBefore(
      marker.originalEvent.target.parentElement,
      this.tooltip,
      marker.originalEvent.target
    );
    this.renderer.setAttribute(
      this.tooltip,
      'style',
      marker.target._icon.style.cssText
    );
    this.renderer.setProperty(
      this.tooltipName,
      'innerText',
      marker.target.city
    );
  }

  public paintConnection(connections: Connection[]) {
    for (const connection of connections) {
      this.addConnection([connection.startPoint, connection.endPoint], connection.metadata);
    }
    if (this.isNecesaryAddOpacity) {
      this.addOpacity();
      this.isNecesaryAddOpacity = false;
    }

    if (this.isNecesaryCenterBounds) {
      this.centerMapBounds();
      this.isNecesaryCenterBounds = false;
    }
  }

  private addConnection(points: LatLngExpression[], metadata?: any): void {
    const color = metadata?.type === 'user-connection' ? '#8a6d3b' : '#bfa76a';
    const dashArray = metadata?.type === 'user-connection' ? '5, 10' : undefined;
    
    const newLine = new L.Polyline(points, {
      color: color,
      weight: 2,
      opacity: 0.9,
      smoothFactor: 0.2,
      dashArray: dashArray
    });
    
    // Add tooltip for user connections
    if (metadata?.type === 'user-connection' && metadata.userName) {
      newLine.bindTooltip(`Contributed by ${metadata.userName}`, {
        className: 'archaeological-tooltip',
        permanent: false,
        direction: 'top'
      });
    }
    
    this.initialMap.connections.push(newLine);
    newLine.addTo(this.map);
  }
}