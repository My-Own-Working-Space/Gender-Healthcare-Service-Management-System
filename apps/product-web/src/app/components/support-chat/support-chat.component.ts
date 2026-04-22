import {
  Component,
  ViewChild,
  ElementRef,
  AfterViewChecked,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Subject, takeUntil, debounceTime } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  ChatMessage,
  ChatRequest,
  ChatResponse,
  DoctorRecommendation,
  N8nWebhookResponse,
} from '../../models/chatbot.model';

@Component({
  selector: 'app-support-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './support-chat.component.html',
  styleUrls: ['./support-chat.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupportChatComponent implements AfterViewChecked, OnDestroy {
  @ViewChild('messageInput') messageInput!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('chatBody') chatBody!: ElementRef<HTMLDivElement>;

  showChatPanel = false;
  message = '';
  isTyping = false;
  isConnected = true;
  unreadCount = 0;
  sessionId?: string;
  userId?: string;

  currentMsg: ChatMessage | null = null;
  showClearBtn = false;

  quickReplyText: string = '';
  showQuickReplies = false;
  inputFocused = false;

  // Smart suggestions based on context
  contextualSuggestions: Array<{ icon: string, text: string, category: string }> = [
    { icon: '🏥', text: 'Tell me about women\'s health services', category: 'services' },
    { icon: '📅', text: 'I need to book an appointment', category: 'booking' },
    { icon: '📊', text: 'Period tracking help', category: 'tracking' },
    { icon: '👩‍⚕️', text: 'Find a doctor', category: 'doctors' },
    { icon: '💊', text: 'Medication information', category: 'medication' },
    { icon: '🤰', text: 'Pregnancy care', category: 'pregnancy' },
    { icon: '🩺', text: 'Gynecological checkup', category: 'checkup' },
    { icon: '💬', text: 'Ask about symptoms', category: 'symptoms' },
  ];

  currentSuggestions: Array<{ icon: string, text: string, category: string }> = [];
  suggestionHistory: string[] = [];

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

  showPatientForm = false;
  showCalendar = false;
  showAppointmentFlow = false;
  formCompleted = false;
  currentAppFlow: 'form' | 'calendar' | 'appointment' | 'completed' = 'form';
  patientFormData: any = {};
  selectedDate: string = '';
  selectedTime: string = '';
  availableSlots: any[] = [];

  // Period tracking
  showPeriodTracker = false;
  showPeriodCalendar = false;
  periodTrackingData: any = {};
  currentMonth = new Date();
  calendarDays: any[] = [];
  periodEntries: any[] = [];
  selectedPeriodDate: string = '';
  periodStats: any = null;

  private destroy$ = new Subject<void>();
  private shouldScrollToBottom = false;
  private messageIdCounter = 0;
  private readonly N8N_WEBHOOK_URL =
    'https://khanhnqse.app.n8n.cloud/webhook/chatbot';

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private translate: TranslateService
  ) {
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

  private initQuickReplies() {
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

    let formatted = response
      .replace(/\[TRIGGER_FORM_FLOW\]/g, '')
      .replace(/\[TRIGGER_PERIOD_TRACKER\]/g, '')
      .replace(
        /\[(\/([\w\-\.]+\.webp))\]/g,
        '<div class="doctor-image-container"><img src="https://ldmcdielxskywugyohrq.supabase.co/storage/v1/object/public/staff-uploads$1" alt="Doctor Photo" class="doctor-image" /></div>'
      )
      .replace(
        /http:\/\/localhost:4200\/doctor\/([\w\-\.]+)/g,
        '<div class="doctor-profile-link"><a href="http://localhost:4200/doctor/$1" target="_blank" class="doctor-link"><span class="doctor-icon">👨‍⚕️</span> View Doctor Profile</a></div>'
      );

    formatted = this.processTextFormatting(formatted);
    formatted = this.processListsAndStructure(formatted);
    formatted = this.processParagraphs(formatted);

    return formatted.trim();
  }

  private processTextFormatting(text: string): string {
    return text
      .replace(/^#{1,6}\s+(.+)$/gm, '<h3 class="chat-heading">$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<span class="chat-bold">$1</span>')
      .replace(/__(.*?)__/g, '<span class="chat-bold">$1</span>')
      .replace(/\*(.*?)\*/g, '<span class="chat-italic">$1</span>')
      .replace(/_(.*?)_/g, '<span class="chat-italic">$1</span>')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '<span class="chat-code">$1</span>')
      .replace(/~~(.*?)~~/g, '<span class="chat-strikethrough">$1</span>')
      .replace(/^>\s+(.+)$/gm, '<div class="chat-quote">$1</div>')
      .replace(/^---+$/gm, '<hr class="chat-divider">');
  }

  private processListsAndStructure(text: string): string {
    const lines = text.split('\n');
    const processedLines: string[] = [];
    let inList = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      if (trimmedLine.match(/^[-\*\+]\s+/)) {
        if (!inList) {
          processedLines.push('<ul class="chat-list">');
          inList = true;
        }
        const content = trimmedLine.replace(/^[-\*\+]\s+/, '');
        processedLines.push(`<li class="chat-list-item">${content}</li>`);
      } else if (trimmedLine.match(/^\d+\.\s+/)) {
        if (!inList) {
          processedLines.push('<ol class="chat-list chat-numbered-list">');
          inList = true;
        }
        const content = trimmedLine.replace(/^\d+\.\s+/, '');
        processedLines.push(`<li class="chat-list-item">${content}</li>`);
      } else {
        if (inList) {
          processedLines.push('</ul>');
          inList = false;
        }
        if (trimmedLine) {
          processedLines.push(line);
        } else {
          processedLines.push('');
        }
      }
    }

    if (inList) {
      processedLines.push('</ul>');
    }

    return processedLines.join('\n');
  }

  private processParagraphs(text: string): string {
    return text
      .split('\n\n')
      .map((paragraph) => {
        const trimmed = paragraph.trim();
        if (!trimmed) return '';

        if (trimmed.includes('<') || trimmed.includes('</')) {
          return trimmed;
        }

        const lines = trimmed.split('\n').filter((line) => line.trim());
        if (lines.length === 1) {
          return `<p class="chat-paragraph">${lines[0]}</p>`;
        } else {
          return `<div class="chat-multi-line">${lines
            .map((line) => `<p class="chat-paragraph">${line}</p>`)
            .join('')}</div>`;
        }
      })
      .filter((p) => p)
      .join('\n');
  }

  private startThinkingMessages(): void {
    this.thinkingMessageIndex = 0;
    this.updateThinkingMessage();

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
    if (msg.from === 'bot' && !this.showChatPanel) this.unreadCount++;
    this.cdr.markForCheck();
  }

  private scrollToBottom(): void {
    if (this.chatBody?.nativeElement) {
      const element = this.chatBody.nativeElement;
      element.scrollTop = element.scrollHeight;
    }
  }

  toggleChat(): void {
    this.showChatPanel = !this.showChatPanel;
    if (this.showChatPanel) {
      this.unreadCount = 0;
      this.cdr.markForCheck();
      setTimeout(() => {
        this.messageInput?.nativeElement?.focus();
      }, 300);
    }
  }

  sendMessage(messageText?: string): void {
    const userMessage = (messageText || this.message).trim();
    if (!userMessage) return;

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

SPECIAL TRIGGERS:
- If the user asks about booking an appointment, scheduling, or wants to see a doctor, include: [TRIGGER_FORM_FLOW]
- If the user asks about period tracking, menstrual cycle, or wants to track their period, include: [TRIGGER_PERIOD_TRACKER]

Example: "I recommend Dr. Sarah Johnson, a gynecologist specializing in reproductive health. [/doctor1.webp] You can view her profile at http://localhost:4200/doctor/dr-sarah-johnson-123"`;

    const chatRequest: ChatRequest = {
      query: enhancedQuery,
      user_id: this.userId,
    };

    console.log('🚀 Sending request to n8n webhook:', {
      url: this.N8N_WEBHOOK_URL,
      request: chatRequest,
      userMessage: userMessage,
    });

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      Accept: 'application/json',
    });

    this.http
      .post<N8nWebhookResponse>(this.N8N_WEBHOOK_URL, chatRequest, { headers })
      .pipe(takeUntil(this.destroy$), debounceTime(100))
      .subscribe({
        next: (response) => {
          console.log('✅ Received response from n8n webhook:', response);

          this.isTyping = false;
          this.clearThinkingInterval();

          let responseData: any;
          if (Array.isArray(response) && response.length > 0) {
            responseData = response[0];
            console.log('📦 Using first array element:', responseData);
          } else {
            responseData = response;
            console.log('📦 Using direct response:', responseData);
          }

          let rawResponse = '';
          if (responseData?.output) {
            rawResponse = responseData.output;
            console.log('📝 Using output field:', rawResponse);
          } else if (responseData?.answer) {
            rawResponse = responseData.answer;
            console.log('📝 Using answer field:', rawResponse);
          } else if (typeof responseData === 'string') {
            rawResponse = responseData;
            console.log('📝 Using string response:', rawResponse);
          } else {
            rawResponse = 'No response received';
            console.warn('⚠️ No valid response format found:', responseData);
          }

          const shouldTriggerForm = rawResponse.includes('[TRIGGER_FORM_FLOW]');
          const shouldTriggerPeriodTracker = rawResponse.includes(
            '[TRIGGER_PERIOD_TRACKER]'
          );
          const botText = this.formatAIResponse(rawResponse);

          console.log('🎯 Final bot text:', botText);
          console.log('🔄 Should trigger form:', shouldTriggerForm);
          console.log(
            '📅 Should trigger period tracker:',
            shouldTriggerPeriodTracker
          );

          if (shouldTriggerForm) {
            setTimeout(() => {
              this.triggerPatientFormFlow();
            }, 2000);
          }

          if (shouldTriggerPeriodTracker) {
            setTimeout(() => {
              this.triggerPeriodTracker();
            }, 2000);
          }

          this.setCurrentMsg(
            {
              id: this.generateMessageId(),
              from: 'bot',
              text: botText,
              timestamp: new Date(),
            },
            true
          );
        },
        error: (error) => {
          console.error('❌ Error calling n8n webhook:', error);
          console.error('📊 Error details:', {
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
    let key = 'AI_CHAT.CHAT_ERROR.DEFAULT';
    if (error.status === 0) key = 'AI_CHAT.CHAT_ERROR.CONNECTION_LOST';
    else if (error.status >= 500) key = 'AI_CHAT.CHAT_ERROR.SERVER';
    else if (error.status === 429) key = 'AI_CHAT.CHAT_ERROR.TOO_MANY';
    else if (error.status === 503)
      key = 'AI_CHAT.CHAT_ERROR.SERVICE_UNAVAILABLE';
    else if (error.status === 404) key = 'AI_CHAT.CHAT_ERROR.NOT_FOUND';

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

  showPatientFormModal(): void {
    this.showPatientForm = true;
    this.currentAppFlow = 'form';
    this.cdr.markForCheck();
  }

  onPatientFormSubmit(formData: any): void {
    this.patientFormData = formData;
    this.formCompleted = true;
    this.showPatientForm = false;
    this.currentAppFlow = 'calendar';

    this.showCalendarView();

    this.setCurrentMsg(
      {
        id: this.generateMessageId(),
        from: 'bot',
        text: `Great! I've received your information. Now let's schedule your appointment. Please select a date from the calendar below.`,
        timestamp: new Date(),
      },
      true
    );
  }

  showCalendarView(): void {
    this.showCalendar = true;
    this.generateAvailableSlots();
    this.cdr.markForCheck();
  }

  onDateSelected(date: string): void {
    this.selectedDate = date;
    this.currentAppFlow = 'appointment';

    this.setCurrentMsg(
      {
        id: this.generateMessageId(),
        from: 'bot',
        text: `Perfect! You selected ${date}. Here are the available time slots for that day:`,
        timestamp: new Date(),
      },
      true
    );

    this.showAppointmentFlow = true;
    this.cdr.markForCheck();
  }

  onTimeSlotSelected(time: string): void {
    this.selectedTime = time;
    this.currentAppFlow = 'completed';
    this.completeAppointmentBooking();
  }

  completeAppointmentBooking(): void {
    const appointmentSummary = `
      <div class="appointment-summary">
        <h3 class="chat-heading">Appointment Confirmed!</h3>
        <div class="appointment-details">
          <p class="chat-paragraph"><span class="chat-bold">Patient:</span> ${this.patientFormData.fullName}</p>
          <p class="chat-paragraph"><span class="chat-bold">Date:</span> ${this.selectedDate}</p>
          <p class="chat-paragraph"><span class="chat-bold">Time:</span> ${this.selectedTime}</p>
          <p class="chat-paragraph"><span class="chat-bold">Phone:</span> ${this.patientFormData.phone}</p>
        </div>
        <div class="confirmation-actions">
          <a href="/appointments" class="appointment-link">📅 View All Appointments</a>
        </div>
      </div>
    `;

    this.setCurrentMsg(
      {
        id: this.generateMessageId(),
        from: 'bot',
        text: appointmentSummary,
        timestamp: new Date(),
      },
      true
    );

    this.resetAppFlow();
  }

  generateAvailableSlots(): void {
    const today = new Date();
    this.availableSlots = [];

    for (let i = 1; i <= 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);

      this.availableSlots.push({
        date: date.toISOString().split('T')[0],
        displayDate: date.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        timeSlots: [
          '09:00 AM',
          '10:00 AM',
          '11:00 AM',
          '02:00 PM',
          '03:00 PM',
          '04:00 PM',
        ],
      });
    }
  }

  resetAppFlow(): void {
    setTimeout(() => {
      this.showPatientForm = false;
      this.showCalendar = false;
      this.showAppointmentFlow = false;
      this.formCompleted = false;
      this.currentAppFlow = 'form';
      this.patientFormData = {};
      this.selectedDate = '';
      this.selectedTime = '';
      this.cdr.markForCheck();
    }, 5000);
  }

  triggerPatientFormFlow(): void {
    this.setCurrentMsg(
      {
        id: this.generateMessageId(),
        from: 'bot',
        text: `I'd be happy to help you schedule an appointment! Let me collect some basic information first. Please fill out this quick form:`,
        timestamp: new Date(),
      },
      true
    );

    setTimeout(() => {
      this.showPatientFormModal();
    }, 1000);
  }

  // ========== PERIOD TRACKING METHODS ==========

  triggerPeriodTracker(): void {
    this.setCurrentMsg(
      {
        id: this.generateMessageId(),
        from: 'bot',
        text: `I'll help you track your menstrual cycle! This is important for understanding your reproductive health. Let me show you your period tracking calendar:`,
        timestamp: new Date(),
      },
      true
    );

    setTimeout(() => {
      this.showPeriodTrackerModal();
    }, 1000);
  }

  showPeriodTrackerModal(): void {
    this.showPeriodTracker = true;
    this.generatePeriodCalendar();
    this.loadPeriodEntries();
    this.cdr.markForCheck();
  }

  generatePeriodCalendar(): void {
    const year = this.currentMonth.getFullYear();
    const month = this.currentMonth.getMonth();

    // Get first day of month and calculate calendar grid
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    this.calendarDays = [];

    for (let i = 0; i < 42; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);

      const dayData = {
        date: currentDate,
        dateString: currentDate.toISOString().split('T')[0],
        dayNumber: currentDate.getDate(),
        isCurrentMonth: currentDate.getMonth() === month,
        isToday: this.isToday(currentDate),
        isPeriodDay: this.isPeriodDay(currentDate),
        isFertileDay: this.isFertileDay(currentDate),
        isOvulationDay: this.isOvulationDay(currentDate),
        isPredictedPeriod: this.isPredictedPeriod(currentDate),
        status: this.getDayStatus(currentDate),
      };

      this.calendarDays.push(dayData);
    }
  }

  loadPeriodEntries(): void {
    // Mock data for demonstration - in real app, load from API
    this.periodEntries = [
      {
        period_id: '1',
        patient_id: 'user-123',
        start_date: '2024-01-15',
        end_date: '2024-01-20',
        cycle_length: 28,
        flow_intensity: 'medium',
        symptoms: ['cramps', 'mood_swings'],
        period_description: 'Normal cycle',
      },
      {
        period_id: '2',
        patient_id: 'user-123',
        start_date: '2024-02-12',
        end_date: '2024-02-17',
        cycle_length: 28,
        flow_intensity: 'heavy',
        symptoms: ['cramps', 'headache'],
        period_description: 'Heavy flow this month',
      },
    ];

    this.calculatePeriodStats();
  }

  calculatePeriodStats(): void {
    if (this.periodEntries.length === 0) {
      this.periodStats = null;
      return;
    }

    const cycles = this.periodEntries.map((entry) => entry.cycle_length || 28);
    const averageCycleLength =
      cycles.reduce((a, b) => a + b, 0) / cycles.length;

    const lastPeriod = this.periodEntries[this.periodEntries.length - 1];
    const lastPeriodDate = new Date(lastPeriod.start_date);
    const nextPeriodDate = new Date(lastPeriodDate);
    nextPeriodDate.setDate(nextPeriodDate.getDate() + averageCycleLength);

    const today = new Date();
    const daysUntilNext = Math.ceil(
      (nextPeriodDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    this.periodStats = {
      averageCycleLength: Math.round(averageCycleLength),
      totalCyclesTracked: this.periodEntries.length,
      daysUntilNextPeriod: daysUntilNext,
      nextPeriodDate: nextPeriodDate.toISOString().split('T')[0],
      lastPeriodDate: lastPeriod.start_date,
    };
  }

  isToday(date: Date): boolean {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }

  isPeriodDay(date: Date): boolean {
    const dateString = date.toISOString().split('T')[0];
    return this.periodEntries.some((entry) => {
      const startDate = entry.start_date;
      const endDate = entry.end_date || entry.start_date;
      return dateString >= startDate && dateString <= endDate;
    });
  }

  isFertileDay(date: Date): boolean {
    // Calculate fertile window (typically 5 days before ovulation + ovulation day)
    // This is a simplified calculation - in a real app, this would be more sophisticated
    return false;
  }

  isOvulationDay(date: Date): boolean {
    // Calculate ovulation day (typically 14 days before next period)
    // This is a simplified calculation - in a real app, this would be more sophisticated
    return false;
  }

  getDayStatus(date: Date): string {
    if (this.isPeriodDay(date)) return 'period';
    if (this.isPredictedPeriod(date)) return 'predicted';
    return 'normal';
  }

  isPredictedPeriod(date: Date): boolean {
    if (!this.periodStats) return false;
    const dateString = date.toISOString().split('T')[0];
    const nextPeriodDate = this.periodStats.nextPeriodDate;
    const predictedEnd = new Date(nextPeriodDate);
    predictedEnd.setDate(predictedEnd.getDate() + 5);

    return (
      dateString >= nextPeriodDate &&
      dateString <= predictedEnd.toISOString().split('T')[0]
    );
  }

  onPeriodDayClick(day: any): void {
    if (!day.isCurrentMonth) return;

    this.selectedPeriodDate = day.dateString;

    if (day.isPeriodDay) {
      this.showPeriodDetails(day);
    } else {
      this.showPeriodLogForm(day);
    }
  }

  showPeriodDetails(day: any): void {
    const entry = this.periodEntries.find(
      (entry) =>
        day.dateString >= entry.start_date &&
        day.dateString <= (entry.end_date || entry.start_date)
    );

    if (entry) {
      const detailsText = `
        <div class="period-details">
          <h4><strong>Period Details</strong></h4>
          <p><strong>Start Date:</strong> ${new Date(
        entry.start_date
      ).toLocaleDateString()}</p>
          <p><strong>End Date:</strong> ${entry.end_date
          ? new Date(entry.end_date).toLocaleDateString()
          : 'Ongoing'
        }</p>
          <p><strong>Flow Intensity:</strong> ${entry.flow_intensity}</p>
          <p><strong>Cycle Length:</strong> ${entry.cycle_length} days</p>
          ${entry.symptoms
          ? `<p><strong>Symptoms:</strong> ${entry.symptoms.join(', ')}</p>`
          : ''
        }
          ${entry.period_description
          ? `<p><strong>Notes:</strong> ${entry.period_description}</p>`
          : ''
        }
        </div>
      `;

      this.setCurrentMsg(
        {
          id: this.generateMessageId(),
          from: 'bot',
          text: detailsText,
          timestamp: new Date(),
        },
        true
      );
    }
  }

  showPeriodLogForm(day: any): void {
    this.selectedPeriodDate = day.dateString;
    this.setCurrentMsg(
      {
        id: this.generateMessageId(),
        from: 'bot',
        text: `Would you like to log your period for ${new Date(
          day.dateString
        ).toLocaleDateString()}? You can track flow intensity, symptoms, and notes.`,
        timestamp: new Date(),
      },
      true
    );
  }

  previousMonth(): void {
    this.currentMonth.setMonth(this.currentMonth.getMonth() - 1);
    this.generatePeriodCalendar();
    this.cdr.markForCheck();
  }

  nextMonth(): void {
    this.currentMonth.setMonth(this.currentMonth.getMonth() + 1);
    this.generatePeriodCalendar();
    this.cdr.markForCheck();
  }

  getMonthYearDisplay(): string {
    return this.currentMonth.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  }

  closePeriodTracker(): void {
    this.showPeriodTracker = false;
    this.cdr.markForCheck();
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  onInputChange(): void {
    // Auto-resize textarea
    const textarea = this.messageInput?.nativeElement;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }

    // Hide quick replies when user starts typing
    if (this.message.trim().length > 0) {
      this.showQuickReplies = false;
    }
  }

  onInputFocus(): void {
    this.inputFocused = true;
    this.showQuickReplies = true;
  }

  onInputBlur(): void {
    this.inputFocused = false;
    // Delay hiding quick replies to allow clicking on them
    setTimeout(() => {
      if (!this.inputFocused) {
        this.showQuickReplies = false;
      }
    }, 200);
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
