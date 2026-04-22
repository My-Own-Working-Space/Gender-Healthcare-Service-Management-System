// ================== IMPORTS ==================
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../environments/environment';
import {
  type MedicalService as MedicalServiceModel,
  type ServiceDetail,
} from '../models/service.model';
import { ServiceBooking } from '../models/booking.model';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

// ================== SERVICE DECORATOR ==================
@Injectable({
  providedIn: 'root',
})
export class MedicalService {
  // =========== CONSTRUCTOR ===========
  constructor(private http: HttpClient) { }

  // =========== PRIVATE HEADER BUILDER ===========
  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
    });
  }

  // =========== FETCH SERVICES ===========
  /**
   * Gọi API lấy danh sách dịch vụ y tế
   */
  getServices(): Observable<MedicalServiceModel[]> {
    return this.http.post<MedicalServiceModel[]>(
      `${environment.supabaseUrl}/rest/v1/rpc/fetch_service`,
      {},
      {
        headers: {
          'Content-Type': 'application/json',
          'apikey': environment.supabaseKey,
          'Authorization': `Bearer ${environment.supabaseKey}`
        },
      }
    );
  }

  // =========== FALLBACK MOCK SERVICES ===========
  /**
   * Mock services for testing when API is down
   */
  getMockServices(): Observable<MedicalServiceModel[]> {
    const mockServices: MedicalServiceModel[] = [
      {
        id: 'mock-1',
        name: 'Khám Phụ Khoa Tổng Quát',
        excerpt: 'Khám sức khỏe phụ khoa định kỳ, tầm soát các bệnh lý phụ khoa',
        price: 300000,
        image_link: '/assets/images/gynecology.jpg',
        service_categories: {
          category_id: 'cat-1',
          category_name: 'Gynecology'
        }
      },
      {
        id: 'mock-2',
        name: 'Siêu Âm Thai',
        excerpt: 'Siêu âm theo dõi sự phát triển của thai nhi',
        price: 250000,
        image_link: '/assets/images/ultrasound.jpg',
        service_categories: {
          category_id: 'cat-2',
          category_name: 'Reproductive Health'
        }
      },
      {
        id: 'mock-3',
        name: 'Xét Nghiệm Hormone',
        excerpt: 'Xét nghiệm các hormone sinh dục nữ',
        price: 400000,
        image_link: '/assets/images/hormone-test.jpg',
        service_categories: {
          category_id: 'cat-2',
          category_name: 'Reproductive Health'
        }
      }
    ];

    return new Observable(observer => {
      observer.next(mockServices);
      observer.complete();
    });
  }

  // =========== FETCH SERVICE BY ID ===========
  /**
   * Gọi API lấy dịch vụ theo ID
   */
  getServiceById(serviceId: string): Observable<ServiceDetail> {
    return this.http.post<ServiceDetail>(
      `${environment.supabaseUrl}/rest/v1/rpc/fetch_service_id`,
      { p_service_id: serviceId },
      {
        headers: {
          'Content-Type': 'application/json',
          'apikey': environment.supabaseKey,
          'Authorization': `Bearer ${environment.supabaseKey}`
        },
      }
    );
  }

  // =========== FETCH SERVICES FOR BOOKING ===========
  /**
   * Lấy danh sách dịch vụ cho booking (old endpoint)
   */
  fetchService(): Observable<ServiceBooking[]> {
    return this.fetchServiceBooking();
  }

  // =========== FETCH SERVICES FOR BOOKING (NEW ENDPOINT) ===========
  /**
   * Lấy danh sách dịch vụ cho booking từ database function
   */
  fetchServiceBooking(): Observable<ServiceBooking[]> {
    return this.http.post<any>(
      `${environment.supabaseUrl}/rest/v1/rpc/fetch_servicebooking`,
      {},
      {
        headers: {
          'Content-Type': 'application/json',
          'apikey': environment.supabaseKey,
          'Authorization': `Bearer ${environment.supabaseKey}`
        },
      }
    ).pipe(
      map((response) => {
        // The function returns a JSONB array, so we need to handle it properly
        if (Array.isArray(response)) {
          return response;
        }
        return [];
      }),
      catchError((error) => {
        console.error('Error fetching services for booking:', error);
        return of([]);
      })
    );
  }
}
