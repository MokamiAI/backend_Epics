#!/bin/bash

# Apex Backend Deployment Script
# This script automates Docker building, ECR push, and App Runner deployment

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_step() {
  echo -e "${GREEN}▶ $1${NC}"
}

print_error() {
  echo -e "${RED}✗ $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠ $1${NC}"
}

# Configuration
read -p "Enter AWS Account ID: " AWS_ACCOUNT_ID
AWS_REGION="us-east-1"

ECR_REPO_NAME="apex-backend"
ECR_REPO_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO_NAME"
SERVICE_NAME="apex-backend"
ROLE_NAME="AppRunnerApexBackendRole"

print_step "Starting deployment process..."
print_step "AWS Account: $AWS_ACCOUNT_ID"
print_step "AWS Region: $AWS_REGION"
print_step "ECR Repository: $ECR_REPO_NAME"

# Step 1: Check if ECR repository exists
print_step "Checking ECR repository..."
if ! aws ecr describe-repositories \
  --repository-names $ECR_REPO_NAME \
  --region $AWS_REGION &>/dev/null; then
  
  print_step "Creating ECR repository..."
  aws ecr create-repository \
    --repository-name $ECR_REPO_NAME \
    --region $AWS_REGION
  
  print_step "Repository created successfully"
else
  print_warning "Repository already exists"
fi

# Step 2: Build Docker image
print_step "Building Docker image..."
docker build -t $ECR_REPO_NAME:latest .
print_step "Docker image built successfully"

# Step 3: Authenticate with ECR
print_step "Authenticating with ECR..."
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $ECR_REPO_URI
print_step "Authentication successful"

# Step 4: Tag and push image
print_step "Tagging and pushing image to ECR..."
IMAGE_TAG=$(date +%Y%m%d-%H%M%S)

docker tag $ECR_REPO_NAME:latest $ECR_REPO_URI:latest
docker tag $ECR_REPO_NAME:latest $ECR_REPO_URI:$IMAGE_TAG

docker push $ECR_REPO_URI:latest
docker push $ECR_REPO_URI:$IMAGE_TAG

print_step "Image pushed successfully"
print_step "  Latest tag: $ECR_REPO_URI:latest"
print_step "  Version tag: $ECR_REPO_URI:$IMAGE_TAG"

# Step 5: Check if IAM role exists
print_step "Checking IAM role..."
if ! aws iam get-role --role-name $ROLE_NAME &>/dev/null; then
  print_step "Creating IAM role..."
  
  cat > /tmp/trust-policy.json << 'EOF'
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
  
  aws iam create-role \
    --role-name $ROLE_NAME \
    --assume-role-policy-document file:///tmp/trust-policy.json
  
  print_step "Attaching ECR read policy..."
  aws iam attach-role-policy \
    --role-name $ROLE_NAME \
    --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly
  
  print_step "Creating S3 policy..."
  cat > /tmp/s3-policy.json << 'EOF'
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
      "Resource": "arn:aws:s3:::intermediate-apex-bucket-east/*"
    },
    {
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::intermediate-apex-bucket-east"
    }
  ]
}
EOF
  
  aws iam put-role-policy \
    --role-name $ROLE_NAME \
    --policy-name ApexS3Access \
    --policy-document file:///tmp/s3-policy.json
  
  print_step "IAM role created successfully"
  
  # Wait for role propagation
  print_warning "Waiting 10 seconds for IAM role to propagate..."
  sleep 10
else
  print_warning "IAM role already exists"
fi

ROLE_ARN="arn:aws:iam::$AWS_ACCOUNT_ID:role/$ROLE_NAME"

# Step 6: Check if App Runner service exists
print_step "Checking App Runner service..."
SERVICE_ARN=$(aws apprunner list-services \
  --region $AWS_REGION \
  --query "ServiceSummaryList[?ServiceName=='$SERVICE_NAME'].ServiceArn" \
  --output text 2>/dev/null || echo "")

if [ -z "$SERVICE_ARN" ]; then
  print_step "Creating App Runner service..."
  
  SERVICE_RESPONSE=$(aws apprunner create-service \
    --service-name $SERVICE_NAME \
    --source-configuration \
      "ImageRepository={RepositoryType=ECR,ImageIdentifier=$ECR_REPO_URI:latest,ImageConfiguration={Port=8000}}" \
    --instance-configuration \
      "InstanceRoleArn=$ROLE_ARN" \
    --region $AWS_REGION)
  
  SERVICE_ARN=$(echo $SERVICE_RESPONSE | jq -r '.Service.ServiceArn')
  print_step "Service created successfully"
  print_step "Service ARN: $SERVICE_ARN"
  
  print_warning "Service is deploying... This may take 2-5 minutes"
  print_step "Monitor progress in AWS Console: https://console.aws.amazon.com/apprunner"
else
  print_step "Updating existing App Runner service..."
  
  aws apprunner update-service \
    --service-arn $SERVICE_ARN \
    --source-configuration \
      "ImageRepository={RepositoryType=ECR,ImageIdentifier=$ECR_REPO_URI:latest}" \
    --region $AWS_REGION
  
  print_step "Service updated successfully"
fi

print_step "Waiting for service to be active (this may take a few minutes)..."
aws apprunner wait service-active \
  --service-arn $SERVICE_ARN \
  --region $AWS_REGION 2>/dev/null || print_warning "Service status check timed out - check console"

# Get service details
print_step "Fetching service details..."
SERVICE_DETAILS=$(aws apprunner describe-service \
  --service-arn $SERVICE_ARN \
  --region $AWS_REGION)

SERVICE_URL=$(echo $SERVICE_DETAILS | jq -r '.Service.ServiceUrl')
SERVICE_STATUS=$(echo $SERVICE_DETAILS | jq -r '.Service.Status')

print_step "================================"
print_step "DEPLOYMENT SUMMARY"
print_step "================================"
echo -e "${GREEN}Service Name:${NC}       $SERVICE_NAME"
echo -e "${GREEN}Service Status:${NC}     $SERVICE_STATUS"
echo -e "${GREEN}Service URL:${NC}        $SERVICE_URL"
echo -e "${GREEN}Service ARN:${NC}        $SERVICE_ARN"
echo -e "${GREEN}Image URI:${NC}          $ECR_REPO_URI:latest"
echo -e "${GREEN}IAM Role:${NC}           $ROLE_ARN"

print_step "================================"
print_step "NEXT STEPS"
print_step "================================"
echo "1. Add environment variables to App Runner:"
echo "   - SUPABASE_URL"
echo "   - SUPABASE_KEY"
echo "   - SUPABASE_ADMIN_KEY"
echo "   - AWS_ACCESS_KEY_ID"
echo "   - AWS_SECRET_ACCESS_KEY"
echo "   - S3_BUCKET_NAME"
echo "   - S3_REGION"
echo "   - CORS_ORIGINS"
echo ""
echo "2. Test health endpoint:"
echo "   curl $SERVICE_URL/health"
echo ""
echo "3. Update frontend .env:"
echo "   REACT_APP_API_URL=$SERVICE_URL/api"
echo ""
echo "Full documentation: See DEPLOYMENT_GUIDE.md"

print_step "Deployment process completed!"
