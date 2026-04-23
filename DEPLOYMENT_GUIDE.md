# Docker, ECR & App Runner Deployment Guide

This guide covers deploying the FastAPI backend to AWS App Runner using Docker and ECR.

## Prerequisites

1. **AWS Account** with credentials configured locally
2. **Docker** installed on your machine
3. **AWS CLI** installed and configured
4. **IAM Permissions** for:
   - ECR (create/push repositories)
   - App Runner (create/deploy services)
   - IAM (create roles)

## Step 1: Create ECR Repository

```bash
# AWS Region: us-east-1 (hardcoded for this deployment)
AWS_ACCOUNT_ID=123456789012
AWS_REGION=us-east-1

# Create ECR repository
aws ecr create-repository \
  --repository-name apex-backend \
  --region $AWS_REGION

# Output will include the repository URI
# Example: 123456789012.dkr.ecr.us-east-1.amazonaws.com/apex-backend
```

## Step 2: Build Docker Image Locally

```bash
# Navigate to project root
cd /path/to/Apex1.2

# Build the image
docker build -t apex-backend:latest .

# Optional: Test locally before pushing
docker run -p 8000:8000 \
  -e SUPABASE_URL="your_supabase_url" \
  -e SUPABASE_KEY="your_supabase_key" \
  -e AWS_ACCESS_KEY_ID="your_aws_key" \
  -e AWS_SECRET_ACCESS_KEY="your_aws_secret" \
  -e S3_BUCKET_NAME="your_bucket_name" \
  -e S3_REGION="af-south-1" \
  -e CORS_ORIGINS="http://localhost:3000,http://localhost:3001" \
  apex-backend:latest
```

## Step 3: Authenticate with ECR

```bash
# Get login token (valid for 12 hours)
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Output: Login Succeeded
```

## Step 4: Tag and Push to ECR

```bash
# Set repository URI
REPO_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/apex-backend"

# Tag the image
docker tag apex-backend:latest $REPO_URI:latest
docker tag apex-backend:latest $REPO_URI:$(date +%Y%m%d-%H%M%S)

# Push to ECR
docker push $REPO_URI:latest
docker push $REPO_URI:$(date +%Y%m%d-%H%M%S)

# Verify in ECR (should see image listing)
aws ecr describe-images --repository-name apex-backend --region $AWS_REGION
```

## Step 5: Create IAM Role for App Runner

```bash
# Create assume role policy JSON
cat > trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "apprunner.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# Create IAM role
aws iam create-role \
  --role-name AppRunnerApexBackendRole \
  --assume-role-policy-document file://trust-policy.json

# Attach ECR read policy
aws iam attach-role-policy \
  --role-name AppRunnerApexBackendRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly

# Attach S3 policy for your bucket
cat > s3-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::intermediate-apex-bucket/*"
    },
    {
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::intermediate-apex-bucket"
    }
  ]
}
EOF

aws iam put-role-policy \
  --role-name AppRunnerApexBackendRole \
  --policy-name ApexS3Access \
  --policy-document file://s3-policy.json
```

## Step 6: Create App Runner Service

### Option A: Using AWS CLI

```bash
# Set variables
REPO_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/apex-backend"
ROLE_ARN="arn:aws:iam::$AWS_ACCOUNT_ID:role/AppRunnerApexBackendRole"

# Create the service
aws apprunner create-service \
  --service-name apex-backend \
  --source-configuration \
    ImageRepository="{RepositoryType=ECR,ImageIdentifier=$REPO_URI:latest,ImageConfiguration={Port=8000}}" \
  --instance-configuration \
    InstanceRoleArn=$ROLE_ARN \
  --region $AWS_REGION

# Note the service ARN from the output
```

### Option B: Using AWS Console

1. Go to **AWS App Runner** → **Create service**
2. Choose **Container registry** → **Amazon ECR**
3. Select:
   - Repository: `apex-backend`
   - Tag: `latest`
4. Port: `8000`
5. Create role or select `AppRunnerApexBackendRole`
6. Configure environment variables (see Step 7)
7. Create service

## Step 7: Configure Environment Variables

After creating the service, add environment variables:

```bash
# Get service ARN
SERVICE_ARN="arn:aws:apprunner:$AWS_REGION:$AWS_ACCOUNT_ID:service/apex-backend/12345678901234567890"

# Update service with environment variables
aws apprunner update-service \
  --service-arn $SERVICE_ARN \
  --instance-configuration \
    "EnvironmentVariables={
      SUPABASE_URL=https://YOUR_SUPABASE_URL.supabase.co,
      SUPABASE_KEY=YOUR_SUPABASE_ANON_KEY,
      SUPABASE_ADMIN_KEY=YOUR_SUPABASE_SERVICE_KEY,
      AWS_ACCESS_KEY_ID=YOUR_AWS_KEY,
      AWS_SECRET_ACCESS_KEY=YOUR_AWS_SECRET,
      S3_BUCKET_NAME=intermediate-apex-bucket,
      S3_REGION=af-south-1,
      CORS_ORIGINS=https://your-frontend-domain.com,https://www.your-frontend-domain.com
    }" \
  --region $AWS_REGION
```

