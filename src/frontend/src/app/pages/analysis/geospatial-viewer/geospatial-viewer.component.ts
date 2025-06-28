import { Component, Input, OnInit, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import * as L from 'leaflet';
// Remove problematic import that's not needed
// import 'leaflet-pointcloud';
import * as GeoTIFF from 'geotiff';
import { TypedArray } from 'geotiff'; // Add TypedArray import
import * as Shapefile from 'shapefile';
import * as THREE from 'three';
import { of } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { LASLoader } from '@loaders.gl/las';
import { load } from '@loaders.gl/core';
import { fromEvent } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

@Component({
  selector: 'app-geospatial-viewer',
  templateUrl: './geospatial-viewer.component.html',
  styleUrls: ['./geospatial-viewer.component.scss']
})
export class GeospatialViewerComponent implements OnInit, AfterViewInit {
  @Input() fileUrl: string = '';
  @Input() fileType: string = ''; // las, laz, tiff, shp
  @ViewChild('container') containerRef!: ElementRef;

  // Change private to public so template can access these properties
  public isLoading = false;
  public pointsLoaded = 0;
  public totalPoints = 0;
  public error: string | null = null;
  
  showScrollIndicator = true;
  currentCoords: string | null = null;

  private map: L.Map | null = null;
  private threeDScene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    // Setup based on file type
  }

  ngAfterViewInit(): void {
    this.loadFile();
    
    // Handle window resize
    fromEvent(window, 'resize')
      .pipe(debounceTime(200))
      .subscribe(() => {
        this.resizeViewer();
      });
      
    // Set up resize observer for container
    this.resizeObserver = new ResizeObserver(() => {
      this.resizeViewer();
    });
    
    if (this.containerRef?.nativeElement) {
      this.resizeObserver.observe(this.containerRef.nativeElement);
    }
  }
  
  ngOnDestroy(): void {
    // Clean up observer
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  private loadFile(): void {
    this.isLoading = true;
    
    switch(this.fileType.toLowerCase()) {
      case 'las':
      case 'laz':
        this.loadPointCloud();
        break;
      case 'tif':
      case 'tiff':
        this.loadRaster();
        break;
      case 'shp':
        this.loadShapefile();
        break;
      default:
        this.error = 'Unsupported file format';
        this.isLoading = false;
    }
  }

  private loadPointCloud(): void {
    if (!this.containerRef) return;

    // Initialize Three.js scene for LAS/LAZ viewer
    const container = this.containerRef.nativeElement;
    const width = container.clientWidth;
    const height = container.clientHeight;

    this.threeDScene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    container.appendChild(this.renderer.domElement);

    // Set initial camera position
    this.camera.position.z = 5;

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.threeDScene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(0, 1, 0);
    this.threeDScene.add(directionalLight);

    // Load LAS/LAZ file using loaders.gl
    load(this.fileUrl, LASLoader).then(parsedData => {
      const { header, attributes } = parsedData;
      const positions = attributes.POSITION.value;
      const colors = attributes.COLOR_0?.value || new Uint8Array(positions.length);
      
      // Create geometry from point data
      const geometry = new THREE.BufferGeometry();
      
      // Set positions
      geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(positions, 3)
      );
      
      // Set colors if available
      if (attributes.COLOR_0) {
        geometry.setAttribute(
          'color',
          new THREE.BufferAttribute(colors, 3, true)
        );
      }
      
      // Create point cloud material
      const material = new THREE.PointsMaterial({
        size: 0.05,
        vertexColors: !!attributes.COLOR_0
      });
      
      // Create point cloud object
      const pointCloud = new THREE.Points(geometry, material);
      this.threeDScene?.add(pointCloud);
      
      // Center the point cloud
      const box = new THREE.Box3().setFromObject(pointCloud);
      const center = box.getCenter(new THREE.Vector3());
      pointCloud.position.sub(center);
      
      // Update camera to frame the point cloud
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = this.camera!.fov * (Math.PI / 180);
      const cameraZ = Math.abs(maxDim / Math.sin(fov / 2));
      this.camera!.position.z = cameraZ * 1.5;
      
      // Start animation loop
      this.animate();
      
      this.isLoading = false;
      this.totalPoints = positions.length / 3;
      this.pointsLoaded = this.totalPoints;
    }).catch(error => {
      console.error('Error loading point cloud:', error);
      this.error = 'Failed to load point cloud data';
      this.isLoading = false;
    });
  }

  private loadRaster(): void {
    if (!this.containerRef) return;
    
    // Initialize Leaflet map for GeoTIFF
    this.initMap();
    
    // Load GeoTIFF file
    fetch(this.fileUrl)
      .then(response => response.arrayBuffer())
      .then(arrayBuffer => {
        return GeoTIFF.fromArrayBuffer(arrayBuffer);
      })
      .then(geotiff => {
        return geotiff.getImage();
      })
      .then(image => {
        const bbox = image.getBoundingBox();
        const width = image.getWidth();
        const height = image.getHeight();
        
        return image.readRasters().then(rasters => {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d')!;
          const imageData = ctx.createImageData(width, height);
          
          // For RGB or grayscale
          if (rasters.length >= 3) {
            // RGB - Fix TypeScript errors with type assertions
            const red = rasters[0] as TypedArray;
            const green = rasters[1] as TypedArray;
            const blue = rasters[2] as TypedArray;
            
            for (let i = 0; i < width * height; i++) {
              imageData.data[i * 4] = Number(red[i]);
              imageData.data[i * 4 + 1] = Number(green[i]);
              imageData.data[i * 4 + 2] = Number(blue[i]);
              imageData.data[i * 4 + 3] = 255;
            }
          } else {
            // Grayscale - Fix TypeScript errors with type assertions
            const data = rasters[0] as TypedArray;
            // Find min/max for normalization
            let min = Infinity;
            let max = -Infinity;
            
            // Fix TypeArray length error with explicit length check
            const dataLength = data.length || 0;
            for (let i = 0; i < dataLength; i++) {
              const val = Number(data[i]);
              if (val < min) min = val;
              if (val > max) max = val;
            }
            
            // Normalize and apply colormap
            for (let i = 0; i < width * height; i++) {
              const val = (Number(data[i]) - min) / (max - min);
              const rgb = this.getColorForValue(val);
              imageData.data[i * 4] = rgb[0];
              imageData.data[i * 4 + 1] = rgb[1];
              imageData.data[i * 4 + 2] = rgb[2];
              imageData.data[i * 4 + 3] = 255;
            }
          }
          
          ctx.putImageData(imageData, 0, 0);
          
          // Add to map as overlay
          const imageBounds = [
            [bbox[1], bbox[0]],
            [bbox[3], bbox[2]]
          ];
          
          L.imageOverlay(canvas.toDataURL(), imageBounds as L.LatLngBoundsExpression).addTo(this.map!);
          this.map!.fitBounds(imageBounds as L.LatLngBoundsExpression);
          
          this.isLoading = false;
        });
      })
      .catch(error => {
        console.error('Error loading GeoTIFF:', error);
        this.error = 'Failed to load raster data';
        this.isLoading = false;
      });
  }

  private loadShapefile(): void {
    if (!this.containerRef) return;
    
    // Initialize Leaflet map for Shapefile
    this.initMap();
    
    // Load .shp and .dbf files
    const shpUrl = this.fileUrl;
    const dbfUrl = this.fileUrl.replace('.shp', '.dbf');
    
    Promise.all([
      fetch(shpUrl).then(response => response.arrayBuffer()),
      fetch(dbfUrl).then(response => response.arrayBuffer()).catch(() => undefined) // Fix null to undefined
    ])
      .then(([shpBuffer, dbfBuffer]) => {
        return Shapefile.read(shpBuffer, dbfBuffer);
      })
      .then(geojson => {
        L.geoJSON(geojson, {
          style: feature => ({
            color: '#a68c4a',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.5,
            fillColor: '#bfa76a'
          }),
          onEachFeature: (feature, layer) => {
            if (feature.properties) {
              let popupContent = '<div class="shapefile-popup">';
              for (const key in feature.properties) {
                popupContent += `<strong>${key}:</strong> ${feature.properties[key]}<br>`;
              }
              popupContent += '</div>';
              layer.bindPopup(popupContent);
            }
          }
        }).addTo(this.map!);
        
        this.map!.fitBounds(L.geoJSON(geojson).getBounds());
        this.isLoading = false;
      })
      .catch(error => {
        console.error('Error loading Shapefile:', error);
        this.error = 'Failed to load shapefile data';
        this.isLoading = false;
      });
  }

  getFileName(): string {
    if (!this.fileUrl) return 'No file selected';
    const parts = this.fileUrl.split('/');
    return parts[parts.length - 1];
  }

  private initMap(): void {
    // Create Leaflet map
    if (this.map) return;
    
    this.map = L.map(this.containerRef.nativeElement, {
      center: [0, 0],
      zoom: 2
    });
    
    // Add basemap layers
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);
    
    // Add archaeological basemap (if available)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Esri, Maxar, Earthstar Geographics'
    });
    
    // Add coordinate tracking
    this.map?.on('mousemove', (e: L.LeafletMouseEvent) => {
      const latlng = e.latlng;
      this.currentCoords = `${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}`;
    });
    
    // Hide scroll indicator after 5 seconds
    setTimeout(() => {
      this.showScrollIndicator = false;
    }, 5000);
  }

  private animate(): void {
    if (!this.threeDScene || !this.camera || !this.renderer) return;
    
    requestAnimationFrame(() => this.animate());
    
    // Rotate the scene slowly
    if (this.threeDScene.children.length > 0) {
      this.threeDScene.rotation.y += 0.001;
    }
    
    this.renderer.render(this.threeDScene, this.camera);
  }

  // Utility function to generate a color gradient for elevation data
  private getColorForValue(value: number): [number, number, number] {
    // Archaeological-themed color ramp: from beige to brown
    const colors = [
      [245, 240, 225], // Light beige
      [227, 213, 182], // Beige
      [191, 167, 106], // Sand
      [166, 140, 74],  // Dark sand
      [139, 107, 53],  // Light brown
      [94, 72, 37]     // Dark brown
    ];
    
    const idx = Math.min(Math.floor(value * (colors.length - 1)), colors.length - 2);
    const fractBetween = (value * (colors.length - 1)) - idx;
    
    const r = Math.round(colors[idx][0] + fractBetween * (colors[idx + 1][0] - colors[idx][0]));
    const g = Math.round(colors[idx][1] + fractBetween * (colors[idx + 1][1] - colors[idx][1]));
    const b = Math.round(colors[idx][2] + fractBetween * (colors[idx + 1][2] - colors[idx][2]));
    
    return [r, g, b];
  }

  // Add methods to handle the toolbar buttons
  zoomIn(): void {
    if (this.map) {
      this.map.zoomIn();
    } else if (this.camera && this.renderer) {
      // For 3D view
      this.camera.position.z *= 0.9;
      this.renderer.render(this.threeDScene!, this.camera);
    }
  }
  
  zoomOut(): void {
    if (this.map) {
      this.map.zoomOut();
    } else if (this.camera && this.renderer) {
      // For 3D view
      this.camera.position.z *= 1.1;
      this.renderer.render(this.threeDScene!, this.camera);
    }
  }
  
  resetView(): void {
    if (this.map) {
      // Reset map view
      this.map.setView([0, 0], 2);
    } else if (this.threeDScene && this.camera && this.renderer) {
      // Reset 3D view
      this.camera.position.set(0, 0, 5);
      this.threeDScene.rotation.set(0, 0, 0);
      this.renderer.render(this.threeDScene, this.camera);
    }
  }

  private resizeViewer(): void {
    if (!this.containerRef?.nativeElement) return;
    
    const container = this.containerRef.nativeElement;
    
    // Resize map if exists
    if (this.map) {
      this.map.invalidateSize();
    }
    
    // Resize Three.js renderer if exists
    if (this.renderer && this.camera) {
      const width = container.clientWidth;
      const height = container.clientHeight;
      
      this.renderer.setSize(width, height);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      
      if (this.threeDScene) {
        this.renderer.render(this.threeDScene, this.camera);
      }
    }
  }
}
