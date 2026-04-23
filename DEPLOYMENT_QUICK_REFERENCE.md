# Docker & App Runner Quick Reference

## Quick Setup (TL;DR)

### Prerequisites
```bash
# Install Docker: https://www.docker.com/products/docker-desktop
# Install AWS CLI: https://aws.amazon.com/cli/
# Configure AWS credentials
aws configure
```

### One-Command Deploy (Windows PowerShell)
```powershell
.\deploy.ps1
```

### One-Command Deploy (Linux/Mac Bash)
```bash
chmod +x deploy.sh
./deploy.sh
```

## Manual Step-by-Step

### 1. Build & Push to ECR
```bash
# Set your variables
AWS_ACCOUNT_ID="123456789012"
AWS_REGION="us-east-1"
ECR_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/apex-backend"

# Build
docker build -t apex-backend:latest .

# Login to ECR
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $ECR_URI

# Push
docker tag apex-backend:latest $ECR_URI:latest
docker push $ECR_URI:latest
```

### 2. Create App Runner Service
```bash
# Create service
aws apprunner create-service \
  --service-name apex-backend \
  --source-configuration ImageRepository="{RepositoryType=ECR,ImageIdentifier=$ECR_URI:latest,ImageConfiguration={Port=8000}}" \
  --instance-configuration InstanceRoleArn=arn:aws:iam::$AWS_ACCOUNT_ID:role/AppRunnerApexBackendRole \
  --region $AWS_REGION
```

### 3. Add Environment Variables
```bash
SERVICE_ARN="arn:aws:apprunner:$AWS_REGION:$AWS_ACCOUNT_ID:service/apex-backend/abc123..."

aws apprunner update-service \
  --service-arn $SERVICE_ARN \
  --instance-configuration EnvironmentVariables='{
    "SUPABASE_URL":"https://your-project.supabase.co",
    "SUPABASE_KEY":"your-anon-key",
    "SUPABASE_ADMIN_KEY":"your-service-key",
    "AWS_ACCESS_KEY_ID":"your-key-id",
    "AWS_SECRET_ACCESS_KEY":"your-secret",
    "S3_BUCKET_NAME":"intermediate-apex-bucket",
    "S3_REGION":"af-south-1",
    "CORS_ORIGINS":"https://your-frontend-domain.com"
  }' \
  --region $AWS_REGION
```

### 4. Test Deployment
```bash
# Get service URL
SERVICE_URL=$(aws apprunner describe-service \
  --service-arn $SERVICE_ARN \
  --region $AWS_REGION \
  --query 'Service.ServiceUrl' \
  --output text)

# Test health endpoint
curl $SERVICE_URL/health

# Test API
curl $SERVICE_URL/api/documents
```

## Common Commands

### View Service Details
```bash
aws apprunner describe-service \
  --service-arn $SERVICE_ARN \
  --region $AWS_REGION
```

### View Service Logs
```bash
# Via AWS CLI
aws logs tail /aws/apprunner/apex-backend/default_platform --follow --region $AWS_REGION

# Via Console
# https://console.aws.amazon.com/apprunner → Select service → Logs
```

### Start Deployment (after code changes)
```bash
aws apprunner start-deployment \
  --service-arn $SERVICE_ARN \
  --region $AWS_REGION
```

### Stop Service (to save costs)
```bash
aws apprunner pause-service \
  --service-arn $SERVICE_ARN \
  --region $AWS_REGION
```

### Resume Service
```bash
aws apprunner resume-service \
  --service-arn $SERVICE_ARN \
  --region $AWS_REGION
```

### Delete Service
```bash
aws apprunner delete-service \
  --service-arn $SERVICE_ARN \
  --region $AWS_REGION
```

## Docker Commands

### Test Image Locally
```bash
docker run -p 8000:8000 \
  -e SUPABASE_URL="https://your-project.supabase.co" \
  -e SUPABASE_KEY="your-key" \
  -e AWS_ACCESS_KEY_ID="your-key" \
  -e AWS_SECRET_ACCESS_KEY="your-secret" \
  -e S3_BUCKET_NAME="your-bucket" \
  -e S3_REGION="af-south-1" \
  apex-backend:latest

# Test: curl http://localhost:8000/health
```

### View Image Details
```bash
docker images apex-backend
docker inspect apex-backend:latest
```

### Clean Up
```bash
# Remove image
docker rmi apex-backend:latest

# Remove all dangling images
docker image prune -a

# Remove ECR image
aws ecr batch-delete-image \
  --repository-name apex-backend \
  --image-ids imageTag=latest \
  --region $AWS_REGION
```

## Troubleshooting

### Service won't start
```bash
# Check logs
aws logs tail /aws/apprunner/apex-backend/default_platform --follow --region $AWS_REGION

# Verify environment variables
aws apprunner describe-service --service-arn $SERVICE_ARN --region $AWS_REGION | \
  jq '.Service.SourceConfiguration'

# Check IAM role permissions
aws iam list-role-policies --role-name AppRunnerApexBackendRole
```

### CORS errors from frontend
```bash
# Update CORS_ORIGINS
aws apprunner update-service \
  --service-arn $SERVICE_ARN \
  --instance-configuration EnvironmentVariables='{
    "CORS_ORIGINS":"https://your-frontend.com,https://www.your-frontend.com"
  }' \
  --region $AWS_REGION

# Restart: aws apprunner start-deployment --service-arn $SERVICE_ARN
```

### S3 access denied
```bash
# Verify IAM role has S3 permissions
aws iam get-role-policy \
  --role-name AppRunnerApexBackendRole \
  --policy-name ApexS3Access

# Check environment variables
aws apprunner describe-service --service-arn $SERVICE_ARN --region $AWS_REGION | \
  jq '.Service.InstanceConfiguration.EnvironmentVariables'
```

### Supabase connection failed
```bash
# Verify credentials
echo $SUPABASE_URL
echo $SUPABASE_KEY

# Test connection locally
curl -X GET "https://YOUR_SUPABASE.supabase.co/rest/v1/documents?select=*" \
  -H "apikey: YOUR_ANON_KEY"
```

## Performance Tips

1. **Reduce startup time**
   - Use Alpine-based Python image (update Dockerfile)
   - Minimize Docker layer count
   - Pre-warm connections in startup script

2. **Optimize costs**
   - Use smaller instance types (512 MB → 256 MB RAM)
   - Stop service when not in use
   - Use reserved capacity discounts

3. **Improve reliability**
   - Enable auto-scaling
   - Set up CloudWatch alarms
   - Enable service logs to CloudWatch

## Security Checklist

- [ ] Secrets are in Environment Variables (not in code)
- [ ] IAM role has minimal required permissions
- [ ] CORS_ORIGINS set to specific domain (not wildcard)
- [ ] ECR image scanning enabled
- [ ] CloudWatch logs retention configured
- [ ] Service uses HTTPS (App Runner default)
- [ ] API rate limiting configured (if needed)

## Cost Calculator

- App Runner: $0.065/hour running = ~$47/month ✓
- ECR Storage: $0.10/GB = ~$1/month for 10GB
- S3: Already configured separately
- CloudWatch Logs: ~$0.50/month for 10GB

**Total estimate: ~$50/month**

## Useful Links

- [AWS App Runner Documentation](https://docs.aws.amazon.com/apprunner/)
- [AWS ECR Documentation](https://docs.aws.amazon.com/ECR/)
- [Docker Best Practices](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/docker-basics.html)
- [App Runner Pricing](https://aws.amazon.com/apprunner/pricing/)
- [AWS CLI AppRunner Reference](https://docs.aws.amazon.com/cli/latest/reference/apprunner/)
