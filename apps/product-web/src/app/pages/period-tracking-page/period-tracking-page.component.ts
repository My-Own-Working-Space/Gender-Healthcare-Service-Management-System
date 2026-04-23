
import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { PeriodTrackingService } from '../../services/period-tracking.service';
import {
  CalendarDay,
  PeriodEntry,
  PeriodStats,
  PeriodTrackingRequest,
  PeriodFormValidation,
  PeriodFormState,
  PERIOD_SYMPTOMS,
  FLOW_INTENSITIES,
  PeriodSymptom,
  getSymptomDisplayName,
  validatePeriodForm,
  createEmptyPeriodForm,
  isFormDirty,
  sanitizePeriodForm,
} from '../../models/period-tracking.model';
import { HeaderComponent } from '../../components/header/header.component';
import { FooterComponent } from '../../components/footer/footer.component';



@Component({
  selector: 'app-period-tracking',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    HeaderComponent,
    FooterComponent,
  ],
  templateUrl: './period-tracking-page.component.html',
  styleUrl: './period-tracking-page.component.css',
})
export class PeriodTrackingComponent implements OnInit {

  private periodService: PeriodTrackingService = inject(PeriodTrackingService);
  private translate = inject(TranslateService);


  isLoading = signal(false);
  error = signal<string | null>(null);
  showLogModal = signal(false);
  showLogForm = signal(false);
  showStatsModal = signal(false);
  showCalendar = signal(false);
  showMiniCalendar = signal(false);
  showSuccessModal = signal(false);
  successPredictions = signal<any>(null);



  activeTab = signal<'overview' | 'insights' | 'history'>(
    'overview'
  );


  periodHistory = signal<PeriodEntry[]>([]);
  periodStats = signal<PeriodStats | null>(null);
  calendarDays = signal<CalendarDay[]>([]);
  currentMonth = signal(new Date());


  logForm: PeriodTrackingRequest = createEmptyPeriodForm();
  originalForm: PeriodTrackingRequest = createEmptyPeriodForm();
  formValidation = signal<PeriodFormValidation>({ isValid: true, errors: {} });
  formState = signal<PeriodFormState>({
    isSubmitting: false,
    isDirty: false,
    validation: { isValid: true, errors: {} },
  });

  // =========== CONSTANTS ===========
  readonly symptoms = PERIOD_SYMPTOMS;
  readonly flowIntensities = FLOW_INTENSITIES;
  readonly PERIOD_SYMPTOMS = PERIOD_SYMPTOMS;
  readonly FLOW_INTENSITIES = FLOW_INTENSITIES;

  // =========== UTILITY METHODS ===========
  getSymptomDisplayName = getSymptomDisplayName;

  getTodayDateString(): string {
    return new Date().toISOString().split('T')[0];
  }

  // Set default date when opening form
  openLogForm(): void {
    // Reset form and set default start_date to today
    this.resetForm();
    this.logForm.start_date = this.getTodayDateString();
    this.showLogForm.set(true);
  }

  // Get max date for date inputs (today)
  getMaxDate(): string {
    return this.getTodayDateString();
  }

  // Validate cycle length
  validateCycleLength(): boolean {
    if (!this.logForm.cycle_length) return true; // Cycle length is optional

    return this.logForm.cycle_length >= 21 && this.logForm.cycle_length <= 35;
  }

  // Calculate predictions after logging period
  calculatePredictions(newPeriod: any): void {
    const history = this.periodHistory();

    // Use default 28-day cycle for first period, or calculated average
    let averageCycle = 28;
    let periodLength = 5;

    if (history.length > 0) {
      // Calculate from existing data
      averageCycle = this.averageCycleLength;
      periodLength = this.getPeriodLength();
    } else {
      // First period - use defaults but calculate period length if end_date provided
      if (newPeriod.end_date) {
        const start = new Date(newPeriod.start_date);
        const end = new Date(newPeriod.end_date);
        periodLength =
          Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) +
          1;
      }
    }

    // Calculate next period date
    const lastPeriodStart = new Date(newPeriod.start_date);
    const nextPeriodDate = new Date(lastPeriodStart);
    nextPeriodDate.setDate(nextPeriodDate.getDate() + averageCycle);

    // Calculate fertile window (typically 14 days before next period)
    const ovulationDate = new Date(nextPeriodDate);
    ovulationDate.setDate(ovulationDate.getDate() - 14);

    const fertileStart = new Date(ovulationDate);
    fertileStart.setDate(fertileStart.getDate() - 5);

    const fertileEnd = new Date(ovulationDate);
    fertileEnd.setDate(fertileEnd.getDate() + 1);

