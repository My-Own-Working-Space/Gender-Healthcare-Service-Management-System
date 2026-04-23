import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SupabaseService } from '../../supabase.service';
import { BlogPost, BlogStatus, CreateBlogPostRequest, UpdateBlogPostRequest } from '../../models/blog.interface';
import { BlogEdgeFunctionService } from '../../blog-edge-function.service';
import { BaseComponent } from '../../shared/base.component';

interface BlogStats {
  totalPosts: number;
  publishedPosts: number;
  draftPosts: number;
  totalViews: number;
}

@Component({
  selector: 'app-doctor-blog-posts',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './blog-posts.component.html',
  styleUrls: ['./blog-posts.component.css']
})
export class BlogPostsComponent extends BaseComponent implements OnInit {
  @ViewChild('contentEditor') contentEditor!: ElementRef;

  // Data properties
  blogPosts: BlogPost[] = [];
  filteredPosts: BlogPost[] = [];
  paginatedPosts: BlogPost[] = [];
  stats: BlogStats = {
    totalPosts: 0,
    publishedPosts: 0,
    draftPosts: 0,
    totalViews: 0
  };

  // UI state
  loading = true;
  error: any = null;
  retrying = false;
  showModal = false;
  showDeleteModal = false;
  isEditMode = false;
  saving = false;
  deleting = false;

  // Form and editing
  blogForm: FormGroup;
  currentPost: BlogPost | null = null;
  postToDelete: BlogPost | null = null;

  // Search and filtering
  searchTerm = '';
  selectedStatus = '';
  sortBy = 'created_at';

  // Pagination
  currentPage = 1;
  itemsPerPage = 9;
  totalPages = 0;

  // Tags and image
  currentTags: string[] = [];
  newTag = '';
  imagePreview: string | null = null;
  selectedFile: File | null = null;

  // Doctor info
  doctorId: string | null = null;

  constructor(
    private supabaseService: SupabaseService,
    private formBuilder: FormBuilder,
    private blogEdgeFunctionService: BlogEdgeFunctionService
  ) {
    super();
    this.blogForm = this.createBlogForm();
  }

  ngOnInit() {
    this.doctorId = localStorage.getItem('doctor_id') || localStorage.getItem('staff_id');
    console.log('🔍 Doctor ID from localStorage:', this.doctorId);
    console.log('🔍 Role from localStorage:', localStorage.getItem('role'));
    console.log('🔍 User name from localStorage:', localStorage.getItem('user_name'));
    console.log('🔍 User email from localStorage:', localStorage.getItem('user_email'));

    if (!this.doctorId) {
      this.error = 'Doctor ID not found. Please log in again.';
      this.loading = false;
      return;
    }
    this.loadBlogPosts();
  }



  // Test method to verify empty list item removal
  testCleanHtml() {
    const testHtml = '<ol><li>you are too good, i like it</li><li><br></li></ol>';
    console.log('🧪 Testing HTML cleaning...');
    console.log('📝 Test input:', testHtml);

    const cleaned = this.cleanHtmlContent(testHtml);
    console.log('✨ Test output:', cleaned);

    // Expected output should be: <ol><li>you are too good, i like it</li></ol>
    const expected = '<ol><li>you are too good, i like it</li></ol>';
    const isCorrect = cleaned === expected;
    console.log('✅ Test result:', isCorrect ? 'PASSED' : 'FAILED');
    console.log('🎯 Expected:', expected);
    console.log('📊 Actual:', cleaned);
  }

  // Test edge function connectivity
  async testBlogEdgeFunction() {
    console.log('🧪 Testing blog edge function...');
    const result = await this.blogEdgeFunctionService.testCreateBlogPostEdgeFunction();
    console.log('🧪 Test result:', result);

    if (result.success) {
      alert('✅ Blog edge function test successful!\nCheck console for details.');
    } else {
      alert(`❌ Blog edge function test failed:\n${result.error}\nCheck console for details.`);
    }
  }

  // Test edge function with image upload
  async testBlogEdgeFunctionWithImage() {
    console.log('🧪 Testing blog edge function with image upload...');

    // Create a small test image file (1x1 pixel PNG)
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#FF0000';
      ctx.fillRect(0, 0, 1, 1);
    }

