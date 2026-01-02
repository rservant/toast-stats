#!/bin/bash

# Club Health Classification System Deployment Script
# This script handles deployment to various environments

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEPLOYMENT_TYPE="${1:-docker-compose}"
ENVIRONMENT="${2:-production}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    case $DEPLOYMENT_TYPE in
        "docker-compose")
            if ! command -v docker &> /dev/null; then
                log_error "Docker is not installed"
                exit 1
            fi
            if ! command -v docker-compose &> /dev/null; then
                log_error "Docker Compose is not installed"
                exit 1
            fi
            ;;
        "kubernetes")
            if ! command -v kubectl &> /dev/null; then
                log_error "kubectl is not installed"
                exit 1
            fi
            if ! kubectl cluster-info &> /dev/null; then
                log_error "Cannot connect to Kubernetes cluster"
                exit 1
            fi
            ;;
        *)
            log_error "Unknown deployment type: $DEPLOYMENT_TYPE"
            exit 1
            ;;
    esac
    
    log_success "Prerequisites check passed"
}

# Validate environment files
validate_environment() {
    log_info "Validating environment configuration..."
    
    local backend_env="$PROJECT_ROOT/backend/.env.$ENVIRONMENT"
    local frontend_env="$PROJECT_ROOT/frontend/.env.$ENVIRONMENT"
    
    if [[ ! -f "$backend_env" ]]; then
        log_error "Backend environment file not found: $backend_env"
        log_info "Please copy from .env.$ENVIRONMENT.example and configure"
        exit 1
    fi
    
    if [[ ! -f "$frontend_env" ]]; then
        log_error "Frontend environment file not found: $frontend_env"
        log_info "Please copy from .env.$ENVIRONMENT.example and configure"
        exit 1
    fi
    
    # Check for placeholder values in production
    if [[ "$ENVIRONMENT" == "production" ]]; then
        if grep -q "your-.*-change" "$backend_env"; then
            log_error "Found placeholder values in production backend environment file"
            log_info "Please update all 'your-*-change-*' values with actual configuration"
            exit 1
        fi
        
        if grep -q "yourdomain.com" "$frontend_env"; then
            log_warning "Found placeholder domain in frontend environment file"
            log_info "Please update yourdomain.com with your actual domain"
        fi
    fi
    
    log_success "Environment validation passed"
}

# Build application
build_application() {
    log_info "Building application..."
    
    cd "$PROJECT_ROOT"
    
    # Install dependencies
    log_info "Installing dependencies..."
    npm ci
    
    # Run quality checks
    log_info "Running quality checks..."
    npm run typecheck
    npm run lint
    npm run test
    
    # Build applications
    log_info "Building backend..."
    npm run build:backend
    
    log_info "Building frontend..."
    npm run build:frontend
    
    log_success "Application build completed"
}

# Deploy with Docker Compose
deploy_docker_compose() {
    log_info "Deploying with Docker Compose..."
    
    cd "$PROJECT_ROOT"
    
    # Copy environment files
    cp "backend/.env.$ENVIRONMENT" "backend/.env.production"
    cp "frontend/.env.$ENVIRONMENT" "frontend/.env.production"
    
    # Build and start services
    log_info "Building Docker images..."
    docker-compose build --no-cache
    
    log_info "Starting services..."
    docker-compose up -d
    
    # Wait for services to be healthy
    log_info "Waiting for services to be healthy..."
    timeout 120 bash -c 'until docker-compose ps | grep -q "healthy"; do sleep 5; done' || {
        log_error "Services failed to become healthy within 2 minutes"
        docker-compose logs
        exit 1
    }
    
    log_success "Docker Compose deployment completed"
    log_info "Services are running at:"
    log_info "  Frontend: http://localhost"
    log_info "  Backend API: http://localhost/api"
    log_info "  Health Check: http://localhost/health"
}

