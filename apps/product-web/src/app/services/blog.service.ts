// ================== IMPORTS ==================
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../environments/environment';
import { type Blog, type BlogDetail } from '../models/blog.model';
import { Observable } from 'rxjs';

// ================== SERVICE DECORATOR ==================
@Injectable({
  providedIn: 'root',
})
export class BlogService {
  // =========== CONSTRUCTOR ===========
  constructor(private http: HttpClient) {}

  // =========== PRIVATE HEADER BUILDER ===========
  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
    });
  }

  getBlogs(): Observable<Blog[]> {
    return this.http.post<Blog[]>(`${environment.supabaseUrl}/rest/v1/rpc/fetch_blogs`, {}, {
      headers: {
        'Content-Type': 'application/json',
        'apikey': environment.supabaseKey,
        'Authorization': `Bearer ${environment.supabaseKey}`
      },
    });
  }

  getBlogById(blogId: string): Observable<BlogDetail> {
    return this.http.post<BlogDetail>(
      `${environment.supabaseUrl}/rest/v1/rpc/fetch_blog_id`,
      { p_blog_id: blogId },
      {
        headers: {
          'Content-Type': 'application/json',
          'apikey': environment.supabaseKey,
          'Authorization': `Bearer ${environment.supabaseKey}`
        },
      }
    );
  }
}
