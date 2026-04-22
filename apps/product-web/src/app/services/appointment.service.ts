import { Injectable, inject } from '@angular/core';
import { Observable, from, map, catchError, of, switchMap, tap } from 'rxjs';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../environments/environment';
import { AuthService } from './auth.service';
import {
  Appointment,
  GuestAppointment,
  Guest,
  AppointmentCreateRequest,
  AppointmentResponse,
  VisitTypeEnum,
  ScheduleEnum,
  TimeSlot,
  DoctorSlotDetail,
} from '../models/booking.model';

@Injectable({
  providedIn: 'root',
})
export class AppointmentService {
  private supabase: SupabaseClient;
  private authService = inject(AuthService);

  constructor(private http: HttpClient) {
    console.log('🔧 Initializing AppointmentService...');
    console.log('🔧 Supabase URL:', environment.supabaseUrl);
    console.log(
      '🔧 Supabase Key (first 20 chars):',
      environment.supabaseKey?.substring(0, 20) + '...'
    );

    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseKey
    );

    console.log('✅ Supabase client created successfully');
  }

  /**
   * Get appointment history for authenticated user
   */
  getUserAppointmentHistory(): Observable<any[]> {
    console.log('📋 Getting user appointment history...');

    const currentUser = this.authService.getCurrentUser();
    const isAuthenticated = this.authService.isAuthenticated();

    if (!isAuthenticated || !currentUser?.patientId) {
      console.log('❌ User not authenticated or no patient ID');
      return of([]);
    }

    console.log('👤 Getting appointments for patient:', currentUser.patientId);

    return from(
      this.supabase
        .from('appointments')
        .select(`
          *,
          doctors:doctor_id (
            doctor_id,
            full_name,
            specialization,
            image_link
          )
        `)
        .eq('patient_id', currentUser.patientId)
        .order('created_at', { ascending: false })
    ).pipe(
      map(({ data, error }) => {
        if (error) {
          console.error('Error fetching appointment history:', error);
          throw error;
        }

        console.log('Appointment history fetched:', data?.length || 0, 'appointments');
        return data || [];
      }),
      catchError((error) => {
        console.error('Failed to fetch appointment history:', error);
        return of([]);
      })
    );
  }

  /**
   * Get appointment details by ID
   */
  getAppointmentById(appointmentId: string): Observable<any> {
    console.log('Getting appointment details for ID:', appointmentId);

    return from(
      this.supabase
        .from('appointments')
        .select(`
          *,
          doctors:doctor_id (
            doctor_id,
            full_name,
            specialization,
            image_link,
            phone,
            email
          ),
          patients:patient_id (
            id,
            full_name,
            phone,
            email
          )
        `)
        .eq('appointment_id', appointmentId)
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) {
          console.error('Error fetching appointment details:', error);
          throw error;
        }

        console.log('Appointment details fetched:', data);
        return data;
      }),
      catchError((error) => {
        console.error('Failed to fetch appointment details:', error);
        throw error;
      })
    );
  }

  /**
   * Update appointment status
   */
  updateAppointmentStatus(appointmentId: string, status: string): Observable<any> {
    console.log('Updating appointment status:', { appointmentId, status });

    return from(
      this.supabase
        .from('appointments')
        .update({
          status: status,
          updated_at: new Date().toISOString()
        })
        .eq('appointment_id', appointmentId)
        .select()
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) {
          console.error('❌ Error updating appointment status:', error);
          throw error;
        }

        console.log('✅ Appointment status updated:', data);
        return data;
      }),
      catchError((error) => {
        console.error('❌ Failed to update appointment status:', error);
        throw error;
      })
    );
  }

  // Note: Database insertion methods removed - now using edge function

  /**
   * Create appointment for logged-in user or guest using edge function
   */
  createAppointment(
    request: AppointmentCreateRequest
  ): Observable<AppointmentResponse> {
    console.log(
      'APPOINTMENT SERVICE - Starting appointment creation process...'
    );
    console.log('Request data:', JSON.stringify(request, null, 2));

    // Convert Vietnamese phone to E.164 format
    const e164Phone = this.convertToE164(request.phone);
    console.log('Phone converted to E.164:', e164Phone);

    // Map schedule to the format expected by edge function
    const schedule = this.mapScheduleToEdgeFunction(request.schedule);
    console.log('Mapped schedule:', schedule);

    // Prepare appointment data for edge function
    const appointmentData = {
      email: request.email || null,
      fullName: request.full_name,
      message: request.message,
      phone: e164Phone,
      schedule: schedule,
      gender: request.gender || 'other',
      date_of_birth: request.date_of_birth || '1990-01-01',
      doctor_id: request.doctor_id,
      preferred_date: request.preferred_date || null,
      preferred_time: request.preferred_time || null,
      preferred_slot_id: request.slot_id || null,
      visit_type: request.visit_type || 'consultation',
    };

    console.log('Appointment data:', JSON.stringify(appointmentData, null, 2));
    console.log('CALLING EDGE FUNCTION FOR APPOINTMENT CREATION...');

    // Call edge function
    const edgeFunctionUrl = 'https://ldmcdielxskywugyohrq.supabase.co/functions/v1/create-appointment';

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${environment.supabaseKey}`
    });

    return this.http.post<any>(edgeFunctionUrl, appointmentData, { headers }).pipe(
      tap({
        next: (response) => {
          console.log(
            'APPOINTMENT SERVICE - Edge function HTTP success response:',
            response
          );
          console.log('Response data:', response.data);
          console.log('Response message:', response.message);

          // Check if the appointment creation was actually successful
          if (response.success === true) {
            console.log(
              'APPOINTMENT CREATION SUCCESS - Appointment was created successfully!'
            );
            console.log(
              'Appointment details:',
              response.data || response.appointment_details
            );
            if (response.appointment_id) {
              console.log('Appointment ID:', response.appointment_id);
            }
            if (response.guest_appointment_id) {
              console.log(
                'Guest Appointment ID:',
                response.guest_appointment_id
              );
            }
          } else {
            console.log(
              '❌ APPOINTMENT CREATION FAILED - Edge function returned success: false'
            );
            console.log(
              '💬 Failure reason:',
              response.message || response.error
            );
            console.log('🔍 Full error response:', response);
          }
        },
        error: (error) => {
          console.log(
            '❌ APPOINTMENT SERVICE - Edge function HTTP error:',
            error
          );
          console.log('📦 Error status:', error.status);
          console.log('📦 Error body:', error.error);
          console.log(
            '🚨 APPOINTMENT CREATION FAILED - Network/HTTP error occurred'
          );
          console.log('🔍 Full error object:', error);
        },
      }),
      map((response) => {
        // Transform edge function response to AppointmentResponse format
        if (response.success) {
          return {
            success: true,
            message: response.message || 'Appointment created successfully',
            appointment_id: response.appointment_id,
            guest_appointment_id: response.guest_appointment_id,
            data: response.data || response.appointment_details,
          };
        } else {
          return {
            success: false,
            message: response.message || response.error || 'Appointment creation failed',
          };
        }
      }),
      catchError((error) => {
        console.error('❌ APPOINTMENT SERVICE - HTTP Error:', error);

        let errorMessage = 'Appointment creation failed. Please try again.';

        if (error.status === 400 && error.error?.error) {
          errorMessage = error.error.error;
        } else if (error.status === 500) {
          errorMessage = 'Server error. Please try again later.';
        } else if (error.message) {
          errorMessage = error.message;
        }

        return of({
          success: false,
          message: errorMessage,
          details: error.error?.details || null,
        });
      })
    );
  }

  /**
   * Convert Vietnamese phone number to E.164 format
   */
  private convertToE164(phone: string): string {
    console.log('📱 Converting phone to E.164:', phone);

    // Remove any spaces or formatting
    const cleanPhone = phone.replace(/\s/g, '');

    // If it starts with 0, replace with +84
    if (cleanPhone.startsWith('0')) {
      const result = '+84' + cleanPhone.substring(1);
      console.log('📱 Converted 0xxx to E.164:', result);
      return result;
    }

    // If it already starts with +84, return as is
    if (cleanPhone.startsWith('+84')) {
      console.log('📱 Already in E.164 format:', cleanPhone);
      return cleanPhone;
    }

    // If it starts with 84, add +
    if (cleanPhone.startsWith('84')) {
      const result = '+' + cleanPhone;
      console.log('📱 Added + to 84xxx:', result);
      return result;
    }

    // Default: assume it's a Vietnamese number without country code
    const result = '+84' + cleanPhone;
    console.log('📱 Default conversion to E.164:', result);
    return result;
  }

  /**
   * Map schedule from frontend format to edge function format
   */
  private mapScheduleToEdgeFunction(schedule: string): string {
    console.log('📅 Mapping schedule:', schedule);

    const scheduleMap: { [key: string]: string } = {
      morning: 'Morning',
      afternoon: 'Afternoon',
      evening: 'Evening',
      specific_time: 'Morning', // Default to Morning if specific time
      Morning: 'Morning',
      Afternoon: 'Afternoon',
      Evening: 'Evening',
    };

    const mapped = scheduleMap[schedule] || 'Morning';
    console.log('📅 Mapped schedule result:', mapped);
    return mapped;
  }

  /**
   * Create appointment for logged-in user
   */
  private async createUserAppointment(
    request: AppointmentCreateRequest,
    patientId: string
  ): Promise<AppointmentResponse> {
    console.log('👤 Creating USER appointment...');
    console.log('👤 Patient ID:', patientId);

    try {
      // Map schedule to database enum format
      const schedule = this.mapScheduleToEnum(request.schedule);
      console.log('📅 Mapped schedule:', schedule);

      // Prepare appointment data
      const appointmentData: Partial<Appointment> = {
        patient_id: patientId,
        phone: request.phone,
        email: request.email,
        visit_type: request.visit_type,
        schedule: schedule,
        message: request.message,
        doctor_id: request.doctor_id,
        category_id: request.category_id,
        slot_id: request.slot_id,
        preferred_date: request.preferred_date,
        preferred_time: request.preferred_time,
        appointment_status: 'pending',
      };

      console.log(
        '📋 Appointment data to insert:',
        JSON.stringify(appointmentData, null, 2)
      );

      // If slot is selected, set appointment date and time from slot
      if (request.slot_id) {
        console.log('🕐 Fetching slot details for slot ID:', request.slot_id);
        const slotDetails = await this.getSlotDetails(request.slot_id);
        console.log('🕐 Slot details:', slotDetails);

        if (slotDetails) {
          appointmentData.appointment_date = slotDetails.slot_date;
          appointmentData.appointment_time = slotDetails.slot_time;
          console.log('✅ Updated appointment with slot date/time:', {
            date: slotDetails.slot_date,
            time: slotDetails.slot_time,
          });
        } else {
          console.warn(
            '⚠️ No slot details found for slot ID:',
            request.slot_id
          );
        }
      }

      console.log('💾 Inserting appointment into database...');
      // Insert appointment into database
      const { data, error } = await this.supabase
        .from('appointments')
        .insert(appointmentData)
        .select()
        .single();

      console.log('💾 Database response:', { data, error });

      if (error) {
        console.error('❌ Database error:', error);
        throw new Error(
          `Database error: ${error.message} (Code: ${error.code})`
        );
      }

      console.log('✅ User appointment created successfully:', data);
      return {
        success: true,
        appointment_id: data.appointment_id,
        message: 'Appointment created successfully!',
        appointment_details: data,
      };
    } catch (error: any) {
      console.error('❌ ERROR in createUserAppointment:', error);
      console.error('❌ Error stack:', error.stack);
      return {
        success: false,
        message: `Failed to create user appointment: ${error.message || 'Unknown error'
          }`,
      };
    }
  }

  /**
   * Create appointment for guest user
   */
  private async createGuestAppointment(
    request: AppointmentCreateRequest
  ): Promise<AppointmentResponse> {
    console.log('👥 Creating GUEST appointment...');

    try {
      // First, create or get guest record
      console.log('👥 Creating/getting guest record...');
      const guestId = await this.createOrGetGuest({
        full_name: request.full_name,
        email: request.email,
        phone: request.phone,
        gender: request.gender,
      });
      console.log('👥 Guest ID:', guestId);

      // Map schedule to database enum format
      const schedule = this.mapScheduleToEnum(request.schedule);
      console.log('📅 Mapped schedule:', schedule);

      // Prepare guest appointment data
      const guestAppointmentData: Partial<GuestAppointment> = {
        guest_id: guestId,
        phone: request.phone,
        email: request.email,
        visit_type: request.visit_type,
        schedule: schedule,
        message: request.message,
        doctor_id: request.doctor_id,
        category_id: request.category_id,
        slot_id: request.slot_id,
        preferred_date: request.preferred_date,
        preferred_time: request.preferred_time,
        appointment_status: 'pending',
      };

      console.log(
        '📋 Guest appointment data to insert:',
        JSON.stringify(guestAppointmentData, null, 2)
      );

      // If slot is selected, set appointment date and time from slot
      if (request.slot_id) {
        console.log('🕐 Fetching slot details for slot ID:', request.slot_id);
        const slotDetails = await this.getSlotDetails(request.slot_id);
        console.log('🕐 Slot details:', slotDetails);

        if (slotDetails) {
          guestAppointmentData.appointment_date = slotDetails.slot_date;
          guestAppointmentData.appointment_time = slotDetails.slot_time;
          console.log('✅ Updated guest appointment with slot date/time:', {
            date: slotDetails.slot_date,
            time: slotDetails.slot_time,
          });
        } else {
          console.warn(
            '⚠️ No slot details found for slot ID:',
            request.slot_id
          );
        }
      }

      console.log('💾 Inserting guest appointment into database...');
      // Insert guest appointment into database
      const { data, error } = await this.supabase
        .from('guest_appointments')
        .insert(guestAppointmentData)
        .select()
        .single();
      console.log('💾 Guest appointment created successfully:', data);
      console.log('💾 Database response:', { data, error });

      if (error) {
        console.error('❌ Database error:', error);
        throw new Error(
          `Database error: ${error.message} (Code: ${error.code})`
        );
      }

      return {
        success: true,
        guest_appointment_id: data.guest_appointment_id,
        message: 'Appointment created successfully!',
        appointment_details: data,
      };
    } catch (error) {
      console.error('Error creating guest appointment:', error);
      return {
        success: false,
        message: 'Failed to create appointment. Please try again.',
      };
    }
  }

  /**
   * Create or get existing guest record
   */
  private async createOrGetGuest(guestData: Partial<Guest>): Promise<string> {
    try {
      // First, try to find existing guest by email
      const { data: existingGuest, error: findError } = await this.supabase
        .from('guests')
        .select('guest_id')
        .eq('email', guestData.email)
        .single();

      if (existingGuest && !findError) {
        return existingGuest.guest_id;
      }

      // If guest doesn't exist, create new one
      const { data: newGuest, error: createError } = await this.supabase
        .from('guests')
        .insert(guestData)
        .select('guest_id')
        .single();

      if (createError) {
        throw new Error(createError.message);
      }

      return newGuest.guest_id;
    } catch (error) {
      console.error('Error creating/getting guest:', error);
      throw error;
    }
  }

  /**
   * Get slot details by slot ID
   */
  private async getSlotDetails(slotId: string): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from('doctor_slot_assignments')
        .select('slot_date, slot_time')
        .eq('doctor_slot_id', slotId)
        .single();

      if (error) {
        console.error('Error fetching slot details:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error fetching slot details:', error);
      return null;
    }
  }

  /**
   * Map schedule string to database enum
   */
  private mapScheduleToEnum(schedule: string): ScheduleEnum {
    const scheduleMap: { [key: string]: ScheduleEnum } = {
      Morning: ScheduleEnum.MORNING,
      Afternoon: ScheduleEnum.AFTERNOON,
      Evening: ScheduleEnum.EVENING,
      morning: ScheduleEnum.MORNING,
      afternoon: ScheduleEnum.AFTERNOON,
      evening: ScheduleEnum.EVENING,
      specific_time: ScheduleEnum.SPECIFIC_TIME,
    };

    return scheduleMap[schedule] || ScheduleEnum.SPECIFIC_TIME;
  }

  // Duplicate method removed - using the enhanced version above

  /**
   * Get guest appointment by ID
   */
  getGuestAppointmentById(
    guestAppointmentId: string
  ): Observable<GuestAppointment | null> {
    return from(
      this.supabase
        .from('guest_appointments')
        .select('*')
        .eq('guest_appointment_id', guestAppointmentId)
        .single()
    ).pipe(
      map((response) => {
        if (response.error) {
          throw new Error(response.error.message);
        }
        return response.data;
      }),
      catchError((error) => {
        console.error('Error fetching guest appointment:', error);
        return of(null);
      })
    );
  }

  /**
   * Get available slots for a doctor on a specific date
   */
  getAvailableSlots(
    doctor_id: string,
    slot_date: string
  ): Observable<TimeSlot[]> {
    return this.http.post<TimeSlot[]>(
      `${environment.apiEndpoint}/get-available-slots`,
      {
        p_doctor_id: doctor_id,
        p_slot_date: slot_date,
        p_start_time: '00:00:00',
        p_end_time: '23:59:59',
        p_slot_id: null,
      },
      { headers: this.getHeaders() }
    );
  }

  /**
   * Fetch slots by doctor ID from API
   */
  fetchSlotsByDoctorId(doctor_id: string): Observable<any> {
    const params = new HttpParams().set('doctor_id', doctor_id);
    return this.http.get(`${environment.apiEndpoint}/fetch-slot-by-doctor-id`, {
      params,
      headers: this.getHeaders(),
    });
  }

  /**
   * Book appointment (legacy method for backward compatibility)
   */
  bookAppointment(payload: any): Observable<any> {
    return this.http.post(
      `${environment.apiEndpoint}/book-appointment`,
      payload,
      { headers: this.getHeaders() }
    );
  }

  /**
   * Get HTTP headers for API calls
   */
  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
    });
  }
}
