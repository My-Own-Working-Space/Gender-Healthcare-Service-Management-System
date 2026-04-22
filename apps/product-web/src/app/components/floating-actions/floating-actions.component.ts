import {
  Component,
  HostListener,
  signal,
  inject,
  ViewChild,
  ElementRef,
  AfterViewChecked,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Subject, takeUntil, debounceTime } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { SupportChatComponent } from '../support-chat/support-chat.component';
import {
  ChatMessage,
  ChatRequest,
  ChatResponse,
  DoctorRecommendation,
  N8nWebhookResponse,
} from '../../models/chatbot.model';

@Component({
  selector: 'app-floating-actions',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, SupportChatComponent],
  templateUrl: './floating-actions.component.html',
  styleUrl: './floating-actions.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FloatingActionsComponent implements AfterViewChecked, OnDestroy {
  @ViewChild('messageInput') messageInput!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('chatBody') chatBody!: ElementRef<HTMLDivElement>;

  private translate = inject(TranslateService);
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);

  // Back to top visibility
  showBackToTop = signal(false);

  // AI Chat state
  isChatOpen = signal(false);

  // Contact info
  phoneNumber = '+84 909 157 997';
  zaloNumber = '+84 909 157 997';

  // AI Chat logic from support-chat
  message = '';
  isTyping = false;
  isConnected = true;
  unreadCount = 0;
  sessionId?: string;
  userId?: string;

  // Dùng duy nhất 1 message cho UI
  currentMsg: ChatMessage | null = null;
  showClearBtn = false;

  // Quick replies, chỉ lấy 1 reply đầu cho UI
  quickReplyText: string = '';
  showQuickReplies = false;

  // Friendly thinking messages
  currentThinkingMessage: string = '';
  private thinkingMessages: string[] = [
    'AI_CHAT.THINKING.DEFAULT',
    'AI_CHAT.THINKING.PROCESSING',
    'AI_CHAT.THINKING.ALMOST_DONE',
    'AI_CHAT.THINKING.OOPS_LONGER',
    'AI_CHAT.THINKING.BEAR_WITH_ME',
    'AI_CHAT.THINKING.WORKING_HARD',
  ];
  private thinkingMessageIndex = 0;
  private thinkingInterval?: any;

  private destroy$ = new Subject<void>();
  private shouldScrollToBottom = false;
  private messageIdCounter = 0;
  private readonly N8N_WEBHOOK_URL =
    'https://buishere.app.n8n.cloud/webhook/chatbot';

  constructor() {
    this.initQuickReplies();
    this.initializeChat();

    this.translate.onLangChange.subscribe(() => {
      this.initQuickReplies();
      this.initializeChat();
    });
  }

  ngAfterViewChecked() {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.clearThinkingInterval();
  }

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

  // AI Chat actions
  toggleChat() {
    this.isChatOpen.set(!this.isChatOpen());
    if (this.isChatOpen()) {
      this.unreadCount = 0;
      this.cdr.markForCheck();
      setTimeout(() => {
        this.messageInput?.nativeElement?.focus();
      }, 300);
    }
  }

  closeChat() {
    this.isChatOpen.set(false);
  }

  // Back to top action
  scrollToTop() {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  // AI Chat methods from support-chat
  private initQuickReplies() {
    // Always show quick replies since we have hardcoded suggestions
    this.showQuickReplies = true;
    this.cdr.markForCheck();
  }

  private initializeChat() {
    this.translate.get('AI_CHAT.WELCOME').subscribe((welcomeMsg) => {
      this.setCurrentMsg({
        id: this.generateMessageId(),
        from: 'bot',
        text: welcomeMsg,
        timestamp: new Date(),
      });
      this.showClearBtn = false;
      this.cdr.markForCheck();
    });
  }

  private generateMessageId(): string {
    return `msg_${++this.messageIdCounter}_${Date.now()}`;
  }

  private formatAIResponse(response: string): string {
    if (!response) return '';

    // First, handle doctor images and profile links specially
    let formatted = response
      // Convert doctor images to HTML img tags
      .replace(
        /\[(\/([\w\-\.]+\.webp))\]/g,
        '<div class="doctor-image-container"><img src="https://ldmcdielxskywugyohrq.supabase.co/storage/v1/object/public/staff-uploads$1" alt="Doctor Photo" class="doctor-image" /></div>'
      )
      // Convert doctor profile links to clickable HTML links (handles various ID formats)
      .replace(
        /http:\/\/localhost:4200\/doctor\/([\w\-\.]+)/g,
        '<a href="http://localhost:4200/doctor/$1" target="_blank" class="doctor-link">👨‍⚕️ View Doctor Profile</a>'
      )
      // Remove headers (# ## ###)
      .replace(/^#{1,6}\s+/gm, '')
      // Keep bold formatting but make it HTML
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.*?)__/g, '<strong>$1</strong>')
      // Keep italic formatting but make it HTML
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/_(.*?)_/g, '<em>$1</em>')
      // Remove code blocks ```code```
      .replace(/```[\s\S]*?```/g, '')
      // Remove inline code `code`
      .replace(/`([^`]+)`/g, '$1')
      // Remove strikethrough ~~text~~
      .replace(/~~(.*?)~~/g, '$1')
      // Remove blockquotes >
      .replace(/^>\s+/gm, '')
      // Remove horizontal rules ---
      .replace(/^---+$/gm, '')
      // Convert simple lists to better formatting
      .replace(/^[\s]*[-\*\+]\s+/gm, '• ')
      // Remove numbered lists but keep content
      .replace(/^[\s]*\d+\.\s+/gm, '• ')
      // Clean up extra whitespace but preserve paragraphs
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return formatted;
  }

  private startThinkingMessages(): void {
    this.thinkingMessageIndex = 0;
    this.updateThinkingMessage();

    // Change message every 3 seconds
    this.thinkingInterval = setInterval(() => {
      this.thinkingMessageIndex =
        (this.thinkingMessageIndex + 1) % this.thinkingMessages.length;
      this.updateThinkingMessage();
    }, 3000);
  }

  private updateThinkingMessage(): void {
    const messageKey = this.thinkingMessages[this.thinkingMessageIndex];
    this.translate.get(messageKey).subscribe((message) => {
      this.currentThinkingMessage = message;
      this.cdr.markForCheck();
    });
  }

  private clearThinkingInterval(): void {
    if (this.thinkingInterval) {
      clearInterval(this.thinkingInterval);
      this.thinkingInterval = undefined;
    }
  }

  private setCurrentMsg(msg: ChatMessage, showClear: boolean = false): void {
    this.currentMsg = msg;
    this.showClearBtn = showClear;
    this.shouldScrollToBottom = true;
    if (msg.from === 'bot' && !this.isChatOpen()) this.unreadCount++;
    this.cdr.markForCheck();
  }

  private scrollToBottom(): void {
    if (this.chatBody?.nativeElement) {
      const element = this.chatBody.nativeElement;
      element.scrollTop = element.scrollHeight;
    }
  }

  sendMessage(messageText?: string): void {
    const userMessage = (messageText || this.message).trim();
    if (!userMessage) return;

    // Show user message
    this.setCurrentMsg(
      {
        id: this.generateMessageId(),
        from: 'user',
        text: userMessage,
        timestamp: new Date(),
      },
      true
    );

    this.message = '';
    this.isTyping = true;
    this.startThinkingMessages();
    this.cdr.markForCheck();

    const enhancedQuery = `${userMessage}

