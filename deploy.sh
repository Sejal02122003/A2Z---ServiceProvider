#!/usr/bin/env bash

# ==============================================================================
# Auto-Deployment Script for A2Z Service Provider (Multi-Project Safe)
# Usage: ./deploy.sh [branch_name]
# ==============================================================================

set -e # Stop on first error

# --- Configuration Variables ---
BRANCH="${1:-main}"                 # Git branch (default: main)
PM2_APP_NAME="a2z-api"              # Exactly matches your PM2 process
BACKEND_DIR="backend"               # Backend directory relative to script root
FRONTEND_DIR="frontend"             # Frontend directory relative to script root
RELOAD_NGINX=true                   # Safe reload of Nginx

# --- Colors ---
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[A2Z-DEPLOY] [INFO] $(date '+%H:%M:%S') - $1${NC}"; }
log_success() { echo -e "${GREEN}[A2Z-DEPLOY] [SUCCESS] $(date '+%H:%M:%S') - $1${NC}"; }
log_warn()    { echo -e "${YELLOW}[A2Z-DEPLOY] [WARN] $(date '+%H:%M:%S') - $1${NC}"; }
log_error()   { echo -e "${RED}[A2Z-DEPLOY] [ERROR] $(date '+%H:%M:%S') - $1${NC}"; }

# Navigate to script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

log_info "🚀 Starting A2Z update on branch: $BRANCH..."

# 1. Pull Latest Git Changes for A2Z
log_info "Pulling latest changes from Git..."
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull origin "$BRANCH"
log_success "Git pull complete."

# 2. Update Backend & Reload ONLY a2z-api
if [ -d "$BACKEND_DIR" ]; then
    log_info "Updating Backend..."
    cd "$BACKEND_DIR"
    
    npm install --omit=dev --legacy-peer-deps || npm install --legacy-peer-deps
    
    # Reload only a2z-api without affecting zapoo processes
    if pm2 list | grep -q "$PM2_APP_NAME"; then
        pm2 reload "$PM2_APP_NAME"
        log_success "PM2 process '$PM2_APP_NAME' reloaded without downtime."
    else
        pm2 start src/server.js --name "$PM2_APP_NAME"
        pm2 save
        log_success "PM2 process '$PM2_APP_NAME' started."
    fi
    
    cd "$SCRIPT_DIR"
fi

# 3. Update & Build Frontend
if [ -d "$FRONTEND_DIR" ]; then
    log_info "Updating Frontend..."
    cd "$FRONTEND_DIR"
    
    npm install --legacy-peer-deps
    npm run build
    log_success "Frontend production build created in frontend/dist."
    
    cd "$SCRIPT_DIR"
fi

# 4. Safe Nginx Reload (Optional)
if [ "$RELOAD_NGINX" = true ] && command -v nginx &> /dev/null; then
    log_info "Validating and reloading Nginx..."
    if sudo nginx -t &> /dev/null; then
        sudo systemctl reload nginx || sudo service nginx reload
        log_success "Nginx reloaded successfully."
    else
        log_warn "Nginx reload skipped (test failed or permissions missing)."
    fi
fi

echo ""
echo "=============================================================================="
log_success "✅ A2Z Deployment Completed Successfully!"
echo "=============================================================================="
pm2 status "$PM2_APP_NAME"
echo ""
