import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'archaios-satellite-analyzer',
  template: `
    <div class="satellite-analyzer">
      <div class="tool-header">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
        <h3>Satellite Imagery Analysis</h3>
      </div>
      
      <div class="tool-body">
        <div class="param-group">
          <label>Satellite Collection</label>
          <select [value]="collection" (change)="onCollectionChange($event)">
            <option value="LANDSAT/LC08/C02/T1_TOA">Landsat 8</option>
            <option value="COPERNICUS/S2_SR">Sentinel-2</option>
          </select>
        </div>
        
        <div class="param-group">
          <label>Analysis Type</label>
          <select [value]="analysisType" (change)="onAnalysisTypeChange($event)">
            <option value="ndvi">NDVI (Vegetation Index)</option>
            <option value="trueColor">True Color</option>
            <option value="falseColor">False Color</option>
          </select>
        </div>
        
        <div class="param-group">
          <label>Buffer Distance (m)</label>
          <input type="range" min="500" max="2000" step="100" [value]="bufferDistance"
                 (input)="onBufferDistanceChange($event)">
          <span class="param-value">{{ bufferDistance }}</span>
        </div>
        
        <div class="param-group">
          <label>Time Range</label>
          <select [value]="timeRange" (change)="onTimeRangeChange($event)">
            <option value="1">Last 1 year</option>
            <option value="2">Last 2 years</option>
            <option value="5">Last 5 years</option>
          </select>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .satellite-analyzer {
      padding: 15px;
      background-color: #f9f6f0;
      border: 1px solid #e0d4c0;
      border-radius: 8px;
    }
    
    .tool-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 15px;
      color: #8b6b35;
    }
    
    .tool-header svg {
      width: 24px;
      height: 24px;
      stroke: #8b6b35;
    }
    
    .tool-header h3 {
      font-size: 16px;
      margin: 0;
    }
    
    .tool-body {
      display: flex;
      flex-direction: column;
      gap: 15px;
    }
    
    .param-group {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    
    .param-group label {
      font-size: 14px;
      color: #5d4824;
    }
    
    .param-group select,
    .param-group input {
      padding: 8px;
      border: 1px solid #d0c0a0;
      border-radius: 4px;
      background-color: #fffcf5;
    }
    
    .param-value {
      font-size: 14px;
      color: #8b6b35;
      text-align: right;
    }
  `]
})
export class SatelliteAnalyzerComponent implements OnInit {
  @Input() parameters: any = {};

  collection: string = 'LANDSAT/LC08/C02/T1_TOA';
  analysisType: string = 'ndvi';
  bufferDistance: number = 1000;
  timeRange: number = 1;

  ngOnInit() {
    // Initialize with any provided parameters
    if (this.parameters.collection) {
      this.collection = this.parameters.collection;
    }
    if (this.parameters.analysisType) {
      this.analysisType = this.parameters.analysisType;
    }
    if (this.parameters.bufferDistance) {
      this.bufferDistance = this.parameters.bufferDistance;
    }
    if (this.parameters.timeRange) {
      this.timeRange = this.parameters.timeRange;
    }
  }

  onCollectionChange(event: Event) {
    this.collection = (event.target as HTMLSelectElement).value;
    this.updateParameters();
  }

  onAnalysisTypeChange(event: Event) {
    this.analysisType = (event.target as HTMLSelectElement).value;
    this.updateParameters();
  }

  onBufferDistanceChange(event: Event) {
    this.bufferDistance = parseInt((event.target as HTMLInputElement).value);
    this.updateParameters();
  }

  onTimeRangeChange(event: Event) {
    this.timeRange = parseInt((event.target as HTMLSelectElement).value);
    this.updateParameters();
  }

  private updateParameters() {
    this.parameters = {
      collection: this.collection,
      analysisType: this.analysisType,
      bufferDistance: this.bufferDistance,
      timeRange: this.timeRange
    };
  }
}
