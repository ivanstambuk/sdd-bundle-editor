#!/bin/bash
#
# Restart Chrome with remote debugging for browser_subagent (WSL → Windows)
#
# Use this when:
# - browser_subagent gets stuck loading a page
# - Chrome stops responding to CDP commands
# - "page not found" or "target closed" errors from browser tools
#
# NOTE: This only kills the Chrome instance with the 'ag-cdp' user-data-dir,
#       preserving your regular Chrome browser windows.
#
# Usage: ./scripts/wsl/restart-chrome.sh
#

set -e

POWERSHELL="/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe"
CHROME_PATH="C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
USER_DATA_DIR="C:\\Temp\\ag-cdp"
DEBUG_PORT=9222

echo "🛑 Stopping Chrome debugging instance (ag-cdp profile only)..."
# Only kill Chrome processes that have 'ag-cdp' in their command line
cd /mnt/c && $POWERSHELL -Command "
    Get-Process chrome -ErrorAction SilentlyContinue | ForEach-Object {
        try {
            \$wmi = Get-CimInstance Win32_Process -Filter \"ProcessId = \$(\$_.Id)\" -ErrorAction SilentlyContinue
            if (\$wmi.CommandLine -match 'ag-cdp') {
                Stop-Process -Id \$_.Id -Force -ErrorAction SilentlyContinue
                Write-Host \"  Killed PID \$(\$_.Id)\"
            }
        } catch {}
    }
" 2>/dev/null || true

sleep 2

echo "🚀 Starting Chrome with remote debugging on port $DEBUG_PORT..."
cd /mnt/c && $POWERSHELL -Command "Start-Process -FilePath '$CHROME_PATH' -ArgumentList '--remote-debugging-port=$DEBUG_PORT','--user-data-dir=$USER_DATA_DIR','--disable-search-engine-choice-screen','--no-first-run','--no-default-browser-check','--remote-allow-origins=*'"

sleep 2

# Verify Chrome is accessible
if curl -s --max-time 5 http://localhost:$DEBUG_PORT/json/version > /dev/null 2>&1; then
    echo "✅ Chrome is running with remote debugging on port $DEBUG_PORT"
    curl -s http://localhost:$DEBUG_PORT/json/version | grep -E '"Browser"|"Protocol-Version"' || true
else
    echo "❌ Chrome may not be accessible. Check Windows firewall or try again."
    exit 1
fi
