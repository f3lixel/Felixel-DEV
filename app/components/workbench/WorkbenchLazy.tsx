import { lazy, Suspense } from 'react';
import { LoadingDots } from '~/components/ui/LoadingDots';

// Lazy load the Workbench component to reduce main bundle size
const WorkbenchComponent = lazy(() => 
  import('./Workbench.client').then(module => ({
    default: module.Workbench
  }))
);

// Lazy load the Terminal component only when needed
const Terminal = lazy(() => 
  import('./terminal/Terminal').then(module => ({
    default: module.Terminal
  }))
);

// Skeleton loader for workbench
function WorkbenchSkeleton() {
  return (
    <div className="flex h-full bg-bolt-elements-background-depth-2 border-l border-bolt-elements-borderColor">
      <div className="flex flex-col w-full">
        {/* Header skeleton */}
        <div className="flex items-center justify-between p-4 border-b border-bolt-elements-borderColor">
          <div className="h-6 w-24 bg-bolt-elements-background-depth-3 rounded animate-pulse" />
          <div className="flex gap-2">
            <div className="h-8 w-8 bg-bolt-elements-background-depth-3 rounded animate-pulse" />
            <div className="h-8 w-8 bg-bolt-elements-background-depth-3 rounded animate-pulse" />
          </div>
        </div>
        
        {/* Content skeleton */}
        <div className="flex-1 p-4 space-y-4">
          <div className="h-4 w-32 bg-bolt-elements-background-depth-3 rounded animate-pulse" />
          <div className="h-4 w-48 bg-bolt-elements-background-depth-3 rounded animate-pulse" />
          <div className="h-4 w-40 bg-bolt-elements-background-depth-3 rounded animate-pulse" />
          
          <div className="flex items-center justify-center py-8">
            <LoadingDots />
          </div>
        </div>
      </div>
    </div>
  );
}

// Terminal skeleton loader
function TerminalSkeleton() {
  return (
    <div className="h-full bg-black p-4">
      <div className="text-green-400 font-mono text-sm">
        <div className="flex items-center gap-2">
          <LoadingDots />
          <span>Loading terminal...</span>
        </div>
      </div>
    </div>
  );
}

interface WorkbenchLazyProps {
  chatStarted?: boolean;
  isStreaming?: boolean;
}

export function WorkbenchLazy({ chatStarted, isStreaming }: WorkbenchLazyProps) {
  // Don't render workbench at all until chat is started to save resources
  if (!chatStarted) {
    return null;
  }

  return (
    <Suspense fallback={<WorkbenchSkeleton />}>
      <WorkbenchComponent chatStarted={chatStarted} isStreaming={isStreaming} />
    </Suspense>
  );
}

// Export lazy terminal for use in workbench
export function LazyTerminal(props: any) {
  return (
    <Suspense fallback={<TerminalSkeleton />}>
      <Terminal {...props} />
    </Suspense>
  );
}

// Preload workbench when user starts interacting
export function preloadWorkbench() {
  // Preload the main workbench component
  import('./Workbench.client');
  
  // Preload CodeMirror core (but not all languages)
  import('../editor/codemirror/CodeMirrorEditor');
  
  // Preload common languages
  import('../editor/codemirror/language-loader').then(({ preloadCommonLanguages }) => {
    preloadCommonLanguages();
  });
}

// Preload terminal when workbench is loaded
export function preloadTerminal() {
  import('./terminal/Terminal');
  // Preload XTerm dependencies
  import('@xterm/xterm');
  import('@xterm/addon-fit');
  import('@xterm/addon-web-links');
}