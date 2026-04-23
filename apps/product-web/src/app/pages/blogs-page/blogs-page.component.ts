import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { HeaderComponent } from '../../components/header/header.component';
import { FooterComponent } from '../../components/footer/footer.component';
import { BlogService } from '../../services/blog.service';
import { Blog, BlogDisplay } from '../../models/blog.model';
import { BreadcrumbsComponent } from '../../components/breadcrumbs/breadcrumbs.component';
import { BreadcrumbService } from '../../services/breadcrumb.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-blogs-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TranslateModule,
    HeaderComponent,
    FooterComponent,
    BreadcrumbsComponent,
  ],
  templateUrl: './blogs-page.component.html',
  styleUrl: './blogs-page.component.css',
})
export class BlogsPageComponent implements OnInit {
  private blogService = inject(BlogService);
  private translate = inject(TranslateService);

  skeletons = Array.from({ length: 6 });
  allBlogs: BlogDisplay[] = [];
  isLoading = true;
  error: string | null = null;

  // Đây là mảng gom tất cả tag không trùng (tag cloud, filter...)
  allTags: string[] = [];

  categories: string[] = [];
  selectedCategory: string = '';
  searchValue: string = '';

  // Pagination
  page = 1;
  perPage = 6;

  get maxPage() {
    return Math.ceil(this.filteredBlogs.length / this.perPage);
  }

  selectedTag: string | null = null;

  ngOnInit() {
    // Use stream to handle translation changes and initial load
    this.translate.get(['COMMON.ALL', 'BLOG.CATEGORIES.COMMUNITY', 'BLOG.CATEGORIES.MENTAL_HEALTH', 'BLOG.CATEGORIES.GENDER_STORIES', 'BLOG.CATEGORIES.LEGAL', 'BLOG.CATEGORIES.EDUCATION']).subscribe((translations) => {
      const allText = translations['COMMON.ALL'];
      this.categories = [
        allText,
        translations['BLOG.CATEGORIES.COMMUNITY'],
        translations['BLOG.CATEGORIES.MENTAL_HEALTH'],
        translations['BLOG.CATEGORIES.GENDER_STORIES'],
        translations['BLOG.CATEGORIES.LEGAL'],
        translations['BLOG.CATEGORIES.EDUCATION'],
      ];
      this.selectedCategory = allText;
      this.loadBlogs();
    });
  }

  loadBlogs() {
    this.isLoading = true;
    this.error = null;

    this.blogService.getBlogs().subscribe({
      next: (blogs: Blog[]) => {
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Map dữ liệu từ API sang format hiện tại
        this.allBlogs = blogs.map((blog) => this.mapBlogToDisplay(blog));
        // Gom tag không trùng vào allTags sau khi đã map xong allBlogs
        this.allTags = this.collectUniqueTags(this.allBlogs);

        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading blogs:', error);
        this.error = this.translate.instant('BLOG.ERRORS.LOAD_FAILED');
        this.isLoading = false;
      },
    });
  }

  private mapBlogToDisplay(blog: Blog): BlogDisplay {
    // Safely extract tags array
    const tagsArray = this.extractTags(blog.blog_tags);

    return {
      id: blog.blog_id,
      title: blog.blog_title,
      desc: blog.excerpt,
      img: this.getBlogImageUrl(blog.image_link),
      author: blog.doctor_details.full_name,
      createdAt: blog.created_at,
      tags: tagsArray,
      category: this.getCategoryFromTags(tagsArray), // Logic để xác định category
    };
  }

  getBlogImageUrl(link?: string | null): string {
    if (!link) return 'https://via.placeholder.com/600x350?text=No+Image';
    // If it's already a full URL, return it
    if (link.startsWith('http')) return link;

    const parts = link.split('/');
    const filename = parts[parts.length - 1];
    return `${environment.supabaseStorageUrl}blog-uploads/${filename}`;
  }

  private extractTags(blogTags: any): string[] {
    if (!blogTags) return [];
    if (Array.isArray(blogTags.tags)) return blogTags.tags;
    if (Array.isArray(blogTags)) return blogTags;
    if (typeof blogTags === 'string')
      return blogTags.split(',').map((t) => t.trim());
    if (typeof blogTags.tags === 'string')
      return blogTags.tags.split(',').map((t: string) => t.trim());
    return [];
  }

  // Gom các tag không trùng từ allBlogs
  private collectUniqueTags(blogs: BlogDisplay[]): string[] {
    const tagSet = new Set<string>();
    for (const blog of blogs) {
      if (Array.isArray(blog.tags)) {
        blog.tags.forEach((tag) => {
          if (tag && typeof tag === 'string') tagSet.add(tag.trim());
        });
      }
    }
    return Array.from(tagSet);
  }

  private getCategoryFromTags(tags: string[]): string {
    if (!Array.isArray(tags) || tags.length === 0) {
      return 'Community'; // default category
    }
    const tagMap: { [key: string]: string } = {
      transgender: 'Gender Stories',
      'hormone therapy': 'Gender Stories',
      'mental health': 'Mental Health',
      community: 'Community',
      legal: 'Legal',
      education: 'Education',
    };
    for (const tag of tags) {
      if (typeof tag === 'string') {
        const category = tagMap[tag.toLowerCase()];
        if (category) return category;
      }
    }
    return 'Community'; // default category
  }

  filterByTag(tag: string) {
    this.selectedTag = tag;
    this.selectedCategory = this.translate.instant('COMMON.ALL');
    this.page = 1;
  }

  get filteredBlogs(): BlogDisplay[] {
    let result = this.allBlogs;

    const allText = this.translate.instant('COMMON.ALL');
    if (this.selectedCategory !== allText) {
      result = result.filter((b) => b.category === this.selectedCategory);
    }
    if (this.selectedTag) {
      result = result.filter((b) => b.tags.includes(this.selectedTag!));
    }
    if (this.searchValue) {
      const key = this.searchValue.toLowerCase();
      result = result.filter(
        (b) =>
          b.title.toLowerCase().includes(key) ||
          b.desc.toLowerCase().includes(key) ||
          b.author.toLowerCase().includes(key) ||
          b.tags.some((tag) => tag.toLowerCase().includes(key))
      );
    }
    return result;
  }

  // Get paginated blogs from filtered results
  get paginatedBlogs(): BlogDisplay[] {
    const filtered = this.filteredBlogs;
    const start = (this.page - 1) * this.perPage;
    const end = start + this.perPage;
    return filtered.slice(start, end);
  }

  clearTagFilter() {
    this.selectedTag = null;
  }

  // ===== PAGINATION =====
  goToPage(pg: number): void {
    if (pg < 1 || pg > this.maxPage) return;
    this.page = pg;
  }

  get pageArray(): number[] {
    return Array.from({ length: this.maxPage }, (_, i) => i);
  }

  selectCategory(cat: string) {
    this.selectedCategory = cat;
    this.page = 1;
  }

  onSearch(event: Event) {
    const val = (event.target as HTMLInputElement)?.value ?? '';
    this.searchValue = val;
    this.page = 1;
  }

  retryLoad() {
    this.loadBlogs();
  }
}
