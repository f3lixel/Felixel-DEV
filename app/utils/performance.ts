// Performance monitoring utilities for Bolt.new

interface PerformanceMetrics {
  bundleLoadTime: number;
  componentsLoadTime: Record<string, number>;
  memoryUsage: MemoryInfo | null;
  networkRequests: number;
  renderTime: number;
}

class PerformanceMonitor {
  private metrics: Partial<PerformanceMetrics> = {};
  private startTimes: Map<string, number> = new Map();
  private observers: PerformanceObserver[] = [];

  constructor() {
    this.initializeObservers();
  }

  private initializeObservers() {
    if (typeof window === 'undefined') return;

    try {
      // Monitor navigation timing
      const navObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.entryType === 'navigation') {
            const navEntry = entry as PerformanceNavigationTiming;
            this.metrics.bundleLoadTime = navEntry.loadEventEnd - navEntry.navigationStart;
          }
        });
      });
      navObserver.observe({ entryTypes: ['navigation'] });
      this.observers.push(navObserver);

      // Monitor resource timing (for chunk loading)
      const resourceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const jsResources = entries.filter(entry => 
          entry.name.endsWith('.js') && entry.name.includes('assets')
        );
        
        this.metrics.networkRequests = (this.metrics.networkRequests || 0) + jsResources.length;
      });
      resourceObserver.observe({ entryTypes: ['resource'] });
      this.observers.push(resourceObserver);

      // Monitor long tasks
      const longTaskObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          console.warn(`Long task detected: ${entry.duration}ms`, entry);
        });
      });
      
      try {
        longTaskObserver.observe({ entryTypes: ['longtask'] });
        this.observers.push(longTaskObserver);
      } catch (e) {
        // longtask not supported in all browsers
      }

    } catch (error) {
      console.warn('Performance monitoring not fully supported:', error);
    }
  }

  // Track component load times
  startTimer(componentName: string) {
    this.startTimes.set(componentName, performance.now());
  }

  endTimer(componentName: string) {
    const startTime = this.startTimes.get(componentName);
    if (startTime) {
      const loadTime = performance.now() - startTime;
      if (!this.metrics.componentsLoadTime) {
        this.metrics.componentsLoadTime = {};
      }
      this.metrics.componentsLoadTime[componentName] = loadTime;
      this.startTimes.delete(componentName);
      
      // Log slow components
      if (loadTime > 100) {
        console.warn(`Slow component load: ${componentName} took ${loadTime.toFixed(2)}ms`);
      }
    }
  }

  // Get current memory usage
  getMemoryUsage(): MemoryInfo | null {
    if ('memory' in performance) {
      return (performance as any).memory;
    }
    return null;
  }

  // Measure First Contentful Paint
  getFCP(): Promise<number> {
    return new Promise((resolve) => {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const fcpEntry = entries.find(entry => entry.name === 'first-contentful-paint');
        if (fcpEntry) {
          resolve(fcpEntry.startTime);
          observer.disconnect();
        }
      });
      observer.observe({ entryTypes: ['paint'] });
    });
  }

  // Measure Largest Contentful Paint
  getLCP(): Promise<number> {
    return new Promise((resolve) => {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        resolve(lastEntry.startTime);
      });
      observer.observe({ entryTypes: ['largest-contentful-paint'] });
      
      // Fallback timeout
      setTimeout(() => {
        observer.disconnect();
        resolve(-1);
      }, 10000);
    });
  }

  // Generate performance report
  generateReport(): PerformanceMetrics & { coreWebVitals: any } {
    const memory = this.getMemoryUsage();
    
    return {
      ...this.metrics,
      memoryUsage: memory,
      renderTime: performance.now(),
      coreWebVitals: this.getCoreWebVitals(),
    } as PerformanceMetrics & { coreWebVitals: any };
  }

  private getCoreWebVitals() {
    const vitals: any = {};
    
    // Try to get web vitals if available
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      try {
        // FCP
        this.getFCP().then(fcp => vitals.fcp = fcp);
        
        // LCP  
        this.getLCP().then(lcp => vitals.lcp = lcp);
        
        // CLS (Cumulative Layout Shift)
        const clsObserver = new PerformanceObserver((list) => {
          let clsValue = 0;
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) {
              clsValue += (entry as any).value;
            }
          }
          vitals.cls = clsValue;
        });
        
        try {
          clsObserver.observe({ entryTypes: ['layout-shift'] });
        } catch (e) {
          // Not supported
        }

      } catch (error) {
        console.warn('Could not measure Core Web Vitals:', error);
      }
    }
    
    return vitals;
  }

  // Clean up observers
  destroy() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

// Utility functions for component performance tracking
export function measureComponentLoad<T>(
  componentName: string,
  asyncFunction: () => Promise<T>
): Promise<T> {
  performanceMonitor.startTimer(componentName);
  
  return asyncFunction().finally(() => {
    performanceMonitor.endTimer(componentName);
  });
}

// Higher-order component for performance tracking
export function withPerformanceTracking<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
) {
  return function PerformanceTrackedComponent(props: P) {
    React.useEffect(() => {
      performanceMonitor.startTimer(`${componentName}-render`);
      return () => {
        performanceMonitor.endTimer(`${componentName}-render`);
      };
    }, []);

    return React.createElement(Component, props);
  };
}

// Bundle analyzer helper
export function analyzeBundleLoad() {
  if (typeof window === 'undefined') return;
  
  const resourceEntries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  const jsResources = resourceEntries.filter(entry => 
    entry.name.endsWith('.js') && entry.name.includes('assets')
  );
  
  const bundleAnalysis = {
    totalResources: jsResources.length,
    totalSize: jsResources.reduce((sum, entry) => sum + (entry.transferSize || 0), 0),
    largestBundle: jsResources.reduce((largest, entry) => 
      (entry.transferSize || 0) > (largest.transferSize || 0) ? entry : largest
    ),
    loadTimes: jsResources.map(entry => ({
      name: entry.name.split('/').pop(),
      duration: entry.duration,
      size: entry.transferSize,
    })).sort((a, b) => b.duration - a.duration),
  };
  
  console.group('Bundle Analysis');
  console.log('Total JS resources:', bundleAnalysis.totalResources);
  console.log('Total transfer size:', Math.round(bundleAnalysis.totalSize / 1024), 'KB');
  console.log('Largest bundle:', bundleAnalysis.largestBundle.name.split('/').pop(), 
    Math.round((bundleAnalysis.largestBundle.transferSize || 0) / 1024), 'KB');
  console.log('Slowest loading bundles:', bundleAnalysis.loadTimes.slice(0, 5));
  console.groupEnd();
  
  return bundleAnalysis;
}

// Export performance data for monitoring
export function exportPerformanceData() {
  const report = performanceMonitor.generateReport();
  
  // In production, you might want to send this to an analytics service
  if (process.env.NODE_ENV === 'development') {
    console.group('Performance Report');
    console.log('Bundle load time:', report.bundleLoadTime, 'ms');
    console.log('Component load times:', report.componentsLoadTime);
    console.log('Memory usage:', report.memoryUsage);
    console.log('Network requests:', report.networkRequests);
    console.log('Core Web Vitals:', report.coreWebVitals);
    console.groupEnd();
  }
  
  return report;
}