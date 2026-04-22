import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { OAuthService } from 'angular-oauth2-oidc';
import { authConfig } from './auth-config';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class AuthGoogleService {
  private oAuthService = inject(OAuthService);
  private http = inject(HttpClient);
  private router = inject(Router);
  private authService = inject(AuthService);

  profile = signal<any>(null);
  isLoading = signal<boolean>(false);
  error = signal<string | null>(null);

  private readonly SUPABASE_FUNCTIONS_URL =
    'https://ldmcdielxskywugyohrq.supabase.co/functions/v1';

  constructor() {
    this.initConfiguration();
  }

  initConfiguration() {
    this.oAuthService.configure(authConfig);
    this.oAuthService.setupAutomaticSilentRefresh();
    this.oAuthService.loadDiscoveryDocumentAndTryLogin().then(() => {
      if (this.oAuthService.hasValidIdToken()) {
        this.profile.set(this.oAuthService.getIdentityClaims());
        this.saveTokenToLocalStorage();
        // Authenticate with Supabase after successful OAuth
        this.authenticateWithSupabase();
      }
    });
  }

  login() {
    this.isLoading.set(true);
    this.error.set(null);
    this.oAuthService.initImplicitFlow();
  }

  logout() {
    this.oAuthService.logOut();
    this.profile.set(null);
    localStorage.removeItem('access_token');
    localStorage.removeItem('id_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('current_user');

    // Redirect to home page after logout
    this.router.navigate(['/']);
  }

  // Authenticate with Supabase after Google OAuth
  private async authenticateWithSupabase() {
    try {
      this.isLoading.set(true);

      const accessToken = this.oAuthService.getAccessToken();
      const idToken = this.oAuthService.getIdToken();
      const profile = this.oAuthService.getIdentityClaims();

      if (!accessToken || !profile) {
        throw new Error('No access token or profile available');
      }

      console.log('🔄 Authenticating with Supabase...', {
        email: profile.email,
      });

      // Call Supabase edge function for Google auth
      const response = await this.http
        .post(`${this.SUPABASE_FUNCTIONS_URL}/google-auth`, {
          accessToken,
          idToken,
          userInfo: profile,
        })
        .toPromise();

      if (response && (response as any).success) {
        const authResponse = response as any;

        // Save Supabase access token to localStorage
        if (authResponse.session?.access_token) {
          localStorage.setItem(
            'access_token',
            authResponse.session.access_token
          );
          localStorage.setItem(
            'refresh_token',
            authResponse.session.refresh_token || ''
          );
          console.log('✅ Supabase access token saved to localStorage');
        }

        // Set session in AuthService
        if (authResponse.session) {
          this.authService.setSession(authResponse.session);
        }

        // Save user profile to localStorage as backup
        if (authResponse.user) {
          const userProfile = {
            id: authResponse.user.id,
            email: authResponse.user.email,
            name: profile.name,
            picture: profile.picture,
            authenticated_via: 'google',
            authenticated_at: new Date().toISOString(),
            supabase_user: authResponse.user,
            patient_profile: authResponse.profile,
          };
          localStorage.setItem('current_user', JSON.stringify(userProfile));
          console.log('✅ User profile saved to localStorage');
        }

        // Update profile
        this.profile.set(authResponse.user || profile);

        console.log(
          '✅ Google authentication successful:',
          authResponse.message
        );

        // Redirect to dashboard
        this.router.navigate(['/dashboard']);
      } else {
        throw new Error((response as any)?.error || 'Authentication failed');
      }
    } catch (error: any) {
      console.error('❌ Supabase authentication error:', error);
      this.error.set(error.message || 'Authentication failed');

      // Still save Google tokens and profile as fallback
      this.saveTokenToLocalStorage();
      const profile = this.oAuthService.getIdentityClaims();
      if (profile) {
        const fallbackProfile = {
          id: profile.sub,
          email: profile.email,
          name: profile.name,
          picture: profile.picture,
          authenticated_via: 'google_fallback',
          authenticated_at: new Date().toISOString(),
        };
        localStorage.setItem('current_user', JSON.stringify(fallbackProfile));
        console.log('⚠️ Saved Google profile as fallback');

        // Still redirect to dashboard with fallback data
        this.router.navigate(['/dashboard']);
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  saveTokenToLocalStorage() {
    const accessToken = this.oAuthService.getAccessToken();
    const idToken = this.oAuthService.getIdToken();
    if (accessToken) localStorage.setItem('access_token', accessToken);
    if (idToken) localStorage.setItem('id_token', idToken);
  }

  getProfile() {
    return this.profile();
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return this.oAuthService.hasValidAccessToken() && this.profile() !== null;
  }

  // Get loading state
  getLoadingState() {
    return this.isLoading();
  }

  // Get error state
  getError() {
    return this.error();
  }

  // Clear error
  clearError() {
    this.error.set(null);
  }
}
