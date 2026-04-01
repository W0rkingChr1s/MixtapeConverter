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
        localStorage:    'readonly',
        URL:             'readonly',
        URLSearchParams: 'readonly',
        FormData:        'readonly',
        DataTransfer:    'readonly',
        FileReader:      'readonly',
        File:            'readonly',
        Image:           'readonly',
        TextEncoder:     'readonly',
        Promise:         'readonly',
        console:         'readonly',
        setTimeout:      'readonly',
        btoa:            'readonly',
        // ── CDN libraries ────────────────────────────────────────────────
        Tesseract:    'readonly',
        pdfjsLib:     'readonly',
        jsmediatags:  'readonly',
      },
    },
    rules: {
      // Top-level functions are consumed via <script> tags in HTML – don't flag them
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', vars: 'local' }],
      'no-console':     'off',
      'prefer-const':   'error',
      'no-var':         'error',
      'eqeqeq':         ['error', 'always'],
    },
  },
];
