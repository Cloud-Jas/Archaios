import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Connection } from '../models/connection.model';
import { ArchaeologyLocationMap } from '../models/archaeology-location.model';
import { MarkerColor } from '../enums/marker-color.enum';

@Injectable({
  providedIn: 'root'
})
export class ArchaeologicalSitesService {
  constructor() { }

  getArchaeologicalSites(): Observable<{ locations: ArchaeologyLocationMap[], connections: Connection[] }> {
    // Sample archaeological sites data
    const locations: ArchaeologyLocationMap[] = [
      {
        id: '1',
        name: 'Roman Villa Complex',
        position: { lat: 41.9028, lng: 12.4964 },
        type: 'Settlement', // Use appropriate string value for type
        color: MarkerColor.RED,
        isKnownSite: true,
        isPossibleArchaeologicalSite: false,
        period: 'Roman',
        siteType: 'Settlement'
      },
      {
        id: '2',
        name: 'Neolithic Circle',
        position: { lat: 51.1789, lng: -1.8262 }, // Stonehenge
        type: 'Ritual',
        color: MarkerColor.YELLOW,
        isKnownSite: true,
        isPossibleArchaeologicalSite: false,
        period: 'Neolithic',
        siteType: 'Ritual'
      },
      {
        id: '3',
        name: 'Mayan Observatory',
        position: { lat: 20.6843, lng: -88.5677 }, // Chichen Itza
        type: 'Settlement',
        color: MarkerColor.RED,
        isKnownSite: true,
        isPossibleArchaeologicalSite: false,
        period: 'Pre-Columbian',
        siteType: 'Astronomical'
      },
      {
        id: '4',
        name: 'Ancient Greek Temple',
        position: { lat: 37.9715, lng: 23.7267 }, // Acropolis
        type: 'Settlement',
        color: MarkerColor.TURQUOISE,
        isKnownSite: true,
        isPossibleArchaeologicalSite: false,
        period: 'Classical Greek',
        siteType: 'Religious'
      },
      {
        id: '5',
        name: 'Possible Settlement',
        position: { lat: 35.6762, lng: 139.6503 },
        type: 'Settlement',
        color: MarkerColor.YELLOW,
        isKnownSite: false,
        isPossibleArchaeologicalSite: true,
        period: 'Undetermined',
        siteType: 'Settlement'
      },
      {
        id: '6',
        name: 'Bronze Age Burial Site',
        position: { lat: 51.5074, lng: -0.1278 },
        type: 'Settlement',
        color: MarkerColor.RED,
        isKnownSite: false,
        isPossibleArchaeologicalSite: true,
        period: 'Bronze Age',
        siteType: 'Ritual'
      }
    ];

    // Sample connections between archaeological sites
    const connections: Connection[] = [
      {
        startPoint: { lat: 41.9028, lng: 12.4964 },
        endPoint: { lat: 37.9715, lng: 23.7267 }
      },
      {
        startPoint: { lat: 51.1789, lng: -1.8262 },
        endPoint: { lat: 51.5074, lng: -0.1278 }
      }
    ];

    return of({ locations, connections });
  }
}
