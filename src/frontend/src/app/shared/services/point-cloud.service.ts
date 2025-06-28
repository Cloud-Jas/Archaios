import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { environment } from 'src/environments/environment';
import { LASFile } from '../components/point-cloud-viewer/las-file';

export interface PointCloudProgress {
  type: 'progress';
  progress: number;
}

export interface PointCloudLoaded {
  type: 'loaded';
  data: {
    points: {
      positions: Float32Array;
      colors?: Float32Array;
      intensity?: Float32Array;
      classification?: Uint8Array;
      returnNumber?: Uint8Array;
    };
    stats: {
      bounds: {
        min: [number, number, number];
        max: [number, number, number];
      };
      pointCount: number;
      hasColors: boolean;
      hasClassification: boolean;
    };
  };
}

export type PointCloudEvent = PointCloudProgress | PointCloudLoaded;

@Injectable({
  providedIn: 'root'
})
export class PointCloudService {
  private apiBaseUrl = environment.backendApi;

  constructor(private http: HttpClient) {}

  loadLasFile(url: string): Observable<PointCloudEvent> {
    // Create a Subject to emit progress and loaded events
    const subject = new Subject<PointCloudEvent>();
    
    // Determine if we're loading a real file URL or a blob URL
    if (url.startsWith('blob:')) {
      // For uploaded files, fetch the data and parse
      fetch(url)
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
          }
          // Show initial progress
          subject.next({ type: 'progress', progress: 10 });
          return response.arrayBuffer();
        })
        .then(async buffer => {
          // Progress update - downloaded file
          subject.next({ type: 'progress', progress: 40 });
          
          try {
            // Parse LAS file
            const lasFile = new LASFile(buffer);
            
            // Progress update - started parsing
            subject.next({ type: 'progress', progress: 60 });
            
            // Parse points
            const pointData = await lasFile.parse();
            
            // Progress update - finished parsing
            subject.next({ type: 'progress', progress: 90 });
            
            // Send the loaded data
            subject.next({
              type: 'loaded',
              data: {
                points: pointData,
                stats: pointData.stats
              }
            });
            
            subject.complete();
          } catch (error) {
            console.error('Error parsing LAS file:', error);
            throw error;
          }
        })
        .catch(error => {
          console.error('Error loading LAS file:', error);
          subject.error(error);
        });
    } else {
      // For remote URLs, use HTTP to fetch
      this.http.get(url, { responseType: 'arraybuffer', reportProgress: true })
        .subscribe({
          next: async (buffer: ArrayBuffer) => {
            try {
              // Progress update - downloaded file
              subject.next({ type: 'progress', progress: 40 });
              
              // Parse LAS file
              const lasFile = new LASFile(buffer);
              
              // Progress update - started parsing
              subject.next({ type: 'progress', progress: 60 });
              
              // Parse points
              const pointData = await lasFile.parse();
              
              // Progress update - finished parsing
              subject.next({ type: 'progress', progress: 90 });
              
              // Send the loaded data
              subject.next({
                type: 'loaded',
                data: {
                  points: pointData,
                  stats: pointData.stats
                }
              });
              
              subject.complete();
            } catch (error) {
              console.error('Error parsing LAS file:', error);
              subject.error(error);
            }
          },
          error: (error) => {
            console.error('Error loading LAS file:', error);
            subject.error(error);
          }
        });
    }
    
    return subject.asObservable();
  }

  loadE57File(url: string): Observable<PointCloudEvent> {
    // Since E57 parsing is more complex, we'll use a similar approach to LAS
    // but with a different parser implementation
    // For now, we'll fall back to the basic behavior
    const subject = new Subject<PointCloudEvent>();
    
    setTimeout(() => {
      subject.next({
        type: 'progress',
        progress: 50
      });
    }, 500);
    
    setTimeout(() => {
      // Create a simple point cloud to show something
      const pointCount = 5000;
      const positions = new Float32Array(pointCount * 3);
      const colors = new Float32Array(pointCount * 3);
      const intensity = new Float32Array(pointCount);
      const classification = new Uint8Array(pointCount);
      
      // Generate building-like structure for E57
      for (let i = 0; i < pointCount; i++) {
        const idx = i * 3;
        // Position points in a building-like structure
        positions[idx] = (Math.random() * 2 - 1) * 5;     // x
        positions[idx + 1] = Math.random() * 8;           // y (height)
        positions[idx + 2] = (Math.random() * 2 - 1) * 5; // z
        
        // Color (grayscale for building)
        const gray = 0.4 + Math.random() * 0.3;
        colors[idx] = gray;
        colors[idx + 1] = gray; 
        colors[idx + 2] = gray;
        
        // Intensity
        intensity[i] = Math.random();
        
        // Classification (mostly building)
        classification[i] = Math.random() > 0.8 ? 2 : 6;
      }
      
      subject.next({
        type: 'loaded',
        data: {
          points: {
            positions,
            colors,
            intensity,
            classification
          },
          stats: {
            bounds: {
              min: [-5, -5, -5],
              max: [5, 5, 5]
            },
            pointCount,
            hasColors: true,
            hasClassification: true
          }
        }
      });
      
      subject.complete();
    }, 1000);
    
    return subject.asObservable();
  }
}
