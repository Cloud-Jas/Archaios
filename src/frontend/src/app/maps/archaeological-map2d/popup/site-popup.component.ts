import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, DoCheck, AfterViewInit } from '@angular/core';
import { ArchaeologicalSite } from '../../models/archaeological-site.model';
import mapboxgl from 'mapbox-gl';
import { environment } from '../../../../environments/environment';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import { AuthService } from '../../../auth/services/auth.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ComponentInteractionService } from '../../../shared/services/component-interaction.service';

@Component({
  selector: 'app-site-popup',
  templateUrl: './site-popup.component.html',
  styleUrls: ['./site-popup.component.scss'],
})
export class SitePopupComponent implements OnInit, OnChanges, DoCheck {
  @Input() site: ArchaeologicalSite;
  @Input() isOpen: boolean = false;
  @Output() close = new EventEmitter<void>();
  
  currentStep: number = 0;
  isClosing: boolean = false;
  mapInitialized: boolean = false;
  initialized = false;
  
  // New property for carousel
  currentComponentIndex = 0;

  // Add properties for analysis results display
  currentAnalysisTab: string = '';
  currentImageIndex: number = 0;

  // Image viewer properties
  showImageViewer: boolean = false;
  currentViewerImage: string = '';

  // Add properties for component likes
  currentUserId: string = '';
  likingInProgress = false;

  // Add properties for image overlay
  overlayMode: boolean = false;
  baseImageIndex: number = 0;
  overlayImageIndex: number = 1;
  overlayOpacity: number = 50;
  blendMode: string = 'normal';
  showOverlayControls: boolean = false;

  private map: mapboxgl.Map;
  private marker: mapboxgl.Marker;

  constructor(
    private sanitizer: DomSanitizer,
    private authService: AuthService,
    private http: HttpClient,
    private componentInteractionService: ComponentInteractionService
  ) {}

