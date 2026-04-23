import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { SupabaseService } from '../../supabase.service';
import { Patient } from '../../models/patient.interface';
import { Staff } from '../../models/staff.interface';
import { VisitType } from '../../models/appointment.interface';
import { StatusUtil } from '../../utils/status.util';
import { NameUtil } from '../../utils/name.util';

interface Appointment {
  appointment_id: string;
  patient_id: string;
  patient_name: string;
  patient_email: string;
  patient_phone?: string;
  doctor_id: string;
  doctor_name: string;
  appointment_date: string;
  appointment_time: string;
  visit_type: VisitType;
  appointment_status:
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'cancelled';
  notes?: string;
  created_at: string;
  updated_at: string;
  // Additional fields for enhanced functionality
  appointment_type?: 'patient' | 'guest';
  original_id?: string;
  slot_id?: string;
  category_name?: string;
}

@Component({
  selector: 'app-appointment-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './appointment-management.component.html',
  styleUrls: ['./appointment-management.component.css'],
})
export class AppointmentManagementComponent implements OnInit {
  // Data properties
  appointments: Appointment[] = [];
  filteredAppointments: Appointment[] = [];
  pendingAppointments: Appointment[] = [];
  patients: Patient[] = [];
  doctors: Staff[] = [];
  isLoading = false;

  // Pagination
  currentPage: number = 1;
  readonly pageSize: number = 10;

  // Filtering
  searchQuery: string = '';
  selectedStatus: string = '';
  selectedDoctor: string = '';
  selectedDate: string = '';

  // Modal states
  showCreateModal = false;
  showApprovalModal = false;
  selectedAppointment: Appointment | null = null;

  // New appointment form
  newAppointment = {
    appointment_type: 'patient' as 'patient' | 'guest',
    patient_id: '',
    guest_name: '',
    doctor_id: '',
    category_id: '',
    phone: '',
    email: '',
    gender: 'other',
    date_of_birth: '',
    appointment_date: '',
    appointment_time: '',
    visit_type: VisitType.CONSULTATION,
    notes: '',
  };

  // Service categories for appointment creation
  serviceCategories: any[] = [];

  // Visit types
  visitTypes = [
    {
      value: VisitType.CONSULTATION,
      label: 'Consultation',
      color: 'bg-blue-100 text-blue-800',
    },
    {
      value: VisitType.FOLLOW_UP,
      label: 'Follow-up',
      color: 'bg-green-100 text-green-800',
    },
    {
      value: VisitType.EMERGENCY,
      label: 'Emergency',
      color: 'bg-red-100 text-red-800',
    },
    { value: VisitType.ROUTINE, label: 'Routine', color: 'bg-gray-100 text-gray-800' },
  ];

  // Status options
  statusOptions = StatusUtil.getAppointmentStatusOptions();

  // Statistics
  stats = {
    totalAppointments: 0,
    pendingApprovals: 0,
    todayAppointments: 0,
    inProgressToday: 0,
  };

  // Error handling
  errorMessage: string = '';
  successMessage: string = '';

  constructor(
    private supabaseService: SupabaseService,
    private route: ActivatedRoute
  ) { }

  async ngOnInit() {
    await this.loadInitialData();
    await this.calculateStats();

    // Check for query parameters
    this.route.queryParams.subscribe((params) => {
      if (params['action'] === 'new') {
        this.openCreateModal();
      } else if (params['action'] === 'approve') {
        this.showPendingAppointments();
      }
    });
  }

  async loadInitialData() {
    this.isLoading = true;
    try {
      await Promise.all([
        this.loadAppointments(),
        this.loadPatients(),
        this.loadDoctors(),
        this.loadServiceCategories(),
      ]);
    } catch (error) {
      console.error('Error loading initial data:', error);
      this.showError('Failed to load data');
    } finally {
      this.isLoading = false;
    }
  }

