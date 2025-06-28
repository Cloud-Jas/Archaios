import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Subject } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UploadService {
  private CHUNK_SIZE = 20 * 1024 * 1024; // 20MB chunks
  private uploadProgress = new Subject<number>();
  uploadProgress$ = this.uploadProgress.asObservable();
  private uploadError = new Subject<string>();
  uploadError$ = this.uploadError.asObservable();
  private currentFileInfo = new Subject<{currentFile: string, currentIndex: number, totalFiles: number}>();
  currentFileInfo$ = this.currentFileInfo.asObservable();

  constructor(private http: HttpClient) {}

  async uploadLidarFile(file: File, options: any): Promise<boolean> {
    console.log('Upload service received options:', options);
    console.log('Uploading file with name:', file.name);
    
    // Get file extension
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    
    // Check if it's a supported format
    const supportedFormats = ['las', 'laz', 'e57', 'tif', 'tiff'];
    if (!supportedFormats.includes(extension)) {
      this.uploadError.next(`Unsupported file format: ${extension}. Supported formats are: LAS, LAZ, E57, TIF, TIFF`);
      return false;
    }
    
    const blockIds: string[] = [];
    const totalChunks = Math.ceil(file.size / this.CHUNK_SIZE);
    let uploadedChunks = 0;

    for (let i = 0; i < totalChunks; i++) {
      const start = i * this.CHUNK_SIZE;
      const end = Math.min(start + this.CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);
      
      const blockId = btoa(`${i.toString().padStart(6, '0')}`);
      blockIds.push(blockId);

      try {
        await this.uploadChunk(file.name, blockId, chunk);
        uploadedChunks++;
        this.uploadProgress.next((uploadedChunks / totalChunks) * 100);
      } catch (error: any) {
        console.error(`Failed to upload chunk ${i + 1} of ${totalChunks}`, error);
        
        // Check if it's a duplicate file error thrown from uploadChunk
        if (error.message === 'FileAlreadyProcessed' && error.status === 409 && error.error) {
          const errorData = error.error;
          this.uploadError.next(`This file has already been processed. Site ID: ${errorData.siteId}`);
          
          // Re-throw the error with all the data so the component can handle it
          throw error;
        }
        
        this.uploadError.next(`Failed to upload chunk ${i + 1} of ${totalChunks}`);
        return false;
      }
    }

    try {
      await this.finalizeUpload(file.name, blockIds);
      if (options && (options.workflow?.length > 0 || options.e57Processing)) {
        console.log('Processing with workflow options:', options);    
      } else {
        console.log('No workflow options provided, skipping workflow processing');
      }
       try {
          const instanceId = await this.processFileWithWorkflow(file.name, file.size.toString(), options);
          console.log('Workflow processing started with instance ID:', instanceId);
           return true;
        } catch (workflowError) {
          console.error('Workflow processing error:', workflowError);
          this.uploadError.next('File was uploaded but workflow processing failed');
          return false;
        }
    } catch (error) {
      this.uploadError.next('Failed to finalize upload');
      return false;
    }
  }

  private async uploadChunk(filename: string, blockId: string, chunk: Blob): Promise<void> {
    const url = `${environment.backendApi}/upload?filename=${encodeURIComponent(filename)}&blockid=${encodeURIComponent(blockId)}`;
    
    const headers = new HttpHeaders({
      'Content-Type': 'application/octet-stream'
    });

    try {
      await this.http.put(url, chunk, { 
        headers,
        responseType: 'text'
      }).toPromise();
    } catch (error: any) {
      // Check if it's a 409 Conflict (duplicate file)
      if (error.status === 409) {
        // Parse the error response and re-throw with proper structure
        let errorData;
        try {
          errorData = typeof error.error === 'string' ? JSON.parse(error.error) : error.error;
        } catch (e) {
          errorData = { error: 'FileAlreadyProcessed', message: 'This file has already been processed' };
        }
        
        // Create a new error with the parsed data
        const duplicateError = new Error('FileAlreadyProcessed');
        (duplicateError as any).status = 409;
        (duplicateError as any).error = errorData;
        throw duplicateError;
      }
      
      // Re-throw other errors as-is
      throw error;
    }
  }

  private async finalizeUpload(filename: string, blockIds: string[]): Promise<void> {
    const url = `${environment.backendApi}/upload?filename=${encodeURIComponent(filename)}&final=true`;
    await this.http.put(url, blockIds, { 
      responseType: 'text' 
    }).toPromise();
  }


  async processFileWithWorkflow(fileName: string, fileSize: string, options: any): Promise<string> {
    try {
      this.uploadProgress.next(90); 
      if ( options && options.workflow) {
        for (const node of options.workflow) {
          if (node.type.includes('historical_context') && node.inputs.files?.length > 0) {
            node.contextFiles = [];
            for (const file of node.inputs.files) {
              const base64Content = await this.fileToBase64(file);
              node.contextFiles.push({
                fileName: file.name,
                contentType: file.type,
                content: base64Content
              });
            }
          }
        }
      }
      
      const requestBody = {
        fileName: fileName,
        fileSize: fileSize,
        workflow: (options && options.workflow) || [],
        coordinates: (options && options.coordinates) || null,
        workflowOptions: {
          resolution: (options && options.resolution) || 0.5,
          classificationRequired: (options && options.classificationRequired) || false
        },
        e57Options: (options && options.e57Processing) || null
      };
      
      console.log('Sending workflow request:', requestBody);
      
      const response = await this.http.post(
        `${environment.backendApi}/process-file`,
        requestBody,
        { responseType: 'json' }
      ).toPromise();
      
      this.uploadProgress.next(100);
      
      return (response as any).instanceId;
    } catch (error) {
      console.error('Error processing file with workflow', error);
      this.uploadError.next('Failed to process file with the specified workflow');
      throw error;
    }
  }

  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // Get base64 string without the prefix (data:application/pdf;base64,)
        const result = reader.result as string;
        const base64Content = result.split(',')[1];
        resolve(base64Content);
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  }

  /**
   * Upload multiple lidar files sequentially.
   * Returns an array of results for each file.
   */
  async uploadLidarFiles(files: File[], options: any): Promise<{fileName: string, success: boolean, error?: any}[]> {
    const results: {fileName: string, success: boolean, error?: any}[] = [];
    const totalFiles = files.length;
    
    for (let i = 0; i < totalFiles; i++) {
      const file = files[i];
      // Emit which file is currently being processed
      this.currentFileInfo.next({
        currentFile: file.name,
        currentIndex: i + 1,
        totalFiles: totalFiles
      });

      try {
        // Reset progress for each file
        this.uploadProgress.next(0);
        
        await this.uploadLidarFile(file, options);
        results.push({ fileName: file.name, success: true });
      } catch (error) {
        results.push({ fileName: file.name, success: false, error });
      }
    }
    
    return results;
  }
}