    canvas.toBlob(async (blob) => {
      if (blob && this.doctorId) {
        const testFile = new File([blob], 'test-image.png', { type: 'image/png' });

        const testData = {
          doctor_id: this.doctorId,
          blog_title: 'Test Blog Post with Image',
          blog_content: 'This is a test blog post with image upload functionality.',
          excerpt: 'Test excerpt with image',
          blog_status: 'draft' as 'draft' | 'published' | 'archived',
          blog_tags: ['test', 'image-upload', 'debugging'],
          image_file: testFile
        };

        console.log('🧪 Testing with image file:', {
          name: testFile.name,
          size: testFile.size,
          type: testFile.type
        });

        const result = await this.blogEdgeFunctionService.createBlogPost(testData);
        console.log('🧪 Image test result:', result);

        if (result.success) {
          alert('✅ Blog edge function with image test successful!\nCheck console for details.');
          // Reload posts to see the new test post
          await this.loadBlogPosts();
        } else {
          alert(`❌ Blog edge function with image test failed:\n${result.error}\nCheck console for details.`);
        }
      } else {
        alert('❌ Cannot create test image or doctor ID not available');
      }
    }, 'image/png');
  }

  // Development helper method to create sample blog posts
  async createSampleBlogPosts() {
    if (!this.doctorId) return;

    const samplePosts = [
      {
        blog_title: "Understanding Gender-Affirming Healthcare",
        blog_content: "<p>Gender-affirming healthcare is a comprehensive approach to medical care that supports individuals in their gender identity journey. This includes hormone therapy, surgical options, and mental health support.</p><p>Our clinic provides personalized care plans that respect each patient's unique needs and timeline.</p>",
        excerpt: "A comprehensive guide to gender-affirming healthcare options and personalized care approaches.",
        blog_status: BlogStatus.PUBLISHED,
        blog_tags: ["gender-affirming", "healthcare", "hormone-therapy"]
      },
      {
        blog_title: "Mental Health Support in Gender Care",
        blog_content: "<p>Mental health is a crucial component of gender care. We provide counseling services, support groups, and resources for patients and their families.</p><p>Our approach emphasizes creating a safe, supportive environment for all patients.</p>",
        excerpt: "Exploring the importance of mental health support in comprehensive gender care.",
        blog_status: BlogStatus.DRAFT,
        blog_tags: ["mental-health", "counseling", "support"]
      },
      {
        blog_title: "Hormone Therapy: What to Expect",
        blog_content: "<p>Hormone therapy is often a key component of gender-affirming care. This article covers the basics of hormone therapy, including what to expect during treatment.</p><p>We discuss both masculinizing and feminizing hormone therapy options.</p>",
        excerpt: "A detailed overview of hormone therapy options and what patients can expect during treatment.",
        blog_status: BlogStatus.PUBLISHED,
        blog_tags: ["hormone-therapy", "treatment", "expectations"]
      }
    ];

    try {
      for (const post of samplePosts) {
        await this.supabaseService.createBlogPost(this.doctorId, post);
      }
      await this.loadBlogPosts();
      console.log('Sample blog posts created successfully');
    } catch (error) {
      console.error('Error creating sample posts:', error);
    }
  }

  private createBlogForm(): FormGroup {
    return this.formBuilder.group({
      blog_title: ['', [Validators.required, Validators.minLength(3)]],
      blog_content: ['', [Validators.required, Validators.minLength(10)]],
      excerpt: [''],
      blog_status: [BlogStatus.DRAFT, Validators.required]
    });
  }

  // Data loading methods
  async loadBlogPosts() {
    try {
      this.loading = true;
      this.error = null;

      console.log('🔍 Loading blog posts for doctor:', this.doctorId);

      if (!this.doctorId) {
        throw new Error('Doctor ID not found');
      }

      // Ensure doctor is authenticated with Supabase for RLS compatibility
      await this.ensureSupabaseAuthentication();

      this.blogPosts = await this.supabaseService.getDoctorBlogPosts(this.doctorId);
      console.log('📝 Loaded blog posts from Supabase:', this.blogPosts);

      this.calculateStats();
      this.applyFilters();

    } catch (error: any) {
      console.error('❌ Error loading blog posts:', error);

      // Format detailed error information
      const errorDetails = this.formatErrorDetails(error, 'Load Blog Posts');
      this.error = {
        message: `Failed to load blog posts: ${error.message}`,
        details: errorDetails,
        timestamp: new Date().toISOString()
      };

      this.blogPosts = [];
      this.calculateStats();
      this.applyFilters();
    } finally {
      this.loading = false;
    }
  }

  // Ensure doctor is authenticated with Supabase for RLS compatibility
  private async ensureSupabaseAuthentication() {
    try {
      const user = await this.supabaseService.getCurrentUser();
      console.log('👤 Current Supabase user:', user);

      if (!user) {
        console.log('🔐 No Supabase user found, attempting authentication...');
        const doctorEmail = localStorage.getItem('user_email');

        if (doctorEmail && this.doctorId) {
          // Try to authenticate with Supabase using default password
          try {
            const authResult = await this.supabaseService.authenticateStaffWithSupabase(doctorEmail, '123456');

            if (authResult.success && authResult.supabaseUser) {
              console.log('✅ Successfully authenticated doctor with Supabase');
            } else {
              console.log('⚠️ Could not authenticate with Supabase, proceeding without auth');
            }
          } catch (authError) {
            console.log('⚠️ Supabase authentication failed, proceeding without auth:', authError);
          }
        }
      } else {
        console.log('✅ Doctor already authenticated with Supabase');
      }
    } catch (error) {
      console.log('⚠️ Authentication attempt failed, proceeding anyway:', error);
      // Don't throw error here, let the main operation proceed
    }
  }

  private calculateStats() {
    this.stats = {
      totalPosts: this.blogPosts.length,
      publishedPosts: this.blogPosts.filter(p => p.blog_status === BlogStatus.PUBLISHED).length,
      draftPosts: this.blogPosts.filter(p => p.blog_status === BlogStatus.DRAFT).length,
      totalViews: this.blogPosts.reduce((sum, p) => sum + (p.view_count || 0), 0)
    };
  }

  // Search and filtering
  onSearch() {
    this.currentPage = 1;
    this.applyFilters();
  }

  onFilterChange() {
    this.currentPage = 1;
    this.applyFilters();
  }

  onSortChange() {
    this.applyFilters();
  }

  private applyFilters() {
    let filtered = [...this.blogPosts];

    // Apply search filter
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(post =>
        post.blog_title.toLowerCase().includes(term) ||
        post.blog_content.toLowerCase().includes(term) ||
        (post.excerpt && post.excerpt.toLowerCase().includes(term))
      );
    }

    // Apply status filter
    if (this.selectedStatus) {
      filtered = filtered.filter(post => post.blog_status === this.selectedStatus);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (this.sortBy) {
        case 'published_at':
          const dateA = new Date(a.published_at || a.created_at || '').getTime();
          const dateB = new Date(b.published_at || b.created_at || '').getTime();
          return dateB - dateA;
        case 'view_count':
          return (b.view_count || 0) - (a.view_count || 0);
        case 'blog_title':
          return a.blog_title.localeCompare(b.blog_title);
        default: // created_at
          const createdA = new Date(a.created_at || '').getTime();
          const createdB = new Date(b.created_at || '').getTime();
          return createdB - createdA;
      }
    });

    this.filteredPosts = filtered;
    this.updatePagination();
  }

  // Pagination methods
  private updatePagination() {
    this.totalPages = Math.ceil(this.filteredPosts.length / this.itemsPerPage);
    this.updatePaginatedPosts();
  }

  private updatePaginatedPosts() {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedPosts = this.filteredPosts.slice(startIndex, endIndex);
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePaginatedPosts();
    }
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(this.totalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    return pages;
  }

  // Modal methods
  openCreateModal() {
    this.isEditMode = false;
    this.currentPost = null;
    this.error = null; // Clear any previous errors
    this.resetForm();
    this.showModal = true;

    // Initialize content editor after modal is shown
    setTimeout(() => {
      this.initializeContentEditor();
    }, 100);
  }

  editPost(post: BlogPost) {
    this.isEditMode = true;
    this.currentPost = post;
    this.error = null; // Clear any previous errors
    this.populateForm(post);
    this.showModal = true;

    // Initialize content editor after modal is shown
    setTimeout(() => {
      this.initializeContentEditor();
    }, 100);
  }

  closeModal() {
    this.showModal = false;
    this.resetForm();
  }

  private resetForm() {
    this.blogForm.reset({
      blog_title: '',
      blog_content: '',
      excerpt: '',
      blog_status: BlogStatus.DRAFT
    });
    this.currentTags = [];
    this.newTag = '';
    this.imagePreview = null;
    this.selectedFile = null;

    // Clear content editor
    setTimeout(() => {
      this.setEditorContent('');
    }, 50);
  }

  private populateForm(post: BlogPost) {
    // Clean the content when loading from database to ensure no old inline styles
    const cleanContent = this.cleanHtmlContent(post.blog_content || '');

    this.blogForm.patchValue({
      blog_title: post.blog_title,
      blog_content: cleanContent,
      excerpt: post.excerpt || '',
      blog_status: post.blog_status
    });

    this.currentTags = this.getTagsArray(post.blog_tags);
    this.imagePreview = post.image_link ? this.getImageUrl(post.image_link) : null;

    // Update content editor
    setTimeout(() => {
      this.initializeContentEditor();
    }, 100);
  }

  // Form submission
  async saveBlogPost() {
    if (this.blogForm.invalid || !this.doctorId) {
      this.markFormGroupTouched();
      console.warn('⚠️ Form invalid or doctor ID missing');
      return;
    }

    try {
      this.saving = true;
      this.error = null; // Clear any previous errors

      const formData = this.blogForm.value;

      if (this.isEditMode && this.currentPost) {
        console.log('✏️ Updating existing post:', this.currentPost.blog_id);

        // For updates, clean HTML content but keep some formatting
        const cleanedContent = this.cleanHtmlContent(formData.blog_content || '');

        // For updates, still use the original Supabase service
        const updateData: UpdateBlogPostRequest = {
          blog_id: this.currentPost.blog_id,
          blog_title: formData.blog_title,
          blog_content: cleanedContent,
          excerpt: formData.excerpt || this.generateExcerpt(cleanedContent),
          blog_status: formData.blog_status,
          blog_tags: this.currentTags.length > 0 ? this.currentTags : null,
          image_link: this.imagePreview || undefined
        };
        await this.supabaseService.updateBlogPost(updateData);
        console.log('✅ Updated post in Supabase');
      } else {
        // For new posts, convert HTML to plain text for consistent storage
        const plainTextContent = this.convertHtmlToPlainText(formData.blog_content || '');

        // Prepare data for edge function
        const blogData = {
          doctor_id: this.doctorId,
          blog_title: formData.blog_title,
          blog_content: plainTextContent, // ✅ Use plain text instead of HTML
          excerpt: formData.excerpt || this.generateExcerpt(plainTextContent),
          blog_status: formData.blog_status as 'draft' | 'published' | 'archived',
          blog_tags: this.currentTags.length > 0 ? this.currentTags : undefined,
          image_file: this.selectedFile || undefined,
          published_at: formData.blog_status === 'published' ? new Date().toISOString() : undefined
        };

        // Use edge function service for creating new posts
        const result = await this.blogEdgeFunctionService.createBlogPost(blogData);

        if (!result.success) {
          throw new Error(result.error || 'Failed to create blog post');
        }

        console.log('✅ Created post with edge function:', result.data);
      }

      console.log('✅ Blog post saved successfully');
      this.closeModal();
      await this.loadBlogPosts();

    } catch (error: any) {
      console.error('❌ Error saving blog post:', error);

      // Format detailed error information
      const operation = this.isEditMode ? 'Update Blog Post' : 'Create Blog Post';
      const errorDetails = this.formatErrorDetails(error, operation);

      this.error = {
        message: `Failed to ${this.isEditMode ? 'update' : 'create'} blog post: ${error.message}`,
        details: errorDetails,
        timestamp: new Date().toISOString()
      };
    } finally {
      this.saving = false;
    }
  }

  private markFormGroupTouched() {
    Object.keys(this.blogForm.controls).forEach(key => {
      this.blogForm.get(key)?.markAsTouched();
    });
  }

  // Content editor methods
  onContentChange(event: any) {
    // Get the current content and clean it before saving
    const rawContent = event.target.innerHTML;
    const cleanContent = this.cleanHtmlContent(rawContent);

    // Debug: Log both raw and clean content
    console.log('📝 Raw content:', rawContent);
    console.log('🧹 Clean content:', cleanContent);

    // Update form value with cleaned content
    this.blogForm.get('blog_content')?.setValue(cleanContent, { emitEvent: false });
  }

  // Clean HTML content by removing unnecessary inline styles (for display purposes)
  private cleanHtmlContent(html: string): string {
    if (!html || html.trim() === '') {
      return '';
    }

    console.log('🧹 Cleaning HTML content...');

    // Create a temporary div to parse and clean the HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    // Remove specific inline styles that we add for display purposes
    const allElements = tempDiv.querySelectorAll('*');
    allElements.forEach((element: Element) => {
      const htmlElement = element as HTMLElement;

      // Remove our display-only styles
      htmlElement.style.removeProperty('direction');
      htmlElement.style.removeProperty('text-align');
      htmlElement.style.removeProperty('unicode-bidi');
      htmlElement.style.removeProperty('writing-mode');
      htmlElement.style.removeProperty('-webkit-writing-mode');
      htmlElement.style.removeProperty('-ms-writing-mode');
      htmlElement.style.removeProperty('text-orientation');

      // If no styles remain, remove the style attribute entirely
      if (!htmlElement.style.cssText || htmlElement.style.cssText.trim() === '') {
        htmlElement.removeAttribute('style');
      }
    });

    console.log('🎨 After style removal:', tempDiv.innerHTML);

    // Clean up empty elements and normalize structure
    this.normalizeHtmlStructure(tempDiv);

    const cleanedHtml = tempDiv.innerHTML;
    console.log('✨ Final cleaned HTML:', cleanedHtml);

    // Return the cleaned HTML
    return cleanedHtml;
  }

  // Convert HTML content to plain text for database storage
  private convertHtmlToPlainText(html: string): string {
    if (!html || html.trim() === '') {
      return '';
    }

    console.log('📝 Converting HTML to plain text...');
    console.log('📝 Input HTML:', html);

    // Create a temporary div to parse the HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    // Get plain text content, preserving line breaks
    let plainText = tempDiv.textContent || tempDiv.innerText || '';

    // Clean up extra whitespace and normalize line breaks
    plainText = plainText
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\n\s*\n/g, '\n') // Replace multiple line breaks with single line break
      .trim(); // Remove leading/trailing whitespace

    console.log('✨ Converted plain text:', plainText);

    return plainText;
  }

  // Normalize HTML structure by removing empty elements and fixing nesting
  private normalizeHtmlStructure(container: HTMLElement) {
    // Remove empty list items first (most important for this fix)
    this.removeEmptyListItems(container);

    // Remove empty paragraphs and divs that only contain <br> tags
    const emptyElements = container.querySelectorAll('p:empty, div:empty');
    emptyElements.forEach(element => {
      if (element.textContent?.trim() === '' || element.innerHTML === '<br>') {
        element.remove();
      }
    });

    // Remove paragraphs and divs that only contain <br> tags
    const brOnlyElements = container.querySelectorAll('p, div');
    brOnlyElements.forEach(element => {
      if (element.innerHTML === '<br>' || element.innerHTML === '<br/>') {
        element.remove();
      }
    });

    // Remove unnecessary wrapper divs
    const wrapperDivs = container.querySelectorAll('div');
    wrapperDivs.forEach(div => {
      // If div has no attributes and only contains other block elements, unwrap it
      if (!div.hasAttributes() && div.children.length > 0) {
        const hasOnlyBlockElements = Array.from(div.children).every(child =>
          ['P', 'DIV', 'UL', 'OL', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(child.tagName)
        );

        if (hasOnlyBlockElements) {
          // Move children to parent and remove the wrapper div
          while (div.firstChild) {
            div.parentNode?.insertBefore(div.firstChild, div);
          }
          div.remove();
        }
      }
    });

    // Clean up empty lists after removing empty list items
    this.removeEmptyLists(container);
  }

  // Remove empty list items specifically
  private removeEmptyListItems(container: HTMLElement) {
    const listItems = container.querySelectorAll('li');
    let removedCount = 0;

    listItems.forEach((li) => {
      const textContent = li.textContent?.trim() || '';
      const innerHTML = li.innerHTML.trim();

      // Remove if completely empty
      if (textContent === '' && innerHTML === '') {
        li.remove();
        removedCount++;
        return;
      }

      // Remove if only contains <br> tag(s) - handle various formats
      const brOnlyPatterns = [
        '<br>',
        '<br/>',
        '<br />',
        '<br><br>',
        '<br/><br/>',
        '<br /><br />',
        '<br><br/>',
        '<br/><br>'
      ];

      if (brOnlyPatterns.includes(innerHTML)) {
        li.remove();
        removedCount++;
        return;
      }

      // Remove if only contains whitespace and/or <br> tags
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = innerHTML;
      const hasOnlyBrAndWhitespace = Array.from(tempDiv.childNodes).every(node => {
        if (node.nodeType === Node.TEXT_NODE) {
          return node.textContent?.trim() === '';
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          return (node as Element).tagName === 'BR';
        }
        return false;
      });

      if (hasOnlyBrAndWhitespace && textContent === '') {
        li.remove();
        removedCount++;
      }
    });

    if (removedCount > 0) {
      console.log(`🗑️ Removed ${removedCount} empty list items`);
    }
  }

  // Remove empty lists after cleaning list items
  private removeEmptyLists(container: HTMLElement) {
    const lists = container.querySelectorAll('ul, ol');
    lists.forEach(list => {
      // Remove list if it has no list items or only empty list items
      const listItems = list.querySelectorAll('li');
      if (listItems.length === 0) {
        list.remove();
      }
    });
  }

  onContentPaste(event: ClipboardEvent) {
    event.preventDefault();
    const text = event.clipboardData?.getData('text/plain') || '';
    document.execCommand('insertText', false, text);
  }

  formatText(command: string) {
    console.log('🎨 Formatting text with command:', command);

    // Ensure the editor is focused
    this.contentEditor.nativeElement.focus();

    // Special handling for list commands
    if (command === 'insertUnorderedList' || command === 'insertOrderedList') {
      this.handleListCommand(command);
    } else {
      // Execute the command
      const success = document.execCommand(command, false);
      console.log('✅ Command executed:', command, 'Success:', success);
    }

    // Keep focus on the editor
    this.contentEditor.nativeElement.focus();

    // Trigger content change to update the form
    const content = this.contentEditor.nativeElement.innerHTML;
    this.blogForm.patchValue({ blog_content: content });
  }

  private handleListCommand(command: string) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const editor = this.contentEditor.nativeElement;

    // Execute the command
    const success = document.execCommand(command, false);
    console.log('✅ List command executed:', command, 'Success:', success);

    // Ensure proper list styling
    setTimeout(() => {
      const lists = editor.querySelectorAll('ul, ol');
      lists.forEach((list: Element) => {
        if (list.tagName === 'UL') {
          (list as HTMLElement).style.listStyleType = 'disc';
        } else if (list.tagName === 'OL') {
          (list as HTMLElement).style.listStyleType = 'decimal';
        }
        (list as HTMLElement).style.marginLeft = '1.5rem';
        (list as HTMLElement).style.paddingLeft = '1rem';
      });
    }, 10);
  }

  // Initialize content editor
  private initializeContentEditor() {
    if (this.contentEditor) {
      const editor = this.contentEditor.nativeElement;

      // Set text direction and alignment explicitly for immediate effect
      editor.style.direction = 'ltr';
      editor.style.textAlign = 'left';
      editor.style.unicodeBidi = 'normal';
      editor.style.writingMode = 'horizontal-tb';

      // Get current form content
      const currentContent = this.blogForm.get('blog_content')?.value || '';

      // Set content safely without causing text reversal
      this.setEditorContent(currentContent);

      console.log('✅ Content editor initialized');
    }
  }

  // Safely set editor content without causing text reversal
  private setEditorContent(content: string) {
    if (!this.contentEditor) return;

    const editor = this.contentEditor.nativeElement;

    // Clear the editor first
    editor.innerHTML = '';

    // Set content or default
    if (!content || content.trim() === '') {
      // Create a default paragraph
      const p = document.createElement('p');
      p.appendChild(document.createElement('br'));
      editor.appendChild(p);
    } else {
      // Set the content directly (this should be clean content from database)
      editor.innerHTML = content;
    }

    // Apply display-only styles using CSS classes instead of inline styles
    this.applyEditorDisplayStyles();
  }

  // Apply display-only styles for proper text direction without affecting saved content
  private applyEditorDisplayStyles() {
    if (!this.contentEditor) return;

    const editor = this.contentEditor.nativeElement;

    // Add CSS class to ensure proper text direction for all content
    editor.classList.add('content-editor-active');

    // The CSS will handle the text direction without inline styles
    // This way, the styles are for display only and won't be saved to database
  }

  // Tag management
  addTag() {
    const tag = this.newTag.trim();

    // Validate tag input
    if (!tag) {
      return; // Don't add empty tags
    }

    if (this.currentTags.some(existingTag => existingTag.toLowerCase() === tag.toLowerCase())) {
      console.log('⚠️ Tag already exists:', tag);
      return; // Don't add duplicate tags (case-insensitive)
    }

    if (this.currentTags.length >= 10) {
      console.log('⚠️ Maximum tag limit reached (10 tags)');
      return; // Limit to 10 tags
    }

    // Add the tag
    this.currentTags.push(tag);
    this.newTag = '';
    console.log('✅ Tag added:', tag);
    console.log('🏷️ Current tags after add:', this.currentTags);
    console.log('🏷️ Current tags types:', this.currentTags.map(t => typeof t));
  }

  removeTag(index: number) {
    const removedTag = this.currentTags[index];
    this.currentTags.splice(index, 1);
    console.log('✅ Tag removed:', removedTag);
  }

  // Handle Enter key press in tag input
  onTagInputKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault(); // Prevent form submission
      this.addTag();
    }
  }

  // Handle add tag button click
  onAddTagClick(event: Event) {
    event.preventDefault(); // Prevent form submission
    this.addTag();
  }

  getTagsArray(tags: any): string[] {
    console.log('🏷️ getTagsArray input:', tags, 'type:', typeof tags);

    if (!tags) {
      console.log('🏷️ getTagsArray: No tags, returning empty array');
      return [];
    }

    if (Array.isArray(tags)) {
      console.log('🏷️ getTagsArray: Already array, returning as-is:', tags);
      return tags;
    }

    if (typeof tags === 'string') {
      try {
        const parsed = JSON.parse(tags);
        console.log('🏷️ getTagsArray: Parsed JSON:', parsed);
        return parsed;
      } catch (error) {
        console.log('🏷️ getTagsArray: JSON parse failed, splitting by comma:', error);
        const split = tags.split(',').map(t => t.trim()).filter(t => t);
        console.log('🏷️ getTagsArray: Split result:', split);
        return split;
      }
    }

    console.log('🏷️ getTagsArray: Unknown type, returning empty array');
    return [];
  }

  // Image handling
  onImageSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      // Use BlogEdgeFunctionService validation
      const validation = this.blogEdgeFunctionService.validateImageFile(file);
      if (!validation.valid) {
        alert(validation.error);
        return;
      }

      console.log('📎 Image file selected:', file.name, 'Size:', file.size, 'Type:', file.type);
      this.selectedFile = file;

      // Create preview
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.imagePreview = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  removeImage() {
    this.imagePreview = null;
    this.selectedFile = null;
  }

  // Get image URL from blog-uploads bucket
  getImageUrl(imagePath: string): string {
    return this.blogEdgeFunctionService.getImageUrl(imagePath);
  }

  // Quick actions
  async publishPost(post: BlogPost) {
    await this.updatePostStatus(post, BlogStatus.PUBLISHED);
  }

  async unpublishPost(post: BlogPost) {
    await this.updatePostStatus(post, BlogStatus.DRAFT);
  }

  private async updatePostStatus(post: BlogPost, status: BlogStatus) {
    try {
      const updateData: UpdateBlogPostRequest = {
        blog_id: post.blog_id,
        blog_title: post.blog_title,
        blog_content: post.blog_content,
        excerpt: post.excerpt,
        image_link: post.image_link,
        blog_tags: post.blog_tags,
        blog_status: status
      };

      await this.supabaseService.updateBlogPost(updateData);
      console.log('✅ Updated post status in Supabase');

      await this.loadBlogPosts();

    } catch (error: any) {
      console.error('Error updating post status:', error);

      // Format detailed error information
      const errorDetails = this.formatErrorDetails(error, 'Update Post Status');
      this.error = {
        message: `Failed to update post status: ${error.message}`,
        details: errorDetails,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Delete methods
  deletePost(post: BlogPost) {
    this.postToDelete = post;
    this.showDeleteModal = true;
  }

  closeDeleteModal() {
    this.showDeleteModal = false;
    this.postToDelete = null;
  }

  async confirmDelete() {
    if (!this.postToDelete) return;

    try {
      this.deleting = true;

      await this.supabaseService.deleteBlogPost(this.postToDelete.blog_id);
      console.log('✅ Deleted post from Supabase');

      this.closeDeleteModal();
      await this.loadBlogPosts();

    } catch (error: any) {
      console.error('Error deleting blog post:', error);

      // Format detailed error information
      const errorDetails = this.formatErrorDetails(error, 'Delete Blog Post');
      this.error = {
        message: `Failed to delete blog post: ${error.message}`,
        details: errorDetails,
        timestamp: new Date().toISOString()
      };
    } finally {
      this.deleting = false;
    }
  }

  // Duplicate post
  duplicatePost(post: BlogPost) {
    this.isEditMode = false;
    this.currentPost = null;

    this.blogForm.patchValue({
      blog_title: `Copy of ${post.blog_title}`,
      blog_content: post.blog_content,
      excerpt: post.excerpt || '',
      blog_status: BlogStatus.DRAFT
    });

    this.currentTags = this.getTagsArray(post.blog_tags);
    this.imagePreview = post.image_link || null;

    setTimeout(() => {
      this.initializeContentEditor();
    }, 100);

    this.showModal = true;
  }

  // Utility methods
  generateExcerpt(content: string): string {
    // Robust regex to strip HTML tags safely
    const plainText = content.replace(/<(?:.|\n)*?>/gm, '');
    return plainText.length > 150 ? plainText.substring(0, 150) + '...' : plainText;
  }

  getExcerpt(content: string): string {
    return this.generateExcerpt(content);
  }

  // Error handling and reporting
  private formatErrorDetails(error: any, operation: string): string {
    const timestamp = new Date().toISOString();
    const errorDetails = {
      timestamp,
      operation,
      error: {
        message: error.message || 'Unknown error',
        code: error.code || 'NO_CODE',
        details: error.details || 'No additional details',
        hint: error.hint || 'No hint provided',
        status: error.status || 'Unknown status'
      },
      context: {
        doctorId: this.doctorId,
        userAgent: navigator.userAgent,
        url: window.location.href
      }
    };

    return JSON.stringify(errorDetails, null, 2);
  }

  copyErrorDetails(errorText: string) {
    navigator.clipboard.writeText(errorText).then(() => {
      console.log('✅ Error details copied to clipboard');
      // You could add a toast notification here
    }).catch(err => {
      console.error('❌ Failed to copy error details:', err);
    });
  }

  // Retry operation with loading state
  async retryOperation() {
    this.retrying = true;
    this.error = null;

    try {
      await this.loadBlogPosts();
    } finally {
      this.retrying = false;
    }
  }
}
