import js from '@eslint/js';

/** @type {import("eslint").Linter.Config[]} */
export default [
  js.configs.recommended,
  {
    files: ['js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        // ── Browser built-ins ────────────────────────────────────────────
        window:          'readonly',
        document:        'readonly',
        fetch:           'readonly',
        crypto:          'readonly',
        sessionStorage:  'readonly',
        URL:             'readonly',
        URLSearchParams: 'readonly',
        FormData:        'readonly',
        DataTransfer:    'readonly',
        FileReader:      'readonly',
        TextEncoder:     'readonly',
        Promise:         'readonly',
        console:         'readonly',
        setTimeout:      'readonly',
        // ── App globals (loaded via <script> tags before each module) ────
        CONFIG:          'readonly',
        State:           'readonly',
        BASE_PATH:       'readonly',
        // ── CDN libraries ────────────────────────────────────────────────
        Tesseract:       'readonly',
        pdfjsLib:        'readonly',
        jsmediatags:     'readonly',
        // ── Cross-file functions (spotify.js) ────────────────────────────
        startSpotifyLogin:      'readonly',
        handleSpotifyCallback:  'readonly',
        isAuthenticated:        'readonly',
        requireAuth:            'readonly',
        createSpotifyPlaylist:  'readonly',
        // ── Cross-file functions (ocr.js) ─────────────────────────────────
        ocrImage:       'readonly',
        ocrPdf:         'readonly',
        parseTrackList: 'readonly',
        // ── Cross-file functions (audio.js) ──────────────────────────────
        readTracksFromFiles: 'readonly',
      },
    },
    rules: {
      'no-unused-vars':    ['warn', { argsIgnorePattern: '^_' }],
      'no-console':        'off',
      'prefer-const':      'error',
      'no-var':            'error',
      'eqeqeq':            ['error', 'always'],
      'no-trailing-spaces': 'off',
    },
  },
];
