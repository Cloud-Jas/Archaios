import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

// Update notification interface to include 'start' type and filename
export interface Notification {
  message: string;
  type: 'success' | 'error' | 'info' | 'start' | 'duplicate';
  timestamp: Date;
  fileName?: string; // Optional filename field
  siteId?: string;
  siteName?: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private toastContainer: HTMLDivElement | null = null;
  
  // Add notifications subject and observable
  private notificationsSubject = new Subject<Notification>();
  public notifications$ = this.notificationsSubject.asObservable();

  constructor() {
    // Create toast container when service is initialized
    this.createToastContainer();
  }

  private createToastContainer() {
    // Only create if it doesn't exist yet
    if (!document.getElementById('toast-container')) {
      this.toastContainer = document.createElement('div');
      this.toastContainer.id = 'toast-container';
      this.toastContainer.style.position = 'fixed';
      this.toastContainer.style.bottom = '20px';
      this.toastContainer.style.right = '20px';
      this.toastContainer.style.zIndex = '10000';
      // Ensure alignment at right edge with flex-end
      this.toastContainer.style.display = 'flex';
      this.toastContainer.style.flexDirection = 'column';
      this.toastContainer.style.alignItems = 'flex-end';
      // Remove fixed width to let the toast take their natural width
      document.body.appendChild(this.toastContainer);
    } else {
      this.toastContainer = document.getElementById('toast-container') as HTMLDivElement;
    }
  }

  showError(message: string, filename?: string) {
    console.log('Showing error toast:', message);
    this.showToast(message, 'error');
    this.notificationsSubject.next({ 
      message, 
      type: 'error', 
      timestamp: new Date(),
      fileName : filename
    });
  }

  showSuccess(message: string, filename?: string) {
    console.log('Showing success toast:', message);
    this.showToast(message, 'success');
    this.notificationsSubject.next({ 
      message, 
      type: 'success', 
      timestamp: new Date(),
      fileName : filename
    });
  }

  showProcessingStart(fileName: string) {
    console.log('Showing processing start toast for:', fileName);
    const message = `Processing ${fileName}...`;
    
    // Use 'start' type for processing start events to match app.component.ts check
    this.notificationsSubject.next({ 
      message, 
      type: 'start', 
      timestamp: new Date(),
      fileName: fileName 
    });
  }

  showProcessingComplete(fileName: string) {
    console.log('Showing processing complete toast for:', fileName);
    
    // Check if we're talking about multiple files
    const message = fileName.includes(' files') ? 
      `${fileName}` : // Keep the message as is if it talks about multiple files
      `Processing of ${fileName} completed successfully!`; 
    
    this.notificationsSubject.next({ 
      message, 
      type: 'success', 
      timestamp: new Date(),
      fileName: fileName
    });
  }

  showDuplicateFile(siteName: string, siteId: string): void {
    const message = `"${siteName}" has already been processed`;
    console.log('Showing duplicate file toast:', message);
    this.notificationsSubject.next({ 
      type: 'duplicate', 
      message, 
      timestamp: new Date(),
      siteId,
      siteName 
    });
  }

  // Update showToast to handle 'start' type
  private showToast(message: string, type: 'success' | 'error' | 'info' | 'start' | 'duplicate') {
    // For UI toast display purposes, treat 'start' as 'info'
    const displayType = type === 'start' ? 'info' : type;
    if (!this.toastContainer) {
      this.createToastContainer();
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${displayType}`;
    toast.style.backgroundColor = this.getBackgroundColor(displayType);
    toast.style.color = '#fff';
    toast.style.padding = '12px 20px';
    toast.style.borderRadius = '4px';
    toast.style.marginTop = '10px';
    toast.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.justifyContent = 'space-between';
    toast.style.animation = 'fadeIn 0.3s ease-out forwards';
    // Set a maximum width instead of 100% width to ensure it's not too wide
    toast.style.maxWidth = '400px';
    toast.style.minWidth = '250px';
    // Remove any margin-left that might center it
    toast.style.marginLeft = '0';
    toast.style.marginRight = '0';
    // Ensure text doesn't overflow
    toast.style.wordBreak = 'break-word';
    
    const messageSpan = document.createElement('span');
    messageSpan.textContent = message;
    toast.appendChild(messageSpan);

    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.background = 'none';
    closeBtn.style.border = 'none';
    closeBtn.style.color = '#fff';
    closeBtn.style.fontSize = '20px';
    closeBtn.style.marginLeft = '10px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.onclick = () => {
      this.removeToast(toast);
    };
    toast.appendChild(closeBtn);

    this.toastContainer?.appendChild(toast);

    // Auto remove after 5 seconds
    setTimeout(() => {
      this.removeToast(toast);
    }, 5000);
  }

  private removeToast(toast: HTMLDivElement) {
    toast.style.animation = 'fadeOut 0.3s ease-in forwards';
    setTimeout(() => {
      if (toast.parentNode === this.toastContainer) {
        this.toastContainer?.removeChild(toast);
      }
    }, 300);
  }

  private getBackgroundColor(type: 'success' | 'error' | 'info' | 'start' | 'duplicate'): string {
    switch (type) {
      case 'success': return '#4caf50';
      case 'error': return '#f44336';
      case 'info': return '#2196f3';
      case 'start': return '#2196f3';
      case 'duplicate': return '#ff9800';
      default: return '#333';
    }
  }
}
