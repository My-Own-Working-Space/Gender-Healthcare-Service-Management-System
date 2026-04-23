import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  Observable,
  from,
  map,
  catchError,
  of,
  switchMap,
  BehaviorSubject,
} from 'rxjs';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../environments/environment';
import { AuthService } from './auth.service';
import {
  PeriodEntry,
  PeriodStats,
  PeriodTrackingRequest,
  PeriodTrackingResponse,
  calculateCycleDay,
  calculateNextPeriodDate,
  calculateFertileWindow,
  calculateOvulationDate,
  calculateFertilityAnalysis,
  calculateConceptionTiming,
  calculatePeriodStatus,
} from '../models/period-tracking.model';

// Database function response interfaces
interface DatabaseFunctionResponse {
  message?: string;
  period_id?: string;
  predictions?: any;
  success?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class PeriodTrackingService {
  private supabase: SupabaseClient;
  private authService = inject(AuthService);
  private http = inject(HttpClient);

  // In-memory storage for period data
  private periodHistorySubject = new BehaviorSubject<PeriodEntry[]>([]);
  private periodStatsSubject = new BehaviorSubject<PeriodStats | null>(null);

  // Database function names
  private readonly DB_FUNCTIONS = {
    TRACK_PERIOD: 'create_period_entry',
    GET_PERIOD_HISTORY: 'get_period_history',
    GET_PERIOD_STATS: 'get_period_stats',
    UPDATE_PERIOD: 'update_period_entry',
  };

  constructor() {
    console.log('Initializing PeriodTrackingService...');
    
    // Only use anon key for client-side operations
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseAnonKey);

    console.log('Supabase client created successfully for period tracking');

    // Set up auth state listener to ensure we have proper session
    this.initializeSupabaseAuth();
  }

  private async initializeSupabaseAuth(): Promise<void> {
    try {
      // Try to get existing session
      const {
        data: { session },
        error,
      } = await this.supabase.auth.getSession();

      if (error) {
        console.warn('Error getting Supabase session:', error);
      }

      if (session) {
        console.log('Supabase session found:', session.user?.id);
      } else {
        console.log('No Supabase session found, will use anon access');
      }

      // Listen for auth changes
      this.supabase.auth.onAuthStateChange((event, session) => {
        console.log(
          'Supabase auth state changed:',
          event,
          session?.user?.id
        );
      });
    } catch (error) {
      console.error('Error initializing Supabase auth:', error);
    }
  }

  // =========== UUID HELPER METHODS ===========
  private isValidUUID(str: string): boolean {
    if (!str || typeof str !== 'string') {
      return false;
    }

    // UUID v4 regex pattern
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const isValid = uuidRegex.test(str);

    console.log('UUID validation:', { input: str, isValid });
    return isValid;
  }

  private generateUUIDFromString(str: string): string {
    // Generate a proper UUID v4 from string hash
    const hash = this.simpleHash(str);
    const hex = Math.abs(hash).toString(16).padStart(8, '0');

    // Create additional entropy
    const timestamp = Date.now().toString(16);
    const random = Math.random().toString(16).substring(2, 10);

    // Combine to create 32 hex characters
    const combined = (hex + timestamp + random + '00000000000000000000000000000000').substring(0, 32);

    // Format as proper UUID v4: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    const uuid = [
      combined.substring(0, 8),
      combined.substring(8, 12),
      '4' + combined.substring(13, 16), // Version 4
      ((parseInt(combined.substring(16, 17), 16) & 0x3) | 0x8).toString(16) + combined.substring(17, 20), // Variant bits
      combined.substring(20, 32)
    ].join('-');

    console.log('Generated UUID from string:', { input: str, output: uuid });
    return uuid;
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Generate a proper random UUID v4
   */
  private generateRandomUUID(): string {
    // Use crypto.randomUUID if available (modern browsers)
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }

