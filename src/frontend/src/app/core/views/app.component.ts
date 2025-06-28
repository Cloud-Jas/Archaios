import { Component, ElementRef, OnInit, ViewChild, Injector } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../auth/services/auth.service';
import { NotificationService } from '../../shared/services/notification.service';
import { UploadService } from '../../shared/services/upload.service';
import { ArchaeologicalDataService } from '../../shared/services/archaeological-data.service';
import { Subscription } from 'rxjs';
import { ArchaeologicalSite } from 'src/app/maps/archaeological-map3d/archaeological-sites.service';
import { ArchaeologicalMap3dService } from 'src/app/maps/archaeological-map3d/archaeological-map3d.service';

interface NotificationType {
  message: string;
  isComplete: boolean;
  isError?: boolean;
}

@Component({
  selector: 'neo4j-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  title = 'archaios';
  showChat = false;
  isFullscreenChat = false;
  currentFileType: 'lidar' | 'image' = 'lidar';
  dragOver = false;
  showLidarMenu = false;
  activeNotification: NotificationType | null = null;
  uploadProgress = 0;
  isUploading = false;
  selectedFile: File | null = null;
  selectedFiles: File[] = []; // Add this for multiple files
  showWizard = false;
  
  // Replace editedFileName with coordinates
  latitude: number | null = null;
  longitude: number | null = null;
  private subscriptions: Subscription[] = [];
  // Add property for recent uploads
  userSites: ArchaeologicalSite[] = [];
  recentUploads: ArchaeologicalSite[] = [];

  currentFileInfo: {currentFile: string, currentIndex: number, totalFiles: number} | null = null;

  @ViewChild('fileInput') fileInput: ElementRef<HTMLInputElement>;
  @ViewChild('lidarInput') lidarInput: ElementRef<HTMLInputElement>;

  constructor(
    private authService: AuthService,
    private router: Router,
    private notificationService: NotificationService,
    private uploadService: UploadService,
    private dataService: ArchaeologicalDataService,
    private map3dService: ArchaeologicalMap3dService,
    
  ) {
    this.notificationService.notifications$.subscribe(notification => {
      if (notification.type === 'start') {
        if (this.activeNotification) {
          setTimeout(() => {
            this.setNewNotification(notification);
          }, 500);
        } else {
          this.setNewNotification(notification);
        }
      } else {
        this.activeNotification = {
          message: `Upload complete! Check dashboard after few seconds to see your site.`,
          isComplete: true,
          isError: false
        };
        setTimeout(() => this.activeNotification = null, 3000);
      }
    });
    this.uploadService.uploadProgress$.subscribe(progress => {
      this.uploadProgress = progress;
    });
    this.uploadService.uploadError$.subscribe(errorMessage => {
      this.activeNotification = {
        message: errorMessage,
        isComplete: true,
        isError: true
      };
      this.isUploading = false;
      setTimeout(() => this.activeNotification = null, 5000);
    });
    
    this.subscriptions.push(
      this.dataService.userSites$.subscribe(sites => {
        this.userSites = sites.sort((a, b) => {
          // Handle potentially undefined lastUpdated values
          const dateA = a.lastUpdated ? new Date(a.lastUpdated) : new Date(0);
          const dateB = b.lastUpdated ? new Date(b.lastUpdated) : new Date(0);
          return dateB.getTime() - dateA.getTime();
        });
        
        this.recentUploads = [...this.userSites].slice(0, 2);
      })
    );

    this.uploadService.currentFileInfo$.subscribe(info => {
      this.currentFileInfo = info;
      
      if (info) {
        this.notificationService.showProcessingStart(
          `${info.currentFile} (${info.currentIndex}/${info.totalFiles})`
        );
      }
    });
  }

  private setNewNotification(notification: any): void {
    this.activeNotification = {
      message: `Processing ${notification.fileName}...`,
      isComplete: false,
      isError: false
    };
  }

  ngOnInit(): void {
   
  }


  openRecentFile(site: ArchaeologicalSite): void {
    console.log('Opening recent file:', site);

      if (this.router.url === '/') {
        this.map3dService.flyTo(site.latitude, site.longitude);
      } else {
        this.router.navigate(['/2d', site.id]);
      }
    
    // Close the side menu after selecting a file
    this.closeSideMenu();
  }
  
  toggleFullscreenChat(): void {
    this.isFullscreenChat = !this.isFullscreenChat;
    
    this.showChat = true;
    
    setTimeout(() => {
      const chatModal = document.querySelector('.chat-modal');
      if (chatModal) {
        chatModal.classList.remove('fullscreen');
        if (this.isFullscreenChat) {
          chatModal.classList.add('fullscreen');
        }
      }
    }, 10);
  }

  onChatClick(): void {
     if (!this.authService.isAuthenticated()) {
      localStorage.setItem('redirectUrl', this.router.url);
      this.router.navigate(['/auth/signin']);
      return;
    }
    else
    {
    this.showChat = true;
    }
  }

  onAttachLidarClick(): void {
    this.currentFileType = 'lidar';
    if (!this.authService.isAuthenticated()) {
      localStorage.setItem('redirectUrl', this.router.url);
      this.router.navigate(['/auth/signin']);
      return;
    }
    if (this.fileInput) {
      this.fileInput.nativeElement.click();
    }
  }

  onAttachImageClick(): void {
    this.currentFileType = 'image';
    if (!this.authService.isAuthenticated()) {
      localStorage.setItem('redirectUrl', this.router.url);
      this.router.navigate(['/auth/signin']);
      return;
    }
    if (this.fileInput) {
      this.fileInput.nativeElement.click();
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFiles = Array.from(input.files);
      this.selectedFile = this.selectedFiles[0] || null;
      // Reset coordinates when selecting a new file
      this.latitude = null;
      this.longitude = null;
    }
  }

  getFileNameWithoutExtension(filename: string): string {
    return filename.substring(0, filename.lastIndexOf('.')) || filename;
  }

  getFileExtension(filename: string): string {
    return filename.split('.').pop() || '';
  }

  // Update getter to consider coordinates valid either when they're both null/undefined or when they're valid numbers
  get areCoordinatesValid(): boolean {
    // Both coordinates are unspecified (optional case)
    if ((this.latitude === null || this.latitude === undefined) && 
        (this.longitude === null || this.longitude === undefined)) {
      return true;
    }
    // One or both are specified, make sure they're valid numbers
    return !isNaN(this.latitude as number) && !isNaN(this.longitude as number);
  }

  // Update coordinate input handlers
  onLatitudeChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    // Allow empty input to reset to null (optional)
    if (!input.value.trim()) {
      this.latitude = null;
      return;
    }
    const value = parseFloat(input.value);
    this.latitude = isNaN(value) ? null : value;
  }

  onLongitudeChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    // Allow empty input to reset to null (optional)
    if (!input.value.trim()) {
      this.longitude = null;
      return;
    }
    const value = parseFloat(input.value);
    this.longitude = isNaN(value) ? null : value;
  }

  onProcessFile(): void {
    if (this.selectedFiles.length > 0 && this.authService.isAuthenticated() && this.areCoordinatesValid) {
      this.isUploading = true;
      this.uploadProgress = 0;
      this.closeSideMenu();
      
      // Create options object with coordinates (default to 0.0 if not provided)
      const options = {
        coordinates: {
          latitude: this.latitude ?? 0.0,
          longitude: this.longitude ?? 0.0
        }
      };

      // Process all selected files
      this.notificationService.showProcessingStart(`Processing ${this.selectedFiles.length} files`);
      
      // Use the uploadLidarFiles method for multiple files
      this.uploadService.uploadLidarFiles(this.selectedFiles, options)
        .then(results => {
          const successCount = results.filter(r => r.success).length;
          if (successCount === this.selectedFiles.length) {
            this.notificationService.showProcessingComplete(`All ${this.selectedFiles.length} files processed successfully`);
          } else {
            this.notificationService.showError(`Processed ${successCount} of ${this.selectedFiles.length} files`);
          }
        })
        .catch(error => {
          this.notificationService.showError('Error processing files');
          console.error('Error processing files:', error);
        })
        .finally(() => {
          this.isUploading = false;
          this.selectedFiles = [];
          this.selectedFile = null;
          this.currentFileInfo = null;
        });
    } else if (!this.areCoordinatesValid) {
      this.notificationService.showError('Please enter valid latitude and longitude coordinates');
    } else if (!this.authService.isAuthenticated()) {
      localStorage.setItem('redirectUrl', this.router.url);
      this.router.navigate(['/auth/signin']);
    }
  }

  onProcessWithOptions(event: { file: File, options: any }): void {
    if (event.file && this.authService.isAuthenticated()) {
      // Use the original file name
      const originalFileName = event.file.name;
      
      this.showWizard = false;
      this.isUploading = true;
      this.uploadProgress = 0;
      
      // Add coordinates to options if provided, default to 0.0 if not
      event.options = event.options || {};
      event.options.coordinates = {
        latitude: this.latitude ?? 0.0,
        longitude: this.longitude ?? 0.0
      };
      
      // Log options for debugging
      console.log('Processing with options:', event.options);
      
      // Check if options exist and have workflow data
      if (!event.options || !event.options.workflow) {
        console.warn('No valid workflow options provided, using default options');
        event.options = event.options || {};
        event.options.workflow = []; // Provide empty workflow as fallback
      }
      
      this.notificationService.showProcessingStart(originalFileName);
      
      this.uploadService.uploadLidarFile(event.file, event.options)
        .then(success => {
          if (success) {
            this.notificationService.showProcessingComplete(originalFileName);
          }
        })
        .catch(error => {
          console.error('Upload error:', error);
          
          // Check if it's a duplicate file error
          if (error?.status === 409 || error?.message === 'FileAlreadyProcessed') {
            const errorData = error?.error || {};
            const siteId = errorData.siteId || '';
            const siteName = errorData.siteName || originalFileName;
            
            // Show duplicate file message
            this.activeNotification = {
              message: `"${siteName}" has already been processed. Site ID: ${siteId}`,
              isComplete: true,
              isError: true
            };
            
            // Optionally navigate to the existing site
            if (siteId) {
              setTimeout(() => {
                const navigateToSite = confirm(`Would you like to view the existing site "${siteName}"?`);
                if (navigateToSite) {
                  this.router.navigate(['/2d', siteId]);
                }
              }, 1000);
            }
          } else {
            this.notificationService.showError('Something went wrong during upload');
          }
        })
        .finally(() => {
          this.isUploading = false;
          this.selectedFile = null;
          this.latitude = null;
          this.longitude = null;
        });
    } else if (!this.authService.isAuthenticated()) {
      localStorage.setItem('redirectUrl', this.router.url);
      this.router.navigate(['/auth/signin']);
    }
  }

  toggleLidarMenu(): void {
    this.showLidarMenu = !this.showLidarMenu;
    console.log('Toggling LIDAR menu');
  }

  onLidarDrop(event: DragEvent): void {
    event.preventDefault();
    if (!this.authService.isAuthenticated()) {
      localStorage.setItem('redirectUrl', this.router.url);
      this.router.navigate(['/auth/signin']);
      return;
    }
    
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.selectedFile = files[0];
    }
  }

  async onLidarFile(event: Event): Promise<void> {
    if (!this.authService.isAuthenticated()) {
      localStorage.setItem('redirectUrl', this.router.url);
      this.router.navigate(['/auth/signin']);
      return;
    }

    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const files = Array.from(input.files);
      this.isUploading = true;
      this.uploadProgress = 0;
      this.closeSideMenu();
      
      // Update notification to show the total files to be processed
      this.notificationService.showProcessingStart(`Processing ${files.length} files`);
      
      // Process the files
      try {
        const results = await this.uploadService.uploadLidarFiles(files, {
          coordinates: {
            latitude: this.latitude ?? 0.0,
            longitude: this.longitude ?? 0.0
          }
        });
        
        const successCount = results.filter(r => r.success).length;
        
        // Show appropriate completion message
        if (successCount === files.length) {
          this.notificationService.showProcessingComplete(`All ${files.length} files processed successfully`);
        } else {
          this.notificationService.showError(`Processed ${successCount} of ${files.length} files`);
        }
      } catch (error) {
        this.notificationService.showError('Error processing files');
        console.error('Error in file processing:', error);
      } finally {
        this.isUploading = false;
        this.selectedFiles = [];
        this.selectedFile = null;
        this.currentFileInfo = null;
      }
    }
  }
  
  onBrowseLidarFile(): void {
    // Clear the input value to ensure the change event fires even if the same file is selected
    if (this.lidarInput && this.lidarInput.nativeElement) {
      this.lidarInput.nativeElement.value = '';
    }
    
    if (!this.authService.isAuthenticated()) {
      localStorage.setItem('redirectUrl', this.router.url);
      this.router.navigate(['/auth/signin']);
      return;
    }
    
    if (this.lidarInput) {
      this.lidarInput.nativeElement.click();
    }
  }

  closeSideMenu() {
    const sideMenu = document.querySelector('.side-menu') as HTMLElement;
    const backdrop = document.querySelector('.side-menu-backdrop') as HTMLElement;

    if (sideMenu && backdrop) {
      sideMenu.classList.remove('active');
      backdrop.classList.remove('active');
      setTimeout(() => {
        this.showLidarMenu = false;
      }, 300);
    }
  }

  onCustomizeLidar(): void {
    if (!this.areCoordinatesValid) {
      this.notificationService.showError('Please enter valid latitude and longitude coordinates');
      return;
    }
    
    this.showWizard = true;
    this.closeSideMenu();
    
    // Pass the edited filename to the wizard component
    if (this.selectedFile && this.latitude !== null && this.longitude !== null) {
      // Create a new temporary file object with the edited name
      const originalFileName = this.selectedFile.name;
      
      // We'll set a property that will be accessible to the wizard component
      this.selectedFile = new File(
        [this.selectedFile], 
        originalFileName, 
        { type: this.selectedFile.type }
      );
    }
  }
}