# Deploy to Kubernetes
deploy_kubernetes() {
    log_info "Deploying to Kubernetes..."
    
    cd "$PROJECT_ROOT"
    
    # Create namespace
    log_info "Creating namespace..."
    kubectl apply -f k8s/namespace.yaml
    
    # Build and push Docker images (assumes registry is configured)
    log_info "Building and pushing Docker images..."
    
    # Backend
    docker build -f Dockerfile.backend -t "club-health/backend:$ENVIRONMENT" .
    docker tag "club-health/backend:$ENVIRONMENT" "your-registry/club-health/backend:$ENVIRONMENT"
    docker push "your-registry/club-health/backend:$ENVIRONMENT"
    
    # Frontend
    docker build -f Dockerfile.frontend -t "club-health/frontend:$ENVIRONMENT" .
    docker tag "club-health/frontend:$ENVIRONMENT" "your-registry/club-health/frontend:$ENVIRONMENT"
    docker push "your-registry/club-health/frontend:$ENVIRONMENT"
    
    # Update image tags in deployment files
    sed -i.bak "s|club-health/backend:latest|your-registry/club-health/backend:$ENVIRONMENT|g" k8s/backend-deployment.yaml
    sed -i.bak "s|club-health/frontend:latest|your-registry/club-health/frontend:$ENVIRONMENT|g" k8s/frontend-deployment.yaml
    
    # Deploy to Kubernetes
    log_info "Applying Kubernetes manifests..."
    kubectl apply -f k8s/backend-deployment.yaml
    kubectl apply -f k8s/frontend-deployment.yaml
    
    # Wait for deployments to be ready
    log_info "Waiting for deployments to be ready..."
    kubectl wait --for=condition=available --timeout=300s deployment/club-health-backend -n club-health
    kubectl wait --for=condition=available --timeout=300s deployment/club-health-frontend -n club-health
    
    # Restore original deployment files
    mv k8s/backend-deployment.yaml.bak k8s/backend-deployment.yaml
    mv k8s/frontend-deployment.yaml.bak k8s/frontend-deployment.yaml
    
    log_success "Kubernetes deployment completed"
    
    # Show service information
    log_info "Service information:"
    kubectl get services -n club-health
    kubectl get ingress -n club-health
}

# Health check
health_check() {
    log_info "Performing health check..."
    
    case $DEPLOYMENT_TYPE in
        "docker-compose")
            local backend_url="http://localhost/api/health"
            local frontend_url="http://localhost/health"
            ;;
        "kubernetes")
            # Port forward for health check
            kubectl port-forward -n club-health service/club-health-frontend-service 8080:80 &
            local port_forward_pid=$!
            sleep 5
            local backend_url="http://localhost:8080/api/health"
            local frontend_url="http://localhost:8080/health"
            ;;
    esac
    
    # Check backend health
    if curl -f "$backend_url" &> /dev/null; then
        log_success "Backend health check passed"
    else
        log_error "Backend health check failed"
        [[ "$DEPLOYMENT_TYPE" == "kubernetes" ]] && kill $port_forward_pid
        exit 1
    fi
    
    # Check frontend health
    if curl -f "$frontend_url" &> /dev/null; then
        log_success "Frontend health check passed"
    else
        log_error "Frontend health check failed"
        [[ "$DEPLOYMENT_TYPE" == "kubernetes" ]] && kill $port_forward_pid
        exit 1
    fi
    
    [[ "$DEPLOYMENT_TYPE" == "kubernetes" ]] && kill $port_forward_pid
    
    log_success "All health checks passed"
}

# Cleanup function
cleanup() {
    log_info "Cleaning up temporary files..."
    rm -f "$PROJECT_ROOT/backend/.env.production"
    rm -f "$PROJECT_ROOT/frontend/.env.production"
}

# Main deployment function
main() {
    log_info "Starting Club Health Classification System deployment"
    log_info "Deployment type: $DEPLOYMENT_TYPE"
    log_info "Environment: $ENVIRONMENT"
    
    # Set up cleanup trap
    trap cleanup EXIT
    
    # Run deployment steps
    check_prerequisites
    validate_environment
    build_application
    
    case $DEPLOYMENT_TYPE in
        "docker-compose")
            deploy_docker_compose
            ;;
        "kubernetes")
            deploy_kubernetes
            ;;
    esac
    
    health_check
    
    log_success "Deployment completed successfully!"
    
    # Show next steps
    echo
    log_info "Next steps:"
    case $DEPLOYMENT_TYPE in
        "docker-compose")
            echo "  1. Access the application at http://localhost"
            echo "  2. Monitor logs with: docker-compose logs -f"
            echo "  3. Stop services with: docker-compose down"
            ;;
        "kubernetes")
            echo "  1. Check deployment status: kubectl get pods -n club-health"
            echo "  2. View logs: kubectl logs -f deployment/club-health-backend -n club-health"
            echo "  3. Access via ingress or port-forward"
            ;;
    esac
    echo "  4. Monitor application metrics and alerts"
    echo "  5. Review deployment documentation for configuration options"
}

# Show usage if no arguments provided
if [[ $# -eq 0 ]]; then
    echo "Usage: $0 <deployment-type> [environment]"
    echo
    echo "Deployment types:"
    echo "  docker-compose  Deploy using Docker Compose (default)"
    echo "  kubernetes      Deploy to Kubernetes cluster"
    echo
    echo "Environments:"
    echo "  production      Production environment (default)"
    echo "  staging         Staging environment"
    echo "  development     Development environment"
    echo
    echo "Examples:"
    echo "  $0 docker-compose production"
    echo "  $0 kubernetes staging"
    exit 1
fi

# Run main function
main "$@"