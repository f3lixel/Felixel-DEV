import type { Extension } from '@codemirror/state';

// Language cache to avoid re-importing
const languageCache = new Map<string, Promise<Extension>>();

// Common language mappings and their dynamic import functions
const languageLoaders: Record<string, () => Promise<Extension>> = {
  // Web languages (most commonly used)
  javascript: () => import('@codemirror/lang-javascript').then(m => m.javascript()),
  typescript: () => import('@codemirror/lang-javascript').then(m => m.javascript({ typescript: true })),
  jsx: () => import('@codemirror/lang-javascript').then(m => m.javascript({ jsx: true })),
  tsx: () => import('@codemirror/lang-javascript').then(m => m.javascript({ jsx: true, typescript: true })),
  html: () => import('@codemirror/lang-html').then(m => m.html()),
  css: () => import('@codemirror/lang-css').then(m => m.css()),
  scss: () => import('@codemirror/lang-sass').then(m => m.sass({ indented: false })),
  sass: () => import('@codemirror/lang-sass').then(m => m.sass({ indented: true })),
  json: () => import('@codemirror/lang-json').then(m => m.json()),
  
  // Systems languages
  python: () => import('@codemirror/lang-python').then(m => m.python()),
  cpp: () => import('@codemirror/lang-cpp').then(m => m.cpp()),
  c: () => import('@codemirror/lang-cpp').then(m => m.cpp()),
  
  // Markup languages
  markdown: () => import('@codemirror/lang-markdown').then(m => m.markdown()),
  wast: () => import('@codemirror/lang-wast').then(m => m.wast()),
  
  // Add more languages as needed, loaded on demand
  // This significantly reduces the initial bundle size
};

// File extension to language mapping
const extensionToLanguage: Record<string, string> = {
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.jsx': 'jsx',
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.sass': 'sass',
  '.json': 'json',
  '.md': 'markdown',
  '.py': 'python',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.c': 'c',
  '.h': 'c',
  '.hpp': 'cpp',
  '.wast': 'wast',
  '.wat': 'wast',
};

/**
 * Get language extension from file path
 */
export function getLanguageFromFilename(filename: string): string {
  const ext = filename.toLowerCase().match(/\.[^.]*$/)?.[0];
  return ext ? extensionToLanguage[ext] || 'text' : 'text';
}

/**
 * Dynamically load a CodeMirror language extension
 * Uses caching to avoid repeated imports of the same language
 */
export async function loadLanguage(language: string): Promise<Extension | null> {
  // Return cached language if available
  if (languageCache.has(language)) {
    return languageCache.get(language)!;
  }
  
  // Check if we have a loader for this language
  const loader = languageLoaders[language];
  if (!loader) {
    console.warn(`No language loader found for: ${language}`);
    return null;
  }
  
  // Load the language and cache the promise
  const languagePromise = loader().catch(error => {
    console.error(`Failed to load language ${language}:`, error);
    languageCache.delete(language); // Remove failed attempt from cache
    throw error;
  });
  
  languageCache.set(language, languagePromise);
  return languagePromise;
}

/**
 * Preload commonly used languages for better UX
 * Call this on app initialization or user interaction
 */
export async function preloadCommonLanguages(): Promise<void> {
  const commonLanguages = ['javascript', 'typescript', 'html', 'css', 'json'];
  
  // Start loading in parallel, but don't wait for completion
  commonLanguages.forEach(lang => {
    loadLanguage(lang).catch(() => {
      // Silently fail - languages will be loaded when needed
    });
  });
}

/**
 * Get available languages (for UI dropdowns, etc.)
 */
export function getAvailableLanguages(): string[] {
  return Object.keys(languageLoaders).sort();
}

/**
 * Check if a language is supported
 */
export function isLanguageSupported(language: string): boolean {
  return language in languageLoaders;
}