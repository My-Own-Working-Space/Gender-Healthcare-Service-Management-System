import { CommonModule } from '@angular/common';
import { Component, inject, HostListener, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { SupabaseService } from '../../supabase.service';
import { FormatNamePipe } from '../../utils/name.util';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-doctor-header',
  standalone: true,
  imports: [CommonModule, RouterModule, FormatNamePipe],
  templateUrl: './doctor-header.component.html',
  styleUrls: ['./doctor-header.component.css']
})
export class DoctorHeaderComponent implements OnInit {
  private router = inject(Router);
  private supabaseService = inject(SupabaseService);

  showNotificationMenu: boolean = false;
  showProfileMenu: boolean = false;
  isNavigating: boolean = false;

  // Doctor profile data
  doctorProfile: any = null;
  avatarUrl: string | null = null;
  isLoadingProfile: boolean = false;

  ngOnInit() {
    this.loadDoctorProfile();
  }
  notifications: string[] = [
    'New message from John',
    'Your order has been shipped',
    'New comment on your post'
  ];

  // Get doctor name from localStorage
  get doctorName(): string {
    return localStorage.getItem('user_name') || 'Doctor';
  }

  // Get doctor email from localStorage
  get doctorEmail(): string {
    return localStorage.getItem('user_email') || '';
  }

  // Get doctor ID from localStorage
  get doctorId(): string | null {
    return localStorage.getItem('staff_id');
  }

  // Load doctor profile data including avatar
  async loadDoctorProfile() {
    const doctorId = this.doctorId;
    if (!doctorId) {
      console.warn('No doctor ID found in localStorage');
      return;
    }

    try {
      this.isLoadingProfile = true;
      console.log('🔍 Loading doctor profile for header avatar:', doctorId);

      // Get doctor profile data
      const profileData = await this.supabaseService.getDoctorProfile(doctorId);

      if (profileData) {
        this.doctorProfile = profileData;

        // Process the image URL using the same method as other components
        if (profileData.image_link) {
          this.avatarUrl = this.getFullImageUrl(profileData.image_link, 'staff-uploads');
        } else {
          // Generate fallback avatar with initials
          this.avatarUrl = this.generateFallbackAvatar(profileData.full_name || this.doctorName);
        }

        console.log('✅ Doctor profile loaded for header:', {
          name: profileData.full_name,
          image_link: profileData.image_link,
          avatarUrl: this.avatarUrl
        });
      }
    } catch (error) {
      console.error('❌ Error loading doctor profile for header:', error);
      // Generate fallback avatar on error
      this.avatarUrl = this.generateFallbackAvatar(this.doctorName);
    } finally {
      this.isLoadingProfile = false;
    }
  }

  // Helper method to get full image URL from Supabase storage
  private getFullImageUrl(imagePath: string | null, bucket: string = 'staff-uploads'): string | null {
    if (!imagePath) return null;

    // If the path already contains the full URL, return as is
    if (imagePath.startsWith('http')) {
      return imagePath;
    }

    // Remove leading slash if present
    const cleanPath = imagePath.startsWith('/') ? imagePath.substring(1) : imagePath;

    // Construct the full Supabase storage URL
    const supabaseUrl = environment.supabaseUrl;
    return `${supabaseUrl}/storage/v1/object/public/${bucket}/${cleanPath}`;
  }

  // Generate fallback avatar with initials
  private generateFallbackAvatar(name: string): string {
    const initials = name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .join('')
      .substring(0, 2);

    const encoded = encodeURIComponent(initials);
    return `https://ui-avatars.com/api/?name=${encoded}&background=4f46e5&color=ffffff&size=128&bold=true`;
  }

  // Handle avatar image load error
  onAvatarError(event: any) {
    console.warn('Avatar image failed to load, using fallback');
    this.avatarUrl = this.generateFallbackAvatar(this.doctorProfile?.full_name || this.doctorName);
  }

  toggleNotificationMenu() {
    this.showNotificationMenu = !this.showNotificationMenu;
    this.showProfileMenu = false; // Close profile menu if open
  }

  toggleProfileMenu() {
    this.showProfileMenu = !this.showProfileMenu;
    this.showNotificationMenu = false; // Close notification menu if open
  }

  // Navigate to profile page and close dropdown
  navigateToProfile() {
    this.isNavigating = true;
    this.showProfileMenu = false;
    this.showNotificationMenu = false;

    this.router.navigate(['/doctor/dashboard/profile']).then(() => {
      // Reset navigation state after a brief delay
      setTimeout(() => {
        this.isNavigating = false;
      }, 300);
    });
  }

  // Close dropdowns when clicking outside
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    const target = event.target as HTMLElement;
    const clickedInside = target.closest('.profile-dropdown') || target.closest('.notification-dropdown') ||
      target.closest('.profile-btn') || target.closest('.notification-btn');

    if (!clickedInside) {
      this.showProfileMenu = false;
      this.showNotificationMenu = false;
    }
  }

  async logout() {
    console.log('🚪 Doctor logout initiated');

    try {
      // Sign out from Supabase Auth if authenticated
      await this.supabaseService.signOut();
      console.log('✅ Supabase Auth session cleared');
    } catch (error) {
      console.log('⚠️ Supabase signout error (continuing with logout):', error);
    }

    // Clear all doctor session data
    localStorage.removeItem('role');
    localStorage.removeItem('doctor_id');
    localStorage.removeItem('staff_id');
    localStorage.removeItem('user_name');
    localStorage.removeItem('user_email');
    localStorage.removeItem('doctor_redirect_url');

    console.log('✅ Session data cleared, redirecting to login');

    // Close all open menus
    this.showProfileMenu = false;
    this.showNotificationMenu = false;

    // Redirect to unified login
    this.router.navigate(['/login']).then(success => {
      if (success) {
        console.log('✅ Successfully redirected to login page');
      } else {
        console.error('❌ Failed to redirect, using fallback');
        // Fallback: force navigation using window.location
        window.location.href = '/login';
      }
    });
  }
}
