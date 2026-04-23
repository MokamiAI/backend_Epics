# Apex Backend Deployment - Complete Setup

## 📋 Overview

Your FastAPI backend is ready for production deployment using:
- **Docker** for containerization
- **Amazon ECR** for image registry
- **AWS App Runner** for serverless container hosting
- **GitHub Actions** for continuous deployment (optional)

All deployment infrastructure and automation scripts have been created.

## 📁 Files Created

| File | Purpose | Use Case |
|------|---------|----------|
| `Dockerfile` | Build the Docker image | Run once locally or in CI/CD |
| `.dockerignore` | Exclude files from Docker | Automatically used by Docker |
| `DEPLOYMENT_GUIDE.md` | Step-by-step manual guide | Detailed walkthrough of all steps |
| `DEPLOYMENT_QUICK_REFERENCE.md` | Command reference & troubleshooting | Quick lookup for commands |
| `deploy.sh` | Bash deployment script | Linux/Mac users - automated setup |
| `deploy.ps1` | PowerShell deployment script | Windows users - automated setup |
| `.github/workflows/deploy.yml` | CI/CD pipeline | Automatic deployment on git push |
| `.github/GITHUB_ACTIONS_SETUP.md` | GitHub Actions configuration | Setup GitHub secrets & workflow |

## 🚀 Quick Start

### Option 1: Automated Deployment (Recommended)

**Windows (PowerShell):**
```powershell
cd c:\Users\user\Downloads\Apex1\Apex1.2
.\deploy.ps1
```

**Linux/Mac (Bash):**
```bash
cd /path/to/Apex1.2
chmod +x deploy.sh
./deploy.sh
```

The script will:
1. ✓ Create ECR repository if needed
2. ✓ Build Docker image
3. ✓ Push to ECR
4. ✓ Create IAM role
5. ✓ Create App Runner service
6. ✓ Return your service URL

### Option 2: Manual Step-by-Step

See `DEPLOYMENT_GUIDE.md` for detailed instructions covering:
- Creating ECR repository
- Building & pushing Docker image
- Setting up IAM roles
- Configuring App Runner
- Adding environment variables
- Verifying deployment

## ⚙️ Prerequisites

Before you deploy, ensure you have:

1. **AWS Account** with permissions for:
   - ECR (create/push repositories)
   - App Runner (create/deploy services)
   - IAM (create roles)

2. **Region**: Configured for **US-EAST-1**
   - ECR Repository: `us-east-1`
   - App Runner Service: `us-east-1`

3. **AWS CLI** installed:
   ```bash
   # Install AWS CLI v2
   # Windows: https://awscli.amazonaws.com/AWSCLIV2.msi
   # Mac: brew install awscli
   # Linux: https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2-linux.html
   
   # Configure credentials
   aws configure
   ```

3. **Docker Desktop** installed:
   - Windows/Mac: https://www.docker.com/products/docker-desktop
   - Linux: `sudo apt-get install docker.io`

4. **Your AWS Credentials Ready:**
   - AWS Access Key ID
   - AWS Secret Access Key
   - AWS Account ID (12-digit number)

5. **Application Secrets:**
   - Supabase URL & Keys
   - S3 bucket credentials
   - Frontend domain (for CORS)

## 🔧 Environment Variables Required

Once deployed, you must add these to App Runner in AWS Console:

| Variable | Example Value |
|----------|---------------|
| `SUPABASE_URL` | `https://abcdef123456.supabase.co` |
| `SUPABASE_KEY` | Your Supabase anon key |
| `SUPABASE_ADMIN_KEY` | Your Supabase service key |
| `AWS_ACCESS_KEY_ID` | Your AWS access key |
| `AWS_SECRET_ACCESS_KEY` | Your AWS secret key |
| `S3_BUCKET_NAME` | `intermediate-apex-bucket` |
| `S3_REGION` | `af-south-1` |
| `CORS_ORIGINS` | `https://your-frontend.com` |

## 🔑 Security Checklist

Before deploying to production:

- [ ] Secrets are in AWS Secrets Manager (not hardcoded)
- [ ] IAM role has minimal required permissions
- [ ] CORS_ORIGINS set to specific domain (not wildcard)
- [ ] ECR image scanning enabled
- [ ] CloudWatch logs configured
- [ ] Service uses HTTPS (App Runner default)
- [ ] Encryption enabled for data in transit
- [ ] Database backups configured (Supabase)

## 📊 What You're Getting

| Component | Benefit |
|-----------|---------|
| **Serverless** | No servers to manage, auto-scaling |
| **Container-based** | Same environment everywhere (dev/prod) |
| **Auto-scaling** | Handles traffic spikes automatically |
| **Health checks** | Service restarts if unhealthy |
| **Monitoring** | CloudWatch logs & metrics |
| **HTTPS** | Free SSL/TLS certificates |
| **VPC options** | Private DB connection option |

