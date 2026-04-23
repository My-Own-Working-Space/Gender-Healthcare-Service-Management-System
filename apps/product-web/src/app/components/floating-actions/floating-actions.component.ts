import {
  Component,
  HostListener,
  signal,
  inject,
  ViewChild,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { SupportChatComponent } from '../support-chat/support-chat.component';

@Component({
  selector: 'app-floating-actions',
  standalone: true,
  imports: [CommonModule, TranslateModule, SupportChatComponent],
  templateUrl: './floating-actions.component.html',
  styleUrl: './floating-actions.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FloatingActionsComponent {
  @ViewChild(SupportChatComponent) supportChat!: SupportChatComponent;

  private translate = inject(TranslateService);

  // Back to top visibility
  showBackToTop = signal(false);

  // Contact info
  phoneNumber = '+84 909 157 997';
  zaloNumber = '+84 909 157 997';

  @HostListener('window:scroll', [])
  onWindowScroll() {
    this.showBackToTop.set(window.pageYOffset > 300);
  }

  // Phone actions
  onPhoneClick() {
    window.open(`tel:${this.phoneNumber}`, '_self');
  }

  // Zalo actions
  onZaloClick() {
    const zaloLink = `https://zalo.me/${this.zaloNumber
      .replace(/\s+/g, '')
      .replace('+84', '0')}`;
    window.open(zaloLink, '_blank');
  }

  // AI Chat actions - Delegate to SupportChatComponent
  toggleChat() {
    if (this.supportChat) {
      this.supportChat.toggleChat();
    }
  }

  // Back to top action
  scrollToTop() {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }
}
