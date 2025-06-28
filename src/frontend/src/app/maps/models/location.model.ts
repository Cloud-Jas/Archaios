import { Coordinates } from './coordinates.model';

export interface LocationMap {
  id: number;
  name: string;
  hasProblem?: boolean;
  position: Coordinates;
  color: string;
}
