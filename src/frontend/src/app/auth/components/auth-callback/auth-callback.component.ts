import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  template: '<div>Processing authentication...</div>'
})
export class AuthCallbackComponent implements OnInit {
  constructor(
    private route: ActivatedRoute,
    private authService: AuthService
  ) {}

  ngOnInit() {
    const fragment = this.route.snapshot.fragment;
    if (fragment) {
      const params = new URLSearchParams(fragment);

      const id_token = params.get('id_token');
      if (id_token) {
        // ID Token flow - post id_token directly
        window.opener?.postMessage({ id_token }, window.location.origin);
        window.close();
        return;
      }

      const access_token = params.get('access_token');
      if (access_token) {
        // Access token flow - call backend to get user info
        const tokenData = {
          access_token,
          token_type: params.get('token_type'),
          expires_in: params.get('expires_in')
        };

        this.authService.handleOAuthCallback(tokenData)
          .subscribe({
            next: (response) => {
              window.opener?.postMessage(response, window.location.origin);
              window.close();
            },
            error: (error) => {
              console.error('Auth callback error:', error);
              window.close();
            }
          });
        return;
      }

      console.error('No id_token or access_token found in OAuth callback');
      window.close();
    }
  }
}