  async loadAppointments() {
    try {
      this.isLoading = true;
      console.log('🏥 Loading appointments for receptionist...');

      const result = await this.supabaseService.getAllAppointmentsForReceptionist();
      if (result.success && result.data) {
        // Transform data to match local interface
        this.appointments = result.data.map((apt: any) => ({
          appointment_id: apt.appointment_id,
          patient_id: apt.patient_id || apt.guest_id,
          patient_name: apt.patient_name,
          patient_email: apt.patient_email,
          patient_phone: apt.patient_phone,
          doctor_id: apt.doctor_id,
          doctor_name: apt.doctor_name,
          appointment_date: apt.appointment_date || apt.slot_date,
          appointment_time: apt.appointment_time || apt.slot_time,
          visit_type: apt.visit_type,
          appointment_status: apt.appointment_status,
          notes: apt.message,
          created_at: apt.created_at,
          updated_at: apt.updated_at,
          // Additional fields for processing
          appointment_type: apt.appointment_type,
          original_id: apt.original_id,
          slot_id: apt.slot_id,
          category_name: apt.category_name
        }));

        this.filteredAppointments = [...this.appointments];
        this.pendingAppointments = this.appointments.filter(
          (apt) => apt.appointment_status === 'pending'
        );
        this.applyFilters();
        await this.calculateStats(); // Ensure stats are calculated after loading

        console.log('✅ Loaded appointments:', {
          total: this.appointments.length,
          pending: this.pendingAppointments.length
        });
      } else {
        console.error('❌ Failed to load appointments:', result.error);
        this.showError(result.error || 'Failed to load appointments');
      }
    } catch (error) {
      console.error('❌ Error loading appointments:', error);
      this.showError('Failed to load appointments');
    } finally {
      this.isLoading = false;
    }
  }

  async loadPatients() {
    try {
      const result = await this.supabaseService.getAllPatients();
      if (result.success && result.data) {
        this.patients = result.data;
      }
    } catch (error) {
      console.error('Error loading patients:', error);
    }
  }

  async loadDoctors() {
    try {
      const result = await this.supabaseService.getAllStaff();
      if (result.success && result.data) {
        this.doctors = result.data.filter((staff) => staff.role === 'doctor');
      }
    } catch (error) {
      console.error('Error loading doctors:', error);
    }
  }

  async loadServiceCategories() {
    try {
      const result = await this.supabaseService.getServiceCategories();
      if (result.success && result.data) {
        this.serviceCategories = result.data;
      }
    } catch (error) {
      console.error('Error loading service categories:', error);
    }
  }

  generateAppointments(patients: Patient[]): Appointment[] {
    const appointments: Appointment[] = [];
    const getRandomInt = (max: number) => {
      const array = new Uint32Array(1);
      window.crypto.getRandomValues(array);
      return array[0] % max;
    };

    patients.forEach((patient, index) => {
      // Generate 1-3 appointments per patient
      const appointmentCount = getRandomInt(3) + 1;

      for (let i = 0; i < appointmentCount; i++) {
        const appointmentDate = new Date();
        appointmentDate.setDate(
          appointmentDate.getDate() + getRandomInt(30) - 15
        );

        appointments.push({
          appointment_id: `APT-${Date.now()}-${index}-${i}`,
          patient_id: patient.id,
          patient_name: patient.full_name,
          patient_email: patient.email || '',
          patient_phone: patient.phone || patient.phone_number || '',
          doctor_id: `DOC-${getRandomInt(3) + 1}`,
          doctor_name: ['Dr. Smith', 'Dr. Johnson', 'Dr. Brown'][
            getRandomInt(3)
          ],
          appointment_date: appointmentDate.toISOString().split('T')[0],
          appointment_time: [
            '09:00',
            '10:00',
            '11:00',
            '14:00',
            '15:00',
            '16:00',
          ][getRandomInt(6)],
          visit_type: this.getRandomVisitType(),
          appointment_status: this.getRandomStatus(),
          notes: getRandomInt(100) > 50 ? 'Regular checkup appointment' : '',
          created_at: patient.created_at || new Date().toISOString(),
          updated_at: patient.updated_at || new Date().toISOString(),
        });
      }
    });

    return appointments.sort(
      (a, b) =>
        new Date(a.appointment_date).getTime() -
        new Date(b.appointment_date).getTime()
    );
  }

  getRandomVisitType(): VisitType {
    const getRandomInt = (max: number) => {
      const array = new Uint32Array(1);
      window.crypto.getRandomValues(array);
      return array[0] % max;
    };
    const types: VisitType[] = [
      VisitType.CONSULTATION,
      VisitType.FOLLOW_UP,
      VisitType.EMERGENCY,
      VisitType.ROUTINE,
    ];
    return types[getRandomInt(types.length)];
  }

