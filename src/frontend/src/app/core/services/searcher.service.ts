import { EventEmitter, Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { ArchaeologicalDataService } from '../../shared/services/archaeological-data.service';
import { ArchaeologicalSite } from '../../maps/archaeological-map3d/archaeological-sites.service';

@Injectable({
  providedIn: 'root',
})
export class SearcherService {
  searched = new EventEmitter<ArchaeologicalSite>();

  constructor(private dataService: ArchaeologicalDataService) {}

  search(keywords: string): Observable<ArchaeologicalSite | null> {
    // Get all sites from the data service
    const allSites = this.dataService.getSites();
    
    if (!keywords || keywords.trim() === '') {
      return of(null);
    }
    
    // Filter sites based on the keywords
    const filteredSites = allSites.filter(site => {
      const searchTerm = keywords.toLowerCase();
      return (
        (site.name && site.name.toLowerCase().includes(searchTerm)) || 
        (site.description && site.description.toLowerCase().includes(searchTerm)) ||
        (site.type && site.type.toLowerCase().includes(searchTerm)) ||
        (site.location && site.location.toLowerCase().includes(searchTerm)) ||
        (site.category && site.category.toLowerCase().includes(searchTerm))
      );
    });

    // Emit the first filtered site (or undefined if none found)
    this.searched.emit(filteredSites.length > 0 ? filteredSites[0] : undefined);

    return of(filteredSites.length > 0 ? filteredSites[0] : null);
  }
}
