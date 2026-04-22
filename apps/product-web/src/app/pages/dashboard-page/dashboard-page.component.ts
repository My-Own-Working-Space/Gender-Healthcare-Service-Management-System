import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, forkJoin } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { HeaderComponent } from '../../components/header/header.component';
import { FooterComponent } from '../../components/footer/footer.component';


import { Router } from '@angular/router';
import {
  AuthService,
  EdgeFunctionUserProfile,
} from '../../services/auth.service';
import { DashboardPatient, Patient } from '../../models/patient.model';
import {
  DashboardAppointment,
  CalendarDay,
  DashboardState,
} from '../../models/appointment.model';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-dashboard',
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    HeaderComponent,
    FooterComponent,
  ],
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.css',
})
export class DashboardComponent implements OnInit, OnDestroy {
  // Make Math available in template
  Math = Math;
  isEditing = false;
  isProfileSaving = false;
  profileError: string | null = null;
  isUploadingAvatar = false;
  selectedAvatarFile: File | null = null;
  avatarPreviewUrl: string | null = null;


  // Calendar properties
  currentDate = new Date();
  currentMonth = this.currentDate.getMonth();
  currentYear = this.currentDate.getFullYear();
  today = new Date();
  calendarView: 'month' | 'week' | 'day' = 'month';
  showDatePicker = false;

  // Dashboard section management
  currentSection: 'dashboard' | 'appointments' | 'profile' | 'settings' = 'dashboard';
  selectedAppointment: DashboardAppointment | null = null;
  appointmentFilter: 'all' | 'upcoming' | 'past' | 'cancelled' = 'all';

  // dashboard data - will be populated from authenticated user
  dashboard = {
    name: '',
    firstName: '',
    lastName: '',
    bio: '',
    phone: '',
    countryCode: '+1',
    phoneType: 'mobile',
    email: '',
    dateOfBirth: '',
    gender: 'other' as 'male' | 'female' | 'other',
    imageLink: '',
    // Additional fields
    emergencyContact: '',
    bloodType: '',
    allergies: '',
    medicalHistory: '',
    // Preferences
    emailReminders: false,
    smsReminders: false,
    // Status
    status: 'inactive' as 'active' | 'inactive',
  };

  // Temporary data for editing
  editdashboard = { ...this.dashboard };

  // Dashboard state management
  dashboardState: DashboardState = {
    isLoading: false,
    error: null,
    patients: [],
    appointments: [],
    totalPatients: 0,
    totalAppointments: 0,
    pendingAppointments: 0,
    confirmedAppointments: 0,
  };

  // Appointments data from Supabase
  appointments: DashboardAppointment[] = [];

  // Patients data from Supabase
  patients: DashboardPatient[] = [];

  // Destroy subject for cleanup
  private destroy$ = new Subject<void>();

  // Edge function user profile data
  edgeFunctionProfile: EdgeFunctionUserProfile | null = null;
  isLoadingEdgeProfile = false;
  edgeProfileError: string | null = null;

  // Dashboard statistics
  dashboardStatistics = {
    totalPatients: 0,
    totalAppointments: 0,
    pendingAppointments: 0,
    confirmedAppointments: 0,
  };

  constructor(
    private authService: AuthService,
    private http: HttpClient,
    private router: Router
  ) { }

  // Appointment mapping to dates (day of month)
  appointmentMapping: { [key: number]: DashboardAppointment[] } = {};

  ngOnInit() {
    // Debug token first
    this.authService.debugToken();

    // Initialize calendar
    this.generateCalendarDays();
    // Load user profile data
    this.loadUserProfile();
    // Load edge function profile data
    this.loadEdgeFunctionProfile();
    // Load dashboard data from Supabase
    this.loadDashboardData();

    // Add click listener to close date picker when clicking outside
    document.addEventListener('click', this.onDocumentClick.bind(this));
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();

    // Remove click listener
    document.removeEventListener('click', this.onDocumentClick.bind(this));
  }

  /**
   * Handle document click to close date picker when clicking outside
   */
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    const datePickerContainer = target.closest('.month-picker-container');