    // Fallback: manual UUID v4 generation
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // =========== IN-MEMORY STORAGE METHODS ===========
  private getCurrentUserId(): string {
    try {
      // First try to get user from localStorage directly
      const currentUserStr = localStorage.getItem('current_user');
      if (currentUserStr) {
        const currentUser = JSON.parse(currentUserStr);
        const userId =
          currentUser.supabase_user?.id ||
          currentUser.id ||
          currentUser.patient_id;

        console.log('Getting current user ID from localStorage:', {
          currentUser,
          userId,
          source: 'localStorage',
        });

        if (userId) {
          return userId;
        }
      }

      // Fallback: try auth service
      const authUser = this.authService.getCurrentUser();
      const authUserId = authUser?.patientId || authUser?.id;

      console.log('Getting current user ID from authService:', {
        authUser,
        authUserId,
        source: 'authService',
      });

      if (authUserId) {
        return authUserId;
      }

      // Final fallback: generate a session-based user ID
      let sessionUserId = sessionStorage.getItem('session_user_id');
      if (!sessionUserId) {
        sessionUserId = `user_${Date.now()}_${Math.random()
          .toString(36)
          .substring(2, 11)}`;
        sessionStorage.setItem('session_user_id', sessionUserId);
        console.log('Generated new session user ID:', sessionUserId);
      }

      console.log('Using session user ID:', sessionUserId);
      return sessionUserId;
    } catch (error) {
      console.error('Error getting current user ID:', error);
      // Generate a fallback ID
      const fallbackId = `fallback_${Date.now()}`;
      console.log('Using fallback user ID:', fallbackId);
      return fallbackId;
    }
  }

  /**
   * Check if user has period data in memory
   */
  hasMemoryData(): boolean {
    const memoryData = this.periodHistorySubject.value;
    return memoryData !== null && memoryData.length > 0;
  }

  /**
   * Debug method to check what user data is available
   */
  private debugUserData(): void {
    console.log('Debugging user data sources:');

    // Check localStorage
    const currentUserStr = localStorage.getItem('current_user');
    console.log(
      'localStorage current_user:',
      currentUserStr ? JSON.parse(currentUserStr) : null
    );

    // Check sessionStorage
    const sessionUserId = sessionStorage.getItem('session_user_id');
    console.log('sessionStorage session_user_id:', sessionUserId);

    // Check auth service
    const authUser = this.authService.getCurrentUser();
    console.log('AuthService current user:', authUser);

    // Check access tokens
    const accessToken = localStorage.getItem('access_token');
    const sessionAccessToken = sessionStorage.getItem('access_token');
    console.log('Access tokens:', {
      localStorage: !!accessToken,
      sessionStorage: !!sessionAccessToken,
    });
  }



  // =========== DATABASE ONLY METHODS ===========

  /**
   * Public method to test user data retrieval (for debugging)
   */
  testUserDataRetrieval(): void {
    console.log('Testing user data retrieval...');
    this.debugUserData();
    const userId = this.getCurrentUserId();
    console.log('Final user ID:', userId);

    // Test UUID validation
    const isValid = this.isValidUUID(userId);
    console.log('User ID is valid UUID:', isValid);

    if (!isValid) {
      const generatedUUID = this.generateUUIDFromString(userId);
      console.log(' Generated UUID from string:', generatedUUID);
    }

    console.log('Period tracking service initialized successfully');
  }



  /**
   * Test database connection
   */
  async testDatabaseConnection(): Promise<void> {
    console.log('Testing database connection...');

    try {
      const { data, error } = await this.supabase.from('patients').select('id').limit(1);
      if (error) {
        console.error('❌ Connection test failed:', error.message);
      } else {
        console.log('✅ Connection SUCCESS!');
      }
    } catch (error) {
      console.error('❌ Connection test exception:', error);
    }
  }