    // Calculate days until next period
    const today = new Date();
    const daysUntil = Math.ceil(
      (nextPeriodDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    const predictions = {
      nextPeriodDate: this.formatDate(
        nextPeriodDate.toISOString().split('T')[0]
      ),
      daysUntilNextPeriod: Math.max(0, daysUntil),
      averageCycleLength: averageCycle,
      periodLength: periodLength,
      ovulationDate: this.formatDate(ovulationDate.toISOString().split('T')[0]),
      fertileWindow: {
        start: this.formatDate(fertileStart.toISOString().split('T')[0]),
        end: this.formatDate(fertileEnd.toISOString().split('T')[0]),
      },
      totalCyclesTracked: history.length + 1,
      isFirstPeriod: history.length === 0,
    };

    this.successPredictions.set(predictions);
  }

  // =========== LIFECYCLE ===========
  ngOnInit(): void {
    console.log('🌸 PeriodTrackingComponent initialized with Pink Pastel Theme');
    this.loadPeriodData();
    this.generateCalendar();
  }



  // =========== DATA LOADING ===========
  private loadPeriodData(): void {
    console.log('🔄 COMPONENT: Loading period data from DATABASE...');
    this.isLoading.set(true);
    this.error.set(null);

    // Load period history from database only
    this.periodService.getPeriodHistory().subscribe({
      next: (history) => {
        console.log('✅ COMPONENT: Period history loaded from database:', history);
        this.periodHistory.set(history);
        this.generateCalendar();

        // Load period stats from database after history is loaded
        this.periodService.getPeriodStats().subscribe({
          next: (stats) => {
            console.log('✅ COMPONENT: Period stats loaded from database:', stats);
            this.periodStats.set(stats);
            this.isLoading.set(false);
          },
          error: (statsError) => {
            console.error('❌ COMPONENT: Failed to load period stats from database:', statsError);
            this.error.set('Failed to load period statistics from database');
            this.isLoading.set(false);
          },
        });
      },
      error: (historyError) => {
        console.error('❌ COMPONENT: Failed to load period history from database:', historyError);
        this.error.set('Failed to load period history from database');
        this.isLoading.set(false);
      },
    });
  }

  // =========== CALENDAR GENERATION ===========
  private generateCalendar(): void {
    const currentMonth = this.currentMonth();
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days: CalendarDay[] = [];
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
      };

      days.push(day);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    this.calendarDays.set(days);
  }

  // =========== CALENDAR HELPER METHODS ===========
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