    if (!datePickerContainer && this.showDatePicker) {
      this.showDatePicker = false;
    }
  }

  // ========== SUPABASE DATA LOADING METHODS ==========

  /**
   * Load user profile data from authenticated user
   */
  loadUserProfile(): void {
    const currentPatient = this.authService.getCurrentPatient();
    if (currentPatient) {
      const fullName = currentPatient.full_name || '';
      const nameParts = fullName.split(' ');

      this.dashboard = {
        name: fullName,
        firstName: nameParts[0] || '',
        lastName: nameParts[1] || '',
        bio: '', // Patient type doesn't have bio
        phone: currentPatient.phone || '',
        countryCode: '+1', // Default value, not in Patient type
        phoneType: 'mobile', // Default value, not in Patient type
        email: currentPatient.email || '',
        dateOfBirth: currentPatient.date_of_birth || '',
        gender: currentPatient.gender || 'other',
        imageLink: currentPatient.image_link || '',
        // Additional fields - use defaults since not in Patient type
        emergencyContact: '',
        bloodType: '',
        allergies: typeof currentPatient.allergies === 'string' ? currentPatient.allergies : '',
        medicalHistory: '',
        // Preferences - use defaults since not in Patient type
        emailReminders: false,
        smsReminders: false,
        // Status - use default since not in Patient type
        status: 'inactive' as 'active' | 'inactive',
      };
      this.editdashboard = { ...this.dashboard };
    }
  }

  /**
   * Load user profile data from edge function
   */
  loadEdgeFunctionProfile(): void {
    this.isLoadingEdgeProfile = true;
    this.edgeProfileError = null;

    this.authService
      .getUserProfileFromEdgeFunction()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isLoadingEdgeProfile = false;
        })
      )
      .subscribe({
        next: (profile) => {
          this.edgeFunctionProfile = profile;


          // Update dashboard with edge function data
          const fullName = profile.full_name || '';
          const nameParts = fullName.split(' ');

          this.dashboard = {
            name: fullName,
            firstName: nameParts[0] || '',
            lastName: nameParts[1] || '',
            bio: '', // Edge function doesn't provide bio
            phone: profile.phone || '',
            countryCode: '+1', // Default value, not in EdgeFunctionUserProfile
            phoneType: 'mobile', // Default value, not in EdgeFunctionUserProfile
            email: profile.email || '',
            dateOfBirth: profile.date_of_birth || '',
            gender: profile.gender || 'other',
            imageLink: profile.image_link || '',
            // Additional fields - use defaults since not in EdgeFunctionUserProfile
            emergencyContact: '',
            bloodType: '',
            allergies: '',
            medicalHistory: '',
            // Preferences - use defaults since not in EdgeFunctionUserProfile
            emailReminders: false,
            smsReminders: false,
            // Status - use default since not in EdgeFunctionUserProfile
            status: 'inactive' as 'active' | 'inactive',
          };
          this.editdashboard = { ...this.dashboard };

          // Update dashboard stats with edge function data
          this.updateDashboardStats();

          // Convert edge function appointments to dashboard format and update calendar
          this.convertEdgeFunctionAppointments();
          this.updateAppointmentMapping();
          this.generateCalendarDays();
        },
        error: (error) => {

          this.edgeProfileError =
            'Failed to load profile from server. Using local data.';
          // Fallback to local profile loading
          this.loadUserProfile();
        },
      });
  }

  /**
   * Update dashboard statistics with edge function data
   */
  updateDashboardStats(): void {
    if (this.edgeFunctionProfile?.appointments) {
      const appointments = this.edgeFunctionProfile.appointments;

      // Count appointments by status
      const pendingCount = appointments.filter(
        (apt) => apt.appointment_status === 'pending'
      ).length;
      const confirmedCount = appointments.filter(
        (apt) => apt.appointment_status === 'confirmed'
      ).length;
      const completedCount = appointments.filter(
        (apt) => apt.appointment_status === 'completed'
      ).length;

      // Update dashboard stats
      this.dashboardStatistics = {
        totalPatients: 1, // Current user
        totalAppointments: appointments.length,
        pendingAppointments: pendingCount,
        confirmedAppointments: completedCount,
      };


    }
  }

  /**
   * Convert edge function appointments to dashboard appointment format
   */
  convertEdgeFunctionAppointments(): void {
    if (!this.edgeFunctionProfile?.appointments) {
      return;
    }



    // Convert edge function appointments to dashboard format
    const edgeAppointments: DashboardAppointment[] =
      this.edgeFunctionProfile.appointments
        .filter((apt) => apt.appointment_date && apt.appointment_time) // Only include appointments with date and time
        .map((apt) => ({
          id: apt.appointment_id,
          title: `${apt.visit_type} Appointment`,
          type: apt.visit_type as
            | 'virtual'
            | 'internal'
            | 'external'
            | 'consultation',
          time: apt.appointment_time || '',
          date: apt.appointment_date || '',
          status: apt.appointment_status,
          patientName: this.edgeFunctionProfile?.full_name || 'Unknown',
          doctorName: 'Dr. TBD', // Edge function doesn't provide doctor name
          schedule: apt.schedule as 'Morning' | 'Afternoon' | 'Evening',
        }));

    // Merge with existing appointments (avoid duplicates)
    const existingIds = new Set(this.appointments.map((apt) => apt.id));
    const newAppointments = edgeAppointments.filter(
      (apt) => !existingIds.has(apt.id)
    );

    // Add new appointments to the existing list
    this.appointments = [...this.appointments, ...newAppointments];


  }

  /**
   * Load all dashboard data from Supabase (patient-specific)
   */
  loadDashboardData(): void {
    this.dashboardState.isLoading = true;
    this.dashboardState.error = null;

    const currentPatientId = this.authService.getCurrentPatientId();

    forkJoin({
      patients: this.authService.getDashboardPatients(),
      appointments: this.authService.getDashboardAppointments(
        currentPatientId || undefined
      ),
      patientCount: this.authService.getPatientCount(),
      appointmentCount: this.authService.getAppointmentCountByStatus(),
      pendingCount: this.authService.getAppointmentCountByStatus('pending'),
      confirmedCount: this.authService.getAppointmentCountByStatus('confirmed'),
    })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.dashboardState.isLoading = false;
        })
      )
      .subscribe({
        next: (data) => {
          console.log('Dashboard data loaded:', {
            patients: data.patients.length,
            appointments: data.appointments.length,
            appointmentData: data.appointments,
          });

          this.dashboardState.patients = data.patients;
          this.dashboardState.appointments = data.appointments;
          this.dashboardState.totalPatients = data.patientCount;
          this.dashboardState.totalAppointments = data.appointmentCount;
          this.dashboardState.pendingAppointments = data.pendingCount;
          this.dashboardState.confirmedAppointments = data.confirmedCount;

          // Update component properties
          this.patients = data.patients;
          this.appointments = data.appointments;

          // Update appointment mapping for calendar
          this.updateAppointmentMapping();

          // Regenerate calendar with new data
          this.generateCalendarDays();
        },
        error: (error) => {
          console.error('Error loading dashboard data:', error);
          this.dashboardState.error =
            'Failed to load dashboard data. Please try again.';

          // Fallback to empty data
          this.dashboardState.patients = [];
          this.dashboardState.appointments = [];
          this.patients = [];
          this.appointments = [];
        },
      });
  }

  /**
   * Update appointment mapping for calendar display
   */
  private updateAppointmentMapping(): void {
    this.appointmentMapping = {};

    console.log(
      'Updating appointment mapping with appointments:',
      this.appointments
    );

    this.appointments.forEach((appointment) => {
      if (appointment.date) {
        const appointmentDate = new Date(appointment.date);
        const dayOfMonth = appointmentDate.getDate();

        console.log(
          'Mapping appointment:',
          appointment.title,
          'to day:',
          dayOfMonth,
          'date:',
          appointment.date
        );

        if (!this.appointmentMapping[dayOfMonth]) {
          this.appointmentMapping[dayOfMonth] = [];
        }

        this.appointmentMapping[dayOfMonth].push(appointment);
      } else {
        console.warn('Appointment without date:', appointment);
      }
    });

    console.log('Final appointment mapping:', this.appointmentMapping);
  }

  // Calendar methods

  get calendarDays(): CalendarDay[] {
    return this.generateCalendarDays();
  }

  generateCalendarDays(): CalendarDay[] {
    switch (this.calendarView) {
      case 'week':
        return this.generateWeekDays();
      case 'day':
        return this.generateSingleDay();
      default:
        return this.generateMonthDays();
    }
  }

  /**
   * Generate days for month view
   */
  private generateMonthDays(): CalendarDay[] {
    const days: CalendarDay[] = [];
    const firstDay = new Date(this.currentYear, this.currentMonth, 1);
    const startDate = new Date(firstDay);

    // Adjust to start from Sunday
    startDate.setDate(startDate.getDate() - startDate.getDay());

    // Generate 42 days (6 weeks)
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);

      const dayNumber = date.getDate();
      const isCurrentMonth = date.getMonth() === this.currentMonth;
      const isToday = this.isSameDay(date, this.today);

      const appointments = isCurrentMonth
        ? this.appointmentMapping[dayNumber] || []
        : [];

      days.push({
        date: dayNumber,
        isCurrentMonth,
        isToday,
        appointments,
      });
    }

    return days;
  }

  /**
   * Generate days for week view
   */
  private generateWeekDays(): CalendarDay[] {
    const days: CalendarDay[] = [];
    const currentDate = new Date(
      this.currentYear,
      this.currentMonth,
      this.currentDate.getDate()
    );

    // Get start of week (Sunday)
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());

    // Generate 7 days for the week
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);

      const dayAppointments = this.getAppointmentsForDate(date);

      days.push({
        date: date.getDate(),
        isCurrentMonth: date.getMonth() === this.currentMonth,
        isToday: this.isSameDay(date, this.today),
        appointments: dayAppointments,
      });
    }

    return days;
  }

  /**
   * Generate single day for day view
   */
  private generateSingleDay(): CalendarDay[] {
    const currentDate = new Date(
      this.currentYear,
      this.currentMonth,
      this.currentDate.getDate()
    );
    const dayAppointments = this.getAppointmentsForDate(currentDate);

    return [
      {
        date: currentDate.getDate(),
        isCurrentMonth: true,
        isToday: this.isSameDay(currentDate, this.today),
        appointments: dayAppointments,
      },
    ];
  }

  /**
   * Get appointments for a specific date
   */
  private getAppointmentsForDate(date: Date): DashboardAppointment[] {
    return this.appointments.filter((appointment) => {
      if (!appointment.date) return false;
      const appointmentDate = new Date(appointment.date);
      return this.isSameDay(appointmentDate, date);
    });
  }

  isSameDay(date1: Date, date2: Date): boolean {
    return (
      date1.getDate() === date2.getDate() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getFullYear() === date2.getFullYear()
    );
  }

  // ========== CALENDAR NAVIGATION METHODS ==========

  previousMonth(): void {
    switch (this.calendarView) {
      case 'week':
        this.previousWeek();
        break;
      case 'day':
        this.previousDay();
        break;
      default:
        if (this.currentMonth === 0) {
          this.currentMonth = 11;
          this.currentYear--;
        } else {
          this.currentMonth--;
        }
        break;
    }
    this.generateCalendarDays();
    this.updateAppointmentMapping();
  }

  nextMonth(): void {
    switch (this.calendarView) {
      case 'week':
        this.nextWeek();
        break;
      case 'day':
        this.nextDay();
        break;
      default:
        if (this.currentMonth === 11) {
          this.currentMonth = 0;
          this.currentYear++;
        } else {
          this.currentMonth++;
        }
        break;
    }
    this.generateCalendarDays();
    this.updateAppointmentMapping();
  }

  /**
   * Navigate to previous week
   */
  private previousWeek(): void {
    this.currentDate.setDate(this.currentDate.getDate() - 7);
    this.currentMonth = this.currentDate.getMonth();
    this.currentYear = this.currentDate.getFullYear();
  }

  /**
   * Navigate to next week
   */
  private nextWeek(): void {
    this.currentDate.setDate(this.currentDate.getDate() + 7);
    this.currentMonth = this.currentDate.getMonth();
    this.currentYear = this.currentDate.getFullYear();
  }

  /**
   * Navigate to previous day
   */
  private previousDay(): void {
    this.currentDate.setDate(this.currentDate.getDate() - 1);
    this.currentMonth = this.currentDate.getMonth();
    this.currentYear = this.currentDate.getFullYear();
  }

  /**
   * Navigate to next day
   */
  private nextDay(): void {
    this.currentDate.setDate(this.currentDate.getDate() + 1);
    this.currentMonth = this.currentDate.getMonth();
    this.currentYear = this.currentDate.getFullYear();
  }

  goToToday(): void {
    const today = new Date();
    this.currentDate = today;
    this.currentMonth = today.getMonth();
    this.currentYear = today.getFullYear();
    this.generateCalendarDays();
    this.updateAppointmentMapping();
  }

  /**
   * Navigate to specific month and year
   */
  goToMonth(month: number, year: number): void {
    this.currentMonth = month;
    this.currentYear = year;
    this.currentDate = new Date(year, month, 1);
    this.generateCalendarDays();
    this.updateAppointmentMapping();
  }

  addAppointment(): void {
    // Navigate to appointment booking page
    window.location.href = '/appointment';
  }

  /**
   * Change calendar view mode
   */
  changeView(view: 'month' | 'week' | 'day'): void {
    this.calendarView = view;
    this.generateCalendarDays();
  }

  /**
   * Toggle date picker visibility
   */
  toggleDatePicker(): void {
    this.showDatePicker = !this.showDatePicker;
  }

  /**
   * Close date picker
   */
  closeDatePicker(): void {
    this.showDatePicker = false;
  }

  /**
   * Get current month name
   */
  get currentMonthName(): string {
    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    return `${monthNames[this.currentMonth]} ${this.currentYear}`;
  }

  /**
   * Get available years for date picker
   */
  get availableYears(): number[] {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear - 5; i <= currentYear + 5; i++) {
      years.push(i);
    }
    return years;
  }

  /**
   * Get available months for date picker
   */
  get availableMonths(): { value: number; name: string }[] {
    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    return monthNames.map((name, index) => ({ value: index, name }));
  }

  /**
   * Navigate to next month (for quick navigation)
   */
  goToNextMonth(): void {
    const nextMonth = this.currentMonth === 11 ? 0 : this.currentMonth + 1;
    const nextYear =
      this.currentMonth === 11 ? this.currentYear + 1 : this.currentYear;
    this.goToMonth(nextMonth, nextYear);
  }

  /**
   * Change year by increment/decrement
   */
  changeYear(increment: number): void {
    this.currentYear += increment;
    this.goToMonth(this.currentMonth, this.currentYear);
  }

  /**
   * Get time slots for week/day view (8 AM to 8 PM)
   */
  get timeSlots(): string[] {
    const slots = [];
    for (let hour = 8; hour <= 20; hour++) {
      const time12 = hour > 12 ? hour - 12 : hour;
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour === 12 ? 12 : time12;
      slots.push(`${displayHour}:00 ${ampm}`);
    }
    return slots;
  }

  /**
   * Get day names for week view
   */
  get dayNames(): string[] {
    return [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];
  }

  /**
   * Get appointments positioned by time for a specific date
   */
  getAppointmentsForTimeSlot(
    date: Date,
    timeSlot: string
  ): DashboardAppointment[] {
    const dayAppointments = this.getAppointmentsForDate(date);
    return dayAppointments.filter((appointment) => {
      if (!appointment.time) return false;
      // Convert appointment time to match time slot format
      const appointmentTime = this.convertTo12HourFormat(appointment.time);
      return appointmentTime === timeSlot;
    });
  }

  /**
   * Get appointments for a specific day and time slot (template helper)
   */
  getAppointmentsForDayTimeSlot(
    dayNumber: number,
    timeSlot: string
  ): DashboardAppointment[] {
    const date = new Date(this.currentYear, this.currentMonth, dayNumber);
    return this.getAppointmentsForTimeSlot(date, timeSlot);
  }

  /**
   * Convert 24-hour time to 12-hour format
   */
  private convertTo12HourFormat(time24: string): string {
    try {
      const [hours, minutes] = time24.split(':');
      const hour = parseInt(hours, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    } catch (error) {
      return time24;
    }
  }

  onDayClick(day: CalendarDay): void {
    if (day.isCurrentMonth) {
      console.log(`Day ${day.date} clicked`);
      // Implement day click logic
    }
  }

  // ========== PROFILE MANAGEMENT METHODS ==========

  toggleEdit(): void {
    this.isEditing = !this.isEditing;
    this.profileError = null;
    if (this.isEditing) {
      this.editdashboard = { ...this.dashboard };
    }
  }

  async savedashboard(): Promise<void> {
    const currentPatientId = this.authService.getCurrentPatientId();
    if (!currentPatientId) {
      this.profileError = 'User not authenticated';
      return;
    }

    // Validate form before saving
    if (!this.isFormValid()) {
      return;
    }

    this.isProfileSaving = true;
    this.profileError = null;

    try {
      // Upload avatar if a new file was selected
      let avatarUrl: string | null = this.editdashboard.imageLink;
      if (this.selectedAvatarFile) {
        const uploadResult = await this.uploadAvatar();
        if (!uploadResult) {
          // Upload failed, error already set in uploadAvatar method
          return;
        }
        avatarUrl = uploadResult;
      }

      // First, update using the edge function
      const edgeFunctionSuccess = await this.updatePatientViaEdgeFunction(
        avatarUrl
      );

      if (edgeFunctionSuccess) {
        // If edge function succeeds, also update local database for consistency
        const updates: Partial<Patient> = {
          full_name: this.editdashboard.name,
          bio: this.editdashboard.bio,
          phone: this.editdashboard.phone,
          email: this.editdashboard.email,
          date_of_birth: this.editdashboard.dateOfBirth || null,
          gender: this.editdashboard.gender,
          image_link: avatarUrl || null,
        };

        this.authService
          .updatePatientProfile(currentPatientId, updates)
          .pipe(
            takeUntil(this.destroy$),
            finalize(() => {
              this.isProfileSaving = false;
            })
          )
          .subscribe({
            next: (updatedPatient) => {
              // Update local dashboard data
              this.dashboard = { ...this.editdashboard };
              this.isEditing = false;

              // Reset avatar selection
              this.resetAvatarSelection();

              // Update auth service with new patient data
              this.authService.updateCurrentPatient(updatedPatient);

              console.log(
                'Profile updated successfully via both edge function and local database'
              );
            },
            error: (error) => {
              console.error(
                'Error updating local profile after edge function success:',
                error
              );
              // Still consider it a success since edge function worked
              this.dashboard = { ...this.editdashboard };
              this.isEditing = false;
              this.resetAvatarSelection();
              console.log(
                'Profile updated successfully via edge function (local database update failed)'
              );
            },
          });
      } else {
        // If edge function fails, fall back to local database update only
        console.log(
          'Edge function failed, falling back to local database update only'
        );

        const updates: Partial<Patient> = {
          full_name: this.editdashboard.name,
          bio: this.editdashboard.bio,
          phone: this.editdashboard.phone,
          email: this.editdashboard.email,
          date_of_birth: this.editdashboard.dateOfBirth || null,
          gender: this.editdashboard.gender,
          image_link: avatarUrl || null,
        };

        this.authService
          .updatePatientProfile(currentPatientId, updates)
          .pipe(
            takeUntil(this.destroy$),
            finalize(() => {
              this.isProfileSaving = false;
            })
          )
          .subscribe({
            next: (updatedPatient) => {
              // Update local dashboard data
              this.dashboard = { ...this.editdashboard };
              this.isEditing = false;

              // Reset avatar selection
              this.resetAvatarSelection();

              // Update auth service with new patient data
              this.authService.updateCurrentPatient(updatedPatient);

              console.log(
                'Profile updated successfully via local database (edge function failed)'
              );
            },
            error: (error) => {
              console.error('Error updating profile:', error);
              this.profileError = 'Failed to update profile. Please try again.';
            },
          });
      }
    } catch (error) {
      console.error('Error in profile save process:', error);
      this.profileError = 'An unexpected error occurred. Please try again.';
      this.isProfileSaving = false;
    }
  }

  /**
   * Update patient information using the edge function
   */
  private async updatePatientViaEdgeFunction(
    avatarUrl: string | null
  ): Promise<boolean> {
    try {
      console.log('🚀 DASHBOARD - Calling update-patient edge function...');

      const currentPatientId = this.authService.getCurrentPatientId();
      if (!currentPatientId) {
        console.error('❌ No patient ID found for edge function update');
        return false;
      }

      // Get access token from localStorage or sessionStorage
      const accessToken =
        localStorage.getItem('access_token') ||
        sessionStorage.getItem('access_token');

      if (!accessToken) {
        console.warn(
          '⚠️ DASHBOARD - No access token found in localStorage or sessionStorage'
        );
        console.error('❌ DASHBOARD - No valid auth token available');
        return false;
      }

      console.log('🔑 DASHBOARD - Found access token for edge function');

      // Prepare FormData for multipart/form-data request
      const formData = new FormData();
      formData.append('patient_id', currentPatientId);
      formData.append('full_name', this.editdashboard.name);
      formData.append('phone', this.editdashboard.phone);
      formData.append('email', this.editdashboard.email);
      formData.append('date_of_birth', this.editdashboard.dateOfBirth || '');
      formData.append('gender', this.editdashboard.gender);

      // Optional fields
      if (this.editdashboard.bio) {
        formData.append('bio', this.editdashboard.bio);
      }

      // Handle image upload if a new file was selected
      if (this.selectedAvatarFile) {
        formData.append('image', this.selectedAvatarFile);
        console.log(
          '📸 DASHBOARD - Including image file in request:',
          this.selectedAvatarFile.name
        );
      }

      // Add empty arrays for medical fields (as expected by the edge function)
      formData.append('allergies', JSON.stringify([]));
      formData.append('chronic_conditions', JSON.stringify([]));
      formData.append('past_surgeries', JSON.stringify([]));
      formData.append('vaccination_status', 'unknown');
      formData.append('patient_status', 'active');

      console.log('� DASHBOARD - FormData prepared with fields:');
      for (const [key, value] of formData.entries()) {
        if (key === 'image') {
          console.log(`  ${key}: [File] ${(value as File).name}`);
        } else {
          console.log(`  ${key}: ${value}`);
        }
      }

      const headers = new HttpHeaders({
        Authorization: `Bearer ${accessToken}`,
        // Don't set Content-Type for FormData - let the browser set it with boundary
      });

      console.log('📋 DASHBOARD - Request headers:', {
        Authorization: `Bearer ${accessToken.substring(0, 20)}...`,
        'Content-Type': 'multipart/form-data (auto-set by browser)',
      });

      // Call the update-patient edge function
      const response = await this.http
        .post<any>(
          'https://ldmcdielxskywugyohrq.supabase.co/functions/v1/update-patient',
          formData,
          { headers }
        )
        .toPromise();

      console.log('✅ DASHBOARD - Edge function response:', response);

      if (response?.patient) {
        console.log(
          '🎉 DASHBOARD - Patient updated successfully via edge function!'
        );
        console.log('📋 Updated patient details:', response.patient);
        console.log('🖼️ Image URL:', response.image_url);
        console.log('💬 Message:', response.message);
        return true;
      } else {
        console.log('❌ DASHBOARD - Edge function returned no patient data');
        console.log('💬 Error message:', response?.error || 'Unknown error');
        return false;
      }
    } catch (error: any) {
      console.error(
        '❌ DASHBOARD - Error calling update-patient edge function:',
        error
      );
      console.log('📦 Error status:', error.status);
      console.log('📦 Error body:', error.error);

      // Handle specific error cases
      if (error.status === 401) {
        console.log(
          '🔐 DASHBOARD - Authentication failed - token may be expired'
        );
      } else if (error.status === 403) {
        console.log(
          '🚫 DASHBOARD - Authorization failed - patient_id mismatch'
        );
      } else if (error.status === 400) {
        console.log('📝 DASHBOARD - Bad request - check required fields');
      }

      console.log('🚨 DASHBOARD - Edge function update failed');
      return false;
    }
  }

  cancelEdit(): void {
    this.editdashboard = { ...this.dashboard };
    this.isEditing = false;
    this.profileError = null;
    this.resetAvatarSelection();
  }

  resetForm(): void {
    // Reset to empty values - no mock data
    this.dashboard = {
      name: '',
      firstName: '',
      lastName: '',
      bio: '',
      phone: '',
      countryCode: '+1',
      phoneType: 'mobile',
      email: '',
      dateOfBirth: '',
      gender: 'other' as 'male' | 'female' | 'other',
      imageLink: '',
      // Additional fields
      emergencyContact: '',
      bloodType: '',
      allergies: '',
      medicalHistory: '',
      // Preferences
      emailReminders: false,
      smsReminders: false,
      // Status
      status: 'inactive' as 'active' | 'inactive',
    };
    this.profileError = null;
  }

  // ========== FORM VALIDATION METHODS ==========

  /**
   * Validate email format
   */
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate phone format (Vietnamese phone numbers)
   */
  isValidPhone(phone: string): boolean {
    const phoneRegex = /^(\+84|0)[0-9]{9,10}$/;
    return phoneRegex.test(phone);
  }

  /**
   * Validate required fields
   */
  isFormValid(): boolean {
    if (!this.editdashboard.name.trim()) {
      this.profileError = 'Name is required';
      return false;
    }

    if (!this.editdashboard.email.trim()) {
      this.profileError = 'Email is required';
      return false;
    }

    if (!this.isValidEmail(this.editdashboard.email)) {
      this.profileError = 'Please enter a valid email address';
      return false;
    }

    if (!this.editdashboard.phone.trim()) {
      this.profileError = 'Phone number is required';
      return false;
    }

    if (!this.isValidPhone(this.editdashboard.phone)) {
      this.profileError =
        'Please enter a valid phone number (e.g., +84901234567 or 0901234567)';
      return false;
    }

    return true;
  }

  /**
   * Get gender options for dropdown
   */
  get genderOptions() {
    return [
      { value: 'male', label: 'Male' },
      { value: 'female', label: 'Female' },
      { value: 'other', label: 'Other / Prefer not to say' },
    ];
  }

  // ========== AVATAR UPLOAD METHODS ==========

  /**
   * Handle avatar file selection
   */
  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];

      // Validate file type
      if (!file.type.startsWith('image/')) {
        this.profileError = 'Please select a valid image file';
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        this.profileError = 'Image file size must be less than 5MB';
        return;
      }

      this.selectedAvatarFile = file;
      this.profileError = null;

      // Create preview URL
      const reader = new FileReader();
      reader.onload = (e) => {
        this.avatarPreviewUrl = e.target?.result as string;
        // Update the edit dashboard image link for preview
        this.editdashboard.imageLink = this.avatarPreviewUrl;
      };
      reader.readAsDataURL(file);
    }
  }

  /**
   * Upload avatar to Supabase Storage
   */
  private async uploadAvatar(): Promise<string | null> {
    if (!this.selectedAvatarFile) {
      return null;
    }

    try {
      this.isUploadingAvatar = true;
      const currentPatientId = this.authService.getCurrentPatientId();
      if (!currentPatientId) {
        throw new Error('User not authenticated');
      }

      // Generate unique filename
      const fileExt = this.selectedAvatarFile.name.split('.').pop();
      const fileName = `${currentPatientId}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload to Supabase Storage
      const uploadResult = await this.authService.uploadAvatar(
        filePath,
        this.selectedAvatarFile
      );

      if (uploadResult.error) {
        throw new Error(uploadResult.error.message);
      }

      // Get public URL
      const publicUrl = this.authService.getAvatarPublicUrl(filePath);
      return publicUrl;
    } catch (error) {
      console.error('Error uploading avatar:', error);
      this.profileError = 'Failed to upload avatar. Please try again.';
      return null;
    } finally {
      this.isUploadingAvatar = false;
    }
  }

  /**
   * Reset avatar selection
   */
  resetAvatarSelection(): void {
    this.selectedAvatarFile = null;
    this.avatarPreviewUrl = null;
    this.editdashboard.imageLink = this.dashboard.imageLink;
  }

  // Utility methods for appointment display
  getAppointmentTypeClass(
    type: 'virtual' | 'internal' | 'external' | 'consultation'
  ): string {
    return `appointment ${type}`;
  }

  /**
   * Get full image URL with Supabase storage URL
   */
  getFullImageUrl(imageLink: string | null | undefined): string {
    if (!imageLink) {
      return 'https://ldmcdielxskywugyohrq.supabase.co/storage/v1/object/public/patient-uploads//default.jpg';
    }

    // If the image link already starts with http/https, return as is
    if (imageLink.startsWith('http://') || imageLink.startsWith('https://')) {
      return imageLink;
    }

    // If it's a relative path, prepend the Supabase storage URL
    // Remove leading slash if present since supabaseStorageUrl already ends with /
    const cleanImageLink = imageLink.startsWith('/')
      ? imageLink.substring(1)
      : imageLink;
    return `${environment.supabaseStorageUrl}${cleanImageLink}`;
  }

  getStatusClass(
    status?: 'pending' | 'confirmed' | 'cancelled' | 'completed'
  ): string {
    if (!status) return '';
    return `appointment-status ${status}`;
  }

  getStatusText(
    status?: 'pending' | 'confirmed' | 'cancelled' | 'completed'
  ): string {
    if (!status) return '';
    return `• ${status.toUpperCase()}`;
  }

  // ========== DASHBOARD UTILITY METHODS ==========

  /**
   * Get loading state
   */
  get isLoading(): boolean {
    return this.dashboardState.isLoading;
  }

  /**
   * Get error message
   */
  get errorMessage(): string | null {
    return this.dashboardState.error;
  }

  /**
   * Get dashboard statistics
   */
  get dashboardStats() {
    return {
      totalPatients: this.dashboardState.totalPatients,
      totalAppointments: this.dashboardState.totalAppointments,
      pendingAppointments: this.dashboardState.pendingAppointments,
      confirmedAppointments: this.dashboardState.confirmedAppointments,
    };
  }

  /**
   * Refresh dashboard data
   */
  refreshDashboard(): void {
    this.loadDashboardData();
  }

  /**
   * Debug token information
   */
  debugToken(): void {
    this.authService.debugToken();
  }

  /**
   * Force refresh token
   */
  async forceRefreshToken(): Promise<void> {
    console.log('Forcing token refresh...');
    const success = await this.authService.forceRefreshToken();
    if (success) {
      console.log('Token refreshed successfully, retrying dashboard load...');
      this.loadEdgeFunctionProfile();
    } else {
      console.error('Failed to refresh token');
    }
  }

  // Navigation methods - now switch sections within dashboard
  navigateToHistory(): void {
    this.currentSection = 'appointments';
    this.selectedAppointment = null;
  }

  navigateToProfiles(): void {
    this.currentSection = 'profile';
  }

  navigateToBooking(): void {
    // For booking, we can still navigate to external page or show booking form
    this.router.navigate(['/appointment']);
  }

  navigateToSettings(): void {
    this.currentSection = 'settings';
  }

  // New method to switch back to main dashboard
  navigateToDashboard(): void {
    this.currentSection = 'dashboard';
    this.selectedAppointment = null;
  }

  // Method to view appointment details
  viewAppointmentDetails(appointment: DashboardAppointment): void {
    this.selectedAppointment = appointment;
    this.currentSection = 'appointments';
  }

  // Method to filter appointments
  setAppointmentFilter(filter: 'all' | 'upcoming' | 'past' | 'cancelled'): void {
    this.appointmentFilter = filter;
  }

  // Get filtered appointments
  get filteredAppointments(): DashboardAppointment[] {
    const now = new Date();

    switch (this.appointmentFilter) {
      case 'upcoming':
        return this.appointments.filter(apt => {
          if (!apt.date) return false;
          const aptDate = new Date(apt.date);
          return aptDate >= now && apt.status !== 'cancelled';
        });
      case 'past':
        return this.appointments.filter(apt => {
          if (!apt.date) return false;
          const aptDate = new Date(apt.date);
          return aptDate < now;
        });
      case 'cancelled':
        return this.appointments.filter(apt => apt.status === 'cancelled');
      default:
        return this.appointments;
    }
  }
}
