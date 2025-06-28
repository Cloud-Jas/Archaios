import * as L from 'leaflet';

export interface CustomMarker extends L.Marker {
  customId: string;
  city: string;
  name: string;
  idDistributionCenter: string | number;
  type: string;
  period?: string;
  siteType?: string;
  isKnownSite?: boolean;
  isPossibleArchaeologicalSite?: boolean;
}
