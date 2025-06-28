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

  paintMarkers(places: ArchaeologyLocationMap[]) {
    // Group nearby markers first
    const markerGroups = this.groupNearbyMarkers(places);
    
    // Add markers with appropriate offsets where needed
    Object.values(markerGroups).forEach(group => {
      if (group.length === 1) {
        // Single marker - add normally
        const item = group[0];
        this.addMarker(
          item.name,
          item.id,
          item.type,
          new LatLng(item.position.lat, item.position.lng),
          item.color,
          item
        );
      } else {
        // Multiple markers at same/nearby location - add with spiral offsets
        this.addClusteredMarkers(group);
      }
    });
  }
  
  private addClusteredMarkers(locations: ArchaeologyLocationMap[]): void {
    // Calculate center position
    const centerLat = locations.reduce((sum, loc) => sum + loc.position.lat, 0) / locations.length;
    const centerLng = locations.reduce((sum, loc) => sum + loc.position.lng, 0) / locations.length;
    
    // Use a spiral pattern for placing markers
    // This ensures they're visible but not too far from the actual position
    const offsetStep = 0.0005; // Small geographic step for marker placement
    
    locations.forEach((item, index) => {
      // Calculate offset using a spiral pattern
      const angle = index * 0.5; // Gradual angle change
      const radius = offsetStep * (index + 1); // Gradually increasing radius
      
      // Calculate new position
      const offsetLat = centerLat + radius * Math.cos(angle);
      const offsetLng = centerLng + radius * Math.sin(angle);
      
      // Add marker with offset position
      this.addMarker(
        item.name,
        item.id,
        item.type,
        new LatLng(offsetLat, offsetLng),
        item.color,
        item
      );
      
      // If this is not the first marker, add a subtle connecting line to center
      if (index > 0) {
        this.addClusterConnector([
          {lat: centerLat, lng: centerLng}, 
          {lat: offsetLat, lng: offsetLng}
        ]);
      }
    });
  }
  
  private addClusterConnector(points: {lat: number, lng: number}[]): void {
    // Add a subtle line connecting clustered markers to indicate they belong together
    const line = new L.Polyline([
      new LatLng(points[0].lat, points[0].lng),
      new LatLng(points[1].lat, points[1].lng)
    ], {
      color: 'rgba(191, 167, 106, 0.4)',
      weight: 1,
      dashArray: '3,3',
      opacity: 0.6
    });
    
    this.map.addLayer(line);
    this.initialMap.connections.push(line);
  }
  
  private groupNearbyMarkers(places: ArchaeologyLocationMap[]): { [key: string]: ArchaeologyLocationMap[] } {
    const proximityThreshold = 0.001; // Approximately 100m at the equator
    const groups: { [key: string]: ArchaeologyLocationMap[] } = {};
    
    places.forEach(place => {
      let foundGroup = false;
      
      for (const groupId in groups) {
        const referencePlace = groups[groupId][0];
        const distance = this.calculateDistance(
          place.position.lat, place.position.lng,
          referencePlace.position.lat, referencePlace.position.lng
        );
        
        if (distance <= proximityThreshold) {
          groups[groupId].push(place);
          foundGroup = true;
          break;
        }
      }
      
      if (!foundGroup) {
        const groupId = `group_${Object.keys(groups).length}`;
        groups[groupId] = [place];
      }
    });
    
    return groups;
  }
  
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
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
    // Remove all markers
    for (const marker of this.initialMap.markers) {
      this.map.removeLayer(marker);
    }
    this.initialMap.markers = [];

    // Remove all connection lines
    for (const connection of this.initialMap.connections) {
      this.map.removeLayer(connection);
    }
    this.initialMap.connections = [];
  }

  centerMapBounds(removeSelected: boolean = true): void {
    if(removeSelected) this.removeAllBorderSelected();
    const group = L.featureGroup(this.initialMap.markers);
    this.clickedOnMarker = true;
    this.map.flyToBounds(group.getBounds(), { maxZoom: 8 });
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