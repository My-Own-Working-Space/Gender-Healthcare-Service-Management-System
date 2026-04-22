import { Injectable } from '@angular/core';

export interface BlogPost {
  blog_id: string;
  doctor_id: string;
  blog_title: string;
  blog_content: string;
  excerpt?: string;
  image_link?: string;
  blog_tags?: string[];
  published_at?: string;
  blog_status?: 'draft' | 'published' | 'archived';
  view_count?: number;
  created_at?: string;
  updated_at?: string;
}

@Injectable({
  providedIn: 'root'
})
export class BlogEdgeFunctionService {
  private readonly EDGE_FUNCTION_URL = 'https://ldmcdielxskywugyohrq.supabase.co/functions/v1/create-blog-post';
  private readonly BUCKET_NAME = 'blog-uploads';

  constructor() { }

  // Create blog post using edge function with HTTP POST and FormData (No Authentication)
  async createBlogPost(
    blogData: {
      doctor_id: string;
      blog_title: string;
      blog_content: string;
      excerpt?: string;
      image_file?: File;
      blog_tags?: string[];
      published_at?: string;
      blog_status?: 'draft' | 'published' | 'archived';
    }
  ): Promise<{ success: boolean; data?: BlogPost; error?: string }> {
    try {
      console.log('🚀 Creating blog post with deployed edge function...');
      console.log('📝 Input data:', {
        ...blogData,
        image_file: blogData.image_file ? `File: ${blogData.image_file.name}` : 'No file'
      });

      // Prepare FormData with exact field names expected by the deployed edge function
      const formData = new FormData();
      formData.append('doctor_id', blogData.doctor_id);
      formData.append('blog_title', blogData.blog_title);
      formData.append('blog_content', blogData.blog_content);

      // Add required excerpt field
      formData.append('excerpt', blogData.excerpt || blogData.blog_content.substring(0, 200) + '...');

      if (blogData.image_file) {
        // Use 'image' field name as expected by the deployed edge function
        formData.append('image', blogData.image_file);
        console.log('📎 Image file attached as "image" field:', {
          name: blogData.image_file.name,
          size: blogData.image_file.size,
          type: blogData.image_file.type
        });
      } else {
        console.log('📎 No image file provided');
      }

      if (blogData.blog_tags && blogData.blog_tags.length > 0) {
        // Send tags as JSON array string for proper parsing by edge function
        const tagsJson = JSON.stringify(blogData.blog_tags);
        formData.append('blog_tags', tagsJson);
        console.log('🏷️ Tags sent as JSON array:', tagsJson);
      } else {
        console.log('🏷️ No tags provided');
      }

      // Add required blog_status field
      formData.append('blog_status', blogData.blog_status || 'draft');

      console.log('📤 FormData prepared with fields:');
      for (let [key, value] of formData.entries()) {
        if (value instanceof File) {
          console.log(`  ${key}: File - ${value.name} (${value.size} bytes)`);
        } else {
          console.log(`  ${key}: ${value}`);
        }
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
        console.error('💥 HTTP Error Details:', {
          status: response.status,
          statusText: response.statusText,
          url: this.EDGE_FUNCTION_URL,
          body: errorText,
          headers: Object.fromEntries(response.headers.entries())
        });

        // Try to parse error as JSON if possible
        let parsedError = errorText;
        try {
          const errorJson = JSON.parse(errorText);
          parsedError = errorJson.error || errorJson.message || errorText;
          console.error('💥 Parsed error JSON:', errorJson);
        } catch (e) {
          console.error('💥 Error text (not JSON):', errorText);
        }

        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}${parsedError ? ' - ' + parsedError : ''}`
        };
      }

      let responseData;
      try {
        responseData = await response.json();
        console.log('📥 Edge function response data:', responseData);
      } catch (jsonError) {
        console.error('💥 Failed to parse response as JSON:', jsonError);
        const responseText = await response.text();
        console.error('💥 Raw response text:', responseText);
        return { success: false, error: 'Invalid JSON response from edge function' };
      }

      if (responseData?.error) {
        console.error('🚫 Edge function returned error:', responseData.error);
        return { success: false, error: responseData.error };
      }

      // Check if image was uploaded successfully
      if (blogData.image_file && responseData.image_link) {
        console.log('📸 Image upload successful:', responseData.image_link);
      } else if (blogData.image_file && !responseData.image_link) {
        console.warn('⚠️ Image file was provided but no image_link in response');
      }

      console.log('✅ Blog post created successfully:', responseData);
      return { success: true, data: responseData as BlogPost };
    } catch (error: any) {
      console.error('💥 Unexpected error creating blog post:', error);
      console.error('💥 Error stack:', error.stack);
      return { success: false, error: error.message || 'An unexpected error occurred' };
    }
  }

  // Test edge function connectivity using HTTP POST (No Authentication)
  async testCreateBlogPostEdgeFunction(): Promise<{ success: boolean; error?: string; details?: any }> {
    try {
      console.log('🧪 Testing create-blog-post edge function connectivity with POST (No Auth)...');

      // Test with exact FormData fields expected by the deployed edge function
      const formData = new FormData();
      formData.append('doctor_id', 'test-doctor-id-12345');
      formData.append('blog_title', 'Test Blog Post - Edge Function');
      formData.append('blog_content', 'This is a comprehensive test blog post content for edge function testing. It includes multiple sentences to test content processing.');
      formData.append('excerpt', 'Test excerpt for blog post');
      formData.append('blog_status', 'draft');
      formData.append('blog_tags', JSON.stringify(['test', 'edge-function', 'debugging']));

      console.log('📤 Test FormData prepared with comprehensive fields:');
      for (let [key, value] of formData.entries()) {
        if (value instanceof File) {
          console.log(`  ${key}: File - ${value.name} (${value.size} bytes)`);
        } else {
          console.log(`  ${key}: ${value}`);
        }
      }

      console.log('🔗 Test URL:', this.EDGE_FUNCTION_URL);
      console.log('🪣 Bucket name:', this.BUCKET_NAME);

      const response = await fetch(this.EDGE_FUNCTION_URL, {
        method: 'POST',
        // No headers needed - let browser set Content-Type with boundary for FormData
        body: formData
      });

      console.log('📥 Test response status:', response.status, response.statusText);
      console.log('📥 Test response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('💥 Test HTTP Error Details:', {
          status: response.status,
          statusText: response.statusText,
          url: this.EDGE_FUNCTION_URL,
          body: errorText,
          headers: Object.fromEntries(response.headers.entries())
        });

        // Try to parse error as JSON
        let parsedError = errorText;
        try {
          const errorJson = JSON.parse(errorText);
          parsedError = errorJson.error || errorJson.message || errorText;
          console.error('💥 Test parsed error JSON:', errorJson);
        } catch (e) {
          console.error('💥 Test error text (not JSON):', errorText);
        }

        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          details: {
            status: response.status,
            statusText: response.statusText,
            body: errorText,
            parsedError: parsedError,
            url: this.EDGE_FUNCTION_URL
          }
        };
      }

      let responseData;
      try {
        responseData = await response.json();
        console.log('📥 Test response data:', responseData);

        // Check specific fields in response
        console.log('🔍 Response analysis:');
        console.log('  - blog_id:', responseData.blog_id);
        console.log('  - blog_title:', responseData.blog_title);
        console.log('  - blog_content:', responseData.blog_content);
        console.log('  - blog_tags:', responseData.blog_tags);
        console.log('  - image_link:', responseData.image_link);
        console.log('  - bucket info:', responseData.bucket_name);

      } catch (jsonError) {
        console.error('💥 Test failed to parse response as JSON:', jsonError);
        const responseText = await response.text();
        console.error('💥 Test raw response text:', responseText);
        return {
          success: false,
          error: 'Invalid JSON response from edge function',
          details: { jsonError, responseText }
        };
      }

      return {
        success: true,
        details: responseData
      };
    } catch (error: any) {
      console.error('💥 Test edge function error:', error);
      console.error('💥 Test error stack:', error.stack);
      return {
        success: false,
        error: error.message,
        details: error
      };
    }
  }

  // Get image URL from blog-uploads bucket
  getImageUrl(imagePath: string): string {
    if (!imagePath) return '';

    // If it's already a full URL, return as is
    if (imagePath.startsWith('http')) {
      return imagePath;
    }

    // Construct URL for blog-uploads bucket
    const baseUrl = 'https://ldmcdielxskywugyohrq.supabase.co/storage/v1/object/public';
    return `${baseUrl}/${this.BUCKET_NAME}/${imagePath}`;
  }

  // Helper method to validate image file
  validateImageFile(file: File): { valid: boolean; error?: string } {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

    if (file.size > maxSize) {
      return { valid: false, error: 'Image file size must be less than 5MB' };
    }

    if (!allowedTypes.includes(file.type)) {
      return { valid: false, error: 'Only JPEG, PNG, GIF, and WebP images are allowed' };
    }

    return { valid: true };
  }
}
