import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthHttpService {
  private baseUrl = environment.backendApi;

  constructor(private http: HttpClient) {}

  /**
   * Get current user profile
   */
  getCurrentUser(): Observable<any> {
    return this.http.get(`${this.baseUrl}/users/me`);
  }

  /**
   * Get user-specific archaeological sites
   */
  getUserSites(): Observable<any> {
    return this.http.get(`${this.baseUrl}/user/sites`);
  }

  /**
   * Generic method for authenticated GET requests
   */
  get<T>(endpoint: string, options = {}): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}/${endpoint}`, options);
  }

  /**
   * Generic method for authenticated POST requests
   */
  post<T>(endpoint: string, body: any, options = {}): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}/${endpoint}`, body, options);
  }

  /**
   * Generic method for authenticated PUT requests
   */
  put<T>(endpoint: string, body: any, options = {}): Observable<T> {
    return this.http.put<T>(`${this.baseUrl}/${endpoint}`, body, options);
  }

  /**
   * Generic method for authenticated DELETE requests
   */
  delete<T>(endpoint: string, options = {}): Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}/${endpoint}`, options);
  }
}
