import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpEventType } from '@angular/common/http';
import { Observable, Subject, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export interface UploadProgress {
  type: 'progress';
  progress: number;
}

export interface UploadComplete {
  type: 'complete';
  url: string;
  fileType: string;
}

export type UploadEvent = UploadProgress | UploadComplete;

@Injectable({
  providedIn: 'root'
})
export class PointCloudUploadService {
  private recentFiles: { url: string, type: string, name: string }[] = [];
  private recentFilesSubject = new Subject<{ url: string, type: string, name: string }[]>();
  public recentFiles$ = this.recentFilesSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadRecentFilesFromStorage();
  }

  /**
   * Track a point cloud file for recent files list
   */
  trackFile(url: string, type: string, name: string): void {
    // Add to recent files and limit to 5 items
    this.recentFiles.unshift({ url, type, name });
    if (this.recentFiles.length > 5) {
      this.recentFiles.pop();
    }
    
    // Save to local storage
    localStorage.setItem('recentPointClouds', JSON.stringify(this.recentFiles));
    
    // Notify subscribers
    this.recentFilesSubject.next([...this.recentFiles]);
  }

  /**
   * Create a blob URL from a file object
   */
  createBlobUrl(file: File): string {
    const url = URL.createObjectURL(file);
    this.trackFile(url, file.name.split('.').pop()?.toLowerCase() || '', file.name);
    return url;
  }
  
  /**
   * Load recent files from local storage
   */
  private loadRecentFilesFromStorage(): void {
    try {
      const saved = localStorage.getItem('recentPointClouds');
      if (saved) {
        this.recentFiles = JSON.parse(saved);
        this.recentFilesSubject.next([...this.recentFiles]);
      }
    } catch (e) {
      console.error('Error loading recent point cloud files', e);
    }
  }

  /**
   * Get recent files
   */
  getRecentFiles(): { url: string, type: string, name: string }[] {
    return [...this.recentFiles];
  }

  /**
   * Process a point cloud file with server-side processing (for future implementation)
   */
  uploadForProcessing(file: File): Observable<HttpEvent<any>> {
    // This is a placeholder for future server-side processing
    // For now, we'll just return a simulated upload progress
    return of(file).pipe(
      map(() => {
        // Simulate progress events
        const progressEvent: HttpEvent<any> = {
          type: HttpEventType.UploadProgress,
          loaded: file.size,
          total: file.size
        };
        return progressEvent;
      })
    );
  }
}
