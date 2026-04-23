// ================== IMPORTS ==================
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../environments/environment';
import { type UserLogin, type UserRegister } from '../models/user.model';
import {
  Observable,
  BehaviorSubject,
  from,
  map,
  catchError,
  of,
  finalize,
  tap,
} from 'rxjs';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Patient, DashboardPatient } from '../models/patient.model';
import { Appointment, DashboardAppointment } from '../models/appointment.model';

export interface AuthUser {
  id: string;
  phone: string;
  email?: string;
  patientId?: string;
  patient?: Patient;
}

export interface EdgeFunctionUserProfile {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  date_of_birth?: string;
  gender: 'male' | 'female' | 'other';
  patient_status: 'active' | 'inactive';
  image_link?: string;
  appointments: Appointment[];
}

// ================== SERVICE DECORATOR ==================
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private supabase: SupabaseClient;
  private currentUserSubject = new BehaviorSubject<AuthUser | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  // =========== CONSTRUCTOR ===========
  constructor(private http: HttpClient) {
    // Initialize Supabase client using environment configuration
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseKey
    );

    // Initialize real authentication
    this.initializeAuth();
  }

  // =========== PRIVATE HEADER BUILDER ===========
  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
    });
  }

  // =========== GET VALID ACCESS TOKEN ===========
  private async getValidAccessToken(): Promise<string | null> {
    try {
      // First try to get current session
      const {
        data: { session },
        error,
      } = await this.supabase.auth.getSession();

      if (error) {
        console.error('Error getting session:', error);
        return null;
      }

      if (session?.access_token) {
        // Store the valid token
        localStorage.setItem('access_token', session.access_token);
        if (session.refresh_token) {
          localStorage.setItem('refresh_token', session.refresh_token);
        }
        console.log('Valid Supabase access token retrieved');
        return session.access_token;
      }

      // If no session, try to refresh or create anonymous session
      console.log('No active session found');
      return null;
    } catch (error) {
      console.error('Error getting valid access token:', error);
      return null;
    }
  }

  // =========== SET SESSION (for external auth like Google) ===========
  setSession(session: any): void {
    if (session?.access_token) {
      localStorage.setItem('access_token', session.access_token);
      if (session.refresh_token) {
        localStorage.setItem('refresh_token', session.refresh_token);
      }

      // Set the session in Supabase client
      this.supabase.auth.setSession(session);

      // Update current user if user data is available
      if (session.user) {
        const authUser: AuthUser = {
          id: session.user.id,
          phone: session.user.phone || '',
          email: session.user.email,
          patientId: session.user.user_metadata?.patient_id,
        };
        this.currentUserSubject.next(authUser);
      }

      console.log('Session set successfully');
    }
  }

  // =========== CREATE DEVELOPMENT SESSION ===========
  async createDevelopmentSession(): Promise<boolean> {
    try {
      // Try to sign in anonymously for development
      const { data, error } = await this.supabase.auth.signInAnonymously();

      if (error) {
        console.error('Error creating anonymous session:', error);

        // Try to create a user with email/password for development
        const devEmail = 'dev@test.com';
        const devPassword = 'devpassword123';

        const { data: signUpData, error: signUpError } =
          await this.supabase.auth.signUp({
            email: devEmail,
            password: devPassword,
          });

        if (signUpError) {
          console.error('Error creating dev user:', signUpError);
          return false;
        }

        // Try to sign in with the dev user
        const { data: signInData, error: signInError } =
          await this.supabase.auth.signInWithPassword({
            email: devEmail,
            password: devPassword,
          });

        if (signInError) {
          console.error('Error signing in dev user:', signInError);
          return false;
        }

        if (signInData.session?.access_token) {
          localStorage.setItem('access_token', signInData.session.access_token);
          localStorage.setItem(
            'refresh_token',
            signInData.session.refresh_token || ''
          );
          console.log('Development session created with email/password');
          return true;
        }

        return false;
      }

      if (data.session?.access_token) {
        localStorage.setItem('access_token', data.session.access_token);
        localStorage.setItem('refresh_token', data.session.refresh_token || '');
        console.log('Development session created anonymously');
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error creating development session:', error);
      return false;
    }
  }

  // =========== FORCE REFRESH TOKEN ===========
  async forceRefreshToken(): Promise<boolean> {
    try {
      const { data, error } = await this.supabase.auth.refreshSession();

      if (error) {
        console.error('Error refreshing session:', error);
        // Try to create a new development session
        return await this.createDevelopmentSession();
      }

      if (data.session?.access_token) {
        localStorage.setItem('access_token', data.session.access_token);
        localStorage.setItem('refresh_token', data.session.refresh_token || '');
        console.log('Token refreshed successfully');
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error in forceRefreshToken:', error);
      return await this.createDevelopmentSession();
    }
  }

  // =========== DEBUG TOKEN ===========
  debugToken(): void {
    const token = localStorage.getItem('access_token');
    console.log('=== TOKEN DEBUG ===');
    console.log('Token exists:', !!token);
    console.log('Token length:', token?.length || 0);
    console.log('Token preview:', token?.substring(0, 50) + '...');

    if (token) {
      try {
        // Try to decode JWT payload (just for debugging)
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          // Token payload log removed for security
        }
      } catch (e) {
        console.log('Token is not a valid JWT:', e);
      }
    }
    console.log('==================');
  }

  // =========== INITIALIZE AUTHENTICATION ===========
  private async initializeAuth(): Promise<void> {
    try {
      // First check if we have an access token
      const accessToken = localStorage.getItem('access_token');

      if (accessToken) {
        console.log('✅ Access token found in localStorage');

        // Check if user is already authenticated with Supabase
        const {
          data: { session },
          error,
        } = await this.supabase.auth.getSession();

        if (error) {
          console.error('Error checking session:', error);
          // Fallback to localStorage user
          this.loadUserFromLocalStorage();
          return;
        }

        if (session?.user) {
          // User is authenticated, set up the session
          this.setSession(session);
          console.log('✅ User already authenticated:', session.user.email);
        } else {
          // No Supabase session but we have access token, try to restore from localStorage
          this.loadUserFromLocalStorage();
        }
      } else {
        console.log('❌ No access token found');
        // Check if we have user data in localStorage (fallback)
        this.loadUserFromLocalStorage();
      }
    } catch (error) {
      console.error('Error initializing auth:', error);
      // Fallback to localStorage user
      this.loadUserFromLocalStorage();
    }
  }

  // =========== LOAD USER FROM LOCALSTORAGE ===========
  private loadUserFromLocalStorage(): void {
    try {
      const currentUserStr = localStorage.getItem('current_user');

      if (currentUserStr) {
        const currentUser = JSON.parse(currentUserStr);
        // Sensitive logs removed

        // Create AuthUser from localStorage data
        const authUser: AuthUser = {
          id: currentUser.id,
          phone: currentUser.phone || '',
          email: currentUser.email,
          patientId: currentUser.supabase_user?.id || currentUser.id,
          patient: currentUser.patient_profile || {
            id: currentUser.supabase_user?.id || currentUser.id,
            full_name: currentUser.name,
            email: currentUser.email,
            phone: currentUser.phone || '',
            image_link: currentUser.picture,
            patient_status: 'active',
            created_at: currentUser.authenticated_at,
            updated_at: currentUser.authenticated_at,
          },
        };

        this.currentUserSubject.next(authUser);
        console.log('✅ User restored from localStorage');
      } else {
        // No user data in localStorage, but we might have a token
        // Create a minimal user object for phone-based authentication
        const accessToken =
          localStorage.getItem('access_token') ||
          sessionStorage.getItem('access_token');
        if (accessToken) {
          console.log(
            '📱 No user data but found token, creating minimal user profile'
          );
          // Try to get user profile from API or create minimal profile
          this.fetchUserProfileFromToken().subscribe({
            next: (userProfile) => {
              if (userProfile) {
                this.currentUserSubject.next(userProfile);
                // Save to localStorage for future use
                localStorage.setItem(
                  'current_user',
                  JSON.stringify(userProfile)
                );
                console.log('✅ User profile fetched and saved');
              }
            },
            error: (error) => {
              console.error('Error fetching user profile:', error);
              // Create a minimal user object as fallback
              const minimalUser: AuthUser = {
                id: 'phone-user',
                phone: '',
                email: '',
                patientId: 'phone-user',
                patient: {
                  id: 'phone-user',
                  full_name: 'Phone User',
                  email: '',
                  phone: '',
                  image_link: '',
                  patient_status: 'active',
                  gender: 'other',
                  vaccination_status: 'not_vaccinated',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
              };
              this.currentUserSubject.next(minimalUser);
              console.log(
                '✅ Created minimal user profile for phone authentication'
              );
            },
          });
        } else {
          console.log('❌ No user data or token found');
        }
      }
    } catch (error) {
      console.error('Error loading user from localStorage:', error);
    }
  }

  // =========== FETCH USER PROFILE FROM TOKEN ===========
  private fetchUserProfileFromToken(): Observable<AuthUser | null> {
    const accessToken =
      localStorage.getItem('access_token') ||
      sessionStorage.getItem('access_token');

    if (!accessToken) {
      return of(null);
    }

    const headers = new HttpHeaders({
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    });

    // Try to get user profile from your API
    return this.http
      .get<any>(`${environment.apiEndpoint}/me`, { headers })
      .pipe(
        map((response) => {
          if (response && response.data) {
            const userData = response.data;
            const authUser: AuthUser = {
              id: userData.id || 'phone-user',
              phone: userData.phone || '',
              email: userData.email || '',
              patientId: userData.patient_id || userData.id || 'phone-user',
              patient: {
                id: userData.patient_id || userData.id || 'phone-user',
                full_name: userData.full_name || userData.name || 'Phone User',
                email: userData.email || '',
                phone: userData.phone || '',
                image_link: userData.image_link || '',
                patient_status: 'active',
                gender: userData.gender || 'other',
                vaccination_status:
                  userData.vaccination_status || 'not_vaccinated',
                created_at: userData.created_at || new Date().toISOString(),
                updated_at: userData.updated_at || new Date().toISOString(),
              },
            };
            return authUser;
          }
          return null;
        }),
        catchError((error) => {
          console.error('Error fetching user profile from token:', error);
          return of(null);
        })
      );
  }

  // =========== REGISTER USER ===========
  registerUser(userRegisterData: UserRegister) {
    const phone = userRegisterData.phone.startsWith('0')
      ? '+84' + userRegisterData.phone.slice(1)
      : userRegisterData.phone;

    const body: UserRegister = {
      phone,
      password: userRegisterData.password,
    };

    return this.http.post(`${environment.apiEndpoint}/register`, body, {
      headers: this.getHeaders(),
    });
  }

  // =========== LOGIN ===========
  loginWithPhone(phone: string, password: string) {
    console.log('🔐 AUTH SERVICE - LOGIN REQUEST STARTED');
    console.log('📱 Original phone input:', phone);

    const formattedPhone = phone.startsWith('0')
      ? '+84' + phone.slice(1)
      : phone;

    console.log('📱 Formatted phone:', formattedPhone);

    const body: UserLogin = {
      phone: formattedPhone,
      password: password,
    };

    const headers = this.getHeaders();
    const endpoint = `${environment.apiEndpoint}/login`;

    // Sensitive login payload log removed
    console.log('🌐 Login endpoint:', endpoint);

    return this.http.post(endpoint, body, { headers }).pipe(
      tap({
        next: (response) => {
          console.log('✅ LOGIN SUCCESS - Response received:', response);
        },
        error: (error) => {
          console.log('❌ LOGIN ERROR - Error details:');
          console.log('Status:', error.status);
          console.log('Status Text:', error.statusText);
          console.log('Error Body:', error.error);
          console.log('Full Error Object:', error);
        },
      })
    );
  }

  // ================== FORGOT PASSWORD (GỬI OTP) ==================
  forgotPassword(phone: string): Observable<any> {
    const formattedPhone = phone.startsWith('0')
      ? '+84' + phone.slice(1)
      : phone;
    return this.http.post(
      `${environment.apiEndpoint}/forgot-password`,
      { phone: formattedPhone },
      { headers: this.getHeaders() }
    );
  }

  // ================== RESET PASSWORD (NHẬP OTP + MẬT KHẨU MỚI) ==================
  resetPassword(
    phone: string,
    otp: string,
    newPassword: string
  ): Observable<any> {
    const formattedPhone = phone.startsWith('0')
      ? '+84' + phone.slice(1)
      : phone;
    return this.http.post(
      `${environment.apiEndpoint}/reset-password`,
      {
        phone: formattedPhone,
        otp,
        password: newPassword,
      },
      { headers: this.getHeaders() }
    );
  }

  // Add email-based forgot password methods
  forgotPasswordByEmail(email: string): Observable<any> {
    return this.http.post(
      `${environment.apiEndpoint}/request-password-reset`,
      { email: email.toLowerCase().trim() },
      { headers: this.getHeaders() }
    );
  }

  confirmPasswordResetByEmail(
    email: string,
    otp: string,
    newPassword: string,
    timestamp: number
  ): Observable<any> {
    return this.http.post(
      `${environment.apiEndpoint}/confirm-password-reset`,
      {
        email: email.toLowerCase().trim(),
        otp,
        newPassword,
        timestamp,
      },
      { headers: this.getHeaders() }
    );
  }

  // =========== PROFILE ===========
  getUserProfile(): Observable<any> {
    let token =
      localStorage.getItem('access_token') ||
      sessionStorage.getItem('access_token');

    if (!token) {
      throw new Error('No access token found');
    }

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });

    // Call REST API endpoint cho user profile
    return this.http.get(`${environment.apiEndpoint}/me`, {
      headers,
    });
  }

  // =========== EDGE FUNCTION PROFILE ===========
  getUserProfileFromEdgeFunction(): Observable<EdgeFunctionUserProfile> {
    return new Observable((observer) => {
      this.getValidAccessToken()
        .then((token) => {
          if (!token) {
            // Try to get from localStorage as fallback
            token =
              localStorage.getItem('access_token') ||
              sessionStorage.getItem('access_token');
          }

          if (!token) {
            observer.error(
              new Error('No valid access token found. Please login again.')
            );
            return;
          }

          const headers = new HttpHeaders({
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          });

          // Call the edge function endpoint
          const edgeFunctionUrl = `${environment.supabaseUrl}/functions/v1/me`;

          this.http
            .get<EdgeFunctionUserProfile>(edgeFunctionUrl, { headers })
            .subscribe({
              next: (response) => {
                // Update current user with edge function data
                if (response) {
                  const updatedUser: AuthUser = {
                    id: response.id,
                    phone: response.phone,
                    email: response.email,
                    patientId: response.id,
                    patient: {
                      id: response.id,
                      full_name: response.full_name,
                      phone: response.phone,
                      email: response.email,
                      date_of_birth: response.date_of_birth,
                      gender: response.gender,
                      patient_status: response.patient_status,
                      image_link: response.image_link,
                      vaccination_status: 'not_vaccinated',
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    },
                  };
                  this.currentUserSubject.next(updatedUser);
                }
                observer.next(response);
                observer.complete();
              },
              error: (error) => {
                console.error(
                  'Error fetching user profile from edge function:',
                  error
                );

                // If it's a 401 error, try to refresh token and retry
                if (error.status === 401) {
                  console.log('Token expired, attempting to refresh...');
                  this.forceRefreshToken().then((success) => {
                    if (success) {
                      console.log('Token refreshed, retrying request...');
                      // Retry the request with new token
                      const newToken = localStorage.getItem('access_token');
                      if (newToken) {
                        const newHeaders = new HttpHeaders({
                          Authorization: `Bearer ${newToken}`,
                          'Content-Type': 'application/json',
                        });

                        this.http
                          .get<EdgeFunctionUserProfile>(edgeFunctionUrl, {
                            headers: newHeaders,
                          })
                          .subscribe({
                            next: (response) => {
                              if (response) {
                                const updatedUser: AuthUser = {
                                  id: response.id,
                                  phone: response.phone,
                                  email: response.email,
                                  patientId: response.id,
                                  patient: {
                                    id: response.id,
                                    full_name: response.full_name,
                                    phone: response.phone,
                                    email: response.email,
                                    date_of_birth: response.date_of_birth,
                                    gender: response.gender,
                                    patient_status: response.patient_status,
                                    image_link: response.image_link,
                                    vaccination_status: 'not_vaccinated',
                                    created_at: new Date().toISOString(),
                                    updated_at: new Date().toISOString(),
                                  },
                                };
                                this.currentUserSubject.next(updatedUser);
                              }
                              observer.next(response);
                              observer.complete();
                            },
                            error: (retryError) => {
                              console.error('Retry failed:', retryError);
                              observer.error(retryError);
                            },
                          });
                      } else {
                        observer.error(error);
                      }
                    } else {
                      observer.error(error);
                    }
                  });
                } else {
                  observer.error(error);
                }
              },
            });
        })
        .catch((error) => {
          console.error('Error getting access token:', error);
          observer.error(error);
        });
    });
  }

  // =========== PATIENT STATE MANAGEMENT ===========

  /**
   * Get current user synchronously
   */
  getCurrentUser(): AuthUser | null {
    return this.currentUserSubject.value;
  }

  /**
   * Get current user as observable
   */
  getCurrentUser$(): Observable<AuthUser | null> {
    return this.currentUser$;
  }

  /**
   * Get current patient ID
   */
  getCurrentPatientId(): string | null {
    const user = this.getCurrentUser();
    return user?.patientId || null;
  }

  /**
   * Get current patient data
   */
  getCurrentPatient(): Patient | null {
    const user = this.getCurrentUser();
    return user?.patient || null;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    // Check if we have a current user in memory
    const currentUser = this.getCurrentUser();
    if (currentUser !== null) {
      return true;
    }

    // If no user in memory, check for valid tokens
    const accessToken =
      localStorage.getItem('access_token') ||
      sessionStorage.getItem('access_token');
    if (accessToken) {
      // We have a token, try to load user data
      this.loadUserFromLocalStorage();
      return true;
    }

    return false;
  }

  // =========== LOGOUT ===========
  logout(): void {
    this.currentUserSubject.next(null);
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('current_user');
    localStorage.removeItem('id_token');

    // Also sign out from Supabase
    this.supabase.auth.signOut();

    console.log('✅ User logged out and localStorage cleared');
  }

  /**
   * Update current user's patient data
   */
  updateCurrentPatient(updatedPatient: Patient): void {
    const currentUser = this.getCurrentUser();
    if (currentUser) {
      const updatedUser: AuthUser = {
        ...currentUser,
        patient: updatedPatient,
      };
      this.currentUserSubject.next(updatedUser);
    }
  }

  // ========== SUPABASE DATA METHODS ==========

  /**
   * Fetch all patients from the database
   */
  getPatients(): Observable<Patient[]> {
    return from(
      this.supabase
        .from('patients')
        .select('*')
        .order('created_at', { ascending: false })
    ).pipe(
      map((response) => {
        if (response.error) {
          throw new Error(response.error.message);
        }
        return response.data || [];
      }),
      catchError((error) => {
        console.error('Error fetching patients:', error);
        return of([]);
      })
    );
  }

  /**
   * Get dashboard-specific patient data with computed fields
   */
  getDashboardPatients(): Observable<DashboardPatient[]> {
    return this.getPatients().pipe(
      map((patients) =>
        patients.map((patient) => this.transformPatientForDashboard(patient))
      )
    );
  }

  /**
   * Get patient count
   */
  getPatientCount(): Observable<number> {
    return from(
      this.supabase.from('patients').select('*', { count: 'exact', head: true })
    ).pipe(
      map((response) => {
        if (response.error) {
          throw new Error(response.error.message);
        }
        return response.count || 0;
      }),
      catchError((error) => {
        console.error('Error fetching patient count:', error);
        return of(0);
      })
    );
  }

  /**
   * Fetch appointments from the database, optionally filtered by patient ID
   */
  getAppointments(patientId?: string): Observable<Appointment[]> {
    let query = this.supabase
      .from('appointments')
      .select('*')
      .order('created_at', { ascending: false });

    // Filter by patient ID if provided
    if (patientId) {
      query = query.eq('patient_id', patientId);
    }

    return from(query).pipe(
      map((response) => {
        if (response.error) {
          throw new Error(response.error.message);
        }
        return response.data || [];
      }),
      catchError((error) => {
        console.error('Error fetching appointments:', error);
        return of([]);
      })
    );
  }

  /**
   * Get dashboard-specific appointment data
   */
  getDashboardAppointments(
    patientId?: string
  ): Observable<DashboardAppointment[]> {
    return this.getAppointments(patientId).pipe(
      map((appointments) =>
        appointments.map((appointment) =>
          this.transformAppointmentForDashboard(appointment)
        )
      )
    );
  }

  /**
   * Get appointment count by status
   */
  getAppointmentCountByStatus(status?: string): Observable<number> {
    let query = this.supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true });

    if (status) {
      query = query.eq('appointment_status', status);
    }

    return from(query).pipe(
      map((response) => {
        if (response.error) {
          throw new Error(response.error.message);
        }
        return response.count || 0;
      }),
      catchError((error) => {
        console.error(
          `Error fetching appointment count for status ${status}:`,
          error
        );
        return of(0);
      })
    );
  }

  /**
   * Update patient profile information
   */
  updatePatientProfile(
    patientId: string,
    updates: Partial<Patient>
  ): Observable<Patient> {
    return from(
      this.supabase
        .from('patients')
        .update(updates)
        .eq('id', patientId)
        .select()
        .single()
    ).pipe(
      map((response) => {
        if (response.error) {
          throw new Error(response.error.message);
        }
        return response.data;
      }),
      catchError((error) => {
        console.error('Error updating patient profile:', error);
        throw error;
      })
    );
  }

  /**
   * Upload avatar image to Supabase Storage
   */
  uploadAvatar(
    filePath: string,
    file: File
  ): Promise<{ data: any; error: any }> {
    return this.supabase.storage.from('avatars').upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
    });
  }

  /**
   * Get public URL for avatar image
   */
  getAvatarPublicUrl(filePath: string): string {
    const { data } = this.supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  // ========== HELPER METHODS ==========

  /**
   * Transform Patient to DashboardPatient
   */
  private transformPatientForDashboard(patient: Patient): DashboardPatient {
    const age = patient.date_of_birth
      ? this.calculateAge(patient.date_of_birth)
      : undefined;

    return {
      id: patient.id,
      name: patient.full_name,
      email: patient.email,
      phone: patient.phone,
      gender: patient.gender,
      age: age,
      status: patient.patient_status,
      image_link: patient.image_link,
    };
  }

  /**
   * Transform Appointment to DashboardAppointment
   */
  private transformAppointmentForDashboard(
    appointment: Appointment
  ): DashboardAppointment {
    const appointmentDate =
      appointment.appointment_date ||
      appointment.preferred_date ||
      new Date().toISOString().split('T')[0];
    const appointmentTime =
      appointment.appointment_time || appointment.preferred_time || '00:00';

    return {
      id: appointment.appointment_id,
      title: this.getAppointmentTitle(appointment.visit_type),
      type: appointment.visit_type,
      time: this.formatTime(appointmentTime),
      date: appointmentDate,
      status: appointment.appointment_status || 'pending',
      schedule: appointment.schedule,
    };
  }

  /**
   * Calculate age from date of birth
   */
  private calculateAge(dateOfBirth: string): number {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    return age;
  }

  /**
   * Get appointment title based on visit type
   */
  private getAppointmentTitle(visitType: string): string {
    switch (visitType) {
      case 'virtual':
        return 'Virtual Consultation';
      case 'internal':
        return 'In-Person Visit';
      case 'external':
        return 'External Referral';
      case 'consultation':
        return 'Medical Consultation';
      default:
        return 'Appointment';
    }
  }

  /**
   * Format time string for display
   */
  private formatTime(timeString: string): string {
    try {
      const [hours, minutes] = timeString.split(':');
      const hour = parseInt(hours, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    } catch (error) {
      return timeString;
    }
  }
}