  /**
   * Get a valid patient ID for the current user
   */
  private async getValidPatientId(): Promise<string> {
    const userId = this.getCurrentUserId();
    console.log('Getting valid patient ID for user:', userId);

    // Get or create a valid patient_id
    let validPatientId = userId;
    if (!this.isValidUUID(userId)) {
      console.log('User ID is not a valid UUID, getting valid patient...');
      validPatientId = await this.getOrCreateTestPatient(this.supabase);
      console.log('Using patient ID:', validPatientId);
    } else {
      // Even if it's a valid UUID, check if patient exists
      const { data: patientExists } = await this.supabase
        .from('patients')
        .select('id')
        .eq('id', userId)
        .single();

      if (!patientExists) {
        console.log('Patient ID not found in database, getting valid patient...');
        validPatientId = await this.getOrCreateTestPatient(this.supabase);
        console.log('Using existing patient ID:', validPatientId);
      }
    }

    return validPatientId;
  }

  /**
   * Get existing patient or create a test patient for testing
   */
  private async getOrCreateTestPatient(client: any): Promise<string> {
    try {
      // First, try to get any existing patient
      const { data: existingPatients, error: selectError } = await client
        .from('patients')
        .select('id')
        .limit(5); // Get multiple patients to choose from

      if (!selectError && existingPatients && existingPatients.length > 0) {
        // Use the first existing patient
        const patientId = existingPatients[0].id;
        console.log('Using existing patient:', patientId);
        console.log(`Found ${existingPatients.length} total patients in database`);
        return patientId;
      }

      // If no patients exist, try to create one with a deterministic approach
      console.log('No patients found, creating patient...');

      // Use a deterministic UUID for test patient to avoid duplicates
      const testPatientId = '550e8400-e29b-41d4-a716-446655440000'; // Fixed test UUID

      // Check if our test patient already exists
      const { data: existingTestPatient } = await client
        .from('patients')
        .select('id')
        .eq('id', testPatientId)
        .single();

      if (existingTestPatient) {
        console.log('Patient already exists, using it:', existingTestPatient.id);
        return existingTestPatient.id;
      }

      // Try to create the test patient
      const { data: newPatient, error: insertError } = await client
        .from('patients')
        .insert({
          id: testPatientId,
          full_name: 'System User',
          email: 'system@healthcare.com',
          phone: '0000000000',
          date_of_birth: '1990-01-01',
          gender: 'female'
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('Failed to create patient:', insertError);

        // If creation fails, the patient might already exist due to race condition
        // Try to get it again
        const { data: retryPatient } = await client
          .from('patients')
          .select('id')
          .eq('id', testPatientId)
          .single();

        if (retryPatient) {
          console.log('✅ Test patient exists after retry:', retryPatient.id);
          return retryPatient.id;
        }

        // Last resort: return the fixed UUID anyway (might work if patient exists)
        console.log('⚠️ Using fallback UUID:', testPatientId);
        return testPatientId;
      }

      console.log('Created new patient:', newPatient.id);
      return newPatient.id;

    } catch (error) {
      console.error('Error in getOrCreateTestPatient:', error);
      // Fallback: use a hardcoded UUID
      return '00000000-0000-4000-8000-000000000000';
    }
  }



  /**
   * Log new period data - ONLY save to database, NO localStorage fallback
   */
  logPeriodData(
    request: PeriodTrackingRequest
  ): Observable<PeriodTrackingResponse> {
    console.log('PERIOD SERVICE - Starting period data logging to DATABASE...');
    console.log('Request data:', request);

    return new Observable((observer) => {
      // First check API key and authentication
      this.checkApiKeyAndAuth().then(async (authCheck) => {
        if (!authCheck.isValid) {
          console.error('API KEY/AUTH ERROR:', authCheck.error);
          observer.error(new Error(`Authentication failed: ${authCheck.error}`));
          return;
        }

        console.log('API key and authentication validated');

        try {
          // Get valid patient ID using the centralized method
          const validPatientId = await this.getValidPatientId();
          console.log(' Using patient ID:', validPatientId);

          // Prepare parameters for database function create_period_entry
          const functionParams = {
            p_patient_id: validPatientId,
            p_start_date: request.start_date,
            p_end_date: null, // Will be set when period ends
            p_cycle_length: request.cycle_length || 28, // Default 28 days, cannot be null
            p_flow_intensity: request.flow_intensity || 'medium',
            p_symptoms: JSON.stringify(request.symptoms || []), // Convert to JSON string
            p_period_description: request.period_description || null,
            p_predictions: null, // Will be calculated later
            p_period_length: request.period_length || 5, // Default 5 days, cannot be null
          };

          console.log('Calling database function:', {
            function: this.DB_FUNCTIONS.TRACK_PERIOD,
            params: functionParams,
          });

          // Call Supabase database function
          from(this.supabase.rpc(this.DB_FUNCTIONS.TRACK_PERIOD, functionParams))
            .pipe(
              map(({ data, error }) => {
                console.log('Raw RPC response:', { data, error });

                if (error) {
                  console.error('DATABASE ERROR - Function call failed:', {
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                    code: error.code,
                    function: this.DB_FUNCTIONS.TRACK_PERIOD,
                    params: functionParams
                  });

                  // Throw error to be caught by catchError
                  throw error;
                }

                console.log('DATABASE SUCCESS - Function response:', data);

                // create_period_entry returns a UUID directly, not an object
                const periodId = data || `period_${Date.now()}`;

                const response: PeriodTrackingResponse = {
                  success: true,
                  message: 'Period data saved to database successfully',
                  period_id: periodId,
                };

                console.log('PERIOD SERVICE - Period logged to database:', response);
                return response;
              }),
              catchError((error) => {
                console.error('PERIOD SERVICE - Database operation failed:', {
                  error: error,
                  message: error.message,
                  stack: error.stack,
                  function: this.DB_FUNCTIONS.TRACK_PERIOD,
                  params: functionParams
                });

                // Return error observable instead of fallback
                throw error;
              })
            )
            .subscribe({
              next: (response) => {
                observer.next(response);
                observer.complete();
              },
              error: (error) => {
                console.error('FINAL ERROR - Period logging failed completely:', error);
                observer.error(error);
              },
            });
        } catch (error) {
          console.error('PERIOD SERVICE - Unexpected error in try block:', error);
          observer.error(error);
        }
      }).catch((error: any) => {
        console.error('AUTH CHECK ERROR:', error);
        observer.error(error);
      });
    });
  }

  /**
   * Check API key and authentication status
   */
  private async checkApiKeyAndAuth(): Promise<{ isValid: boolean, error?: string }> {
    try {
      // Check if we have API keys
      if (!environment.supabaseUrl) {
        return { isValid: false, error: 'Missing Supabase URL' };
      }

      if (!environment.supabaseAnonKey) {
        return { isValid: false, error: 'Missing Supabase API keys' };
      }

      // Check current session
      const { data: { session }, error: sessionError } = await this.supabase.auth.getSession();

      if (sessionError) {
        console.warn('⚠️ Session error (may be normal for anon access):', sessionError);
      }

      console.log('🔍 Auth status:', {
        hasSession: !!session,
        userId: session?.user?.id || 'anonymous',
        apiKeyUsed: 'anon'
      });

      // For RPC calls, we can work with or without session (depending on RLS policies)
      return { isValid: true };

    } catch (error) {
      return { isValid: false, error: `Auth check failed: ${error}` };
    }
  }

  /**
   * Get period history from database only
   */
  getPeriodHistory(): Observable<PeriodEntry[]> {
    console.log('Getting period history from DATABASE...');

    return new Observable((observer) => {
      this.getValidPatientId().then((validPatientId: string) => {
        console.log('👤 Getting history for patient ID:', validPatientId);

        // Query the period_tracking table directly instead of using RPC function
        const queryPromise = this.supabase
          .from('period_tracking')
          .select(`
            period_id,
            patient_id,
            start_date,
            end_date,
            cycle_length,
            flow_intensity,
            symptoms,
            period_description,
            predictions,
            created_at,
            updated_at,
            period_length
          `)
          .eq('patient_id', validPatientId)
          .order('start_date', { ascending: false })
          .limit(50);

        // Convert PromiseLike to Promise to use catch
        Promise.resolve(queryPromise).then(({ data, error }) => {
          console.log('🔍 Period history direct query response:', { data, error });

          if (error) {
            console.error('❌ DATABASE ERROR - Failed to get period history:', {
              message: error.message,
              details: error.details,
              hint: error.hint,
              code: error.code,
              patientId: validPatientId
            });
            observer.error(error);
            return;
          }

          const periodHistory = (data || []).map((entry: any) => ({
            period_id: entry.period_id,
            patient_id: entry.patient_id,
            start_date: entry.start_date,
            end_date: entry.end_date,
            cycle_length: entry.cycle_length,
            flow_intensity: entry.flow_intensity,
            symptoms: entry.symptoms,
            period_description: entry.period_description,
            predictions: entry.predictions,
            created_at: entry.created_at,
            updated_at: entry.updated_at,
            period_length: entry.period_length
          }));

          console.log('✅ DATABASE SUCCESS - Period history retrieved:', periodHistory);

          // Update memory with database data
          this.periodHistorySubject.next(periodHistory);

          observer.next(periodHistory);
          observer.complete();
        }).catch((error: any) => {
          console.error('❌ PERIOD SERVICE - Failed to get period history:', error);
          observer.next([]);
          observer.complete();
        });
      }).catch((error: any) => {
        console.error('❌ Failed to get valid patient ID:', error);
        observer.next([]);
        observer.complete();
      });
    });
  }



  /**
   * Get period statistics
   */
  getPeriodStats(): Observable<PeriodStats | null> {
    console.log('Getting period stats...');

    // First check memory
    const memoryStats = this.periodStatsSubject.value;
    if (memoryStats) {
      console.log('📊 Returning period stats from memory:', memoryStats);
      return of(memoryStats);
    }

    // Calculate stats from current period history
    const periodHistory = this.periodHistorySubject.value;
    if (periodHistory && periodHistory.length > 0) {
      const stats = this.calculatePeriodStats(periodHistory);
      this.periodStatsSubject.next(stats);
      console.log('📊 Calculated and returning period stats:', stats);
      return of(stats);
    }

    console.log('📊 No period data available for stats calculation');
    return of(null);
  }

  /**
   * Calculate period statistics from history data
   */
  private calculatePeriodStats(history: PeriodEntry[]): PeriodStats | null {
    if (!history || history.length === 0) {
      return null;
    }

    try {
      // Sort history by start date (most recent first)
      const sortedHistory = [...history].sort(
        (a, b) =>
          new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
      );

      const lastPeriodStart = new Date(sortedHistory[0].start_date);

      // Calculate cycle lengths
      const cycleLengths: number[] = [];
      for (let i = 0; i < sortedHistory.length - 1; i++) {
        const current = new Date(sortedHistory[i].start_date);
        const previous = new Date(sortedHistory[i + 1].start_date);
        const cycleLength = Math.round(
          (current.getTime() - previous.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (cycleLength > 0 && cycleLength <= 45) {
          // Reasonable cycle length
          cycleLengths.push(cycleLength);
        }
      }

      const averageCycleLength =
        cycleLengths.length > 0
          ? Math.round(
            cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length
          )
          : 28;

      // Calculate period lengths using actual period_length or default 5 days
      const periodLengths = history
        .filter((entry) => entry.cycle_length) // Only completed periods have cycle_length
        .map((entry) => {
          // Use actual period_length or default 5 days
          return entry.period_length || 5;
        });

      const averagePeriodLength =
        periodLengths.length > 0
          ? Math.round(
            periodLengths.reduce((a, b) => a + b, 0) / periodLengths.length
          )
          : 5;

      // Convert date to string for calculations
      const lastPeriodStartString = lastPeriodStart.toISOString().split('T')[0];

      const currentCycleDay = calculateCycleDay(lastPeriodStartString);
      const nextPeriodDate = calculateNextPeriodDate(
        lastPeriodStartString,
        averageCycleLength
      );
      const fertileWindow = calculateFertileWindow(lastPeriodStartString);
      const ovulationDate = calculateOvulationDate(lastPeriodStartString);

      const nextPeriod = new Date(nextPeriodDate);
      const today = new Date();
      const daysUntilNextPeriod = Math.max(
        0,
        Math.ceil(
          (nextPeriod.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        )
      );

      // Enhanced fertility analysis
      const fertilityAnalysis = calculateFertilityAnalysis(
        lastPeriodStartString,
        averageCycleLength
      );

      const conceptionTiming = calculateConceptionTiming(
        lastPeriodStartString,
        averageCycleLength
      );

      const periodStatus = calculatePeriodStatus(
        sortedHistory,
        averageCycleLength
      );

      const stats: PeriodStats = {
        averageCycleLength,
        currentCycleDay,
        daysUntilNextPeriod,
        nextPeriodDate: nextPeriodDate,
        fertileWindowStart: fertileWindow.start,
        fertileWindowEnd: fertileWindow.end,
        ovulationDate: ovulationDate,
        averagePeriodLength,
        totalCyclesTracked: history.length,
        // Enhanced analysis
        fertilityAnalysis,
        conceptionTiming,
        periodStatus,
      };

      return stats;
    } catch (error) {
      console.error('❌ Error calculating period stats:', error);
      return null;
    }
  }

  /**
   * Get observable for period history changes
   */
  get periodHistory$(): Observable<PeriodEntry[]> {
    return this.periodHistorySubject.asObservable();
  }

  /**
   * Get observable for period stats changes
   */
  get periodStats$(): Observable<PeriodStats | null> {
    return this.periodStatsSubject.asObservable();
  }

  /**
   * Get current ongoing period (period without cycle_length)
   */
  getCurrentOngoingPeriod(): PeriodEntry | null {
    const history = this.periodHistorySubject.value;
    if (!history || history.length === 0) {
      return null;
    }

    // Find the most recent period without a cycle_length (ongoing period)
    const ongoingPeriod = history.find((entry) => !entry.cycle_length);
    return ongoingPeriod || null;
  }

  /**
   * Check if there's currently an ongoing period
   */
  hasOngoingPeriod(): boolean {
    return this.getCurrentOngoingPeriod() !== null;
  }

  /**
   * Get days since period started (for ongoing periods)
   */
  getDaysSincePeriodStarted(): number {
    const ongoingPeriod = this.getCurrentOngoingPeriod();
    if (!ongoingPeriod) {
      return 0;
    }

    const startDate = new Date(ongoingPeriod.start_date);
    const today = new Date();
    const diffTime = today.getTime() - startDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(1, diffDays); // At least 1 day
  }

  /**
   * Delete period entry from database
   */
  deletePeriodEntry(periodId: string): Observable<boolean> {
    console.log('PERIOD SERVICE - Deleting period entry:', periodId);
    
    return new Observable((observer) => {
      // Direct supabase delete
      from(this.supabase.from('period_tracking').delete().eq('period_id', periodId))
        .subscribe({
          next: ({ error }) => {
            if (error) {
              console.error('DATABASE ERROR - Failed to delete period:', error);
              observer.error(error);
              return;
            }
            
            console.log('DATABASE SUCCESS - Period entry deleted');
            // Refresh local signals after delete if any, or just update history
            this.getPeriodHistory().subscribe();
            observer.next(true);
            observer.complete();
          },
          error: (err) => observer.error(err)
        });
    });
  }
}
