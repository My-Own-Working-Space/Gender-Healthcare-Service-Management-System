import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  CalendarDay,
  PeriodEntry,
  PeriodStats,
} from '../../models/period-tracking.model';

@Component({
  selector: 'app-period-calendar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="period-calendar">
      <!-- Calendar Header -->
      <div class="flex items-center justify-between mb-8 px-4">
        <button
          (click)="previousMonth()"
          class="p-3 rounded-2xl bg-pink-50 text-pink-500 hover:bg-pink-100 transition-all duration-300 hover:scale-105 shadow-sm border border-pink-100"
        >
          <svg
            class="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 19l-7-7 7-7"
            ></path>
          </svg>
        </button>

        <h3 class="text-xl font-black text-gray-800 tracking-tight">
          {{ monthYearDisplay() }}
        </h3>

        <button
          (click)="nextMonth()"
          class="p-3 rounded-2xl bg-pink-50 text-pink-500 hover:bg-pink-100 transition-all duration-300 hover:scale-105 shadow-sm border border-pink-100"
        >
          <svg
            class="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 5l7 7-7 7"
            ></path>
          </svg>
        </button>
      </div>

      <!-- Calendar Grid -->
      @if (isLoading || isGenerating()) {
        <!-- Loading State -->
        <div class="calendar-grid mb-6">
          <!-- Day Headers -->
          @for (day of dayHeaders; track day) {
          <div class="day-header">
            {{ day }}
          </div>
          }

          <!-- Loading Skeleton -->
          @for (i of [].constructor(42); track $index) {
          <div class="calendar-day loading-skeleton">
            <div class="skeleton-content"></div>
          </div>
          }
        </div>
      } @else {
        <!-- Actual Calendar -->
        <div class="calendar-grid mb-6">
          <!-- Day Headers -->
          @for (day of dayHeaders; track day) {
          <div class="day-header">
            {{ day }}
          </div>
          }

          <!-- Calendar Days -->
          @for (day of calendarDays(); track day.dateString) {
          <div
            class="calendar-day"
            [ngClass]="getDayClasses(day)"
            (click)="onDayClick(day)"
            [attr.title]="getDayTooltip(day)"
            [attr.aria-label]="getAriaLabel(day)"
            [attr.role]="'button'"
            [attr.tabindex]="day.isCurrentMonth ? 0 : -1"
          >
            <!-- Day Number -->
            <span class="day-number">{{ day.dayNumber }}</span>

            <!-- Status Indicators -->
            @if (day.isPeriodDay) {
              <div class="status-indicator period-indicator" aria-hidden="true">
                <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <circle cx="10" cy="10" r="8"/>
                </svg>
              </div>
            } @else if (day.isOvulationDay) {
              <div class="status-indicator ovulation-indicator" aria-hidden="true">
                <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                </svg>
              </div>
            } @else if (day.isFertileDay) {
              <div class="status-indicator fertile-indicator" aria-hidden="true">
                <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                </svg>
              </div>
            } @else if (day.isPredictedPeriod) {
              <div class="status-indicator predicted-indicator" aria-hidden="true">
                <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
                </svg>
              </div>
            }

            <!-- Late Period Warning -->
            @if (day.isLatePeriod) {
              <div class="late-indicator" aria-label="Period is late">
                {{ day.daysLate }}d
              </div>
            }

            <!-- Today Ring -->
            @if (day.isToday) {
              <div class="today-ring" aria-hidden="true"></div>
            }
          </div>
          }
        </div>
      }

      <!-- Enhanced Legend -->
      <div class="legend-container">
        <h4 class="legend-title">Calendar Legend</h4>
        <div class="legend-grid">
          <div class="legend-item">
            <div class="legend-color period-color"></div>
            <span class="legend-text">Period Days</span>
          </div>
          <div class="legend-item">
            <div class="legend-color ovulation-color"></div>
            <span class="legend-text">Ovulation</span>
          </div>
          <div class="legend-item">
            <div class="legend-color fertile-color"></div>
            <span class="legend-text">Fertile Window</span>
          </div>
          <div class="legend-item">
            <div class="legend-color predicted-color"></div>
            <span class="legend-text">Predicted Period</span>
          </div>
          <div class="legend-item">
            <div class="legend-color today-color"></div>
            <span class="legend-text">Today</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .period-calendar {
        width: 100%;
        max-width: 28rem;
        margin-left: auto;
        margin-right: auto;
        font-family: 'Inter', 'Segoe UI', sans-serif;
      }

      /* Calendar Grid */
      .calendar-grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 6px;
        background: transparent;
        padding: 4px;
      }

      /* Day Headers */
      .day-header {
        text-align: center;
        font-size: 0.7rem;
        font-weight: 800;
        color: #F472B6;
        padding: 8px 0;
        text-transform: uppercase;
        letter-spacing: 1px;
      }

      /* Calendar Day Cells */
      .calendar-day {
        position: relative;
        aspect-ratio: 1;
        min-height: 48px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.2s ease-in-out;
        background: ;
        border: 2px solid transparent;
        box-shadow: 0 1px 3px rgba(255, 255, 255, 0.1);
      }

      .calendar-day:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }

      /* Day Number */
      .day-number {
        font-size: 0.875rem;
        font-weight: 600;
        z-index: 10;
        position: relative;
      }

      /* Status Indicators */
      .status-indicator {
        position: absolute;
        bottom: 4px;
        right: 4px;
        z-index: 5;
      }

      .period-indicator {
        color: #dc2626;
      }

      .ovulation-indicator {
        color: #f59e0b;
      }

      .fertile-indicator {
        color: #059669;
      }

      .predicted-indicator {
        color: #ec4899;
        opacity: 0.7;
      }

      /* Late Period Warning */
      .late-indicator {
        position: absolute;
        top: 2px;
        right: 2px;
        font-size: 0.625rem;
        font-weight: 700;
        color: #dc2626;
        background: #fef2f2;
        padding: 1px 4px;
        border-radius: 4px;
        animation: pulse 2s infinite;
      }

      /* Today Ring */
      .today-ring {
        position: absolute;
        inset: -2px;
        border: 3px solid #3b82f6;
        border-radius: 12px;
        pointer-events: none;
        animation: ring-pulse 2s infinite;
      }

      @keyframes ring-pulse {
        0%, 100% {
          opacity: 1;
          transform: scale(1);
        }
        50% {
          opacity: 0.7;
          transform: scale(1.05);
        }
      }

      /* Day Type Styles */
      .period-day {
        background: linear-gradient(135deg, #F9A8D4 0%, #F472B6 100%) !important;
        color: white !important;
        border-color: #F472B6 !important;
        box-shadow: 0 4px 10px rgba(244, 114, 182, 0.3) !important;
      }

      .ovulation-day {
        background: linear-gradient(135deg, #FDE68A 0%, #FBBF24 100%) !important;
        color: #92400E !important;
        border-color: #FBBF24 !important;
        box-shadow: 0 4px 10px rgba(251, 191, 36, 0.3) !important;
      }

      .fertile-day {
        background: linear-gradient(135deg, #A7F3D0 0%, #6EE7B7 100%) !important;
        color: #064E3B !important;
        border-color: #34D399 !important;
      }

      .predicted-day {
        background: white !important;
        color: #F472B6 !important;
        border: 2px dashed #F472B6 !important;
      }

      .other-month {
        background: transparent !important;
        color: #FBCFE8 !important;
        opacity: 0.5;
      }

      .normal-day {
        background: white;
        color: #4B5563;
        border-color: #FFF1F2;
      }

      .normal-day:hover {
        background: #FFF1F2;
        border-color: #FBCFE8;
        transform: scale(1.05);
      }

      /* Legend Styles */
      .legend-container {
        background: white;
        border-radius: 20px;
        padding: 20px;
        border: 1px solid #FFF1F2;
        box-shadow: 0 4px 15px rgba(251, 207, 232, 0.1);
        margin-top: 20px;
      }

      .legend-title {
        font-size: 0.75rem;
        font-weight: 800;
        color: #F472B6;
        margin-bottom: 16px;
        text-align: center;
        text-transform: uppercase;
        letter-spacing: 1px;
      }

      .legend-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
      }

      .legend-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        text-align: center;
      }

      .legend-color {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .period-color {
        background: #F472B6;
        box-shadow: 0 2px 5px rgba(244, 114, 182, 0.4);
      }

      .ovulation-color {
        background: #FBBF24;
        box-shadow: 0 2px 5px rgba(251, 191, 36, 0.4);
      }

      .fertile-color {
        background: #34D399;
      }

      .predicted-color {
        background: white;
        border: 1.5px dashed #F472B6;
      }

      .today-color {
        background: white;
        border: 3px solid #3b82f6;
      }

      .legend-text {
        font-size: 0.65rem;
        font-weight: 700;
        color: #9CA3AF;
      }

      /* Enhanced Animations */
      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes scaleIn {
        from {
          transform: scale(0.8);
          opacity: 0;
        }
        to {
          transform: scale(1);
          opacity: 1;
        }
      }

      .calendar-day {
        animation: fadeIn 0.3s ease-out;
      }

      .status-indicator {
        animation: scaleIn 0.4s ease-out;
      }

      /* Hover Effects */
      .calendar-day:hover .status-indicator {
        transform: scale(1.2);
      }

      .calendar-day:hover .day-number {
        font-weight: 700;
      }

      /* Loading Skeleton */
      .loading-skeleton {
        background: #f3f4f6;
        border: 1px solid #e5e7eb;
        animation: pulse 2s infinite;
      }

      .skeleton-content {
        width: 60%;
        height: 12px;
        background: #d1d5db;
        border-radius: 4px;
        margin: auto;
      }

      @keyframes pulse {
        0%, 100% {
          opacity: 1;
        }
        50% {
          opacity: 0.5;
        }
      }

      /* Focus States for Accessibility */
      .calendar-day:focus {
        outline: none;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.5);
        ring: 2px solid #3b82f6;
        ring-offset: 2px;
      }

      .calendar-day:focus-visible {
        outline: 2px solid #3b82f6;
        outline-offset: 2px;
      }

      /* Keyboard Navigation */
      .calendar-day[tabindex="0"]:focus {
        z-index: 10;
      }

      /* Responsive Design */
      @media (max-width: 768px) {
        .period-calendar {
          max-width: 100%;
          padding: 0 8px;
        }

        .calendar-grid {
          padding: 8px;
          gap: 3px;
        }

        .calendar-day {
          min-height: 44px;
        }

        .day-number {
          font-size: 0.8rem;
        }

        .legend-grid {
          grid-template-columns: repeat(2, 1fr);
          gap: 6px;
        }

        .legend-item {
          padding: 4px;
        }

        .legend-text {
          font-size: 0.7rem;
        }
      }

      @media (max-width: 640px) {
        .calendar-day {
          min-height: 40px;
        }

        .day-number {
          font-size: 0.75rem;
        }

        .status-indicator svg {
          width: 10px;
          height: 10px;
        }

        .day-header {
          font-size: 0.7rem;
          padding: 6px 2px;
        }
      }

      @media (max-width: 480px) {
        .calendar-day {
          min-height: 36px;
        }

        .calendar-grid {
          gap: 2px;
          padding: 6px;
        }

        .day-number {
          font-size: 0.7rem;
        }

        .status-indicator {
          bottom: 2px;
          right: 2px;
        }

        .status-indicator svg {
          width: 8px;
          height: 8px;
        }

        .legend-container {
          padding: 12px;
        }

        .legend-title {
          font-size: 0.8rem;
          margin-bottom: 8px;
        }
      }

      /* Print styles */
      @media print {
        .calendar-day {
          box-shadow: none;
          border: 1px solid #000;
        }

        .status-indicator {
          display: none;
        }

        .today-ring {
          display: none;
        }
      }
    `,
  ],
})
export class PeriodCalendarComponent implements OnInit {
  @Input() periodHistory: PeriodEntry[] = [];
  @Input() periodStats: PeriodStats | null = null;
  @Input() miniMode: boolean = false;
  @Input() isLoading: boolean = false;
  @Input() currentMonth = signal(new Date());
  @Output() daySelected = new EventEmitter<CalendarDay>();
  @Output() monthChanged = new EventEmitter<Date>();

  dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  calendarDays = signal<CalendarDay[]>([]);
  isGenerating = signal(false);

  monthYearDisplay = computed(() => {
    return this.currentMonth().toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  });

  ngOnInit() {
    this.generateCalendar();
  }

  ngOnChanges() {
    this.generateCalendar();
  }

  // Enhanced method to get dynamic CSS classes for each day
  getDayClasses(day: CalendarDay): string {
    const classes: string[] = [];

    // Base styling for days outside current month
    if (!day.isCurrentMonth) {
      classes.push('other-month');
      return classes.join(' ');
    }

    // Priority-based styling for current month days
    if (day.isPeriodDay) {
      classes.push('period-day');
    } else if (day.isOvulationDay) {
      classes.push('ovulation-day');
    } else if (day.isFertileDay) {
      classes.push('fertile-day');
    } else if (day.isPredictedPeriod) {
      classes.push('predicted-day');
    } else {
      classes.push('normal-day');
    }

    return classes.join(' ');
  }

  // New method to get tooltip text for each day
  getDayTooltip(day: CalendarDay): string {
    if (!day.isCurrentMonth) {
      return '';
    }

    const tooltips = this.collectDayTooltips(day);
    return tooltips.join(' • ') || `Day ${day.dayNumber}`;
  }

  // Helper method to collect all tooltip texts for a day
  private collectDayTooltips(day: CalendarDay): string[] {
    const tooltips: string[] = [];

    // Add basic day status
    this.addBasicDayTooltips(day, tooltips);

    // Add cycle-related tooltips
    this.addCycleTooltips(day, tooltips);

    // Add prediction tooltips
    this.addPredictionTooltips(day, tooltips);

    return tooltips;
  }

  // Add basic day status tooltips
  private addBasicDayTooltips(day: CalendarDay, tooltips: string[]): void {
    if (day.isToday) {
      tooltips.push('Today');
    }
  }

  // Add cycle-related tooltips
  private addCycleTooltips(day: CalendarDay, tooltips: string[]): void {
    if (day.isPeriodDay) {
      tooltips.push('Period Day');
    }

    if (day.isOvulationDay) {
      tooltips.push('Ovulation Day');
    }

    if (day.isFertileDay && !day.isPeriodDay && !day.isOvulationDay) {
      tooltips.push('Fertile Window');
    }
  }

  // Add prediction and late period tooltips
  private addPredictionTooltips(day: CalendarDay, tooltips: string[]): void {
    if (day.isPredictedPeriod) {
      tooltips.push('Predicted Period');
    }

    if (day.isLatePeriod) {
      tooltips.push(`Period is ${day.daysLate} days late`);
    }

    if (day.conceptionChance && day.conceptionChance > 20) {
      tooltips.push(`${day.conceptionChance}% conception chance`);
    }
  }

  // Accessibility method for screen readers
  getAriaLabel(day: CalendarDay): string {
    if (!day.isCurrentMonth) {
      return `${day.dayNumber}, not in current month`;
    }

    const labels = this.collectAriaLabels(day);
    return labels.join(', ');
  }

  // Helper method to collect all aria labels for a day
  private collectAriaLabels(day: CalendarDay): string[] {
    const labels: string[] = [];

    // Add formatted date
    labels.push(this.formatDateForAria(day.date));

    // Add status labels using existing helper methods
    this.addAriaStatusLabels(day, labels);

    return labels;
  }

  // Format date for aria label
  private formatDateForAria(date: Date): string {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }

  // Add status information for aria labels
  private addAriaStatusLabels(day: CalendarDay, labels: string[]): void {
    if (day.isToday) {
      labels.push('Today');
    }

    if (day.isPeriodDay) {
      labels.push('Period day');
    }

    if (day.isOvulationDay) {
      labels.push('Ovulation day');
    }

    if (day.isFertileDay && !day.isPeriodDay && !day.isOvulationDay) {
      labels.push('Fertile window');
    }

    if (day.isPredictedPeriod) {
      labels.push('Predicted period');
    }

    if (day.isLatePeriod) {
      labels.push(`Period is ${day.daysLate} days late`);
    }
  }

  previousMonth(): void {
    const current = this.currentMonth();
    const previous = new Date(current.getFullYear(), current.getMonth() - 1, 1);
    this.currentMonth.set(previous);
    this.monthChanged.emit(previous);
    this.generateCalendar();
  }

  nextMonth(): void {
    const current = this.currentMonth();
    const next = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    this.currentMonth.set(next);
    this.monthChanged.emit(next);
    this.generateCalendar();
  }

  onDayClick(day: CalendarDay): void {
    if (day.isCurrentMonth) {
      this.daySelected.emit(day);
    }
  }

  private generateCalendar(): void {
    this.isGenerating.set(true);

    // Add small delay to show loading state
    setTimeout(() => {
      const days: CalendarDay[] = [];
      const current = this.currentMonth();
      const year = current.getFullYear();
      const month = current.getMonth();

      // First day of the month
      const firstDay = new Date(year, month, 1);
      // Start from Sunday of the week containing the first day
      const startDate = new Date(firstDay);
      startDate.setDate(firstDay.getDate() - firstDay.getDay());

      // Generate 42 days (6 weeks)
      const currentDate = new Date(startDate);

      for (let i = 0; i < 42; i++) {
        const day: CalendarDay = {
          date: new Date(currentDate),
          dateString: this.formatDateString(currentDate),
          isCurrentMonth: currentDate.getMonth() === month,
          isToday: this.isDateToday(currentDate),
          isPeriodDay: this.isPeriodDay(currentDate),
          isFertileDay: this.isFertileDay(currentDate),
          isOvulationDay: this.isOvulationDay(currentDate),
          isPredictedPeriod: this.isPredictedPeriod(currentDate),
          dayNumber: currentDate.getDate(),
          status: this.getDayStatus(currentDate),
          // Enhanced fertility indicators
          fertilityLevel: this.getFertilityLevel(currentDate),
          cyclePhase: this.getCyclePhase(currentDate),
          conceptionChance: this.getConceptionChance(currentDate),
          isOptimalConception: this.isOptimalConceptionDay(currentDate),
          isPeakFertility: this.isPeakFertilityDay(currentDate),
          isLatePeriod: this.isLatePeriodDay(currentDate),
          daysLate: this.getDaysLate(currentDate),
        };

        days.push(day);
        currentDate.setDate(currentDate.getDate() + 1);
      }

      this.calendarDays.set(days);
      this.isGenerating.set(false);
    }, 100);
  }

  private isDateToday(date: Date): boolean {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }

  private formatDateString(date: Date): string {
    // Format date as YYYY-MM-DD without timezone issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  isOngoingPeriodDay(date: Date): boolean {
    // Check if this date is part of an ongoing period (no cycle_length)
    return this.periodHistory.some((entry) => {
      if (entry.cycle_length) return false; // Has cycle_length, not ongoing

      const startDate = new Date(entry.start_date + 'T00:00:00');
      const today = new Date();
      today.setHours(23, 59, 59, 999);

      return date >= startDate && date <= today;
    });
  }

  // ========== ENHANCED FERTILITY ANALYSIS METHODS ==========

  getFertilityLevel(date: Date): 'none' | 'low' | 'moderate' | 'high' | 'peak' {
    if (!this.periodStats) return 'none';

    const dateString = this.formatDateString(date);
    const ovulationDate = this.periodStats.ovulationDate;
    const fertileStart = this.periodStats.fertileWindowStart;
    const fertileEnd = this.periodStats.fertileWindowEnd;

    if (dateString === ovulationDate) return 'peak';
    if (this.isDateInRange(dateString, fertileStart, fertileEnd)) {
      const ovulationDay = new Date(ovulationDate);
      const daysDiff = Math.abs(
        (date.getTime() - ovulationDay.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysDiff <= 1) return 'peak';
      if (daysDiff <= 2) return 'high';
      if (daysDiff <= 3) return 'moderate';
      return 'low';
    }

    return 'none';
  }

  getCyclePhase(
    date: Date
  ): 'menstrual' | 'follicular' | 'ovulatory' | 'luteal' {
    if (!this.periodStats) return 'follicular';

    const dateString = this.formatDateString(date);

    // Check if it's a period day
    if (this.isPeriodDay(date)) return 'menstrual';

    // Check if it's around ovulation (±1 day)
    const ovulationDate = new Date(this.periodStats.ovulationDate);
    const daysDiff = Math.abs(
      (date.getTime() - ovulationDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysDiff <= 1) return 'ovulatory';

    // Check if it's before or after ovulation
    if (date < ovulationDate) return 'follicular';
    return 'luteal';
  }

  getConceptionChance(date: Date): number {
    const fertilityLevel = this.getFertilityLevel(date);

    switch (fertilityLevel) {
      case 'peak':
        return 95;
      case 'high':
        return 75;
      case 'moderate':
        return 50;
      case 'low':
        return 25;
      default:
        return 5;
    }
  }

  isOptimalConceptionDay(date: Date): boolean {
    if (!this.periodStats?.conceptionTiming?.optimalWindow) return false;

    const dateString = this.formatDateString(date);
    return (
      this.periodStats.conceptionTiming.optimalWindow.start <= dateString &&
      dateString <= this.periodStats.conceptionTiming.optimalWindow.end
    );
  }

  isPeakFertilityDay(date: Date): boolean {
    return this.getFertilityLevel(date) === 'peak';
  }

  isLatePeriodDay(date: Date): boolean {
    if (!this.periodStats?.periodStatus) return false;

    const dateString = this.formatDateString(date);
    const expectedDate = this.periodStats.periodStatus.expectedDate;
    const today = new Date().toISOString().split('T')[0];

    return (
      this.periodStats.periodStatus.isLate &&
      dateString === today &&
      dateString > expectedDate
    );
  }

  getDaysLate(date: Date): number | undefined {
    if (!this.isLatePeriodDay(date)) return undefined;
    return this.periodStats?.periodStatus?.daysLate;
  }

  private isDateInRange(
    date: string,
    startDate: string,
    endDate: string
  ): boolean {
    return date >= startDate && date <= endDate;
  }

  private isPeriodDay(date: Date): boolean {
    const dateString = this.formatDateString(date);

    return this.periodHistory.some((entry) => {
      const startDate = new Date(entry.start_date + 'T00:00:00');
      const startDateString = this.formatDateString(startDate);

      // If no cycle_length, it's an ongoing period - check if date is >= start date and <= today
      if (!entry.cycle_length) {
        const today = new Date();
        const todayString = this.formatDateString(today);
        return dateString >= startDateString && dateString <= todayString;
      }

      // If has cycle_length, calculate period duration using period_length or default 5 days
      const periodDuration = entry.period_length || 5;
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + periodDuration - 1);
      const endDateString = this.formatDateString(endDate);

      return dateString >= startDateString && dateString <= endDateString;
    });
  }

  private isFertileDay(date: Date): boolean {
    // Use period stats if available for more accurate fertile window
    if (this.periodStats) {
      const fertileStart = new Date(this.periodStats.fertileWindowStart);
      const fertileEnd = new Date(this.periodStats.fertileWindowEnd);
      return date >= fertileStart && date <= fertileEnd;
    }

    // Fallback: Simple fertile window calculation (days 10-17 of cycle)
    return this.periodHistory.some((entry) => {
      const startDate = new Date(entry.start_date);
      const fertileStart = new Date(startDate);
      fertileStart.setDate(startDate.getDate() + 9); // Day 10
      const fertileEnd = new Date(startDate);
      fertileEnd.setDate(startDate.getDate() + 16); // Day 17
      return date >= fertileStart && date <= fertileEnd;
    });
  }

  private isOvulationDay(date: Date): boolean {
    // Use period stats if available for more accurate ovulation date
    if (this.periodStats) {
      const ovulationDate = new Date(this.periodStats.ovulationDate);
      return date.toDateString() === ovulationDate.toDateString();
    }

    // Fallback: Ovulation typically occurs around day 14
    return this.periodHistory.some((entry) => {
      const startDate = new Date(entry.start_date);
      const ovulationDate = new Date(startDate);
      ovulationDate.setDate(startDate.getDate() + 13); // Day 14
      return date.toDateString() === ovulationDate.toDateString();
    });
  }

  private isPredictedPeriod(date: Date): boolean {
    if (this.periodHistory.length === 0) return false;

    // Use period stats if available for more accurate prediction
    if (this.periodStats) {
      const predictedStart = new Date(this.periodStats.nextPeriodDate);
      // Predicted period duration (5 days default)
      const predictedEnd = new Date(predictedStart);
      predictedEnd.setDate(
        predictedStart.getDate() + (this.periodStats.averagePeriodLength - 1)
      );

      return date >= predictedStart && date <= predictedEnd;
    }

    // Fallback: Predict next period based on average cycle length
    const lastPeriod = this.periodHistory[0];
    const averageCycle = 28; // Default cycle length
    const lastStart = new Date(lastPeriod.start_date);
    const predictedStart = new Date(lastStart);
    predictedStart.setDate(lastStart.getDate() + averageCycle);

    // Predicted period duration (5 days)
    const predictedEnd = new Date(predictedStart);
    predictedEnd.setDate(predictedStart.getDate() + 4);

    return date >= predictedStart && date <= predictedEnd;
  }

  private getDayStatus(
    date: Date
  ): 'period' | 'fertile' | 'ovulation' | 'predicted' | 'normal' {
    if (this.isPeriodDay(date)) return 'period';
    if (this.isOvulationDay(date)) return 'ovulation';
    if (this.isFertileDay(date)) return 'fertile';
    if (this.isPredictedPeriod(date)) return 'predicted';
    return 'normal';
  }
}
