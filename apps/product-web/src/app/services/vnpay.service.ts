import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../environments/environment';
import {
  VNPayPaymentRequest,
  VNPayPaymentResponse,
  VNPayCallbackData,
  PaymentTransaction,
  PaymentResult,
} from '../models/payment.model';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable({
  providedIn: 'root',
})
export class VnpayService {
  private readonly vnpayPaymentUrl =
    'https://ldmcdielxskywugyohrq.supabase.co/functions/v1/vnpay-payment';
  private readonly vnpayCallbackUrl =
    'https://ldmcdielxskywugyohrq.supabase.co/functions/v1/vnpay-callback';
  private readonly vnp_TmnCode = '4Q0AGO8S';

  private supabase: SupabaseClient;

  constructor(private http: HttpClient) {
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseKey
    );
  }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
    });
  }

  private async createTransaction(payload: any): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from('transactions')
        .insert({
          order_id: payload.order_id,
          amount: payload.amount,
          order_info: payload.order_info,
          services: payload.services,
          status: 'pending',
          patient_id: payload.patient_id || null,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating transaction:', error);
        throw new Error(`Failed to create transaction: ${error.message}`);
      }

      console.log('Transaction created successfully:', data);
      return data;
    } catch (error) {
      console.error('Transaction creation failed:', error);
      throw error;
    }
  }

  async updateTransactionStatus(
    orderId: string,
    status: 'pending' | 'completed' | 'failed' | 'cancelled',
    vnpayResponse?: any
  ): Promise<any> {
    try {
      const updateData: any = {
        status,
        updated_at: new Date().toISOString()
      };

      if (vnpayResponse) {
        updateData.vnpay_response = vnpayResponse;
      }

      const { data, error } = await this.supabase
        .from('transactions')
        .update(updateData)
        .eq('order_id', orderId)
        .select()
        .single();

      if (error) {
        console.error('Error updating transaction:', error);
        throw new Error(`Failed to update transaction: ${error.message}`);
      }

      console.log('Transaction updated successfully:', data);
      return data;
    } catch (error) {
      console.error('Transaction update failed:', error);
      throw error;
    }
  }

  createPayment(
    paymentRequest: VNPayPaymentRequest
  ): Observable<VNPayPaymentResponse> {
    const orderId = this.generateOrderId();

    const payload = {
      order_id: orderId,
      amount: this.formatAmountForVNPay(paymentRequest.amount),
      order_info: paymentRequest.orderInfo,
      patient_id: paymentRequest.patientId,
      services: paymentRequest.services,
    };

    this.createTransaction(payload).catch(error => {
      console.error('Failed to create transaction record:', error);
    });

    console.log('Creating payment with payload:', payload);

    return this.http.post<VNPayPaymentResponse>(this.vnpayPaymentUrl, payload, {
      headers: this.getHeaders(),
    }).pipe(
      tap(response => console.log('Payment creation response:', response)),
      catchError(error => {
        console.error('Payment creation failed:', error);
        return throwError(() => error);
      })
    );
  }

  verifyCallback(callbackData: VNPayCallbackData): Observable<PaymentResult> {
    const payload = {
      vnp_Amount: callbackData.vnp_Amount,
      vnp_BankCode: callbackData.vnp_BankCode,
      vnp_BankTranNo: callbackData.vnp_BankTranNo,
      vnp_CardType: callbackData.vnp_CardType,
      vnp_OrderInfo: callbackData.vnp_OrderInfo,
      vnp_PayDate: callbackData.vnp_PayDate,
      vnp_ResponseCode: callbackData.vnp_ResponseCode,
      vnp_TmnCode: callbackData.vnp_TmnCode,
      vnp_TransactionNo: callbackData.vnp_TransactionNo,
      vnp_TransactionStatus: callbackData.vnp_TransactionStatus,
      vnp_TxnRef: callbackData.vnp_TxnRef,
      vnp_SecureHash: callbackData.vnp_SecureHash,
    };

    this.updateTransactionStatusFromCallback(payload).catch(error => {
      console.error('Failed to update transaction status:', error);
    });

    console.log('Payload being sent to VNPay callback edge function:', payload);

    return this.http.post<PaymentResult>(this.vnpayCallbackUrl, payload, {
      headers: this.getHeaders(),
    }).pipe(
      catchError(error => {
        console.error('Callback verification failed:', error);
        return throwError(() => error);
      })
    );
  }

  private async updateTransactionStatusFromCallback(payload: any): Promise<void> {
    let status: 'completed' | 'failed' | 'cancelled';

    if (payload.vnp_TransactionStatus === '00') {
      status = 'completed';
    } else if (payload.vnp_TransactionStatus === '01') {
      status = 'failed';
    } else {
      status = 'cancelled';
    }

    await this.updateTransactionStatus(payload.vnp_TxnRef, status, payload);
  }

  verifyCallbackFromUrl(callbackUrl: string): Observable<PaymentResult> {
    const callbackData = this.parseCallbackParams(callbackUrl);
    if (!callbackData) {
      return throwError(() => new Error('Failed to parse VNPay callback URL parameters'));
    }
    return this.verifyCallback(callbackData);
  }

  verifyCallbackFromParams(queryParams: {
    [key: string]: any;
  }): Observable<PaymentResult> {
    const callbackData = this.parseCallbackFromQueryParams(queryParams);
    if (!callbackData) {
      return throwError(() => new Error('Failed to parse VNPay callback query parameters'));
    }
    return this.verifyCallback(callbackData);
  }

  async getTransactionByOrderId(orderId: string): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from('transactions')
        .select('*')
        .eq('order_id', orderId)
        .single();

      if (error) {
        throw new Error(`Failed to get transaction: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Get transaction failed:', error);
      throw error;
    }
  }

  async getUserTransactionsByPatientId(patientId: string): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('transactions')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to get user transactions: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Get user transactions failed:', error);
      throw error;
    }
  }

  generateReturnUrl(): string {
    const baseUrl = window.location.origin;
    return `${baseUrl}/payment-result`;
  }

  private generateOrderId(): string {
    const timestamp = Date.now();
    const randomNum = Math.floor(Math.random() * 1000);
    return `ORDER_${timestamp}_${randomNum}`;
  }

  private getClientIP(): string {
    return '127.0.0.1';
  }

  formatAmountForVNPay(amount: number): number {
    return Math.round(Math.max(0, amount));
  }

  private validateCallbackData(callbackData: VNPayCallbackData): boolean {
    const requiredFields = [
      'vnp_Amount',
      'vnp_ResponseCode',
      'vnp_TxnRef',
      'vnp_SecureHash',
      'vnp_TmnCode',
    ];

    for (const field of requiredFields) {
      const value = callbackData[field as keyof VNPayCallbackData];
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        console.error(`Missing or empty required VNPay parameter: ${field}`);
        return false;
      }
    }

    if (callbackData.vnp_TmnCode !== this.vnp_TmnCode) {
      console.error(
        `Invalid vnp_TmnCode: expected ${this.vnp_TmnCode}, received ${callbackData.vnp_TmnCode}`
      );
      return false;
    }

    return true;
  }

  parseCallbackFromQueryParams(queryParams: {
    [key: string]: any;
  }): VNPayCallbackData | null {
    try {
      const callbackData: VNPayCallbackData = {
        vnp_Amount: this.sanitizeParam(queryParams['vnp_Amount']),
        vnp_BankCode: this.sanitizeParam(queryParams['vnp_BankCode']),
        vnp_BankTranNo: this.sanitizeParam(queryParams['vnp_BankTranNo']),
        vnp_CardType: this.sanitizeParam(queryParams['vnp_CardType']),
        vnp_OrderInfo: this.sanitizeParam(queryParams['vnp_OrderInfo']),
        vnp_PayDate: this.sanitizeParam(queryParams['vnp_PayDate']),
        vnp_ResponseCode: this.sanitizeParam(queryParams['vnp_ResponseCode']),
        vnp_TmnCode: this.sanitizeParam(queryParams['vnp_TmnCode']),
        vnp_TransactionNo: this.sanitizeParam(queryParams['vnp_TransactionNo']),
        vnp_TransactionStatus: this.sanitizeParam(queryParams['vnp_TransactionStatus']),
        vnp_TxnRef: this.sanitizeParam(queryParams['vnp_TxnRef']),
        vnp_SecureHash: this.sanitizeParam(queryParams['vnp_SecureHash']),
      };

      console.log('Parsed callback data from query parameters:', callbackData);

      this.logMissingCriticalParams(callbackData);

      return callbackData;
    } catch (error) {
      console.error('Error parsing VNPay callback query parameters:', error);
      return null;
    }
  }

  parseCallbackParams(url: string): VNPayCallbackData | null {
    try {
      const urlParts = url.split('?');
      if (urlParts.length < 2) {
        console.error('Invalid URL format: no query parameters found');
        return null;
      }

      const urlParams = new URLSearchParams(urlParts[1]);

      const callbackData: VNPayCallbackData = {
        vnp_Amount: urlParams.get('vnp_Amount') || '',
        vnp_BankCode: urlParams.get('vnp_BankCode') || '',
        vnp_BankTranNo: urlParams.get('vnp_BankTranNo') || '',
        vnp_CardType: urlParams.get('vnp_CardType') || '',
        vnp_OrderInfo: urlParams.get('vnp_OrderInfo') || '',
        vnp_PayDate: urlParams.get('vnp_PayDate') || '',
        vnp_ResponseCode: urlParams.get('vnp_ResponseCode') || '',
        vnp_TmnCode: urlParams.get('vnp_TmnCode') || '',
        vnp_TransactionNo: urlParams.get('vnp_TransactionNo') || '',
        vnp_TransactionStatus: urlParams.get('vnp_TransactionStatus') || '',
        vnp_TxnRef: urlParams.get('vnp_TxnRef') || '',
        vnp_SecureHash: urlParams.get('vnp_SecureHash') || '',
      };

      console.log('Parsed callback data from URL:', callbackData);

      this.logMissingCriticalParams(callbackData);

      return callbackData;
    } catch (error) {
      console.error('Error parsing VNPay callback parameters:', error);
      return null;
    }
  }

  private sanitizeParam(param: any): string {
    if (param === null || param === undefined) {
      return '';
    }
    return String(param).trim();
  }

  private logMissingCriticalParams(callbackData: VNPayCallbackData): void {
    if (!callbackData.vnp_TxnRef) {
      console.warn('No vnp_TxnRef found in callback parameters');
    }
    if (!callbackData.vnp_SecureHash) {
      console.warn('No vnp_SecureHash found in callback parameters');
    }
    if (!callbackData.vnp_TmnCode) {
      console.warn('No vnp_TmnCode found in callback parameters');
    } else if (callbackData.vnp_TmnCode !== this.vnp_TmnCode) {
      console.warn(
        `Invalid vnp_TmnCode: expected ${this.vnp_TmnCode}, received ${callbackData.vnp_TmnCode}`
      );
    }
  }

  isPaymentSuccessful(responseCode: string): boolean {
    return responseCode === '00';
  }

  getPaymentStatusMessage(responseCode: string): string {
    const statusMessages: { [key: string]: string } = {
      '00': 'Giao dịch thành công',
      '07': 'Trừ tiền thành công. Giao dịch bị nghi ngờ (liên quan tới lừa đảo, giao dịch bất thường).',
      '09': 'Giao dịch không thành công do: Thẻ/Tài khoản của khách hàng chưa đăng ký dịch vụ InternetBanking tại ngân hàng.',
      '10': 'Giao dịch không thành công do: Khách hàng xác thực thông tin thẻ/tài khoản không đúng quá 3 lần',
      '11': 'Giao dịch không thành công do: Đã hết hạn chờ thanh toán. Xin quý khách vui lòng thực hiện lại giao dịch.',
      '12': 'Giao dịch không thành công do: Thẻ/Tài khoản của khách hàng bị khóa.',
      '13': 'Giao dịch không thành công do Quý khách nhập sai mật khẩu xác thực giao dịch (OTP).',
      '24': 'Giao dịch không thành công do: Khách hàng hủy giao dịch',
      '51': 'Giao dịch không thành công do: Tài khoản của quý khách không đủ số dư để thực hiện giao dịch.',
      '65': 'Giao dịch không thành công do: Tài khoản của Quý khách đã vượt quá hạn mức giao dịch trong ngày.',
      '75': 'Ngân hàng thanh toán đang bảo trì.',
      '79': 'Giao dịch không thành công do: KH nhập sai mật khẩu thanh toán quá số lần quy định.',
    };

    return (
      statusMessages[responseCode] ||
      'Giao dịch không thành công do lỗi không xác định.'
    );
  }
}