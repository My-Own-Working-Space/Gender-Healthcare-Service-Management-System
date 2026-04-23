// ==================== IMPORTS ====================
import { Router, RouterLink } from '@angular/router';
import {
  afterNextRender,
  Component,
  DestroyRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { GoogleComponent } from '../../components/google/google.component';
import { debounceTime } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { TokenService } from '../../services/token.service';
import { type UserLogin } from '../../models/user.model';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

// ==================== COMPONENT DECORATOR ====================
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, GoogleComponent, TranslateModule],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.css',
})
export class LoginComponent {
  // ==================== STATE / PROPERTY ====================
  RememberMe = false;
  ShowPass = false;
  formSubmitted = false;
  isWrong = false;
  isSubmitting = false;
  errorMsg = '';
  showForgotPassword = signal(false);

  // ==================== VIEWCHILD & DEPENDENCY INJECTION ====================
  private form = viewChild.required<NgForm>('form');
  private destroyRef = inject(DestroyRef);
  private authService = inject(AuthService);
  private tokenService = inject(TokenService);
  public router = inject(Router);
  private translate = inject(TranslateService);

  // ==================== CONSTRUCTOR ====================
  constructor() {
    afterNextRender(() => {
      // --- Lấy thông tin login đã lưu ---
      let savedForm: string | null = null;
      if (window.localStorage.getItem('Remember-login-form')) {
        savedForm = window.localStorage.getItem('Remember-login-form');
      } else if (window.localStorage.getItem('save-login-form')) {
        savedForm = window.localStorage.getItem('save-login-form');
      }
      if (savedForm) {
        const loadedFormData = JSON.parse(savedForm);
        Promise.resolve().then(() => {
          if (this.form().controls['phone'] && loadedFormData.phone) {
            this.form().controls['phone'].setValue(loadedFormData.phone);
          }
          if (this.form().controls['rememberMe'] && loadedFormData.rememberMe) {
            this.form().controls['rememberMe'].setValue(
              loadedFormData.rememberMe
            );
            this.RememberMe = loadedFormData.rememberMe;
          }
        });
      }

      // --- Auto save số điện thoại vào localStorage mỗi lần user nhập ---
      const subscription = this.form()
        .valueChanges?.pipe(debounceTime(500))
        .subscribe({
          next: (value) =>
            window.localStorage.setItem(
              'save-login-form',
              JSON.stringify({ phone: value.phone })
            ),
        });
      this.destroyRef.onDestroy(() => subscription?.unsubscribe());
    });
  }

  // ==================== METHODS ====================
  openForgotPassword(event: Event) {
    event.preventDefault();
    this.showForgotPassword.set(true);
  }