  ngOnInit(): void {
    console.log('SitePopupComponent initialized');
    this.tryInitializeComponent();
    
    // Initialize analysis display
    this.initializeAnalysis();

    // Get current user ID for like functionality
    this.authService.currentUser$.subscribe(user => {
      if (user) {
        this.currentUserId = user.id;
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    console.log('SitePopup ngOnChanges, isOpen:', this.isOpen, 'site:', this.site);
    
    // If site changed or isOpen changed to true
    if ((changes.site && changes.site.currentValue) || 
        (changes.isOpen && changes.isOpen.currentValue)) {
      this.tryInitializeComponent();
      
      // Reset component index when site changes
      if (changes.site) {
        this.currentComponentIndex = 0;
      }
    }
  }
  
  ngDoCheck(): void {
    // Additional check to catch cases where inputs change but don't trigger ngOnChanges
    if (!this.initialized && this.site) {
      console.log('SitePopup ngDoCheck initializing with site:', this.site);
      this.tryInitializeComponent();
    }
  }

  private tryInitializeComponent(): void {
    if (this.site) {
      console.log('Initializing popup with site:', this.site);
      this.initialized = true;
      this.isClosing = false;
      this.currentStep = 0;
      this.currentComponentIndex = 0;
      
      // Initialize map when on location tab (now step 1, was step 2)
      if (this.currentStep === 1) {
        this.initializeMap();
      }
    }
  }

  closePopup(): void {
    this.close.emit();
  }
  
  closeWithAnimation(event: Event): void {
    // Don't close if clicking on elements inside the popup
    if (event.target !== event.currentTarget) return;
    
    this.isClosing = true;
    setTimeout(() => {
      this.closePopup();
    }, 300); // Match the animation duration in CSS
  }
  
  goToStep(step: number): void {
    // Destroy map when leaving map step
    if (this.currentStep === 1 && step !== 1) {
      this.destroyMap();
    }
    
    this.currentStep = step;
    
    // Initialize map when entering map step
    if (step === 1) {
      // Allow DOM to update before initializing map
      setTimeout(() => this.initializeMap(), 100);
    }
  }
  
  nextStep(): void {
    if (this.currentStep < 3) {
      this.currentStep++;
      if (this.currentStep === 1 && !this.mapInitialized) {
        setTimeout(() => this.initializeMap(), 100);
      }
    }
  }
  
  prevStep(): void {
    if (this.currentStep > 0) {
      this.currentStep--;
    }
  }

  // Updated carousel navigation methods
  nextComponent(): void {
    const componentsWithImages = this.getComponentsWithImages();
    if (componentsWithImages.length > 0 && this.currentComponentIndex < componentsWithImages.length - 1) {
      this.currentComponentIndex++;
    }
  }
  
  prevComponent(): void {
    if (this.currentComponentIndex > 0) {
      this.currentComponentIndex--;
    }
  }
  
  goToComponent(index: number): void {
    const componentsWithImages = this.getComponentsWithImages();
    if (componentsWithImages.length > 0 && index >= 0 && index < componentsWithImages.length) {
      this.currentComponentIndex = index;
    }
  }

  /**
   * Returns true if there are components with valid images
   */
  hasValidComponentImages(): boolean {
    if (!this.site?.components) {
      return false;
    }
    
    return this.site.components.some(component => 
      this.isValidImage(component.imageUrl || '')
    );
  }
  
  /**
   * Returns only components that have valid images
   */
  getComponentsWithImages(): any[] {
    if (!this.site?.components) {
      return [];
    }
    
    return this.site.components.filter(component => 
      this.isValidImage(component.imageUrl || '')
    );
  }
  
  /**
   * Checks if an image URL is valid (not null, undefined, or empty)
   */
  private isValidImage(imageUrl: string): boolean {
    return !!imageUrl && imageUrl.trim() !== '' && !imageUrl.startsWith('https://earthengine') && !imageUrl.startsWith('https://storage.googleapis.com/');
  }
  
  /**
   * Initialize or refresh the map with proper timing
   */
  private initOrRefreshMap(): void {
    // Give the DOM time to render
    setTimeout(() => {
      // Check if map container exists
      const mapContainer = document.getElementById('site-detail-map');
      
      if (!mapContainer) {
        console.error('Map container not found');
        return;
      }
      
      if (!this.mapInitialized || !this.map) {
        // First time initialization
        try {
          (mapboxgl as any).accessToken = environment.mapboxToken || 'YOUR_MAPBOX_TOKEN';
          
          const latitude = this.site?.latitude || 0;
          const longitude = this.site?.longitude || 0;
          
          this.map = new mapboxgl.Map({
            container: 'site-detail-map',
            style: 'mapbox://styles/mapbox/outdoors-v11',
            center: [longitude, latitude],
            zoom: 12,
            pitch: 30,
            bearing: 0
          });
          
          // Add navigation controls
          this.map.addControl(new mapboxgl.NavigationControl(), 'top-right');
          
          // Add marker
          this.marker = new mapboxgl.Marker({
            color: '#bfa76a'
          })
            .setLngLat([longitude, latitude])
            .addTo(this.map);
            
          this.map.on('load', () => {
            this.mapInitialized = true;
          });
        } catch (error) {
          console.error('Error initializing map:', error);
        }
      } else {
        // Map already exists, just resize and recenter it
        try {
          // Check if map container is visible
          if (mapContainer.offsetParent !== null) {
            this.map.resize();
            
            const latitude = this.site?.latitude || 0;
            const longitude = this.site?.longitude || 0;
            this.map.setCenter([longitude, latitude]);
            
            // Update marker position if needed
            if (this.marker) {
              this.marker.setLngLat([longitude, latitude]);
            }
          }
        } catch (error) {
          console.error('Error refreshing map:', error);
          // If there was an error with the existing map, try to reinitialize
          this.map.remove();
          this.mapInitialized = false;
          this.initOrRefreshMap();
        }
      }
    }, 300); // Wait for DOM update
  }

  initializeMap(): void {
    if (!this.site) return;
    
    try {
      // Correctly set the access token
      (mapboxgl as any).accessToken = environment.mapboxToken || 'YOUR_MAPBOX_TOKEN';
      
      const latitude = this.site.latitude || 0;
      const longitude = this.site.longitude || 0;
      
      // Create a new map instance with a simpler style
      this.map = new mapboxgl.Map({
        container: 'site-detail-map',
        style: 'mapbox://styles/mapbox/satellite-streets-v12', // Use a different style that doesn't have indoor features
        center: [longitude, latitude],
        zoom: 12,
        attributionControl: true
      });
      
      // Add navigation controls
      this.map.addControl(new mapboxgl.NavigationControl(), 'top-right');
      
      // Add marker for the archaeological site
      this.marker = new mapboxgl.Marker({
        color: '#bfa76a' // Match theme color
      })
        .setLngLat([longitude, latitude])
        .addTo(this.map);
      
      // Add a popup to the marker
      new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 25
      })
        .setLngLat([longitude, latitude])
        .setHTML(`<h4>${this.site.name}</h4><p>${this.site.type || 'Archaeological Site'}</p>`)
        .addTo(this.map);
        
      // Listen for when the map is loaded
      this.map.on('load', () => {
 
        this.map.addSource('mapbox-dem', {
          'type': 'raster-dem',
          'url': 'mapbox://mapbox.mapbox-terrain-dem-v1',
          'tileSize': 512,
          'maxzoom': 14
        });
        this.map.setTerrain({ 'source': 'mapbox-dem', 'exaggeration': 1.5 });
        
        // Mark map as initialized
        this.mapInitialized = true;
      });
    }
    catch (error) {
      console.error('Error initializing map:', error);
      this.mapInitialized = false;
    }
  }

  private destroyMap(): void {
    if (this.map) {
      this.map.remove();
      this.mapInitialized = false;
    }
  }

  ngOnDestroy(): void {
   
  }

  getPreservationStatus(): string {
    if (!this.site.dangerLevel || this.site.dangerLevel < 30) {
      return 'Well Preserved';
    } else if (this.site.dangerLevel < 60) {
      return 'Moderate Risk';
    } else {
      return 'High Risk';
    }
  }
  
  getRiskDescription(): string {
    if (!this.site.dangerLevel || this.site.dangerLevel < 30) {
      return 'This site is currently in good condition with minimal risk factors. Regular monitoring is recommended to maintain preservation.';
    } else if (this.site.dangerLevel < 60) {
      return 'This site faces moderate preservation challenges. Environmental factors and human activity pose some risk to its integrity.';
    } else {
      return 'This site is at high risk of degradation or damage. Immediate conservation efforts are recommended to preserve remaining archaeological evidence.';
    }
  }

  formatTimestamp(timestamp: string | Date | undefined): string {
    if (!timestamp) return 'Unknown time';
    
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    
    try {
      return date.toLocaleString();
    } catch (error) {
      return 'Invalid date';
    }
  }

  getFormattedDescription(): SafeHtml {
  const desc = this.site?.description ?? '';
  if (!desc.trim()) {
    return this.sanitizer.bypassSecurityTrustHtml('No detailed description available for this archaeological site.');
  }
  return this.formatMessage(desc);
}

  formatMessage(message: string): SafeHtml {
    if (!message) return '';
    
     try {
      const htmlContent = marked.parse(message) as string;
      return htmlContent;
    } catch (e) {
      console.error('Error parsing markdown:', e);
      return this.sanitizer.bypassSecurityTrustHtml(message);
    }
  }

  getAgentIconClass(message: any): string {
    if (!message || !message.agentType) return 'unknown';
    
    switch (message.agentType) {
      case 'ArchaeologicalAnalyst':
        return 'analyst';
      case 'TerrainSpecialist':
        return 'terrain';
      case 'EnvironmentalExpert':
        return 'environmental';
      default:
        return 'coordinator';
    }
  }

  getConsensusDecision(): string {
    if (!this.site.agentAnalysis || this.site.agentAnalysis.length === 0) {
      return '';
    }
    
    // Find the last message from the coordinator that contains a decision
    const lastCoordinatorMessage = [...this.site.agentAnalysis]
      .reverse()
      .find(msg => 
        msg.agentName === 'TeamCoordinator' && 
        (msg.message.includes('Approved') || msg.message.includes('Rejected') || msg.message.includes('Not Approved'))
      );
    
    return lastCoordinatorMessage ? this.extractDecisionSummary(lastCoordinatorMessage.message) : '';
  }
  
  extractDecisionSummary(message: string): string {
    const sentences = message.split(/[.!?]+/);
    const approvalSentences = sentences
      .filter(s => s.includes('Approved') || s.includes('Rejected') || s.includes('Not Approved') || s.includes('consensus'))
      .slice(0, 2)
      .join('. ');
    
    return approvalSentences || sentences[0];
  }
  
  isApproved(): boolean {
    if(this.site.isKnownSite) {
      return true;
    }
    if (!this.site.agentAnalysis || this.site.agentAnalysis.length === 0) {
      return false;
    }
    
    // Check if the final decision was approval
    const lastCoordinatorMessage = [...this.site.agentAnalysis]
      .reverse()
      .find(msg => msg.agentName === 'TeamCoordinator');
    
    return lastCoordinatorMessage ? 
      lastCoordinatorMessage.message.includes('Approved') && 
      !lastCoordinatorMessage.message.includes('Not Approved') : 
      false;
  }

  /**
   * Checks if the site was explicitly rejected
   */
  isRejected(): boolean {
    if (!this.site.agentAnalysis || this.site.agentAnalysis.length === 0) {
      return false;
    }
    
    // Check if the final decision was a rejection
    const lastCoordinatorMessage = [...this.site.agentAnalysis]
      .reverse()
      .find(msg => msg.agentName === 'TeamCoordinator');
    
    return lastCoordinatorMessage ? 
      (lastCoordinatorMessage.message.includes('Reject') || 
       lastCoordinatorMessage.message.includes('Not Approved')) : 
      false;
  }
  
  /**
   * Returns a descriptive text about the approval status
   */
  getApprovalDescription(): string {
    if (this.isApproved()) {
      if(this.site.isKnownSite){
      return 'This site is a known Heritage site with established historical significance.';
    } 
    else
    {
      return 'This site has been verified by archaeological experts and contains valuable historical data.';
    }
    } else if (this.isRejected()) {
      return 'This site does not meet verification criteria based on expert analysis. Further investigation may be required.';
    }
    else {
      const analysisInProgress = this.hasAgentAnalysis() && !this.getConsensusDecision();
      
      if (analysisInProgress) {
        return 'Archaeological experts are currently analyzing this site. Check the Expert Discussion for updates.';
      } else {
        return 'This site requires further analysis before verification can be completed.';
      }
    }
  }
  
  // Add a safety method to check if agentAnalysis is available
  hasAgentAnalysis(): boolean {
    return !!(this.site && this.site.agentAnalysis && this.site.agentAnalysis.length > 0);
  }

  // Add to ngOnInit or a separate initialization method
  initializeAnalysis() {
    if (this.site?.analysisResults && this.hasAnalysisResults()) {
      const groups = this.getAnalysisGroups();
      if (groups.length > 0) {
        this.currentAnalysisTab = groups[0];
        this.currentImageIndex = 0;
      }
    }
  }

  // Methods to handle analysis results display
  hasAnalysisResults(): boolean {
    return !!this.site?.analysisResults && Object.keys(this.site.analysisResults).length > 0;
  }

  getAnalysisGroups(): string[] {
    return this.site?.analysisResults ? Object.keys(this.site.analysisResults) : [];
  }

  selectAnalysisTab(groupName: string): void {
    this.currentAnalysisTab = groupName;
    this.currentImageIndex = 0;
  }

  getCurrentAnalysisResult(): any | null {
    if (!this.site?.analysisResults || !this.currentAnalysisTab) {
      return null;
    }
    return this.site.analysisResults[this.currentAnalysisTab] || null;
  }

  nextImage(): void {
    const result = this.getCurrentAnalysisResult();
    if (result?.imageUrls && this.currentImageIndex < result.imageUrls.length - 1) {
      this.currentImageIndex++;
    }
  }

  prevImage(): void {
    if (this.currentImageIndex > 0) {
      this.currentImageIndex--;
    }
  }

  selectImage(index: number): void {
    this.currentImageIndex = index;
  }

  /**
   * Opens the image viewer modal with the selected image
   */
  openImageViewer(imageUrl: string): void {
    this.currentViewerImage = imageUrl;
    this.showImageViewer = true;
  }

  /**
   * Closes the image viewer modal
   */
  closeImageViewer(): void {
    this.showImageViewer = false;
    setTimeout(() => {
      this.currentViewerImage = '';
    }, 300); // Wait for animation to complete
  }

  /**
   * Toggle like status for a component
   */
  toggleComponentLike(component: any, event: Event): void {
    event.stopPropagation(); // Prevent image click event
    
    if (!this.currentUserId || this.likingInProgress) {
      return;
    }
    
    this.likingInProgress = true;
    
    // Use the component interaction service
    this.componentInteractionService.toggleComponentLike(this.site.siteId, component, this.currentUserId)
      .then(() => {
        this.likingInProgress = false;
      })
      .catch(err => {
        console.error('Error toggling component like:', err);
        this.likingInProgress = false;
      });
  }

  /**
   * Check if the current user has liked a component
   */
  hasUserLikedComponent(component: any): boolean {
    return this.componentInteractionService.hasUserLikedComponent(component, this.currentUserId);
  }

  // Add methods for overlay functionality
  toggleOverlayMode(): void {
    this.overlayMode = !this.overlayMode;
    if (this.overlayMode && this.getComponentsWithImages().length > 1) {
      // Initialize with first two images
      this.baseImageIndex = 0;
      this.overlayImageIndex = 1;
      this.showOverlayControls = true;
    } else {
      this.showOverlayControls = false;
    }
  }

  selectBaseImage(index: number | string): void {
    const idx = typeof index === 'string' ? parseInt(index, 10) : index;
    if (idx !== this.overlayImageIndex) {
      this.baseImageIndex = idx;
    }
  }

  selectOverlayImage(index: number | string): void {
    const idx = typeof index === 'string' ? parseInt(index, 10) : index;
    if (idx !== this.baseImageIndex) {
      this.overlayImageIndex = idx;
    }
  }

  updateOverlayOpacity(value: number | string): void {
    this.overlayOpacity = typeof value === 'string' ? parseInt(value, 10) : value;
  }

  setBlendMode(mode: string): void {
    this.blendMode = mode;
  }

  getAvailableBlendModes(): string[] {
    return ['normal', 'multiply', 'screen', 'overlay', 'difference', 'lighten', 'darken', 'color-dodge', 'color-burn'];
  }

  canUseOverlay(): boolean {
    return this.getComponentsWithImages().length >= 2;
  }

  resetOverlay(): void {
    this.overlayMode = false;
    this.showOverlayControls = false;
    this.overlayOpacity = 50;
    this.blendMode = 'normal';
  }
}