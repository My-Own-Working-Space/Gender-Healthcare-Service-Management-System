// ================== IMPORTS ==================
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../environments/environment';
import { type Doctor, type DoctorDetail } from '../models/doctor.model';
import { DoctorBooking } from '../models/booking.model';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

// ================== SERVICE DECORATOR ==================
@Injectable({
  providedIn: 'root',
})
export class DoctorService {
  // =========== CONSTRUCTOR ===========
  constructor(private http: HttpClient) { }

  // =========== PRIVATE HEADER BUILDER ===========
  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
    });
  }

  // =========== FETCH DOCTORS ===========
  /**
   * Gọi API lấy danh sách bác sĩ, có filter
   */
  getDoctors(name: string, specialty: string, gender: string) {
    let params = new HttpParams();
    if (name) params = params.set('name', name);
    if (specialty && specialty !== 'All')
      params = params.set('specialty', specialty);
    if (gender && gender !== 'All') params = params.set('gender', gender);

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'apikey': environment.supabaseKey
    });

    return this.http.get<Doctor[]>(`${environment.apiEndpoint}/fetch-doctor`, {
      params,
      headers
    });
  }

  // =========== FETCH DOCTORS FOR BOOKING (APPOINTMENT PAGE) ===========
  /**
   * Lấy danh sách bác sĩ cho appointment booking từ database function
   */
  fetchDoctorBooking(): Observable<DoctorBooking[]> {
    return this.http.post<any>(
      `${environment.supabaseUrl}/rest/v1/rpc/fetch_doctorbooking`,
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
        console.error('Error fetching doctors for booking:', error);
        return of([]);
      })
    );
  }

  // =========== FETCH DOCTOR BY ID ===========
  getDoctorById(id: string): Observable<DoctorDetail> {
    return this.http.post<DoctorDetail>(
      `${environment.supabaseUrl}/rest/v1/rpc/fetch_doctor_id`,
      { p_doctor_id: id, p_email: '' }, // Updated RPC fallback for empty email
      {
        headers: {
          'Content-Type': 'application/json',
          'apikey': environment.supabaseKey,
          'Authorization': `Bearer ${environment.supabaseKey}`
        },
      }
    );
  }

  // =========== FETCH DOCTOR BY SERVICE ===========
  /**
   * Lấy danh sách bác sĩ theo service_id
   */
  getDoctorsByService(service_id: string): Observable<DoctorBooking[]> {
    return this.fetchDoctorBooking().pipe(
      map(doctors => doctors.filter(d => d.services && d.services.includes(service_id)))
    );
  }
}
