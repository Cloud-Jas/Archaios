import { 
  Component, ElementRef, Input, OnDestroy, OnInit, ViewChild, AfterViewInit, ChangeDetectorRef, SimpleChanges 
} from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { PCDLoader } from 'three/examples/jsm/loaders/PCDLoader';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader';
import { LASFile } from './las-file';
import { PointCloudService } from '../../services/point-cloud.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

export type PointColorMode = 'rgb' | 'intensity' | 'height' | 'classification';
export type ViewMode = '3d' | 'top' | 'side' | 'front';

@Component({
  selector: 'app-point-cloud-viewer',
  templateUrl: './point-cloud-viewer.component.html',
  styleUrls: ['./point-cloud-viewer.component.scss']
})
export class PointCloudViewerComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('rendererContainer') rendererContainer: ElementRef;
  
  @Input() fileUrl: string;
  @Input() fileType: string;
  @Input() fileName?: string; // Add input for file name
  
  // View state
  isLoading = false;
  loadingProgress = 0;
  error: string | null = null;
  private errorTimeout: any = null;
  
  // Point cloud data
  pointCount = 0;
  classificationCount: { [key: number]: number } = {};
  pointCloudStats: any = {};
  
  // Viewer controls
  colorMode: PointColorMode = 'height';
  viewMode: ViewMode = '3d';
  pointSize = 1;
  showClassification: { [key: number]: boolean } = {
    0: true,  // Created, never classified
    1: true,  // Unclassified
    2: true,  // Ground 
    3: true,  // Low Vegetation
    4: true,  // Medium Vegetation
    5: true,  // High Vegetation
    6: true   // Building
    // Additional classifications can be added
  };
  
  // Classification color map with proper index signature
  classificationColors: { [key: number]: THREE.Color } = {
    0: new THREE.Color(0x888888),  // Created (gray)
    1: new THREE.Color(0xffffff),  // Unclassified (white)
    2: new THREE.Color(0x905000),  // Ground (brown)
    3: new THREE.Color(0x00aa00),  // Low veg (light green)
    4: new THREE.Color(0x009500),  // Medium veg (med green)
    5: new THREE.Color(0x006400),  // High veg (dark green)
    6: new THREE.Color(0xff6666),  // Building (red)
    7: new THREE.Color(0x00c8ff),  // Noise (blue)
    8: new THREE.Color(0xffff00),  // Reserved
    9: new THREE.Color(0x0000ff)   // Water
  };
  
  // Three.js objects
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private pointCloud: THREE.Points;
  private unsubscribe$ = new Subject<void>();

  // Memory management
  private objectUrls: string[] = [];

  constructor(
    private pointCloudService: PointCloudService,
    private changeDetector: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.isLoading = true;
  }

  ngAfterViewInit(): void {
    this.initScene();
    this.loadPointCloud();
  }

  ngOnDestroy(): void {
    // Clear any pending error timeout
    if (this.errorTimeout) {
      clearTimeout(this.errorTimeout);
    }
    
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
    if (this.renderer) {
      this.renderer.dispose();
    }
    if (this.pointCloud) {
      this.scene.remove(this.pointCloud);
      this.pointCloud.geometry.dispose();
      (this.pointCloud.material as THREE.Material).dispose();
    }
    
    // Clean up object URLs to prevent memory leaks
    this.objectUrls.forEach(url => {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Reload point cloud when fileUrl changes
    if (changes.fileUrl && !changes.fileUrl.firstChange) {
      this.loadPointCloud();
    }
  }

  private initScene(): void {
    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    // Camera setup
    const aspectRatio = this.getAspectRatio();
    this.camera = new THREE.PerspectiveCamera(75, aspectRatio, 0.1, 10000);
    this.camera.position.set(0, 5, 10);

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(
      this.rendererContainer.nativeElement.clientWidth, 
      this.rendererContainer.nativeElement.clientHeight
    );
    this.rendererContainer.nativeElement.appendChild(this.renderer.domElement);

    // Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.25;
    this.controls.screenSpacePanning = true;
    this.controls.addEventListener('change', () => this.render());

    // Grid helper
    const gridHelper = new THREE.GridHelper(20, 20);
    this.scene.add(gridHelper);

    // Axes helper
    const axesHelper = new THREE.AxesHelper(5);
    this.scene.add(axesHelper);

    // Handle window resize
    window.addEventListener('resize', () => this.onWindowResize());

    // Initial render
    this.animate();
  }

  private loadPointCloud(): void {
    if (!this.fileUrl) {
      this.showError('No file URL provided');
      this.isLoading = false;
      return;
    }

    this.isLoading = true;
    this.loadingProgress = 0;
    
    // If there's an existing point cloud, dispose of it properly
    if (this.pointCloud) {
      this.scene.remove(this.pointCloud);
      this.pointCloud.geometry.dispose();
      (this.pointCloud.material as THREE.Material).dispose();
    }
    
    const fileExt = this.fileType || this.getFileExtension(this.fileUrl);
    console.log(`Loading point cloud: ${this.fileName || this.fileUrl} (${fileExt})`);

    // Check if URL is blob URL (from file upload)
    if (this.fileUrl.startsWith('blob:')) {
      // For uploaded files, we need to fetch the file data
      if (fileExt.toLowerCase() === 'las' || fileExt.toLowerCase() === 'laz') {
        // Use the point cloud service to handle LAS/LAZ files
        this.loadLASFile(this.fileUrl);
      } else {
        // For other file types, use direct fetch and parse
        fetch(this.fileUrl)
          .then(response => response.arrayBuffer())
          .then(arrayBuffer => {
            // Process the arrayBuffer based on file type
            switch (fileExt.toLowerCase()) {
              case 'ply':
                // Process PLY data
                const loader = new PLYLoader();
                const geometry = loader.parse(arrayBuffer);
                this.setupPointCloudFromGeometry(geometry);
                break;
              case 'pcd':
                // Process PCD data
                const pcdLoader = new PCDLoader();
                const pcdGeometry = pcdLoader.parse(arrayBuffer);
                this.scene.add(pcdGeometry);
                this.pointCloud = pcdGeometry;
                this.pointCount = pcdGeometry.geometry.attributes.position.count;
                this.isLoading = false;
                this.centerCamera();
                this.changeDetector.detectChanges();
                break;
              default:
                this.error = `Unsupported file format: ${fileExt}`;
                this.isLoading = false;
            }
          })
          .catch(error => {
            this.showError(`Failed to load file: ${error.message || error}`);
            this.isLoading = false;
            this.changeDetector.detectChanges();
          });
      }
    } else {
      // For remote URLs, use existing loading methods
      switch (fileExt.toLowerCase()) {
        case 'las':
        case 'laz':
          this.loadLASFile(this.fileUrl);
          break;
        case 'e57':
          this.loadE57File(this.fileUrl);
          break;
        case 'pcd':
          this.loadPCDFile(this.fileUrl);
          break;
        case 'ply':
          this.loadPLYFile(this.fileUrl);
          break;
        default:
          this.error = `Unsupported file format: ${fileExt}`;
          this.isLoading = false;
      }
    }
  }

  private loadLASFile(url: string): void {
    this.pointCloudService.loadLasFile(url)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe({
        next: (event) => {
          if (event.type === 'progress') {
            this.loadingProgress = event.progress;
            this.changeDetector.detectChanges();
          } else if (event.type === 'loaded') {
            const { points, stats } = event.data;
            this.createPointCloud(points);
            this.pointCloudStats = stats;
            this.analyzeClassifications(points);
            this.isLoading = false;
            
            // Center camera on the point cloud
            this.centerCamera();
            this.changeDetector.detectChanges();
          }
        },
        error: (error) => {
          //this.showError(`Failed to load LAS file: ${error.message || error}`);
          this.isLoading = false;
          this.changeDetector.detectChanges();
        }
      });
  }

  private loadE57File(url: string): void {
    this.pointCloudService.loadE57File(url)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe({
        next: (event) => {
          if (event.type === 'progress') {
            this.loadingProgress = event.progress;
            this.changeDetector.detectChanges();
          } else if (event.type === 'loaded') {
            const { points, stats } = event.data;
            this.createPointCloud(points);
            this.pointCloudStats = stats;
            this.analyzeClassifications(points);
            this.isLoading = false;
            this.centerCamera();
            this.changeDetector.detectChanges();
          }
        },
        error: (error) => {
          this.showError(`Failed to load E57 file: ${error.message || error}`);
          this.isLoading = false;
          this.changeDetector.detectChanges();
        }
      });
  }

  private loadPCDFile(url: string): void {
    const loader = new PCDLoader();
    loader.load(
      url,
      (points) => {
        this.scene.add(points);
        this.pointCloud = points;
        this.pointCount = points.geometry.attributes.position.count;
        this.isLoading = false;
        this.centerCamera();
        this.changeDetector.detectChanges();
      },
      (xhr) => {
        this.loadingProgress = xhr.loaded / xhr.total * 100;
        this.changeDetector.detectChanges();
      },
      (error) => {
        this.showError(`Failed to load PCD file: ${error}`);
        this.isLoading = false;
        this.changeDetector.detectChanges();
      }
    );
  }

  private loadPLYFile(url: string): void {
    const loader = new PLYLoader();
    loader.load(
      url,
      (geometry) => {
        const material = new THREE.PointsMaterial({ 
          size: this.pointSize,
          vertexColors: true 
        });
        this.pointCloud = new THREE.Points(geometry, material);
        this.scene.add(this.pointCloud);
        this.pointCount = geometry.attributes.position.count;
        this.isLoading = false;
        this.centerCamera();
        this.changeDetector.detectChanges();
      },
      (xhr) => {
        this.loadingProgress = xhr.loaded / xhr.total * 100;
        this.changeDetector.detectChanges();
      },
      (error) => {
        this.showError(`Failed to load PLY file: ${error}`);
        this.isLoading = false;
        this.changeDetector.detectChanges();
      }
    );
  }

  private createPointCloud(pointData: any): void {
    // If there's an existing point cloud, remove it
    if (this.pointCloud) {
      this.scene.remove(this.pointCloud);
      this.pointCloud.geometry.dispose();
      (this.pointCloud.material as THREE.Material).dispose();
    }

    // Create geometry
    const geometry = new THREE.BufferGeometry();
    
    // Set position attribute
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(pointData.positions, 3));
    
    // Add color attribute if available
    if (pointData.colors) {
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(pointData.colors, 3));
    }
    
    // Add intensity attribute if available
    if (pointData.intensity) {
      geometry.setAttribute('intensity', new THREE.Float32BufferAttribute(pointData.intensity, 1));
    }
    
    // Add classification attribute if available
    if (pointData.classification) {
      geometry.setAttribute('classification', 
        new THREE.Float32BufferAttribute(pointData.classification, 1));
    }
    
    // Create point material
    const material = new THREE.PointsMaterial({
      size: this.pointSize,
      vertexColors: (this.colorMode === 'rgb' && pointData.colors) ? true : false,
      sizeAttenuation: false
    });
    
    // Create points
    this.pointCloud = new THREE.Points(geometry, material);
    this.scene.add(this.pointCloud);
    this.pointCount = geometry.attributes.position.count;
    
    // Apply color mode
    this.applyColorMode(this.colorMode);
  }

  private analyzeClassifications(pointData: any): void {
    if (!pointData.classification) return;
    
    // Reset classification counts
    this.classificationCount = {};
    
    // Count occurrences of each classification
    for (let i = 0; i < pointData.classification.length; i++) {
      const classValue = pointData.classification[i];
      if (this.classificationCount[classValue] === undefined) {
        this.classificationCount[classValue] = 0;
      }
      this.classificationCount[classValue]++;
    }
    
    // Ensure all classifications in our showClassification map are represented
    Object.keys(this.showClassification).forEach(classKey => {
      const key = parseInt(classKey, 10);
      if (this.classificationCount[key] === undefined) {
        this.classificationCount[key] = 0;
      }
    });
  }

  public applyColorMode(mode: PointColorMode): void {
    if (!this.pointCloud) return;
    
    this.colorMode = mode;
    const geometry = this.pointCloud.geometry;
    const positions = geometry.attributes.position.array as Float32Array;
    
    let colors;
    
    switch (mode) {
      case 'rgb':
        if (geometry.attributes.color) {
          // Use existing RGB colors
          (this.pointCloud.material as THREE.PointsMaterial).vertexColors = true;
        } else {
          // Default to height-based coloring if no RGB data
          this.applyColorMode('height');
        }
        break;
        
      case 'intensity':
        if (geometry.attributes.intensity) {
          colors = new Float32Array(positions.length);
          const intensity = geometry.attributes.intensity.array;
          
          // Find min/max intensity for normalization
          let minIntensity = Infinity;
          let maxIntensity = -Infinity;
          for (let i = 0; i < intensity.length; i++) {
            if (intensity[i] < minIntensity) minIntensity = intensity[i];
            if (intensity[i] > maxIntensity) maxIntensity = intensity[i];
          }
          
          const range = maxIntensity - minIntensity;
          
          for (let i = 0; i < intensity.length; i++) {
            const normalizedIntensity = (intensity[i] - minIntensity) / range;
            const index = i * 3;
            
            // Grayscale mapping
            colors[index] = normalizedIntensity;
            colors[index + 1] = normalizedIntensity;
            colors[index + 2] = normalizedIntensity;
          }
          
          geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
          (this.pointCloud.material as THREE.PointsMaterial).vertexColors = true;
        } else {
          // Default to height-based coloring if no intensity data
          this.applyColorMode('height');
        }
        break;
        
      case 'height':
        colors = new Float32Array(positions.length);
        
        // Find min/max height (Y coordinate)
        let minY = Infinity;
        let maxY = -Infinity;
        for (let i = 1; i < positions.length; i += 3) {
          if (positions[i] < minY) minY = positions[i];
          if (positions[i] > maxY) maxY = positions[i];
        }
        
        const range = maxY - minY;
        
        // Height-based gradient: blue (low) to green to red (high)
        for (let i = 0; i < positions.length; i += 3) {
          const normalizedHeight = (positions[i + 1] - minY) / range;
          const index = i;
          
          const heightColor = new THREE.Color();
          
          // Rainbow gradient
          if (normalizedHeight < 0.33) {
            // Blue to Green (0-0.33)
            const t = normalizedHeight * 3; // 0 to 1 in this range
            heightColor.setRGB(0, t, 1 - t);
          } else if (normalizedHeight < 0.67) {
            // Green to Yellow (0.33-0.67)
            const t = (normalizedHeight - 0.33) * 3; // 0 to 1 in this range
            heightColor.setRGB(t, 1, 0);
          } else {
            // Yellow to Red (0.67-1.0)
            const t = (normalizedHeight - 0.67) * 3; // 0 to 1 in this range
            heightColor.setRGB(1, 1 - t, 0);
          }
          
          colors[index] = heightColor.r;
          colors[index + 1] = heightColor.g;
          colors[index + 2] = heightColor.b;
        }
        
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        (this.pointCloud.material as THREE.PointsMaterial).vertexColors = true;
        break;
        
      case 'classification':
        if (geometry.attributes.classification) {
          colors = new Float32Array(positions.length);
          const classification = geometry.attributes.classification.array;
          
          for (let i = 0; i < classification.length; i++) {
            const classValue = Math.floor(classification[i]);
            const color = this.classificationColors[classValue] || new THREE.Color(0x777777);
            const index = i * 3;
            
            colors[index] = color.r;
            colors[index + 1] = color.g;
            colors[index + 2] = color.b;
          }
          
          geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
          (this.pointCloud.material as THREE.PointsMaterial).vertexColors = true;
          
          // Apply visibility filtering based on classifications
          this.filterVisiblePoints();
        } else {
          // Default to height-based coloring if no classification data
          this.applyColorMode('height');
        }
        break;
    }
    
    this.render();
  }

  public filterVisiblePoints(): void {
    if (!this.pointCloud || !this.pointCloud.geometry.attributes.classification) {
      return;
    }
    
    // Convert object of booleans to array for faster lookup
    const classifications = this.pointCloud.geometry.attributes.classification.array;
    const positions = this.pointCloud.geometry.attributes.position.array as Float32Array;
    const colors = this.pointCloud.geometry.attributes.color.array as Float32Array;
    
    // Create a hidden color (black with zero alpha)
    const hiddenColor = new THREE.Color(0x000000);
    
    // Loop through and set visibility
    for (let i = 0; i < classifications.length; i++) {
      const classValue = Math.floor(classifications[i]);
      const posIndex = i * 3;
      
      if (this.showClassification[classValue] !== undefined && !this.showClassification[classValue]) {
        // Hide point by setting its color to black
        colors[posIndex] = hiddenColor.r;
        colors[posIndex + 1] = hiddenColor.g;
        colors[posIndex + 2] = hiddenColor.b;
      } else {
        // Show point with its proper color
        const color = this.classificationColors[classValue] || new THREE.Color(0x777777);
        colors[posIndex] = color.r;
        colors[posIndex + 1] = color.g;
        colors[posIndex + 2] = color.b;
      }
    }
    
    // Update the color buffer
    this.pointCloud.geometry.attributes.color.needsUpdate = true;
    this.render();
  }

  public setPointSize(size: number): void {
    this.pointSize = size;
    if (this.pointCloud) {
      (this.pointCloud.material as THREE.PointsMaterial).size = size;
      this.render();
    }
  }

  public setViewMode(mode: ViewMode): void {
    this.viewMode = mode;
    
    if (!this.camera || !this.pointCloud) return;
    
    // Get bounding box of point cloud for camera positioning
    const box = new THREE.Box3().setFromObject(this.pointCloud);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = this.camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / Math.sin(fov / 2));
    
    // Reset camera and controls for the selected view
    this.controls.reset();
    
    switch (mode) {
      case '3d':
        // Isometric view
        this.camera.position.set(center.x + cameraZ * 0.7, center.y + cameraZ * 0.7, center.z + cameraZ * 0.7);
        break;
      case 'top':
        // Top-down view (archaeological plan view)
        this.camera.position.set(center.x, center.y + cameraZ, center.z);
        break;
      case 'side':
        // Side view (east-west section)
        this.camera.position.set(center.x + cameraZ, center.y, center.z);
        break;
      case 'front':
        // Front view (north-south section)
        this.camera.position.set(center.x, center.y, center.z + cameraZ);
        break;
    }
    
    this.camera.lookAt(center);
    this.controls.update();
    this.render();
  }

  private centerCamera(): void {
    if (!this.pointCloud) return;
    
    // Calculate bounding box
    const box = new THREE.Box3().setFromObject(this.pointCloud);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    // Position camera to see the entire point cloud
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = this.camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / Math.sin(fov / 2));
    
    // Set min distance from size
    const minCameraZ = maxDim * 1.5;
    cameraZ = Math.max(cameraZ, minCameraZ);
    
    // Position camera for isometric view
    this.camera.position.set(
      center.x + cameraZ * 0.5, 
      center.y + cameraZ * 0.5, 
      center.z + cameraZ * 0.5
    );
    
    // Look at center of point cloud
    this.camera.lookAt(center);
    
    // Remove grid and add new one at point cloud center
    this.scene.remove(...this.scene.children.filter(child => child instanceof THREE.GridHelper));
    const gridSize = Math.ceil(maxDim * 2);
    const gridDivisions = 20;
    const gridHelper = new THREE.GridHelper(gridSize, gridDivisions);
    gridHelper.position.set(center.x, box.min.y, center.z);
    this.scene.add(gridHelper);
    
    // Update controls target
    this.controls.target.set(center.x, center.y, center.z);
    this.controls.update();
    
    this.render();
  }

  private getAspectRatio(): number {
    const width = this.rendererContainer?.nativeElement?.clientWidth || 1;
    const height = this.rendererContainer?.nativeElement?.clientHeight || 1;
    return width / height;
  }

  private onWindowResize(): void {
    if (!this.camera || !this.renderer) return;
    
    const width = this.rendererContainer.nativeElement.clientWidth;
    const height = this.rendererContainer.nativeElement.clientHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.render();
  }

  private getFileExtension(filename: string): string {
    return filename.split('.').pop() || '';
  }

  private animate(): void {
    requestAnimationFrame(() => this.animate());
    this.controls.update();
    this.render();
  }

  private render(): void {
    if (!this.renderer || !this.scene || !this.camera) return;
    this.renderer.render(this.scene, this.camera);
  }

  public exportScreenshot(): void {
    if (!this.renderer) return;
    
    // Render scene
    this.renderer.render(this.scene, this.camera);
    
    // Get base64 image
    const imgData = this.renderer.domElement.toDataURL('image/png');
    
    // Create download link
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.download = `archaios-point-cloud-${timestamp}.png`;
    link.href = imgData;
    link.click();
  }

  public toggleClassification(classification: number): void {
    this.showClassification[classification] = !this.showClassification[classification];
    if (this.colorMode === 'classification') {
      this.filterVisiblePoints();
    }
  }

  // Add this missing method to support displaying classification names in the UI
  public getClassificationName(classValue: number): string {
    const classificationNames: {[key: number]: string} = {
      0: 'Created/Never Classified',
      1: 'Unclassified',
      2: 'Ground',
      3: 'Low Vegetation',
      4: 'Medium Vegetation',
      5: 'High Vegetation',
      6: 'Building',
      7: 'Noise',
      8: 'Reserved',
      9: 'Water',
      10: 'Rail',
      11: 'Road Surface',
      12: 'Overlap',
      13: 'Wire - Guard',
      14: 'Wire - Conductor',
      15: 'Transmission Tower',
      16: 'Wire - Connector',
      17: 'Bridge Deck',
      18: 'High Noise',
      // Archaeological specific classifications
      19: 'Structure',
      20: 'Artifact',
      21: 'Feature',
      22: 'Burial',
      23: 'Archaeological Site',
    };
    
    return classificationNames[classValue] || `Class ${classValue}`;
  }

  // Add method to get measurements for status bar
  public getMeasurements(): string {
    if (!this.pointCloudStats?.bounds) return '';
    
    const bounds = this.pointCloudStats.bounds;
    const sizeX = Math.abs(bounds.max[0] - bounds.min[0]).toFixed(2);
    const sizeY = Math.abs(bounds.max[1] - bounds.min[1]).toFixed(2);
    const sizeZ = Math.abs(bounds.max[2] - bounds.min[2]).toFixed(2);
    
    return `${sizeX}m × ${sizeY}m × ${sizeZ}m`;
  }

  // Helper method to handle point size changes
  public onPointSizeChanged(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.setPointSize(+input.value);
  }

  // Helper method to get classification color as a string
  public getClassColor(classValue: number): string {
    const color = this.classificationColors[classValue];
    return color ? '#' + color.getHexString() : '#777777';
  }

  // New method to process uploaded LAS/LAZ files
  private processUploadedLasFile(arrayBuffer: ArrayBuffer): void {
    // Use worker to process LAS/LAZ data
    // This is a simplified version - you'd need a proper LAS parser for production
    try {
      // Simulate processing with some random points
      const pointCount = 10000;
      const positions = new Float32Array(pointCount * 3);
      const colors = new Float32Array(pointCount * 3);
      
      for (let i = 0; i < pointCount; i++) {
        const idx = i * 3;
        positions[idx] = (Math.random() - 0.5) * 10;
        positions[idx + 1] = (Math.random() - 0.5) * 10;
        positions[idx + 2] = (Math.random() - 0.5) * 10;
        
        colors[idx] = Math.random();
        colors[idx + 1] = Math.random();
        colors[idx + 2] = Math.random();
      }
      
      const pointData = {
        positions: positions,
        colors: colors,
        classification: new Uint8Array(pointCount).fill(2) // Default to ground class
      };
      
      this.createPointCloud(pointData);
      this.pointCloudStats = {
        bounds: {
          min: [-5, -5, -5],
          max: [5, 5, 5]
        }
      };
      this.analyzeClassifications(pointData);
      this.isLoading = false;
      this.centerCamera();
      this.changeDetector.detectChanges();
    } catch (error) {
      this.showError(`Failed to process LAS file: ${error}`);
      this.isLoading = false;
      this.changeDetector.detectChanges();
    }
  }

  // Helper method to setup point cloud from geometry
  private setupPointCloudFromGeometry(geometry: THREE.BufferGeometry): void {
    const material = new THREE.PointsMaterial({ 
      size: this.pointSize,
      vertexColors: true 
    });
    
    this.pointCloud = new THREE.Points(geometry, material);
    this.scene.add(this.pointCloud);
    this.pointCount = geometry.attributes.position.count;
    this.isLoading = false;
    this.centerCamera();
    this.changeDetector.detectChanges();
  }

  // Add the missing showError method
  private showError(message: string): void {
    // Clear previous timeout if exists
    if (this.errorTimeout) {
      clearTimeout(this.errorTimeout);
      this.errorTimeout = null;
    }
    
    // Set the error message
    this.error = message;
    
    // Auto-clear after 5 seconds (5000ms)
    this.errorTimeout = setTimeout(() => {
      this.error = null;
      this.errorTimeout = null;
      this.changeDetector.detectChanges();
    }, 5000);
  }
}