  getRandomStatus():
    | 'pending'
    | 'in_progress'
    | 'completed'
    | 'cancelled' {
    const getRandomInt = (max: number) => {
      const array = new Uint32Array(1);
      window.crypto.getRandomValues(array);
      return array[0] % max;
    };
    const statuses: (
      | 'pending'
      | 'in_progress'
      | 'completed'
      | 'cancelled'
    )[] = ['pending', 'in_progress', 'completed', 'cancelled'];
    return statuses[getRandomInt(statuses.length)];
  }

  async calculateStats() {
    // Get Vietnam time date
    const today = this.getVietnamDate();

    console.log('📊 Calculating stats for date (Vietnam):', today);
    console.log('📊 All appointments dates:', this.appointments.map(apt => apt.appointment_date));

    this.stats = {
      totalAppointments: this.appointments.length,
      pendingApprovals: this.appointments.filter(
        (apt) => apt.appointment_status === 'pending'
      ).length,
      todayAppointments: this.appointments.filter(
        (apt) => apt.appointment_date === today
      ).length,
      inProgressToday: this.appointments.filter(
        (apt) =>
          apt.appointment_date === today &&
          apt.appointment_status === 'in_progress'
      ).length,
    };

    console.log('📊 Stats updated:', this.stats);
    console.log('📊 Today appointments:', this.appointments.filter(apt => apt.appointment_date === today));
  }

  // Pagination methods
  get paginatedAppointments(): Appointment[] {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    return this.filteredAppointments.slice(
      startIndex,
      startIndex + this.pageSize
    );
  }

