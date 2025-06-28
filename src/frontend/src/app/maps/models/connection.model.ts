import { Coordinates } from './coordinates.model';

export interface Connection {
  startPoint: Coordinates;
  endPoint: Coordinates;
  fromSiteId?: string;
  toSiteId?: string;
  metadata?: {
    type?: string;
    category?: string;
    [key: string]: any;
  };
}
