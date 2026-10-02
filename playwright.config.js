const { defineConfig } = require('@playwright/test')
const fs = require('fs')
const path = require('path')

const portFile = path.join(__dirname, '.port')
const PORT = process.env.CHECKS_LOCAL_PORT || process.env.PORT ||
  (fs.existsSync(portFile) ? fs.readFileSync(portFile, 'utf8').trim() : '3000')

module.exports = defineConfig({
  testDir: './tests',
  testIgnore: ['**/unit/**', '**/contracts/**'],
  use: {
    baseURL: `http://localhost:${PORT}`,
  },
  webServer: {
    command: 'node test-server.js',
    url: `http://localhost:${PORT}`,
    env: { PORT: String(PORT) },
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } }
  ]
})