  get totalPages(): number {
    return Math.ceil(this.filteredAppointments.length / this.pageSize);
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  // Filtering methods
  applyFilters() {
    this.filteredAppointments = this.appointments.filter((appointment) => {
      const matchesSearch =
        !this.searchQuery ||
        appointment.patient_name
          .toLowerCase()
          .includes(this.searchQuery.toLowerCase()) ||
        appointment.patient_email
          .toLowerCase()
          .includes(this.searchQuery.toLowerCase()) ||
        appointment.doctor_name
          .toLowerCase()
          .includes(this.searchQuery.toLowerCase()) ||
        appointment.appointment_id
          .toLowerCase()
          .includes(this.searchQuery.toLowerCase());

      const matchesStatus =
        !this.selectedStatus ||
        appointment.appointment_status === this.selectedStatus;
      const matchesDoctor =
        !this.selectedDoctor || appointment.doctor_id === this.selectedDoctor;
      const matchesDate =
        !this.selectedDate ||
        appointment.appointment_date === this.selectedDate;

      return matchesSearch && matchesStatus && matchesDoctor && matchesDate;
    });

    this.currentPage = 1;
  }

  onSearchChange() {
    this.applyFilters();
  }

  onStatusFilterChange() {
    this.applyFilters();
  }

  onDoctorFilterChange() {
    this.applyFilters();
  }

  onDateFilterChange() {
    this.applyFilters();
  }

  // Modal methods
  openCreateModal() {
    this.resetNewAppointmentForm();
    this.showCreateModal = true;
  }

  closeCreateModal() {
    this.showCreateModal = false;
    this.resetNewAppointmentForm();
  }

  openApprovalModal(appointment: Appointment) {
    this.selectedAppointment = appointment;
    this.showApprovalModal = true;
  }

  closeApprovalModal() {
    this.showApprovalModal = false;
    this.selectedAppointment = null;
  }

  resetNewAppointmentForm() {
    this.newAppointment = {
      appointment_type: 'patient',
      patient_id: '',
      guest_name: '',
      doctor_id: '',
      category_id: '',
      phone: '',
      email: '',
      gender: 'other',
      date_of_birth: '',
      appointment_date: '',
      appointment_time: '',
      visit_type: VisitType.CONSULTATION,
      notes: '',
    };
  }

  showPendingAppointments() {
    this.selectedStatus = 'pending';
    this.applyFilters();
  }

  // CRUD operations
  async createAppointment() {
    if (!this.validateAppointmentForm()) {
      return;
    }

    this.isLoading = true;
    this.clearMessages();

    try {
      let result: any;

      // Use a default receptionist ID for testing (no auth required)
      const receptionistId = 'default-receptionist-id';

      console.log('📅 Creating appointment with date:', this.newAppointment.appointment_date);
      console.log('🕐 Creating appointment with time:', this.newAppointment.appointment_time);
      console.log('📊 Today date for comparison (Vietnam):', this.getVietnamDate());

      if (this.newAppointment.appointment_type === 'patient') {
        // Create appointment for existing patient
        const patient = this.patients.find(p => p.id === this.newAppointment.patient_id);
        if (!patient) {
          this.showError('Patient not found');
          return;
        }

        result = await this.supabaseService.createPatientAppointment(
          receptionistId,
          {
            patient_id: this.newAppointment.patient_id,
            doctor_id: this.newAppointment.doctor_id,
            category_id: this.newAppointment.category_id || undefined,
            phone: this.newAppointment.phone || patient.phone || patient.phone_number || '',
            email: this.newAppointment.email || patient.email || '',
            visit_type: this.newAppointment.visit_type,
            appointment_date: this.newAppointment.appointment_date,
            appointment_time: this.newAppointment.appointment_time,
            message: this.newAppointment.notes
          }
        );
      } else {
        // Create appointment for walk-in guest
        if (!this.newAppointment.guest_name || !this.newAppointment.phone || !this.newAppointment.email) {
          this.showError('Guest name, phone, and email are required');
          return;
        }

        result = await this.supabaseService.createGuestAppointment(
          receptionistId,
          {
            guest_name: this.newAppointment.guest_name,
            phone: this.newAppointment.phone,
            email: this.newAppointment.email,
            gender: this.newAppointment.gender,
            date_of_birth: this.newAppointment.date_of_birth,
            doctor_id: this.newAppointment.doctor_id,
            category_id: this.newAppointment.category_id || undefined,
            visit_type: this.newAppointment.visit_type,
            appointment_date: this.newAppointment.appointment_date,
            appointment_time: this.newAppointment.appointment_time,
            message: this.newAppointment.notes
          }
        );
      }

      if (result.success) {
        console.log('✅ Appointment created successfully:', result);
        this.showSuccess(`${this.newAppointment.appointment_type === 'patient' ? 'Patient' : 'Guest'} appointment created successfully`);

        // Reload appointments first
        await this.loadAppointments();

        // Force stats recalculation
        await this.calculateStats();

        this.closeCreateModal();
      } else {
        this.showError(result.error || 'Failed to create appointment');
      }
    } catch (error) {
      console.error('Error creating appointment:', error);
      this.showError('Failed to create appointment');
    } finally {
      this.isLoading = false;
    }
  }

  async approveAppointment(appointment: any) {
    try {
      this.isLoading = true;
      console.log('✅ Approving appointment:', appointment);

      const result = await this.supabaseService.approveAppointment(
        appointment.original_id || appointment.appointment_id,
        appointment.appointment_type || 'patient',
        appointment.slot_id
      );

      if (result.success) {
        // Update local data
        const index = this.appointments.findIndex(
          (apt) => apt.appointment_id === appointment.appointment_id
        );
        if (index !== -1) {
          this.appointments[index] = {
            ...this.appointments[index],
            appointment_status: 'in_progress' as const,
            updated_at: new Date().toISOString(),
          };
          this.applyFilters();
          await this.calculateStats(); // Recalculate stats immediately
        }
        this.showSuccess('Appointment approved successfully');
      } else {
        this.showError(result.error || 'Failed to approve appointment');
      }
    } catch (error) {
      console.error('❌ Error approving appointment:', error);
      this.showError('Failed to approve appointment');
    } finally {
      this.isLoading = false;
    }
  }

  async updateAppointmentStatus(appointment: any, newStatus: string) {
    if (!newStatus) return;
    try {
      this.isLoading = true;
      console.log('🔄 Updating appointment status:', { appointment, newStatus });

      const result = await this.supabaseService.updateAppointmentStatus(
        appointment.original_id || appointment.appointment_id,
        appointment.appointment_type || 'patient',
        newStatus as any
      );

      if (result.success) {
        // Update local data
        const index = this.appointments.findIndex(
          (apt) => apt.appointment_id === appointment.appointment_id
        );
        if (index !== -1) {
          this.appointments[index] = {
            ...this.appointments[index],
            appointment_status: newStatus as any,
            updated_at: new Date().toISOString(),
          };
          this.applyFilters();
          await this.calculateStats(); // Recalculate stats immediately
        }
        this.showSuccess('Appointment status updated successfully');
      } else {
        this.showError(result.error || 'Failed to update appointment status');
      }
    } catch (error) {
      console.error('❌ Error updating appointment status:', error);
      this.showError('Failed to update appointment status');
    } finally {
      this.isLoading = false;
    }
  }

  async rejectAppointment(appointment: any, reason?: string) {
    try {
      this.isLoading = true;
      console.log('❌ Rejecting appointment:', appointment);

      const result = await this.supabaseService.rejectAppointment(
        appointment.original_id || appointment.appointment_id,
        appointment.appointment_type || 'patient',
        reason
      );

      if (result.success) {
        // Update local data
        const index = this.appointments.findIndex(
          (apt) => apt.appointment_id === appointment.appointment_id
        );
        if (index !== -1) {
          this.appointments[index] = {
            ...this.appointments[index],
            appointment_status: 'cancelled' as const,
            updated_at: new Date().toISOString(),
          };
          this.applyFilters();
          await this.calculateStats(); // Recalculate stats immediately
        }
        this.showSuccess('Appointment rejected successfully');
      } else {
        this.showError(result.error || 'Failed to reject appointment');
      }
    } catch (error) {
      console.error('❌ Error rejecting appointment:', error);
      this.showError('Failed to reject appointment');
    } finally {
      this.isLoading = false;
    }
  }

  // Utility methods
  validateAppointmentForm(): boolean {
    // Common validations
    if (!this.newAppointment.doctor_id) {
      this.showError('Please select a doctor');
      return false;
    }
    if (!this.newAppointment.appointment_date) {
      this.showError('Please select an appointment date');
      return false;
    }
    if (!this.newAppointment.appointment_time) {
      this.showError('Please select an appointment time');
      return false;
    }

    // Type-specific validations
    if (this.newAppointment.appointment_type === 'patient') {
      if (!this.newAppointment.patient_id) {
        this.showError('Please select a patient');
        return false;
      }
    } else {
      // Guest validations
      if (!this.newAppointment.guest_name?.trim()) {
        this.showError('Please enter guest name');
        return false;
      }
      if (!this.newAppointment.phone?.trim()) {
        this.showError('Please enter phone number');
        return false;
      }
      if (!this.newAppointment.email?.trim()) {
        this.showError('Please enter email address');
        return false;
      }
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(this.newAppointment.email)) {
        this.showError('Please enter a valid email address');
        return false;
      }
    }

    return true;
  }

