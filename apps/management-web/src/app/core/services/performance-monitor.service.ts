import { Injectable, OnDestroy } from '@angular/core';
import { environment } from '../../environments/environment';
import { LoggerService } from './logger.service';

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  url?: string;
  sessionId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PerformanceMonitorService implements OnDestroy {
  private metrics: PerformanceMetric[] = [];
  private observers: PerformanceObserver[] = [];
  private sessionId: string;
  private isInitialized = false;

  constructor(private logger: LoggerService) {
    this.sessionId = this.generateSessionId();
    
    if (typeof window !== 'undefined' && environment.production) {
      this.initializePerformanceObserver();
    }
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  /**
   * Track custom performance metrics
   */
  trackMetric(name: string, value: number): void {
    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      url: typeof window !== 'undefined' ? window.location.href : '',
      sessionId: this.sessionId
    };

    this.metrics.push(metric);
    
    // Limit metrics array size to prevent memory issues
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-500);
    }
    
    if (environment.production) {
      this.sendMetric(metric);
    } else {
      this.logger.debug('Performance metric tracked', metric);
    }
  }

  /**
   * Track page load performance
   */
  trackPageLoad(): void {
    if (typeof window !== 'undefined' && 'performance' in window) {
      try {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        
        if (navigation) {
          // Use correct properties for PerformanceNavigationTiming
          this.trackMetric('page_load_time', navigation.loadEventEnd - navigation.fetchStart);
          this.trackMetric('dom_content_loaded', navigation.domContentLoadedEventEnd - navigation.fetchStart);
          this.trackMetric('first_paint', this.getFirstPaint());
          this.trackMetric('dom_interactive', navigation.domInteractive - navigation.fetchStart);
          this.trackMetric('dom_complete', navigation.domComplete - navigation.fetchStart);
          
          this.logger.debug('Page load metrics tracked successfully');
        }
      } catch (error) {
        this.logger.error('Failed to track page load performance', error);
      }
    }
  }

  /**
   * Track Angular component render time
   */
  trackComponentRender(componentName: string, startTime: number): void {
    const renderTime = performance.now() - startTime;
    this.trackMetric(`component_render_${componentName}`, renderTime);
  }

  /**
   * Track API response times
   */
  trackApiCall(endpoint: string, duration: number, status: number): void {
    this.trackMetric(`api_call_${endpoint}`, duration);
    this.trackMetric(`api_status_${status}`, 1);
  }

  private initializePerformanceObserver(): void {
    if ('PerformanceObserver' in window && !this.isInitialized) {
      try {
        // Monitor Largest Contentful Paint
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          this.trackMetric('largest_contentful_paint', lastEntry.startTime);
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
        this.observers.push(lcpObserver);

        // Monitor First Input Delay
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            this.trackMetric('first_input_delay', entry.processingStart - entry.startTime);
          });
        });
        fidObserver.observe({ entryTypes: ['first-input'] });
        this.observers.push(fidObserver);

        // Monitor Cumulative Layout Shift
        const clsObserver = new PerformanceObserver((list) => {
          let clsValue = 0;
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              clsValue += (entry as any).value;
            }
          }
          this.trackMetric('cumulative_layout_shift', clsValue);
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });
        this.observers.push(clsObserver);

        this.isInitialized = true;
        this.logger.debug('Performance observers initialized successfully');
      } catch (error) {
        this.logger.error('Failed to initialize performance observers', error);
      }
    }
  }

  private getFirstPaint(): number {
    try {
      const paintEntries = performance.getEntriesByType('paint');
      const firstPaint = paintEntries.find(entry => entry.name === 'first-paint');
      return firstPaint ? firstPaint.startTime : 0;
    } catch (error) {
      this.logger.error('Failed to get first paint metric', error);
      return 0;
    }
  }

  private sendMetric(metric: PerformanceMetric): void {
    try {
      // Send to analytics service using beacon API for reliability
      if ('sendBeacon' in navigator) {
        const data = JSON.stringify(metric);
        navigator.sendBeacon('/api/analytics/performance', data);
      }
      // TODO: Add fallback for other analytics services (Google Analytics, etc.)
    } catch (error) {
      this.logger.error('Failed to send performance metric', error);
    }
  }

  private generateSessionId(): string {
    const array = new Uint32Array(2);
    window.crypto.getRandomValues(array);
    return 'session_' + array[0].toString(36) + array[1].toString(36) + Date.now().toString(36);
  }

  private cleanup(): void {
    // Disconnect all performance observers
    this.observers.forEach(observer => {
      try {
        observer.disconnect();
      } catch (error) {
        this.logger.error('Failed to disconnect performance observer', error);
      }
    });
    this.observers = [];
    this.isInitialized = false;
    this.logger.debug('Performance monitor cleanup completed');
  }

  /**
   * Get all collected metrics
   */
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  /**
   * Get metrics by name pattern
   */
  getMetricsByPattern(pattern: string): PerformanceMetric[] {
    return this.metrics.filter(metric => metric.name.includes(pattern));
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): any {
    const summary = {
      totalMetrics: this.metrics.length,
      sessionId: this.sessionId,
      averagePageLoadTime: 0,
      averageApiResponseTime: 0,
      coreWebVitals: {
        lcp: 0,
        fid: 0,
        cls: 0
      }
    };

    const pageLoadMetrics = this.getMetricsByPattern('page_load_time');
    if (pageLoadMetrics.length > 0) {
      summary.averagePageLoadTime = pageLoadMetrics.reduce((sum, m) => sum + m.value, 0) / pageLoadMetrics.length;
    }

    const apiMetrics = this.getMetricsByPattern('api_call_');
    if (apiMetrics.length > 0) {
      summary.averageApiResponseTime = apiMetrics.reduce((sum, m) => sum + m.value, 0) / apiMetrics.length;
    }

    // Get latest Core Web Vitals
    const lcpMetrics = this.getMetricsByPattern('largest_contentful_paint');
    if (lcpMetrics.length > 0) {
      summary.coreWebVitals.lcp = lcpMetrics[lcpMetrics.length - 1].value;
    }

    const fidMetrics = this.getMetricsByPattern('first_input_delay');
    if (fidMetrics.length > 0) {
      summary.coreWebVitals.fid = fidMetrics[fidMetrics.length - 1].value;
    }

    const clsMetrics = this.getMetricsByPattern('cumulative_layout_shift');
    if (clsMetrics.length > 0) {
      summary.coreWebVitals.cls = clsMetrics[clsMetrics.length - 1].value;
    }

    return summary;
  }

  /**
   * Clear collected metrics
   */
  clearMetrics(): void {
    this.metrics = [];
    this.logger.debug('Performance metrics cleared');
  }
}
