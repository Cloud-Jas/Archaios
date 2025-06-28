/**
 * LAS file parser
 * Based on the LAS file format specification 1.4
 * http://www.asprs.org/wp-content/uploads/2010/12/LAS_1_4_r13.pdf
 */

export interface LASHeader {
  versionMajor: number;
  versionMinor: number;
  headerSize: number;
  offsetToPointData: number;
  pointDataRecordFormat: number;
  pointDataRecordLength: number;
  numberOfPointRecords: number;
  xScale: number;
  yScale: number;
  zScale: number;
  xOffset: number;
  yOffset: number;
  zOffset: number;
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}

export class LASFile {
  private header: LASHeader | null = null;
  private pointDataView: DataView | null = null;
  private pointCount: number = 0;
  private pointFormat: number = 0;
  private pointSize: number = 0;
  
  constructor(private arrayBuffer: ArrayBuffer) {}
  
  async parse(): Promise<{
    positions: Float32Array;
    colors?: Float32Array;
    intensity?: Float32Array;
    classification?: Uint8Array;
    stats: {
      bounds: {
        min: [number, number, number];
        max: [number, number, number];
      };
      pointCount: number;
      hasColors: boolean;
      hasClassification: boolean;
    };
  }> {
    this.parseHeader();
    
    if (!this.header) {
      throw new Error('Failed to parse LAS header');
    }
    
    // Set up data for points
    this.pointCount = this.header.numberOfPointRecords;
    this.pointFormat = this.header.pointDataRecordFormat;
    this.pointSize = this.header.pointDataRecordLength;
    
    const positions = new Float32Array(this.pointCount * 3);
    const intensity = new Float32Array(this.pointCount);
    const classification = new Uint8Array(this.pointCount);
    
    // Initialize data view for point data
    const dataView = new DataView(this.arrayBuffer, this.header.offsetToPointData);
    this.pointDataView = dataView;
    
    // Determine if we have color data
    const hasColors = this.pointFormat === 2 || this.pointFormat === 3 || 
                      this.pointFormat === 5 || this.pointFormat >= 7;
    let colors: Float32Array | undefined;
    
    if (hasColors) {
      colors = new Float32Array(this.pointCount * 3);
    }
    
    // Parse all points
    for (let i = 0; i < this.pointCount; i++) {
      const pointOffset = i * this.pointSize;
      
      // Read X, Y, Z
      const x = this.readScaledValue(dataView, pointOffset, 0);
      const y = this.readScaledValue(dataView, pointOffset, 4);
      const z = this.readScaledValue(dataView, pointOffset, 8);
      
      // Store position
      const posIndex = i * 3;
      positions[posIndex] = x;
      positions[posIndex + 1] = z; // Swap Y and Z to match Three.js coordinate system
      positions[posIndex + 2] = y;
      
      // Read intensity (always present in LAS)
      intensity[i] = dataView.getUint16(pointOffset + 12, true) / 65535;
      
      // Read classification
      classification[i] = dataView.getUint8(pointOffset + 15);
      
      // Read RGB values if available
      if (hasColors) {
        let rOffset = 0, gOffset = 0, bOffset = 0;
        
        // Determine RGB offsets based on point format
        switch (this.pointFormat) {
          case 2:
            rOffset = 20; gOffset = 22; bOffset = 24;
            break;
          case 3:
            rOffset = 28; gOffset = 30; bOffset = 32;
            break;
          case 5:
            rOffset = 28; gOffset = 30; bOffset = 32;
            break;
          case 7:
            rOffset = 30; gOffset = 32; bOffset = 34;
            break;
          case 8:
            rOffset = 30; gOffset = 32; bOffset = 34;
            break;
          case 10:
            rOffset = 30; gOffset = 32; bOffset = 34;
            break;
        }
        
        if (rOffset > 0 && colors) {
          const r = dataView.getUint16(pointOffset + rOffset, true) / 65535;
          const g = dataView.getUint16(pointOffset + gOffset, true) / 65535;
          const b = dataView.getUint16(pointOffset + bOffset, true) / 65535;
          
          colors[posIndex] = r;
          colors[posIndex + 1] = g;
          colors[posIndex + 2] = b;
        }
      }
    }
    
    return {
      positions,
      colors,
      intensity,
      classification,
      stats: {
        bounds: {
          min: [this.header.minX, this.header.minZ, this.header.minY], // Swap Y and Z
          max: [this.header.maxX, this.header.maxZ, this.header.maxY]  // Swap Y and Z
        },
        pointCount: this.pointCount,
        hasColors: !!colors,
        hasClassification: true
      }
    };
  }
  
  private parseHeader(): void {
    const view = new DataView(this.arrayBuffer);
    
    // Check magic bytes for LAS format
    const signature = String.fromCharCode(
      view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3)
    );
    
    if (signature !== 'LASF') {
      throw new Error('Not a valid LAS file');
    }
    
    this.header = {
      versionMajor: view.getUint8(24),
      versionMinor: view.getUint8(25),
      headerSize: view.getUint16(94, true),
      offsetToPointData: view.getUint32(96, true),
      pointDataRecordFormat: view.getUint8(104),
      pointDataRecordLength: view.getUint16(105, true),
      numberOfPointRecords: view.getUint32(107, true) || view.getUint32(247, true), // Support LAS 1.4
      xScale: view.getFloat64(131, true),
      yScale: view.getFloat64(139, true),
      zScale: view.getFloat64(147, true),
      xOffset: view.getFloat64(155, true),
      yOffset: view.getFloat64(163, true),
      zOffset: view.getFloat64(171, true),
      minX: view.getFloat64(179, true),
      minY: view.getFloat64(187, true),
      minZ: view.getFloat64(195, true),
      maxX: view.getFloat64(203, true),
      maxY: view.getFloat64(211, true),
      maxZ: view.getFloat64(219, true)
    };
  }
  
  private readScaledValue(view: DataView, pointOffset: number, valueOffset: number): number {
    if (!this.header) return 0;
    
    const value = view.getInt32(pointOffset + valueOffset, true);
    
    if (valueOffset === 0) {
      return value * this.header.xScale + this.header.xOffset;
    } else if (valueOffset === 4) {
      return value * this.header.yScale + this.header.yOffset;
    } else {
      return value * this.header.zScale + this.header.zOffset;
    }
  }
}