  getStatusBadgeClass(status: string): string {
    const statusOption = this.statusOptions.find((s) => s.value === status);
    return statusOption ? statusOption.color : 'bg-gray-100 text-gray-800';
  }

  getVisitTypeBadgeClass(visitType: string): string {
    const visitTypeOption = this.visitTypes.find(
      (vt) => vt.value === visitType
    );
    return visitTypeOption
      ? visitTypeOption.color
      : 'bg-gray-100 text-gray-800';
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('vi-VN');
  }

  formatTime(timeString: string): string {
    return timeString;
  }

  isToday(dateString: string): boolean {
    const date = new Date(dateString);
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }

  isPast(dateString: string, timeString: string): boolean {
    const appointmentDateTime = new Date(`${dateString}T${timeString}`);
    return appointmentDateTime < new Date();
  }

  showError(message: string) {
    this.errorMessage = message;
    this.successMessage = '';
    setTimeout(() => this.clearMessages(), 5000);
  }

  showSuccess(message: string) {
    this.successMessage = message;
    this.errorMessage = '';
    setTimeout(() => this.clearMessages(), 5000);
  }

  clearMessages() {
    this.errorMessage = '';
    this.successMessage = '';
  }

  getTodayDate(): string {
    return this.getVietnamDate();
  }

  // Helper method to get Vietnam time date string
  private getVietnamDate(): string {
    const now = new Date();
    const vietnamTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
    return vietnamTime.toISOString().split('T')[0];
  }

  onStatusChange(appointment: any, event: any) {
    const newStatus = event.target.value;
    if (newStatus) {
      this.updateAppointmentStatus(appointment, newStatus);
    }
  }
}
