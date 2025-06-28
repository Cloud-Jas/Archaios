import { Component, ElementRef, ViewChild } from '@angular/core';

interface AnalysisTool {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'lidar' | 'dating' | 'imaging' | 'modeling';
  status: 'available' | 'processing' | 'offline';
  formats?: string[];
  viewer?: 'point-cloud' | 'geospatial' | 'model' | 'document';
}

interface IconPaths {
  [key: string]: string;
  terrain: string;
  calendar: string;
  cube: string;
}

// Add this interface definition for activeFile
interface ActiveFile {
  url: string;
  type: string;
  name?: string;
}

@Component({
  selector: 'app-analysis',
  templateUrl: './analysis.component.html',
  styleUrls: ['./analysis.component.scss']
})
export class AnalysisComponent {
  @ViewChild('fileInput') fileInput: ElementRef;
  
  activeCategory: string = 'all';
  // Update the type of activeFile
  activeFile: ActiveFile | null = null;
  showViewer = false;
  viewerType: 'point-cloud' | 'geospatial' | 'model' | 'document' = 'geospatial';
  activeToolName: string = '';
  
  tools: AnalysisTool[] = [
    {
      id: 'point-cloud-viewer',
      name: 'Point Cloud Explorer',
      description: 'Interactive 3D point cloud visualization for archaeological data analysis',
      icon: 'cube',
      category: 'lidar',
      status: 'available',
      formats: ['las', 'laz', 'e57', 'pcd', 'ply', 'tif', 'tiff'],
      viewer: 'point-cloud'
    }
  ];

  filterTools(category: string) {
    // Since we only have one tool, we can simplify this
    this.activeCategory = category;
  }

  getFilteredTools() {
    // We can return all tools since there's only one
    return this.tools;
  }

  getViewerTitle(): string {
    return this.activeToolName || 'File Viewer';
  }

  launchTool(tool: AnalysisTool) {
    if (tool.status !== 'available') return;
    
    // Set the viewer type based on the tool
    this.viewerType = tool.viewer || 'geospatial';
    this.activeToolName = tool.name;
    
    // For demonstration, we'll just show sample data based on tool ID
    switch (tool.id) {
      case 'point-cloud-viewer':
        this.activeFile = {
          url: 'assets/demo/sample-lidar.laz',
          type: 'laz',
          name: 'Sample LIDAR Data' // Add name property
        };
        break;
      default:
        this.activeFile = null;
    }
    
    this.showViewer = !!this.activeFile;
  }

  closeViewer(): void {
    this.showViewer = false;
    this.activeFile = null;
    this.activeToolName = '';
  }

  // New methods for file upload functionality
  openFileUpload(): void {
    this.fileInput.nativeElement.click();
  }

  handleFileUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    
    const file = input.files[0];
    const fileType = file.name.split('.').pop()?.toLowerCase() || '';
    
    // Check if file type is supported
    const supportedPointCloudFormats = ['las', 'laz', 'e57', 'pcd', 'ply', 'tif', 'tiff'];
    
    if (supportedPointCloudFormats.includes(fileType)) {
      // Create object URL for the file
      const objectUrl = URL.createObjectURL(file);
      
      // Set active file and type, now with name property
      this.activeFile = {
        url: objectUrl,
        type: fileType,
        name: file.name // This is valid now with our interface
      };
      
      // Set viewer type based on file type
      if (['tif', 'tiff'].includes(fileType)) {
        this.viewerType = 'geospatial';
      } else {
        this.viewerType = 'point-cloud';
      }
      
      this.activeToolName = `${['tif', 'tiff'].includes(fileType) ? 'Raster' : 'Point Cloud'}: ${file.name}`;
      this.showViewer = true;
    } else {
      alert('Unsupported file format. Please upload a LAS, LAZ, E57, PCD, PLY, TIF, or TIFF file.');
    }
    
    // Reset file input
    input.value = '';
  }
  
  getIconPath(icon: keyof IconPaths): string {
    const icons: IconPaths = {
      terrain: 'M3 18h18v-2H3v2zM3 13h18v-2H3v2zM3 6v2h18V6H3z',
      calendar: 'M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z',
      cube: 'M21 16.5c0 .38-.21.71-.53.88l-7.9 4.44c-.16.12-.36.18-.57.18-.21 0-.41-.06-.57-.18l-7.9-4.44A.991.991 0 013 16.5v-9c0-.38.21-.71.53-.88l7.9-4.44c.16-.12.36-.18.57-.18.21 0 .41.06.57.18l7.9 4.44c.32.17.53.5.53.88v9z',
      'grid': 'M3 3h18v18H3V3zm15 15V6H6v12h12z',
      'layers': 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5'
    };
    return icons[icon] || '';
  }
}