Answer like you're a caring friend having a normal conversation. Use simple, everyday language that's easy to understand. Write in flowing sentences and natural paragraphs - no lists, no bullet points, no numbers, no symbols. Just talk to me like a real person would.

IMPORTANT: When recommending doctors, show ONLY 1 doctor (the best match). Include their name, specialty, brief description, their profile image, and profile link.

For the doctor image, use this format: [/doctor1.webp] where the filename matches the doctor.
For the profile link, use this EXACT format: http://localhost:4200/doctor/{doctor_id} where {doctor_id} is the actual doctor's unique ID. DO NOT show the doctor ID in the text, just include the full URL.

Example: "I recommend Dr. Sarah Johnson, a gynecologist specializing in reproductive health. [/doctor1.webp] You can view her profile at http://localhost:4200/doctor/dr-sarah-johnson-123"`;

    const chatRequest: ChatRequest = {
      query: enhancedQuery,
      user_id: this.userId,
    };

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      Accept: 'application/json',
    });

    console.log('Sending request to n8n webhook:', {
      url: this.N8N_WEBHOOK_URL,
      payload: chatRequest,
    });

    this.http
      .post<N8nWebhookResponse>(this.N8N_WEBHOOK_URL, chatRequest, { headers })
      .pipe(takeUntil(this.destroy$), debounceTime(100))
      .subscribe({
        next: (response) => {
          console.log('Received response from n8n webhook:', response);
          console.log('Response type:', typeof response);
          console.log('Is array:', Array.isArray(response));

          this.isTyping = false;
          this.clearThinkingInterval();

          // Extract the text from response
          let botText = '';

          // Handle array response format
          let responseData: any;
          if (Array.isArray(response) && response.length > 0) {
            responseData = response[0];
            console.log(
              'Response is array, using first element:',
              responseData
            );
          } else {
            responseData = response;
          }

          if (responseData && responseData.output) {
            botText = this.formatAIResponse(responseData.output);
          } else if (responseData && responseData.answer) {
            botText = this.formatAIResponse(responseData.answer);
          } else if (typeof responseData === 'string') {
            botText = this.formatAIResponse(responseData);
          } else {
            botText = 'No response received';
            console.warn('Unexpected response format:', response);
          }

          console.log('Bot text to display:', botText);

          // Note: n8n webhook doesn't provide session_id or doctor_recommendations
          // If needed, these features would need to be implemented in the n8n workflow
          this.setCurrentMsg(
            {
              id: this.generateMessageId(),
              from: 'bot',
              text: botText,
              timestamp: new Date(),
            },
            true
          );

          // Doctor recommendations feature disabled for n8n webhook
          // If needed, this would need to be implemented in the n8n workflow
        },
        error: (error) => {
          console.error('Error calling n8n webhook:', error);
          console.error('Error details:', {
            status: error.status,
            statusText: error.statusText,
            message: error.message,
            url: error.url,
            error: error.error,
          });
          this.isTyping = false;
          this.clearThinkingInterval();
          this.isConnected = false;
          this.getErrorMessage(error);

          setTimeout(() => {
            this.isConnected = true;
            this.cdr.markForCheck();
          }, 3000);
        },
      });
  }

  private getErrorMessage(error: any): void {
    let key = 'AI_CHAT.ERROR.DEFAULT';
    if (error.status === 0) key = 'AI_CHAT.ERROR.CONNECTION_LOST';
    else if (error.status >= 500) key = 'AI_CHAT.ERROR.SERVER';
    else if (error.status === 429) key = 'AI_CHAT.ERROR.TOO_MANY';
    else if (error.status === 503) key = 'AI_CHAT.ERROR.SERVICE_UNAVAILABLE';
    else if (error.status === 404) key = 'AI_CHAT.ERROR.NOT_FOUND';

    this.translate.get(key, { status: error.status }).subscribe((msg) => {
      this.setCurrentMsg(
        {
          id: this.generateMessageId(),
          from: 'bot',
          text: msg,
          timestamp: new Date(),
        },
        true
      );
    });
  }

  getQuickReplies(): string[] {
    return [
      'Find me a gynecologist',
      'I need hormone therapy help',
      'Period problems and pain',
      'Mental health support',
      'Book an appointment',
    ];
  }

  sendQuickReply(reply: string): void {
    this.sendMessage(reply);
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  clearChat(): void {
    this.initializeChat();
    this.sessionId = undefined;
    this.cdr.markForCheck();
  }

  formatTime(timestamp?: Date): string {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
