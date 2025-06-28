import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../auth/services/auth.service';

export interface ComponentInteraction {
  siteId: string;
  componentId: string;
  liked: boolean;
  likesCount: number;
  likedByUsers: string[];
}

@Injectable({
  providedIn: 'root'
})
export class ComponentInteractionService {
  private readonly baseApiUrl = `${environment.backendApi}`;
  private interactionsSubject = new BehaviorSubject<Map<string, ComponentInteraction>>(new Map());
  
  public interactions$ = this.interactionsSubject.asObservable();
  
  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  /**
   * Like a component
   * @param siteId The site ID
   * @param componentId The component ID
   * @returns An observable with the server response
   */
  likeComponent(siteId: string, componentId: string): Observable<any> {
    return this.http.post(`${this.baseApiUrl}/${siteId}/components/${componentId}/like`, {});
  }

  /**
   * Unlike a component
   * @param siteId The site ID
   * @param componentId The component ID
   * @returns An observable with the server response
   */
  unlikeComponent(siteId: string, componentId: string): Observable<any> {
    return this.http.post(`${this.baseApiUrl}/${siteId}/components/${componentId}/unlike`, {});
  }

  /**
   * Toggle the like status of a component
   * @param siteId The site ID
   * @param component The component object
   * @param currentUserId The current user ID
   * @returns A promise that resolves when the operation completes
   */
  async toggleComponentLike(siteId: string, component: any, currentUserId: string): Promise<boolean> {
    if (!component || !currentUserId) {
      return false;
    }

    // Ensure component has required properties
    if (!component.componentId) {
      component.componentId = component.name.replace(/\s+/g, '-').toLowerCase() + '-' + Date.now();
    }
    
    if (!component.likes) {
      component.likes = 0;
    }
    
    if (!component.likedByUsers) {
      component.likedByUsers = [];
    }

    const isLiked = this.hasUserLikedComponent(component, currentUserId);
    const endpoint = isLiked ? 'unlike' : 'like';
    
    try {
      // Optimistically update the UI
      this.updateComponentLikeStatus(component, currentUserId, !isLiked);
      
      // Make the API call
      await this.http.post(
        `${this.baseApiUrl}/${siteId}/components/${component.componentId}/${endpoint}`, 
        {}
      ).toPromise();
      
      return true;
    } catch (error) {
      // Revert the optimistic update on error
      console.error('Error toggling component like:', error);
      this.updateComponentLikeStatus(component, currentUserId, isLiked);
      return false;
    }
  }

  /**
   * Check if a user has liked a component
   * @param component The component to check
   * @param userId The user ID to check
   * @returns True if the user has liked the component, false otherwise
   */
  hasUserLikedComponent(component: any, userId: string): boolean {
    if (!component || !component.likedByUsers || !userId) {
      return false;
    }
    return component.likedByUsers.includes(userId);
  }

  /**
   * Update the like status of a component in memory
   * @param component The component to update
   * @param userId The user ID
   * @param isLiked Whether the component is liked
   */
  private updateComponentLikeStatus(component: any, userId: string, isLiked: boolean): void {
    if (isLiked) {
      // Like component
      if (!component.likedByUsers.includes(userId)) {
        component.likes = (component.likes || 0) + 1;
        component.likedByUsers.push(userId);
      }
    } else {
      // Unlike component
      const index = component.likedByUsers.indexOf(userId);
      if (index > -1) {
        component.likes = Math.max(0, (component.likes || 1) - 1);
        component.likedByUsers.splice(index, 1);
      }
    }
    
    // Update the interactions map
    const interactions = this.interactionsSubject.value;
    interactions.set(`${component.componentId}`, {
      siteId: component.siteId || '',
      componentId: component.componentId,
      liked: isLiked,
      likesCount: component.likes,
      likedByUsers: [...component.likedByUsers]
    });
    
    this.interactionsSubject.next(interactions);
  }
}
