import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError, of } from 'rxjs';
import { retry, catchError, map } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { PublicClientApplication, AuthenticationResult, PopupRequest } from '@azure/msal-browser';
import { ArchaiosUser } from '../../maps/archaeological-map3d/archaeological-sites.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private msalInstance: PublicClientApplication;
  private msalInitialized = false;
  private currentUserSubject = new BehaviorSubject<any>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  public isAuthenticating = new BehaviorSubject<boolean>(false);

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    this.initializeMsal();
  }

  private async initializeMsal() {
    try {
      this.msalInstance = new PublicClientApplication({
        auth: {
          clientId: environment.microsoftOauth.clientId,
          authority: environment.microsoftOauth.authority,
          redirectUri: environment.microsoftOauth.redirectUri,
        },
        cache: {
          cacheLocation: 'localStorage',
          storeAuthStateInCookie: false
        }
      });
      
      await this.msalInstance.initialize();
      this.msalInitialized = true;
    } catch (error) {
      console.error('Failed to initialize MSAL:', error);
      throw error;
    }
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An error occurred';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Backend error
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
    }
    
    console.error(errorMessage);
    return throwError(() => new Error(errorMessage));
  }

  private formatUserName(email: string): string {
    return email
      .split('@')[0]         // Get part before @
      .split('.')[0]         // Get first part if email has dots
      .split('-')[0]         // Remove any hyphens
      .replace(/[0-9]/g, '') // Remove numbers
      .split('_')[0]         // Remove any underscores
      .charAt(0).toUpperCase() + // Capitalize first letter
      email.split('@')[0].toLowerCase().slice(1); // Rest of the name
  }

  private async registerUserWithBackend(userDetails: any): Promise<any> {
    try {
      const response = await this.http.post(
        `${environment.backendApi}/users/register`,
        userDetails,
        {
          headers: new HttpHeaders({
            'Authorization': `Bearer ${userDetails.token}`,
            'Content-Type': 'application/json'
          })
        }
      ).toPromise();
      return response;
    } catch (error) {
      console.error('Error registering user with backend:', error);
      throw error;
    }
  }

  async signInWithMicrosoft() {
    try {
      if (!this.msalInitialized) {
        await this.initializeMsal();
      }

      this.isAuthenticating.next(true);
      
      const loginRequest: PopupRequest = {
        scopes: ["openid", "profile", "email", "User.Read","api://64cd0f11-a1fe-4121-aaeb-f8c4699d1e69/access_as_user"],
      };

      const response: AuthenticationResult = await this.msalInstance.loginPopup(loginRequest);
      
      if (response?.account) {
        const userDetails = {
          name: this.formatUserName(response.account.username),
          username: response.account.username,
          photoUrl: null,
          role: 'Archaeologist',
          token: response.accessToken,
          oid: response.account.homeAccountId // Microsoft specific identifier
        };
        
        // Register with backend before handling auth success
        const registeredUser = await this.registerUserWithBackend(userDetails);
        registeredUser.name = this.formatUserName(registeredUser.username);
        console.log('Registered user:', registeredUser);
        this.handleAuthSuccess({ ...registeredUser, token: userDetails.token });
        this.router.navigate(['/']);
      }
    } catch (error) {
      console.error('Microsoft auth error:', error);
    } finally {
      this.isAuthenticating.next(false);
    }
  }

  async signInWithGoogle() {
  try {
    this.isAuthenticating.next(true);

    const nonce = this.generateNonce();
    // Save nonce somewhere for backend verification if needed
    sessionStorage.setItem('google_oauth_nonce', nonce);

    const googleAuthUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${environment.googleOauth.clientId}&` +
      `redirect_uri=${environment.googleOauth.redirectUri}&` +
      `response_type=id_token&` +
      `scope=email profile openid&` +
      `nonce=${nonce}&` +
      `prompt=select_account`;

    const popup = window.open(
      googleAuthUrl,
      'Google Sign In',
      'width=500,height=600'
    );

    // Listener for messages from popup redirect page
    const messageHandler = async (event: MessageEvent) => {
      if (event.origin === window.location.origin) {
        const { id_token } = event.data;
        if (id_token) {
          // Decode ID token payload
          const payload = JSON.parse(atob(id_token.split('.')[1]));

          // Optional: Validate nonce here or backend will do it

          const userDetails = {
            name: this.formatUserName(payload.email),
            username: payload.email,
            photoUrl: payload.picture,
            role: 'Archaeologist',
            token: id_token,
            oid: payload.sub,
          };

          console.log('Google user details (from id_token):', userDetails);

          const registeredUser = await this.registerUserWithBackend(userDetails);
          this.handleAuthSuccess({ ...registeredUser, token: id_token });

          this.router.navigate(['/']);
          popup?.close();

          // Clean up event listener
          window.removeEventListener('message', messageHandler);
          this.isAuthenticating.next(false);
        }
      }
    };

    window.addEventListener('message', messageHandler);

  } catch (error) {
    console.error('Google auth error:', error);
    this.isAuthenticating.next(false);
  }
}

// Simple nonce generator
generateNonce(length = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let i = 0; i < length; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}


  // Update handleOAuthCallback to include sub claim
  handleOAuthCallback(params: any) {
    if (params.access_token) {
      return this.http.get('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${params.access_token}`
        }
      }).pipe(
        map((profile: any) => ({
          token: params.access_token,
          profile: {
            ...profile,
            sub: profile.id // Ensure we capture Google's unique identifier
          }
        }))
      );
    }
    return throwError(() => new Error('No access token received'));
  }

  private handleAuthSuccess(userDetails: any) {
    // Store in localStorage
    localStorage.setItem('user', JSON.stringify(userDetails));
    localStorage.setItem('token', userDetails.token);
    this.currentUserSubject.next(userDetails);
    
    // Check for redirect URL
    const redirectUrl = localStorage.getItem('redirectUrl');
    if (redirectUrl) {
      localStorage.removeItem('redirectUrl');
      this.router.navigate([redirectUrl]);
    } else {
      this.router.navigate(['/']);
    }
  }

  /**
   * Get the current user from localStorage or return null if not authenticated
   * @returns The current user as ArchaiosUser or null if not authenticated
   */
  getCurrentUser(): ArchaiosUser | null {
    try {
      const userStr = localStorage.getItem('user');
      if (!userStr) {
        return null;
      }
      
      const userData = JSON.parse(userStr);
      
      // Return as properly typed ArchaiosUser object
      const user: ArchaiosUser = {
        id: userData.id || '',
        name: userData.name || '',
        username: userData.username || userData.email || '',
        email: userData.email || userData.username || '',
        role: userData.role || 'User',
        photoUrl: userData.photoUrl || null,
        oid: userData.oid || null,
        provider: userData.provider || null,
        isArchaeologist: userData.isArchaeologist || false
      };
      
      return user;
    } catch (error) {
      console.error('Error retrieving current user from localStorage:', error);
      return null;
    }
  }

  logout() {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    this.currentUserSubject.next(null);
    this.router.navigate(['/auth/signin']);
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem('token');
  }

  public updateUserState(user: any) {
    this.currentUserSubject.next(user);
  }
}
