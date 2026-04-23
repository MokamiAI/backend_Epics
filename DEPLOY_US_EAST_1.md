# Deploy to US-EAST-1 - Quick Start

Your deployment is configured for **AWS US-EAST-1 region**.

## 🚀 Ready to Deploy?

### Step 1: Ensure AWS Credentials are Configured

```powershell
# Windows PowerShell
aws configure

# Then enter:
# AWS Access Key ID: [YOUR_KEY]
# AWS Secret Access Key: [YOUR_SECRET_KEY]
# Default region name: us-east-1
# Default output format: json
```

### Step 2: Run Deployment Script

**Windows PowerShell:**
```powershell
cd c:\Users\user\Downloads\Apex1\Apex1.2
.\deploy.ps1
```

When prompted:
```
Enter AWS Account ID: 123456789012
```
(The region is automatically set to us-east-1)

**Linux/Mac Bash:**
```bash
cd /path/to/Apex1.2
chmod +x deploy.sh
./deploy.sh
```

### Step 3: What Happens

The script will automatically:

1. ✅ Create ECR repository in **us-east-1**
   - `123456789012.dkr.ecr.us-east-1.amazonaws.com/apex-backend`

2. ✅ Build Docker image locally

3. ✅ Authenticate with ECR (us-east-1)

4. ✅ Push image to ECR (us-east-1)

5. ✅ Create IAM role for App Runner

6. ✅ Create App Runner service in **us-east-1**

7. ✅ Return your service URL:
   - `https://abc123def456.us-east-1.apprunner.aws`

### Step 4: After Deployment Complete

You'll see output like:
```
================================
DEPLOYMENT SUMMARY
================================
Service Name:       apex-backend
Service Status:     ACTIVE
Service URL:        https://abc123def456.us-east-1.apprunner.aws
Region:            us-east-1
```

### Step 5: Add Environment Variables

1. Go to [AWS Console - App Runner](https://console.aws.amazon.com/apprunner)
2. Find your `apex-backend` service
3. Click **Configuration** → **Edit**
4. Add Environment Variables:
   ```
   SUPABASE_URL = https://your-project.supabase.co
   SUPABASE_KEY = your-anon-key
   SUPABASE_ADMIN_KEY = your-service-key
   AWS_ACCESS_KEY_ID = your-access-key
   AWS_SECRET_ACCESS_KEY = your-secret-key
   S3_BUCKET_NAME = intermediate-apex-bucket
   S3_REGION = af-south-1
   CORS_ORIGINS = https://your-frontend-domain.com
   ```

### Step 6: Test Your Deployment

```powershell
# Replace with your actual service URL
$SERVICE_URL = "https://abc123def456.us-east-1.apprunner.aws"

# Test health endpoint
Invoke-WebRequest "$SERVICE_URL/health"

# Should respond with:
# {"status":"ok","api":"ok","database":"ok","s3":"ok"}
```

### Step 7: Update Frontend

Edit `frontend/.env`:
```
REACT_APP_API_URL=https://abc123def456.us-east-1.apprunner.aws/api
REACT_APP_ENV=production
```

Then rebuild and deploy your frontend.

## 📊 Region Details

| Component | US-EAST-1 | 
|-----------|-----------|
| **ECR Repository** | ✅ apex-backend |
| **App Runner Service** | ✅ apex-backend |
| **IAM Role** | ✅ AppRunnerApexBackendRole |
| **CloudWatch Logs** | ✅ /aws/apprunner/apex-backend/default_platform |
| **Data Residency** | US East (N. Virginia) |

## 🔐 AWS Console Links

After deployment, access these consoles:

- **App Runner Service**: https://console.aws.amazon.com/apprunner/home?region=us-east-1
- **ECR Repository**: https://console.aws.amazon.com/ecr/repositories?region=us-east-1
- **CloudWatch Logs**: https://console.aws.amazon.com/logs/home?region=us-east-1
- **IAM Roles**: https://console.aws.amazon.com/iamv2/home#/roles

## 💰 Costs in US-EAST-1

- **App Runner**: $0.065/hour = ~$47/month
- **ECR Storage**: $0.10/GB = ~$2/month (assuming 20GB)
- **CloudWatch Logs**: $0.50/month
- **S3**: Separate (already configured)

**Total**: ~$50/month

## ❌ Troubleshooting

### "Service not found" error
```powershell
# Check ECR repos in us-east-1
aws ecr describe-repositories --region us-east-1

# List App Runner services in us-east-1
aws apprunner list-services --region us-east-1
```

### "Access Denied" from AWS
- Check IAM user has EC2, AppRunner, IAM permissions
- Verify region is set to us-east-1 in AWS CLI

### Docker image won't build
```powershell
# Test Docker locally
docker build -t apex-backend:latest .

# If this fails, check:
# - Docker Desktop is running
# - Python dependencies are in requirements.txt
# - Dockerfile is in project root
```

### Health endpoint fails
```powershell
$SERVICE_URL = "https://your-service.us-east-1.apprunner.aws"

# Check service is actually running
aws apprunner describe-service `
  --service-arn arn:aws:apprunner:us-east-1:ACCOUNT_ID:service/apex-backend/SERVICE_ID `
  --region us-east-1

# View logs
aws logs tail /aws/apprunner/apex-backend/default_platform --follow --region us-east-1
```

## ✅ Checklist Before Running Deploy

- [ ] Docker Desktop installed and running
- [ ] AWS CLI installed (`aws --version`)
- [ ] AWS credentials configured (`aws configure`)
- [ ] AWS Account ID ready (12-digit number)
- [ ] IAM user has ECR, App Runner, IAM permissions
- [ ] Internet connection is stable

## 🎯 Next Steps

1. Run the deployment script
2. Wait for "DEPLOYMENT SUMMARY" output (usually 2-5 minutes)
3. Note your Service URL (looks like `https://abc123def456.us-east-1.apprunner.aws`)
4. Add environment variables in AWS Console
5. Test health endpoint
6. Update frontend with API URL
7. Deploy frontend

**You're all set! Ready to deploy? Run the script!** 🚀