  closeForgotPassword() {
    this.showForgotPassword.set(false);
  }
  // Xử lý khi sai thì set lại error
  onInput() {
    this.isWrong = false;
    this.errorMsg = '';
  }
  /**
   * Xử lý khi submit form đăng nhập
   * @param formData Dữ liệu form (NgForm)
   */
  onSubmit(formData: NgForm) {
    if (this.isSubmitting) return;
    this.isSubmitting = true;
    this.formSubmitted = true;
    this.errorMsg = '';

    if (formData.valid) {
      // --- Lấy giá trị từ form ---
      const phone: UserLogin['phone'] = formData.form.value.phone;
      const password: UserLogin['password'] = formData.form.value.password;
      const rememberMe = formData.form.value.rememberMe;

      // --- Gọi API login ---
      console.log('🔄 Calling authService.loginWithPhone...');
      const subscription = this.authService
        .loginWithPhone(phone, password)
        .subscribe({
          next: (res: any) => {
            console.log('✅ LOGIN COMPONENT - Success response received');
            console.log('📦 Full response object:', res);
            console.log('📦 Response type:', typeof res);
            console.log('📦 Response keys:', Object.keys(res || {}));

            // --- Lấy token từ response (tùy BE) ---
            const token =
              res.access_token ||
              (res.data && res.data.access_token) ||
              res.token;

            console.log('🎫 Token extraction:');
            console.log('  - res.access_token:', res.access_token);
            console.log('  - res.data?.access_token:', res.data?.access_token);
            console.log('  - res.token:', res.token);
            console.log(
              '  - Final token:',
              token ? token.substring(0, 20) + '...' : 'null'
            );

            if (token) {
              console.log('💾 Token found, processing storage...');

              // Save user data if available in response
              if (res.data?.user || res.user) {
                const userData = res.data?.user || res.user;
                const userDataToSave = {
                  id: userData.id || 'phone-user',
                  phone: userData.phone || phone,
                  email: userData.email || '',
                  name: userData.full_name || userData.name || 'Phone User',
                  authenticated_at: new Date().toISOString(),
                  patient_profile: {
                    id: userData.id || 'phone-user',
                    full_name:
                      userData.full_name || userData.name || 'Phone User',
                    phone: userData.phone || phone,
                    email: userData.email || '',
                    patient_status: 'active',
                    created_at: userData.created_at || new Date().toISOString(),
                    updated_at: userData.updated_at || new Date().toISOString(),
                  },
                };
                localStorage.setItem(
                  'current_user',
                  JSON.stringify(userDataToSave)
                );
                console.log('✅ User data saved to localStorage after login');
              }

              // --- Xử lý lưu token + remember me ---
              if (rememberMe) {
                console.log('💾 Saving to localStorage (Remember Me = true)');
                this.tokenService.setToken(token); // Lưu vào localStorage
                localStorage.setItem(
                  'Remember-login-form',
                  JSON.stringify({
                    phone,
                    rememberMe: true,
                  })
                );
                sessionStorage.removeItem('access_token');
              } else {
                console.log(
                  '💾 Saving to sessionStorage (Remember Me = false)'
                );
                this.tokenService.setTokenSession(token); // Lưu vào sessionStorage
                localStorage.removeItem('Remember-login-form');
                localStorage.removeItem('save-login-form');
                localStorage.removeItem('access_token');
              }
              console.log('🏠 Navigating to home page...');
              // --- Chuyển hướng về trang chủ ---
              this.router.navigate(['/']);
              // formData.resetForm(); // (optional) Reset form sau login
            } else {
              console.log('❌ No token found in response!');
            }
          },
          error: (err: any) => {
            // Sensitive error logs removed

            // --- Xử lý lỗi ---
            if (err.status === 401) {
              console.log('🔒 401 Unauthorized - Invalid credentials');
              this.errorMsg = this.translate.instant(
                'LOGIN.ERRORS.INVALID_CREDENTIALS'
              );
              this.isWrong = true;
              alert(this.errorMsg);
            } else if (err.status === 500) {
              console.log('🔥 500 Server Error');
              this.errorMsg = this.translate.instant(
                'LOGIN.ERRORS.SERVER_ERROR'
              );
              alert(this.errorMsg);
            } else {
              console.log('❓ Other error status:', err.status);
              this.errorMsg = this.translate.instant(
                'LOGIN.ERRORS.LOGIN_FAILED'
              );
              alert(this.errorMsg);
            }
            this.isSubmitting = false;
          },
          complete: () => {
            console.log('🏁 LOGIN COMPONENT - Request completed');
            this.isSubmitting = false;
          },
        });
      this.destroyRef.onDestroy(() => subscription?.unsubscribe());
    } else {
      console.log('❌ LOGIN COMPONENT - Form is invalid');
      console.log('📋 Form errors:', formData.errors);
      console.log('📋 Form controls status:');
      Object.keys(formData.controls).forEach((key) => {
        const control = formData.controls[key];
        console.log(`  - ${key}:`, {
          value: control.value,
          valid: control.valid,
          errors: control.errors,
          touched: control.touched,
          dirty: control.dirty,
        });
      });
      this.formSubmitted = true;
      this.isSubmitting = false;
      return;
    }
  }
}
