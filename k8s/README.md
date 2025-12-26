# Kubernetes Deployment

This directory contains Kubernetes manifests for deploying the Toastmasters District Visualizer.

## Prerequisites

- Kubernetes cluster (1.19+)
- kubectl configured
- Docker images built and pushed to a registry

## Quick Start

1. **Create namespace (optional):**

```bash
kubectl create namespace toastmasters
kubectl config set-context --current --namespace=toastmasters
```

2. **Create secrets:**

```bash
# Generate a secure JWT secret
JWT_SECRET=$(openssl rand -base64 32)

# Create the secret
kubectl create secret generic toastmasters-secrets \
  --from-literal=jwt-secret=$JWT_SECRET
```

3. **Update ConfigMap:**

Edit `configmap.yaml` and update:

- `dashboard-url`: Toastmasters dashboard URL
- `cors-origin`: Your frontend domain

4. **Apply configurations:**

```bash
kubectl apply -f configmap.yaml
kubectl apply -f backend-deployment.yaml
kubectl apply -f frontend-deployment.yaml
```

5. **Verify deployment:**

```bash
# Check pods
kubectl get pods

# Check services
kubectl get services

# View logs
kubectl logs -l app=toastmasters-backend
kubectl logs -l app=toastmasters-frontend
```

## Accessing the Application

### Get LoadBalancer IP

```bash
kubectl get service toastmasters-frontend
```

The application will be available at the EXTERNAL-IP shown.

### Using Ingress (Recommended for Production)

Create an ingress resource for better routing and SSL termination:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: toastmasters-ingress
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
    - hosts:
        - yourdomain.com
      secretName: toastmasters-tls
  rules:
    - host: yourdomain.com
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: toastmasters-backend
                port:
                  number: 5001
          - path: /
            pathType: Prefix
            backend:
              service:
                name: toastmasters-frontend
                port:
                  number: 80
```

## Scaling

### Manual Scaling

```bash
# Scale backend
kubectl scale deployment toastmasters-backend --replicas=3

# Scale frontend
kubectl scale deployment toastmasters-frontend --replicas=3
```

### Horizontal Pod Autoscaling

```bash
# Backend autoscaling
kubectl autoscale deployment toastmasters-backend \
  --cpu-percent=70 \
  --min=2 \
  --max=10

# Frontend autoscaling
kubectl autoscale deployment toastmasters-frontend \
  --cpu-percent=70 \
  --min=2 \
  --max=10
```

## Monitoring

### View Logs

```bash
# Backend logs
kubectl logs -f -l app=toastmasters-backend

# Frontend logs
kubectl logs -f -l app=toastmasters-frontend

# Specific pod
kubectl logs -f <pod-name>
```

### Health Checks

```bash
# Port forward to test locally
kubectl port-forward service/toastmasters-backend 5001:5001
curl http://localhost:5001/health

kubectl port-forward service/toastmasters-frontend 8080:80
curl http://localhost:8080/health
```

## Updates

### Rolling Update

```bash
# Update backend image
kubectl set image deployment/toastmasters-backend \
  backend=toastmasters-backend:v2

# Update frontend image
kubectl set image deployment/toastmasters-frontend \
  frontend=toastmasters-frontend:v2

# Check rollout status
kubectl rollout status deployment/toastmasters-backend
kubectl rollout status deployment/toastmasters-frontend
```

### Rollback

```bash
# Rollback backend
kubectl rollout undo deployment/toastmasters-backend

# Rollback frontend
kubectl rollout undo deployment/toastmasters-frontend
```

## Troubleshooting

### Pods Not Starting

```bash
# Describe pod to see events
kubectl describe pod <pod-name>

# Check logs
kubectl logs <pod-name>

# Check if secrets exist
kubectl get secrets
```

### Service Not Accessible

```bash
# Check service endpoints
kubectl get endpoints

# Check if pods are ready
kubectl get pods

# Test service internally
kubectl run -it --rm debug --image=alpine --restart=Never -- sh
# Inside the pod:
wget -O- http://toastmasters-backend:5001/health
```

## Cleanup

```bash
kubectl delete -f frontend-deployment.yaml
kubectl delete -f backend-deployment.yaml
kubectl delete -f configmap.yaml
kubectl delete secret toastmasters-secrets
```
