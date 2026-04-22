import { Injectable } from '@angular/core';

export interface Staff {
  staff_id: string;
  full_name: string;
  working_email: string;
  role: 'doctor' | 'receptionist';
  years_experience?: number;
  hired_at?: string;
  is_available?: boolean;
  staff_status?: 'active' | 'inactive' | 'on_leave';
  gender?: 'male' | 'female' | 'other';
  languages?: string[];
  image_link?: string;
  created_at?: string;
  updated_at?: string;
}

@Injectable({
  providedIn: 'root'
})
export class EdgeFunctionService {
  private readonly EDGE_FUNCTION_URL = 'https://ldmcdielxskywugyohrq.supabase.co/functions/v1/create-staff';

  constructor() { }

  // Create staff using edge function with HTTP POST and FormData (No Authentication)
  async createStaffMember(
    staffData: {
      full_name: string;
      working_email: string;
      role: 'doctor' | 'receptionist';
      years_experience?: number;
      hired_at?: string;
      is_available?: boolean;
      staff_status?: 'active' | 'inactive' | 'on_leave';
      gender?: 'male' | 'female' | 'other';
      languages?: string[];
      image_link?: string;
    }
  ): Promise<{ success: boolean; data?: Staff; error?: string }> {
    try {
      console.log('🚀 Creating staff member with edge function using POST (No Auth)...');
      console.log('📝 Input data:', staffData);

      // Prepare FormData
      const formData = new FormData();
      formData.append('full_name', staffData.full_name);
      formData.append('working_email', staffData.working_email);
      formData.append('role', staffData.role);
      
      // Add optional fields if provided
      if (staffData.years_experience !== undefined) {
        formData.append('years_experience', staffData.years_experience.toString());
      }
      
      if (staffData.hired_at) {
        formData.append('hired_at', staffData.hired_at);
      }
      
      if (staffData.is_available !== undefined) {
        formData.append('is_available', staffData.is_available.toString());
      }
      
      if (staffData.staff_status) {
        formData.append('staff_status', staffData.staff_status);
      }
      
      if (staffData.gender) {
        formData.append('gender', staffData.gender);
      }
      
      if (staffData.languages && staffData.languages.length > 0) {
        formData.append('languages', JSON.stringify(staffData.languages));
      }
      
      if (staffData.image_link) {
        formData.append('image_link', staffData.image_link);
      }

      console.log('📤 FormData prepared with fields:');
      for (let [key, value] of formData.entries()) {
        console.log(`  ${key}: ${value}`);
      }

      console.log('🔗 Edge function URL:', this.EDGE_FUNCTION_URL);

      // Make HTTP POST request with FormData (No Authorization header)
      console.log('📡 Making POST request to edge function (No Auth)...');
      const response = await fetch(this.EDGE_FUNCTION_URL, {
        method: 'POST',
        // No headers needed - let browser set Content-Type with boundary for FormData
        body: formData
      });

      console.log('📥 Response status:', response.status, response.statusText);
      console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('💥 HTTP Error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        return { 
          success: false, 
          error: `HTTP ${response.status}: ${response.statusText}${errorText ? ' - ' + errorText : ''}` 
        };
      }

      const responseData = await response.json();
      console.log('📥 Edge function response data:', responseData);

      if (responseData?.error) {
        console.error('🚫 Edge function returned error:', responseData.error);
        return { success: false, error: responseData.error };
      }

      console.log('✅ Staff member created successfully:', responseData);
      return { success: true, data: responseData as Staff };
    } catch (error: any) {
      console.error('💥 Unexpected error creating staff member:', error);
      console.error('💥 Error stack:', error.stack);
      return { success: false, error: error.message || 'An unexpected error occurred' };
    }
  }

  // Test edge function connectivity using HTTP POST (No Authentication)
  async testCreateStaffEdgeFunction(): Promise<{ success: boolean; error?: string; details?: any }> {
    try {
      console.log('🧪 Testing create-staff edge function connectivity with POST (No Auth)...');

      // Test with minimal required data using FormData
      const formData = new FormData();
      formData.append('full_name', 'Test Staff Member');
      formData.append('working_email', 'test@example.com');
      formData.append('role', 'receptionist');
      formData.append('hired_at', new Date().toISOString().split('T')[0]); // Add required hired_at

      console.log('📤 Test FormData prepared with fields:');
      for (let [key, value] of formData.entries()) {
        console.log(`  ${key}: ${value}`);
      }

      console.log('🔗 Test URL:', this.EDGE_FUNCTION_URL);

      const response = await fetch(this.EDGE_FUNCTION_URL, {
        method: 'POST',
        // No headers needed - let browser set Content-Type with boundary for FormData
        body: formData
      });

      console.log('📥 Test response status:', response.status, response.statusText);
      console.log('📥 Test response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('💥 Test HTTP Error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          details: {
            status: response.status,
            statusText: response.statusText,
            body: errorText
          }
        };
      }

      const responseData = await response.json();
      console.log('📥 Test response data:', responseData);

      return {
        success: true,
        details: responseData
      };
    } catch (error: any) {
      console.error('💥 Test edge function error:', error);
      return {
        success: false,
        error: error.message,
        details: error
      };
    }
  }
}
