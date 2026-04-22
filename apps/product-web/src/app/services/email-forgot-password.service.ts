import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

// ========== INTERFACES ==========

export interface EmailForgotPasswordRequest {
  email: string;
}

export interface EmailConfirmPasswordResetRequest {
  email: string;
  otp: string;
  newPassword: string;
  timestamp: number;
}

export interface EmailForgotPasswordResponse {
  success: boolean;
  message: string;
  timestamp?: number;
  data?: {
    email: string;
  };
}

export interface EmailConfirmPasswordResetResponse {
  success: boolean;
  message: string;
  data?: {
    email: string;
  };
}

export interface EmailForgotPasswordErrorResponse {
  error: string;
  details?: string;
}

// ========== SERVICE ==========

@Injectable({
  providedIn: 'root',
})
export class EmailForgotPasswordService {
  private readonly REQUEST_PASSWORD_RESET_URL =
    'https://ldmcdielxskywugyohrq.supabase.co/functions/v1/request-password-reset';
  private readonly CONFIRM_PASSWORD_RESET_URL =
    'https://ldmcdielxskywugyohrq.supabase.co/functions/v1/confirm-password-reset';

  constructor(private http: HttpClient) {}

  /**
   * Request password reset OTP via email
   */
  requestPasswordReset(email: string): Observable<EmailForgotPasswordResponse> {
    console.log(
      '📧 EMAIL FORGOT PASSWORD SERVICE - REQUEST PASSWORD RESET STARTED'
    );
    console.log('📧 Email input:', email);

    const payload: EmailForgotPasswordRequest = {
      email: email.toLowerCase().trim(),
    };

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
    });

    console.log(
      '🌐 Request password reset endpoint:',
      this.REQUEST_PASSWORD_RESET_URL
    );
    console.log('📦 Request body:', JSON.stringify(payload, null, 2));

    return this.http
      .post<EmailForgotPasswordResponse>(
        this.REQUEST_PASSWORD_RESET_URL,
        payload,
        { headers }
      )
      .pipe(
        tap({
          next: (response) => {
            console.log('✅ EMAIL PASSWORD RESET REQUEST SUCCESS:', response);
            console.log('📧 Email confirmed:', response.data?.email);
            console.log('⏰ Timestamp:', response.timestamp);
          },
          error: (error) => {
            console.log('❌ EMAIL PASSWORD RESET REQUEST ERROR:');
            console.log('Status:', error.status);
            console.log('Error Body:', error.error);
          },
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Confirm password reset with OTP and new password
   */
  confirmPasswordReset(
    email: string,
    otp: string,
    newPassword: string,
    timestamp: number
  ): Observable<EmailConfirmPasswordResetResponse> {
    console.log(
      '🔐 EMAIL FORGOT PASSWORD SERVICE - CONFIRM PASSWORD RESET STARTED'
    );
    console.log('📧 Email:', email);
    console.log('🔢 OTP:', otp);
    console.log('🔒 New password length:', newPassword.length);
    console.log('⏰ Timestamp:', timestamp);

    const payload: EmailConfirmPasswordResetRequest = {
      email: email.toLowerCase().trim(),
      otp: otp,
      newPassword: newPassword,
      timestamp: timestamp,
    };

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
    });

    console.log(
      '🌐 Confirm password reset endpoint:',
      this.CONFIRM_PASSWORD_RESET_URL
    );
    console.log(
      '📦 Request body:',
      JSON.stringify(
        {
          email: payload.email,
          otp: payload.otp,
          newPassword:
            '***' +
            payload.newPassword.substring(payload.newPassword.length - 2),
          timestamp: payload.timestamp,
        },
        null,
        2
      )
    );

    return this.http
      .post<EmailConfirmPasswordResetResponse>(
        this.CONFIRM_PASSWORD_RESET_URL,
        payload,
        { headers }
      )
      .pipe(
        tap({
          next: (response) => {
            console.log('✅ EMAIL PASSWORD RESET CONFIRM SUCCESS:', response);
            console.log('📧 Email confirmed:', response.data?.email);
          },
          error: (error) => {
            console.log('❌ EMAIL PASSWORD RESET CONFIRM ERROR:');
            console.log('Status:', error.status);
            console.log('Error Body:', error.error);
          },
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Validate email format
   */
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate OTP format (6 digits)
   */
  isValidOTP(otp: string): boolean {
    return /^\d{6}$/.test(otp);
  }

  /**
   * Handle HTTP errors
   */
  private handleError = (error: any): Observable<never> => {
    console.error('❌ EMAIL FORGOT PASSWORD SERVICE ERROR:', error);

    let errorMessage = 'An unexpected error occurred';

    if (error.error) {
      if (typeof error.error === 'string') {
        errorMessage = error.error;
      } else if (error.error.message) {
        errorMessage = error.error.message;
      } else if (error.error.error) {
        errorMessage = error.error.error;
      }
    } else if (error.message) {
      errorMessage = error.message;
    }

    return throwError(() => ({
      status: error.status,
      message: errorMessage,
      error: error.error,
    }));
  };
}
