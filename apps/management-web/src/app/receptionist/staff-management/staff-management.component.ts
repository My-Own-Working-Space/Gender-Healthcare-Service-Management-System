import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../supabase.service';
import { Staff } from '../../models/staff.interface';

@Component({
  selector: 'app-receptionist-staff-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './staff-management.component.html',
  styleUrls: ['./staff-management.component.css']
})
export class ReceptionistStaffManagementComponent implements OnInit {
  staffMembers: Staff[] = [];
  filteredStaff: Staff[] = [];
  paginatedStaff: Staff[] = [];
  isLoading = false;
  searchTerm = '';
  selectedRole = '';
  selectedAvailability = '';

  // Pagination
  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 1;

  // Modal
  showStaffModal = false;
  selectedStaff: Staff | null = null;
  errorMessage = '';

  constructor(private supabaseService: SupabaseService) { }

  ngOnInit() {
    this.loadStaffMembers();
  }

  async refreshData() {
    this.errorMessage = '';
    await this.loadStaffMembers();
  }

  async loadStaffMembers() {
    this.isLoading = true;
    this.errorMessage = '';
    try {
      const result = await this.supabaseService.getAllStaff();
      if (result.success && result.data) {
        this.staffMembers = result.data;
        this.filterStaff();
      } else {
        this.errorMessage = result.error || 'Failed to load staff data';
        console.error('Error loading staff:', result.error);
      }
    } catch (error) {
      this.errorMessage = 'An unexpected error occurred while loading staff data';
      console.error('Error:', error);
    } finally {
      this.isLoading = false;
    }
  }

  filterStaff() {
    this.filteredStaff = this.staffMembers.filter(staff => {
      const matchesSearch = !this.searchTerm ||
        staff.full_name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        staff.working_email.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        staff.role.toLowerCase().includes(this.searchTerm.toLowerCase());

      const matchesRole = !this.selectedRole || staff.role === this.selectedRole;

      const matchesAvailability = !this.selectedAvailability ||
        (this.selectedAvailability === 'available' && staff.is_available) ||
        (this.selectedAvailability === 'busy' && !staff.is_available);

      return matchesSearch && matchesRole && matchesAvailability;
    });

    this.totalPages = Math.ceil(this.filteredStaff.length / this.itemsPerPage);
    this.currentPage = 1;
    this.updatePaginatedStaff();
  }

  updatePaginatedStaff() {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedStaff = this.filteredStaff.slice(startIndex, endIndex);
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePaginatedStaff();
    }
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxPagesToShow = 5;
    const half = Math.floor(maxPagesToShow / 2);

    let start = Math.max(1, this.currentPage - half);
    let end = Math.min(this.totalPages, start + maxPagesToShow - 1);

    if (end - start + 1 < maxPagesToShow) {
      start = Math.max(1, end - maxPagesToShow + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    return pages;
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }

  getRoleBadgeClass(role: string): string {
    switch (role.toLowerCase()) {
      case 'doctor':
        return 'bg-green-100 text-green-800';
      case 'consultant':
        return 'bg-purple-100 text-purple-800';
      case 'receptionist':
        return 'bg-blue-100 text-blue-800';
      case 'administrator':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  getStatusBadgeClass(status: string): string {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-red-100 text-red-800';
      case 'on_leave':
        return 'bg-yellow-100 text-yellow-800';
      case 'terminated':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  getDoctorCount(): number {
    return this.staffMembers.filter(staff => staff.role === 'doctor' || staff.role === 'consultant').length;
  }

  getReceptionistCount(): number {
    return this.staffMembers.filter(staff => staff.role === 'receptionist').length;
  }

  getActiveCount(): number {
    return this.staffMembers.filter(staff => staff.staff_status === 'active' && staff.is_available).length;
  }

  // Quick filter methods
  filterByRole(role: string) {
    this.selectedRole = role;
    this.selectedAvailability = '';
    this.searchTerm = '';
    this.filterStaff();
  }

  filterByMedicalStaff() {
    this.selectedRole = '';
    this.selectedAvailability = '';
    this.searchTerm = '';
    // Filter to show only doctors and consultants
    this.filteredStaff = this.staffMembers.filter(staff =>
      staff.role === 'doctor' || staff.role === 'consultant'
    );
    this.totalPages = Math.ceil(this.filteredStaff.length / this.itemsPerPage);
    this.currentPage = 1;
    this.updatePaginatedStaff();
  }

  filterByAvailability(availability: string) {
    this.selectedAvailability = availability;
    this.selectedRole = '';
    this.searchTerm = '';
    this.filterStaff();
  }

  clearFilters() {
    this.searchTerm = '';
    this.selectedRole = '';
    this.selectedAvailability = '';
    this.filterStaff();
  }

  viewStaffDetails(staff: Staff) {
    this.selectedStaff = staff;
    this.showStaffModal = true;
  }

  closeStaffModal() {
    this.showStaffModal = false;
    this.selectedStaff = null;
  }

  contactStaff(staff: Staff) {
    // Open email client or show contact options
    window.open(`mailto:${staff.working_email}?subject=Contact from Healthcare System`);
  }

  handleExportData(data: Staff[]) {
    // Create CSV content
    const headers = ['Staff ID', 'Full Name', 'Email', 'Role', 'Experience', 'Status', 'Hired Date', 'Gender'];
    const csvContent = [
      headers.join(','),
      ...data.map(staff => [
        staff.staff_id,
        `"${staff.full_name}"`,
        staff.working_email,
        staff.role,
        staff.years_experience || 0,
        staff.staff_status,
        staff.hired_at ? new Date(staff.hired_at).toLocaleDateString() : '',
        staff.gender || ''
      ].join(','))
    ].join('\n');

    // Download CSV file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `staff-directory-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  getStaffAvatarUrl(staff: Staff): string | null {
    if (staff.image_link) {
      // If it's already a full URL, return it
      if (staff.image_link.startsWith('http')) {
        return staff.image_link;
      }
      // If it's a path, construct the full Supabase storage URL
      const supabaseUrl = 'https://ldmcdielxskywugyohrq.supabase.co';
      return `${supabaseUrl}/storage/v1/object/public/staff-uploads/${staff.image_link}`;
    }
    return null;
  }

  onImageError(event: any) {
    // Hide the image element when there's an error loading it
    event.target.style.display = 'none';
    // Find and show the fallback initials avatar in the same container
    const container = event.target.parentElement;
    if (container) {
      const fallback = container.querySelector('.avatar-fallback');
      if (fallback) {
        fallback.style.display = 'flex';
      }
    }
  }
}
