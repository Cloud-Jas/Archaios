import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type FilterType = 'heritage' | 'archaios' | 'all' | 'myupload' | 'potential';

@Injectable({
  providedIn: 'root'
})
export class FilterPersistenceService {
  private map2dFilterKey = 'archaios-map2d-filter';
  private map3dFilterKey = 'archaios-map3d-filter';
  
  private map2dFilterSubject = new BehaviorSubject<FilterType>(this.getStoredFilter(this.map2dFilterKey));
  private map3dFilterSubject = new BehaviorSubject<FilterType>(this.getStoredFilter(this.map3dFilterKey));
  
  map2dFilter$ = this.map2dFilterSubject.asObservable();
  map3dFilter$ = this.map3dFilterSubject.asObservable();
  
  constructor() {}
  
  private getStoredFilter(key: string): FilterType {
    const stored = localStorage.getItem(key);
    if (stored && this.isValidFilter(stored)) {
      return stored as FilterType;
    }
    return 'potential'; // Default filter
  }
  
  private isValidFilter(filter: string): boolean {
    return ['heritage', 'archaios', 'all', 'myupload', 'potential'].includes(filter);
  }
  
  setMap2dFilter(filter: FilterType): void {
    localStorage.setItem(this.map2dFilterKey, filter);
    this.map2dFilterSubject.next(filter);
  }
  
  setMap3dFilter(filter: FilterType): void {
    localStorage.setItem(this.map3dFilterKey, filter);
    this.map3dFilterSubject.next(filter);
  }
  
  getCurrentMap2dFilter(): FilterType {
    return this.map2dFilterSubject.value;
  }
  
  getCurrentMap3dFilter(): FilterType {
    return this.map3dFilterSubject.value;
  }
}