  private isPeriodDay(date: Date): boolean {
    const history = this.periodHistory();
    return history.some((entry) => {
      const startDate = new Date(entry.start_date + 'T00:00:00');

      // If no cycle_length, it's an ongoing period - check if date is >= start date and <= today
      if (!entry.cycle_length) {
        const today = new Date();
        today.setHours(23, 59, 59, 999); // End of today
        return date >= startDate && date <= today;
      }

      // If has cycle_length, calculate period duration using period_length or default 5 days
      const periodDuration = entry.period_length || 5; // Use actual period length or default
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + periodDuration - 1);
      return date >= startDate && date <= endDate;
    });
  }

  private isFertileDay(date: Date): boolean {
    const stats = this.periodStats();
    if (!stats) {
      // Fallback: Simple fertile window calculation (days 10-17 of cycle)
      const history = this.periodHistory();
      return history.some((entry) => {
        const startDate = new Date(entry.start_date);
        const fertileStart = new Date(startDate);
        fertileStart.setDate(startDate.getDate() + 9); // Day 10
        const fertileEnd = new Date(startDate);
        fertileEnd.setDate(startDate.getDate() + 16); // Day 17
        return date >= fertileStart && date <= fertileEnd;
      });
    }

    const fertileStart = new Date(stats.fertileWindowStart);
    const fertileEnd = new Date(stats.fertileWindowEnd);
    return date >= fertileStart && date <= fertileEnd;
  }

  private isOvulationDay(date: Date): boolean {
    const stats = this.periodStats();
    if (!stats) {
      // Fallback: Ovulation typically occurs around day 14
      const history = this.periodHistory();
      return history.some((entry) => {
        const startDate = new Date(entry.start_date);
        const ovulationDate = new Date(startDate);
        ovulationDate.setDate(startDate.getDate() + 13); // Day 14
        return date.toDateString() === ovulationDate.toDateString();
      });
    }

    const ovulationDate = new Date(stats.ovulationDate);
    return date.toDateString() === ovulationDate.toDateString();
  }

  private isPredictedPeriod(date: Date): boolean {
    const stats = this.periodStats();
    const history = this.periodHistory();

    if (history.length === 0) return false;

    if (stats) {
      // Use period stats for more accurate prediction
      const nextPeriod = new Date(stats.nextPeriodDate);
      const predictedEnd = new Date(nextPeriod);
      predictedEnd.setDate(
        predictedEnd.getDate() + (stats.averagePeriodLength - 1)
      );

      return date >= nextPeriod && date <= predictedEnd;
    }

    // Fallback: Simple prediction based on last period + 28 days
    const lastPeriod = history[0];
    const lastStart = new Date(lastPeriod.start_date);
    const predictedStart = new Date(lastStart);
    predictedStart.setDate(lastStart.getDate() + 28);

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

  // =========== NAVIGATION ===========
  previousMonth(): void {
    const current = this.currentMonth();
    const previous = new Date(current.getFullYear(), current.getMonth() - 1, 1);
    this.currentMonth.set(previous);
    this.generateCalendar();
  }

  nextMonth(): void {
    const current = this.currentMonth();
    const next = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    this.currentMonth.set(next);
    this.generateCalendar();
  }

  // =========== MODAL CONTROLS ===========
  toggleLogForm(): void {
    this.showLogForm.set(!this.showLogForm());
    if (this.showLogForm()) {
      this.logForm.start_date = new Date().toISOString().split('T')[0];
    } else {
      this.resetForm();
    }
  }

  toggleMiniCalendar(): void {
    this.showMiniCalendar.set(!this.showMiniCalendar());
  }

  // =========== FORM HANDLING ===========
  toggleSymptom(symptom: PeriodSymptom): void {
    const symptoms = this.logForm.symptoms || [];
    const index = symptoms.indexOf(symptom);

    if (index > -1) {
      symptoms.splice(index, 1);
    } else {
      symptoms.push(symptom);
    }

    this.logForm.symptoms = [...symptoms];
    this.validateForm();
  }

  validateForm(): void {
    const validation = validatePeriodForm(this.logForm);
    this.formValidation.set(validation);

    const isDirty = isFormDirty(this.logForm, this.originalForm);
    this.formState.update((state) => ({
      ...state,
      isDirty,
      validation,
    }));
  }

  onFormFieldChange(): void {
    this.validateForm();
  }

  isSymptomSelected(symptom: PeriodSymptom): boolean {
    return this.logForm.symptoms?.includes(symptom) || false;
  }

  resetForm(): void {
    this.logForm = createEmptyPeriodForm();
    this.originalForm = createEmptyPeriodForm();
    this.formValidation.set({ isValid: true, errors: {} });
    this.formState.set({
      isSubmitting: false,
      isDirty: false,
      validation: { isValid: true, errors: {} },
    });
  }

  // =========== TAB METHODS ===========
  switchTab(tab: 'overview' | 'insights' | 'history'): void {
    this.activeTab.set(tab);
  }

  changeMonth(offset: number): void {
    const nextMonth = new Date(this.currentMonth());
    nextMonth.setMonth(nextMonth.getMonth() + offset);
    this.currentMonth.set(nextMonth);
    this.generateCalendar();
  }

  onDateClick(date: Date): void {
    // If date is in history, maybe show details. If empty, open log form.
    this.logForm.start_date = date.toISOString().split('T')[0];
    this.openLogForm();
  }

  deletePeriodEntry(id: string): void {
    if (confirm('Are you sure you want to delete this record?')) {
      this.periodService.deletePeriodEntry(id).subscribe({
        next: () => {
          this.loadPeriodData();
          this.showSuccessModal.set(true);
        }
      });
    }
  }

  // =========== FORM SUBMISSION ===========
  submitPeriodLog(): void {
    if (!this.logForm.start_date) {
      this.error.set(
        this.translate.instant('PERIOD.ERRORS.START_DATE_REQUIRED')
      );
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    this.periodService.logPeriodData(this.logForm).subscribe({
      next: (response) => {
        console.log('Period logged successfully:', response);
        this.toggleLogForm();
        this.loadPeriodData();

        const successMsg = this.translate.instant('PERIOD.SUCCESS.LOGGED');
        alert(successMsg);
      },
      error: (err) => {
        console.error('Error logging period:', err);
        this.error.set(this.translate.instant('PERIOD.ERRORS.LOG_FAILED'));
        this.isLoading.set(false);
      },
    });
  }

  // =========== FORM HELPER METHODS ===========
  setTodayAsStart(): void {
    const today = new Date();
    this.logForm.start_date = today.toISOString().split('T')[0];
  }

  setYesterdayAsStart(): void {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    this.logForm.start_date = yesterday.toISOString().split('T')[0];
  }

  isToday(dateString: string): boolean {
    if (!dateString) return false;
    const today = new Date().toISOString().split('T')[0];
    return dateString === today;
  }

  isYesterday(dateString: string): boolean {
    if (!dateString) return false;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return dateString === this.formatDateString(yesterday);
  }

  getFlowIntensityLabel(intensity: string): string {
    return this.translate.instant(`PERIOD.FLOW.${intensity.toUpperCase()}`);
  }

  getSymptomLabel(symptom: string): string {
    return this.translate.instant(`PERIOD.SYMPTOMS.${symptom.toUpperCase()}`);
  }

  // =========== CALENDAR METHODS ===========
  getMonthYearDisplay(): string {
    const current = this.currentMonth();
    return current.toLocaleDateString('en-GB', {
      month: 'long',
      year: 'numeric',
    });
  }

  onCalendarDayClick(day: CalendarDay): void {
    if (day.isCurrentMonth) {
      this.quickLogForDate(day.dateString);
    }
  }

  onMonthChanged(newMonth: Date): void {
    this.currentMonth.set(newMonth);
    this.generateCalendar();
  }

  // =========== INSIGHTS METHODS ===========
  getMinCycleLength(): number {
    const history = this.periodHistory();
    if (history.length < 2) return 28;

    const cycleLengths = this.calculateCycleLengths(history);
    return cycleLengths.length > 0 ? Math.min(...cycleLengths) : 28;
  }

  getMaxCycleLength(): number {
    const history = this.periodHistory();
    if (history.length < 2) return 28;

    const cycleLengths = this.calculateCycleLengths(history);
    return cycleLengths.length > 0 ? Math.max(...cycleLengths) : 28;
  }

  getTopSymptoms(): Array<{ name: string; frequency: number }> {
    const history = this.periodHistory();
    const symptomCounts: { [key: string]: number } = {};

    history.forEach((period) => {
      if (period.symptoms) {
        period.symptoms.forEach((symptom) => {
          symptomCounts[symptom] = (symptomCounts[symptom] || 0) + 1;
        });
      }
    });

    const totalPeriods = history.length;
    return Object.entries(symptomCounts)
      .map(([name, count]) => ({
        name: getSymptomDisplayName(name as PeriodSymptom),
        frequency: Math.round((count / totalPeriods) * 100),
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 3);
  }

  getPeriodDuration(period: PeriodEntry): number {
    if (!period.cycle_length) {
      // For ongoing periods, calculate days since start
      const start = new Date(period.start_date);
      const today = new Date();
      const diffTime = today.getTime() - start.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(1, diffDays);
    }

    // For completed periods, use actual period_length or default 5 days
    return period.period_length || 5;
  }

  private calculateCycleLengths(history: PeriodEntry[]): number[] {
    const cycleLengths: number[] = [];

    for (let i = 1; i < history.length; i++) {
      const current = new Date(history[i].start_date);
      const previous = new Date(history[i - 1].start_date);
      const diffTime = current.getTime() - previous.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays > 0 && diffDays < 60) {
        // Reasonable cycle length
        cycleLengths.push(diffDays);
      }
    }

    return cycleLengths;
  }

  getCalendarDayClasses(day: CalendarDay): string {
    let classes = 'w-full h-full ';

    if (!day.isCurrentMonth) {
      classes += 'text-gray-300 bg-gray-50 ';
    } else {
      classes += 'text-gray-700 ';
    }

    if (day.isToday) {
      classes += 'ring-2 ring-blue-500 ring-inset ';
    }

    if (day.isPeriodDay) {
      classes += 'bg-red-500 text-white hover:bg-red-600 ';
    } else if (day.isFertileDay) {
      classes += 'bg-green-500 text-white hover:bg-green-600 ';
    } else if (day.isOvulationDay) {
      classes += 'bg-yellow-500 text-white hover:bg-yellow-600 ';
    } else if (day.isPredictedPeriod) {
      classes +=
        'bg-pink-200 text-pink-800 border-2 border-pink-500 border-dashed hover:bg-pink-300 ';
    } else {
      classes += 'bg-white hover:bg-gray-100 ';
    }

    return classes.trim();
  }

  private quickLogForDate(dateString: string): void {
    this.logForm.start_date = dateString;
    this.showLogForm.set(true);
  }

  /**
   * Get ongoing period information for display
   */
  getOngoingPeriodInfo(): {
    isOngoing: boolean;
    dayCount: number;
    startDate: string;
  } | null {
    try {
      const ongoingPeriod = this.periodService.getCurrentOngoingPeriod();
      if (!ongoingPeriod) {
        return null;
      }

      const dayCount = this.periodService.getDaysSincePeriodStarted();
      return {
        isOngoing: true,
        dayCount,
        startDate: ongoingPeriod.start_date,
      };
    } catch (error) {
      console.error('Error getting ongoing period info:', error);
      return null;
    }
  }

  /**
   * Edit the current ongoing period
   */
  editCurrentPeriod(): void {
    const ongoingPeriod = this.periodService.getCurrentOngoingPeriod();
    if (!ongoingPeriod) {
      this.error.set('No ongoing period found to edit.');
      return;
    }

    // Pre-fill the form with the current period data
    this.logForm = {
      patient_id: ongoingPeriod.patient_id,
      start_date: ongoingPeriod.start_date,
      cycle_length: ongoingPeriod.cycle_length || 28,
      period_length: ongoingPeriod.period_length || 5,
      flow_intensity: ongoingPeriod.flow_intensity || 'medium',
      symptoms: ongoingPeriod.symptoms || [],
      period_description: ongoingPeriod.period_description || '',
    };

    // Show the form
    this.showLogForm.set(true);

    // Scroll to the form
    setTimeout(() => {
      const formElement = document.querySelector('.period-log-form');
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);

    // Show success message
    alert(
      'Period data loaded for editing. You can now update the details or add an end date.'
    );
  }

  // =========== DATE FORMATTING ===========
  formatDate(dateString?: string): string {
    if (!dateString) return '';

    try {
      const date = new Date(dateString);
      // Use a clearer format: "28 Aug 2024" instead of "28/08/2024"
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateString;
    }
  }

  // Debug method to show raw date values
  formatDateWithRaw(dateString?: string): string {
    if (!dateString) return '';

    try {
      const date = new Date(dateString);
      const formatted = date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      // Show both formatted and raw for debugging
      return `${formatted} (${dateString})`;
    } catch {
      return dateString;
    }
  }

  // =========== COMPUTED PROPERTIES ===========
  get currentCycleDay(): number {
    const stats = this.periodStats();
    return stats?.currentCycleDay || 1;
  }

  get daysUntilNextPeriod(): number {
    const stats = this.periodStats();
    return stats?.daysUntilNextPeriod || 0;
  }

  get averageCycleLength(): number {
    const stats = this.periodStats();
    return stats?.averageCycleLength || 28;
  }

  getNextPeriodDate(): string {
    const stats = this.periodStats();
    return this.formatDate(stats?.nextPeriodDate);
  }

  getPeriodLength(): number {
    // Calculate average period length from history or return default
    const history = this.periodHistory();
    if (history.length === 0) return 5;

    const lengths = history
      .filter((entry) => entry.period_length) // Only entries with period_length
      .map((entry) => entry.period_length!);

    return lengths.length > 0
      ? Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length)
      : 5;
  }

  getStreakDays(): number {
    // Calculate consecutive tracking days
    const history = this.periodHistory();
    return history.length;
  }

  savePeriodData(): void {
    // Validate form before submission
    const validation = validatePeriodForm(this.logForm);
    this.formValidation.set(validation);

    if (!validation.isValid) {
      // Show first error message
      const firstError = Object.values(validation.errors)[0];
      if (firstError) {
        alert(firstError);
      }
      return;
    }

    // Sanitize form data
    const sanitizedForm = sanitizePeriodForm(this.logForm);

    this.formState.update((state) => ({ ...state, isSubmitting: true }));
    this.isLoading.set(true);

    // Use the period service to save data to DATABASE
    console.log('🚀 COMPONENT: Submitting period data to database:', sanitizedForm);
    this.periodService.logPeriodData(sanitizedForm).subscribe({
      next: (response) => {
        console.log('✅ COMPONENT: Period data saved to database successfully:', response);
        this.isLoading.set(false);
        this.formState.update((state) => ({ ...state, isSubmitting: false }));
        this.showLogForm.set(false);
        this.resetForm();

        // Reload data first from database
        this.loadPeriodData();

        // Calculate and show predictions
        this.calculatePredictions(sanitizedForm);

        // Show success modal with predictions
        this.showSuccessModal.set(true);
      },
      error: (error) => {
        console.error('❌ COMPONENT: Failed to save period data to database:', error);
        this.isLoading.set(false);
        this.formState.update((state) => ({ ...state, isSubmitting: false }));

        const errorMsg = `Failed to save to database: ${error.message || 'Unknown error'}`;
        alert(errorMsg);
      },
    });
  }
}