### Or via Console:

1. Open your service in App Runner
2. Go to **Configuration** tab
3. Click **Edit** on Environment variables
4. Add each variable:
   - `SUPABASE_URL`: Your Supabase URL
   - `SUPABASE_KEY`: Your anon key
   - `SUPABASE_ADMIN_KEY`: Your service key
   - `AWS_ACCESS_KEY_ID`: Your AWS access key
   - `AWS_SECRET_ACCESS_KEY`: Your AWS secret key
   - `S3_BUCKET_NAME`: `intermediate-apex-bucket`
   - `S3_REGION`: `af-south-1`
   - `CORS_ORIGINS`: Your frontend URL (production domain)

## Step 8: Verify Deployment

```bash
# Get service details
aws apprunner describe-service \
  --service-arn $SERVICE_ARN \
  --region $AWS_REGION

# Check service status - should be RUNNING
# Get the default domain from the output
# Example: https://abc123def456.us-east-1.apprunner.aws

# Test health endpoint
curl https://YOUR_APP_RUNNER_DOMAIN/health
```

## Step 9: Update Frontend CORS & API URL

Once your App Runner service is running:

```bash
# Update frontend .env
REACT_APP_API_URL=https://YOUR_APP_RUNNER_DOMAIN/api

# Rebuild and deploy frontend
cd frontend
npm run build
# Deploy build/ to your frontend hosting (Vercel, Netlify, S3, etc.)
```

## Step 10: Setup Continuous Deployment (Optional)

### GitHub Actions to Auto-Deploy

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to App Runner

on:
  push:
    branches: [ main ]

env:
  AWS_REGION: us-east-1
  ECR_REPOSITORY: apex-backend
  SERVICE_NAME: apex-backend

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v2
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: ${{ env.AWS_REGION }}
    
    - name: Login to ECR
      id: login-ecr
      uses: aws-actions/amazon-ecr-login@v1
    
    - name: Build and push Docker image
      env:
        ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
        IMAGE_TAG: ${{ github.sha }}
      run: |
        docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
        docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
        docker tag $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG $ECR_REGISTRY/$ECR_REPOSITORY:latest
        docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest
    
    - name: Create App Runner deployment
      run: |
        aws apprunner start-deployment \
          --service-arn arn:aws:apprunner:${{ env.AWS_REGION }}:ACCOUNT_ID:service/${{ env.SERVICE_NAME }}/SERVICE_ID
```

## Security Best Practices

1. **Secrets Management**: Use AWS Secrets Manager for sensitive keys
2. **IAM Roles**: Use minimal permissions (least privilege)
3. **Image Scanning**: Enable ECR image scanning for vulnerabilities
4. **CORS**: Set specific frontend domains instead of wildcards
5. **Health Checks**: Ensure /health endpoint always returns 200 OK
6. **Logging**: Enable App Runner logging to CloudWatch

## Troubleshooting

### Service not starting
- Check App Runner logs: Console → Service → Logs
- Verify environment variables are set
- Check Docker image:
  ```bash
  docker run -it apex-backend:latest /bin/bash
  ```

### CORS errors
- Verify `CORS_ORIGINS` environment variable includes frontend URL
- Check backend CORS middleware in `config.py`
- Restart App Runner service after env var changes

### S3 access denied
- Check IAM role has S3 permissions
- Verify `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`
- Confirm bucket name matches `S3_BUCKET_NAME`

### Supabase connection failed
- Test Supabase URL is reachable
- Verify API keys are correct
- Check Supabase project is not paused

## Rollback

```bash
# Update service to use previous image tag
aws apprunner update-service \
  --service-arn $SERVICE_ARN \
  --source-configuration \
    ImageRepository="{RepositoryType=ECR,ImageIdentifier=$REPO_URI:PREVIOUS_TAG}" \
  --region $AWS_REGION
```

## Estimated Costs

- **App Runner**: $0.065/hour running + $0.0000006 per GB-second processing
- **ECR**: $0.10/GB for storage
- **S3**: Already configured, no additional cost for App Runner access
- **Total estimate**: ~$50-100/month for small to medium traffic

---

**Next Steps:**
1. Gather all AWS credentials and Supabase keys
2. Configure AWS CLI locally
3. Execute steps 1-7 in order
4. Test the health endpoint
5. Clone frontend repo URL into env var
6. Deploy and monitor
