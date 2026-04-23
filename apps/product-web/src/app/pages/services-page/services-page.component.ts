import { Component, signal, inject, OnInit } from '@angular/core';

import { HeaderComponent } from '../../components/header/header.component';
import { FooterComponent } from '../../components/footer/footer.component';
import { MedicalService as MedicalServiceAPI } from '../../services/medical.service';
import { CartService } from '../../services/cart.service';
import { MedicalService } from '../../models/service.model';
import { CartItem } from '../../models/payment.model';
import { NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BreadcrumbsComponent } from '../../components/breadcrumbs/breadcrumbs.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-service-page',
  standalone: true,
  imports: [
    HeaderComponent,
    FooterComponent,
    NgClass,
    RouterLink,
    BreadcrumbsComponent,
    TranslateModule,
  ],
  templateUrl: './services-page.component.html',
  styleUrl: './services-page.component.css',
})
export class ServicePageComponent implements OnInit {
  private medicalService = inject(MedicalServiceAPI);
  private cartService = inject(CartService);
  private translate = inject(TranslateService);

  categories = signal<string[]>([]);
  services = signal<MedicalService[]>([]);
  searchValue = signal('');
  selectedCategory = signal('');
  page = signal(1);
  pageSize = 6;
  loading = signal(true);
  skeletons = Array.from({ length: this.pageSize }, (_, i) => i);

  ngOnInit() {
    this.loading.set(true);

    // Use stream to handle translation changes and initial load
    this.translate.get('SERVICES.ALL_CATEGORIES').subscribe((allText: string) => {
      this.selectedCategory.set(allText);

      this.medicalService.getServices().subscribe({
        next: (data: MedicalService[]) => {
          this.services.set(data || []);
          const categoryNames = (data || [])
            .map((s: MedicalService) => s.service_categories?.category_name)
            .filter((name): name is string => Boolean(name));
          const uniqueCats = Array.from(new Set(categoryNames));
          this.categories.set([allText, ...uniqueCats]);
          this.loading.set(false);
        },
        error: (error) => {
          // Fallback to mock data
          this.medicalService.getMockServices().subscribe({
            next: (mockData: MedicalService[]) => {
              this.services.set(mockData || []);
              const categoryNames = (mockData || [])
                .map((s: MedicalService) => s.service_categories?.category_name)
                .filter((name): name is string => Boolean(name));
              const uniqueCats = Array.from(new Set(categoryNames));
              this.categories.set([allText, ...uniqueCats]);
              this.loading.set(false);
            },
            error: () => {
              this.services.set([]);
              this.categories.set([allText]);
              this.loading.set(false);
            }
          });
        }
      });
    });
  }

  limitText(text: string | null, maxLength: number = 32): string {
    if (!text) return '';
    return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
  }

  formatPrice(price: number): string {
    const vndText = this.translate.instant('SERVICES.VND');
    return typeof price === 'number'
      ? price.toLocaleString('en-US') + ' ' + vndText
      : price + ' ' + vndText;
  }

  get filteredServices(): MedicalService[] {
    let filtered = this.services();
    const allText = this.translate.instant('SERVICES.ALL_CATEGORIES');
    if (this.selectedCategory() !== allText) {
      filtered = filtered.filter(
        (s) => s.service_categories?.category_name === this.selectedCategory()
      );
    }
    const searchLower = this.searchValue().toLowerCase();
    if (searchLower) {
      filtered = filtered.filter(
        (s) =>
          (s.name && s.name.toLowerCase().includes(searchLower)) ||
          (s.excerpt && s.excerpt.toLowerCase().includes(searchLower)) ||
          (typeof s.price === 'number' &&
            this.formatPrice(s.price).toLowerCase().includes(searchLower))
      );
    }
    return filtered;
  }

  get paginatedServices(): MedicalService[] {
    const start = (this.page() - 1) * this.pageSize;
    return this.filteredServices.slice(start, start + this.pageSize);
  }

  get maxPage(): number {
    return Math.ceil(this.filteredServices.length / this.pageSize) || 1;
  }

  get pageArray(): number[] {
    return Array(this.maxPage)
      .fill(0)
      .map((_, i) => i + 1);
  }

  onSearch(event: Event) {
    const target = event.target as HTMLInputElement;
    this.searchValue.set(target.value);
    this.page.set(1);
  }

  selectCategory(cat: string) {
    this.selectedCategory.set(cat);
    this.page.set(1);
  }

  goToPage(p: number) {
    if (p >= 1 && p <= this.maxPage) {
      this.page.set(p);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  bookService(service: MedicalService, event: Event) {
    event.preventDefault();
    const messageTemplate = this.translate.instant('SERVICES.INQUIRY_MESSAGE');
    const message = `${messageTemplate} ${service.name}`;
    localStorage.setItem('Remember-contact-form', JSON.stringify({ message }));
  }

  // Add service to cart
  addToCart(service: MedicalService, event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    const cartItem: CartItem = {
      service_id: service.id,
      service_name: service.name,
      price: service.price,
      quantity: 1,
      image_link: service.image_link || undefined,
      description: service.excerpt || undefined,
    };

    this.cartService.addToCart(cartItem);

    // Show success message (you can implement a toast service for better UX)
    alert(`${service.name} đã được thêm vào giỏ hàng!`);
  }

  // Check if service is in cart
  isInCart(serviceId: string): boolean {
    return this.cartService.isInCart(serviceId);
  }

  // Get cart item count for a specific service
  getCartQuantity(serviceId: string): number {
    const cartItem = this.cartService.getCartItem(serviceId);
    return cartItem ? cartItem.quantity : 0;
  }

  getServiceImageUrl(link?: string | null): string {
    if (!link) return '';
    // If it's already a full URL, return it
    if (link.startsWith('http')) return link;

    const parts = link.split('/');
    const filename = parts[parts.length - 1];
    return `${environment.supabaseStorageUrl}service-uploads/${filename}`;
  }
}
