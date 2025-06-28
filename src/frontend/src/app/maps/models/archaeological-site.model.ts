import { ArchaiosUser } from '../archaeological-map3d/archaeological-sites.service';
import { ArchaeologicalSiteType } from '../enums/archaeological-site-type.enum';
import { ArchaeologicalStatus } from '../enums/archaeological-status.enum';
import { Coordinates } from './coordinates.model';

export interface ArchaeologicalSite {
  id: string;
  name: string;
  siteId: string;
  description?: string;
  imageUrl?: string;
  type?: ArchaeologicalSiteType | string;
  archaiosUser?: ArchaiosUser;
  dangerLevel?: number;
  status?: ArchaeologicalStatus | string;
  latitude: number;
  longitude: number;
  location?: string;
  category?: string;
  period?: string;
  yearRange?: string;
  features?: string[];
  researcher?: string;
  discoveryDate?: string;
  excavationStart?: string;
  significance?: string;
  components?: SiteComponent[];
  lastUpdated?: Date | string;
  isKnownSite?: boolean;
  expertNotes?: string[];
  terrain?: string;
  elevation?: number;
  agentAnalysis?: AgentChatMessage[];
  analysisResults?: Record<string, AnalysisResult>;
  detectedFeatures?: DetectedFeature[];
}
export interface SiteComponent {
  id?: string;
  name: string;
  state: string;
  latitude: number;
  longitude: number;
  imageUrl?: string;
  type?: string;
  description?: string;
  likes?: number;
  likedByUsers?: string[];
  siteId: string;
  componentId?: string;
}
export interface AgentChatMessage {
  agentId: string;
  agentName: string;
  message: string;
  timestamp?: string | Date;
  agentType?: string;
  messageId?: string;
  parentMessageId?: string;
  iconUrl?: string;
  metadata?: Record<string, string>;
}

export interface AnalysisResult {
  caption?: string;
  tags?: string[];
  features?: DetectedFeature[];
  imageUrls?: string[];
  confidence?: number;
  timestamp?: string | Date;
  groupName?: string;
}

export interface DetectedFeature {
  name: string;
  confidence: number;
  description?: string;
  type?: string;
  location?: Coordinates;
  imageUrl?: string;
}