## 💰 Cost Estimate

- **App Runner**: ~$47/month (0.065/hour × 730 hours)
- **ECR Storage**: ~$1-5/month (depends on image size)
- **CloudWatch Logs**: ~$0.50/month
- **S3**: Already configured separately
- **Supabase DB**: Already configured separately

**Total: ~$50-60/month** (can reduce by pausing when not in use)

## 🔄 Deployment Options

### Option A: Manual - One-Time Setup
Best for: Initial deployment
1. Run deployment script
2. Configure environment variables manually
3. Test and monitor

### Option B: GitHub Actions - Continuous Deployment
Best for: Automatic updates on code changes
1. Add GitHub secrets (AWS credentials)
2. Push code to `main` branch
3. Workflow automatically deploys
4. Monitor in GitHub Actions tab

See `.github/GITHUB_ACTIONS_SETUP.md` for detailed GitHub Actions setup.

### Option C: Manual CLI - Maximum Control
Best for: DevOps teams with specific requirements
See `DEPLOYMENT_GUIDE.md` for step-by-step CLI commands.

## ✅ Verification Checklist

After deployment completes:

```bash
# 1. Get your service URL (from deploy script output or AWS Console)
SERVICE_URL="https://abc123def456.us-east-1.apprunner.aws"

# 2. Test health endpoint
curl $SERVICE_URL/health
# Expected response: {"status":"ok","api":"ok","database":"ok","s3":"ok"}

# 3. Test API endpoint
curl $SERVICE_URL/api/documents
# Expected response: JSON array of documents

# 4. Update frontend URL
# Edit frontend/.env:
# REACT_APP_API_URL=$SERVICE_URL/api
```

## 📚 Documentation

| Document | Contains |
|----------|----------|
| `DEPLOYMENT_GUIDE.md` | Complete manual setup guide with 10 steps |
| `DEPLOYMENT_QUICK_REFERENCE.md` | Common commands, troubleshooting, cost info |
| `API_ENDPOINTS.md` | All 17 API endpoints documented |
| `.github/GITHUB_ACTIONS_SETUP.md` | GitHub Actions CI/CD configuration |

## 🐛 Troubleshooting

### Service won't start
→ Check CloudWatch logs: https://console.aws.amazon.com/logs

### CORS errors
→ Update `CORS_ORIGINS` env var and restart service

### S3 access denied
→ Verify IAM role S3 permissions and credentials

### High costs?
→ Pause service when not in use: `aws apprunner pause-service`

See `DEPLOYMENT_QUICK_REFERENCE.md` for detailed troubleshooting.

## 📞 Common Commands

```bash
# View service details
aws apprunner describe-service --service-arn $SERVICE_ARN --region us-east-1

# Stream logs in real-time
aws logs tail /aws/apprunner/apex-backend/default_platform --follow

# Start new deployment
aws apprunner start-deployment --service-arn $SERVICE_ARN --region us-east-1

# Pause service (save money)
aws apprunner pause-service --service-arn $SERVICE_ARN --region us-east-1

# Resume service
aws apprunner resume-service --service-arn $SERVICE_ARN --region us-east-1

# Delete service
aws apprunner delete-service --service-arn $SERVICE_ARN --region us-east-1
```

## 🎯 Next Steps

1. **Gather your credentials:**
   - AWS Access Key ID & Secret Key
   - AWS Account ID
   - Supabase URL & Keys
   - Frontend domain URL

2. **Deploy backend:**
   - Run `./deploy.ps1` (Windows) or `./deploy.sh` (Linux/Mac)
   - Or follow step-by-step in `DEPLOYMENT_GUIDE.md`

3. **Configure environment:**
   - After service URL is provided, add all env vars in App Runner Configuration

4. **Update frontend:**
   - Set `REACT_APP_API_URL` to your service URL
   - Deploy frontend to your hosting

5. **Test everything:**
   - Call `/health` endpoint
   - Upload documents via UI
   - Verify S3 storage & database

6. **Optional - Setup CI/CD:**
   - Follow `.github/GITHUB_ACTIONS_SETUP.md`
   - Add GitHub secrets
   - Future pushes automatically deploy

## 📞 Support

If you encounter issues:

1. Check `DEPLOYMENT_QUICK_REFERENCE.md` troubleshooting section
2. Review CloudWatch logs in AWS Console
3. Verify all environment variables are set correctly
4. Ensure AWS credentials have correct permissions
5. Test Docker image locally: `docker run apex-backend:latest`

---

**Status:** ✅ All deployment infrastructure created and committed to GitHub

**Next Action:** Run deployment script and follow prompts!
