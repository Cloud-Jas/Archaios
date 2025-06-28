import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

interface NetworkResponse {
  nodes: ArchaeologicalNode[];
  relationships: ArchaeologicalEdge[];
}

export interface ArchaeologicalNode {
  id: string;
  label: string;
  type: string;
  category?: string;
  description?: string;
  imageUrl?: string;
  dangerLevel?: number;
  status?: string;
  latitude?: number;
  longitude?: number;
  lastUpdated?: string;
  confidence?: string;
  significance?: string;
  components?: Array<{
    name: string;
    state: string;
    latitude: number;
    longitude: number;
  }>;
}

export interface ArchaeologicalEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  label?: string;
  color?: string;
  dashes?: boolean | number[];
  width?: number;
}

export interface GraphData {
  nodes: ArchaeologicalNode[];
  relationships: ArchaeologicalEdge[];
}

@Injectable({
  providedIn: 'root'
})
export class GraphService {
  private readonly baseUrl = environment.backendApi;

  constructor(private http: HttpClient) {}

  getArchaeologicalNetwork(): Observable<GraphData> {
    return this.http.get<NetworkResponse>(`${this.baseUrl}/archaeological-network`).pipe(
      map(response => ({
        nodes: response.nodes.map((node) => ({
          id: node.id,
          label: node.label,
          type: node.type,
          category: node.category,
          latitude: node.latitude,
          longitude: node.longitude,
          dangerLevel: node.dangerLevel,
          status: node.status
        })),
        relationships: response.relationships.map((rel) => ({
          id: rel.id,
          source: rel.source,
          target: rel.target,
          type: rel.type,
          label: rel.label,
          color: this.getRelationshipColor(rel.type),
          width: this.getRelationshipWidth(rel.type)
        }))
      }))
    );
  }

  private getRelationshipColor(type: string): string {
    switch (type) {
      case 'BELONGS_TO': return '#bfa76a';
      case 'CONNECTED_TO': return '#8b6b35';
      default: return '#3e2c18';
    }
  }

  private getRelationshipWidth(type: string): number {
    switch (type) {
      case 'BELONGS_TO': return 3;
      case 'CONNECTED_TO': return 2;
      default: return 1;
    }
  }
}
