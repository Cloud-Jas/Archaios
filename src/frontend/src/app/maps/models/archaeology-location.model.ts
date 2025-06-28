import { MarkerColor } from '../enums';
import { Coordinates } from './coordinates.model';

export interface ArchaeologyLocationMap {
  id: string;
  name: string;
  isMyUpload?: boolean;
  isKnownSite?: boolean;
  isPossibleArchaeologicalSite?: boolean;
  type: string;
  position: Coordinates;
  color: MarkerColor;
  period?: string;
  siteType?: string;
}
