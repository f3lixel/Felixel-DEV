import { cloudflareDevProxyVitePlugin as remixCloudflareDevProxy, vitePlugin as remixVitePlugin } from '@remix-run/dev';
import UnoCSS from 'unocss/vite';
import { defineConfig, type ViteDevServer } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { optimizeCssModules } from 'vite-plugin-optimize-css-modules';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig((config) => {
  return {
    build: {
      target: 'esnext',
      // Performance optimizations
      rollupOptions: {
        output: {
          // Manual chunks for better caching and loading patterns
          manualChunks: {
            // Core vendor chunks
            'vendor-react': ['react', 'react-dom'],
            'vendor-remix': ['@remix-run/react', '@remix-run/cloudflare'],
            
            // UI library chunks  
            'vendor-ui': ['framer-motion', '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', 'react-toastify'],
            'vendor-editor-core': ['@codemirror/state', '@codemirror/view', '@codemirror/commands', '@codemirror/autocomplete'],
            
            // Terminal and workbench (lazy loaded)
            'terminal': ['@xterm/xterm', '@xterm/addon-fit', '@xterm/addon-web-links'],
            'webcontainer': ['@webcontainer/api'],
            
            // Language support chunks (will be further optimized with dynamic imports)
            'lang-web': ['@codemirror/lang-html', '@codemirror/lang-css', '@codemirror/lang-javascript'],
            'lang-systems': ['@codemirror/lang-python', '@codemirror/lang-cpp'],
            'lang-markup': ['@codemirror/lang-markdown', '@codemirror/lang-json'],
            
            // Syntax highlighting (heavy chunk)
            'syntax-highlighting': ['shiki'],
            
            // Utility libraries
            'utils': ['nanostores', '@nanostores/react', 'date-fns', 'diff'],
          },
          // Better chunk naming for debugging
          chunkFileNames: (chunkInfo) => {
            const name = chunkInfo.name;
            return `[name]-[hash].js`;
          },
        },
      },
      // Increase chunk size warning limit since we're optimizing manually
      chunkSizeWarningLimit: 1000,
      // Better source maps for production debugging
      sourcemap: config.mode === 'development',
    },
    plugins: [
      nodePolyfills({
        include: ['path', 'buffer'],
      }),
      config.mode !== 'test' && remixCloudflareDevProxy(),
      remixVitePlugin({
        future: {
          v3_fetcherPersist: true,
          v3_relativeSplatPath: true,
          v3_throwAbortReason: true,
          // Enable performance-oriented future flags
          v3_lazyRouteDiscovery: true,
          v3_singleFetch: true,
        },
      }),
      UnoCSS(),
      tsconfigPaths(),
      chrome129IssuePlugin(),
      config.mode === 'production' && optimizeCssModules({ apply: 'build' }),
    ],
    // Optimization hints
    optimizeDeps: {
      // Pre-bundle these for faster dev startup
      include: [
        'react',
        'react-dom',
        '@remix-run/react',
        'nanostores',
        '@nanostores/react',
      ],
      // Exclude large libraries that should be lazy loaded
      exclude: [
        '@webcontainer/api',
        '@xterm/xterm',
        'shiki',
      ],
    },
    // Better tree-shaking
    esbuild: {
      treeShaking: true,
      // Remove console.log in production
      drop: config.mode === 'production' ? ['console', 'debugger'] : [],
    },
  };
});

function chrome129IssuePlugin() {
  return {
    name: 'chrome129IssuePlugin',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        const raw = req.headers['user-agent']?.match(/Chrom(e|ium)\/([0-9]+)\./);

        if (raw) {
          const version = parseInt(raw[2], 10);

          if (version === 129) {
            res.setHeader('content-type', 'text/html');
            res.end(
              '<body><h1>Please use Chrome Canary for testing.</h1><p>Chrome 129 has an issue with JavaScript modules & Vite local development, see <a href="https://github.com/stackblitz/bolt.new/issues/86#issuecomment-2395519258">for more information.</a></p><p><b>Note:</b> This only impacts <u>local development</u>. `pnpm run build` and `pnpm run start` will work fine in this browser.</p></body>',
            );

            return;
          }
        }

        next();
      });
    },
  };
}
