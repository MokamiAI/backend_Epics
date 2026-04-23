# GitHub Actions Setup for Automatic Deployment

This workflow automatically deploys your backend to AWS App Runner whenever you push to `main` or `master` branch.

## Setup Instructions

### 1. Add GitHub Secrets

Go to your GitHub repository:
1. Navigate to **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret** and add these secrets:

| Secret Name | Value | Where to Find |
|-------------|-------|----------------|
| `AWS_ACCOUNT_ID` | Your 12-digit AWS Account ID | AWS Console → Account ID (top-right) |
| `AWS_ACCESS_KEY_ID` | Your AWS Access Key ID | AWS IAM → Users → Your User → Security Credentials |
| `AWS_SECRET_ACCESS_KEY` | Your AWS Secret Access Key | AWS IAM → Users → Your User → Security Credentials |

**⚠️ Security Note:** 
- Keep these credentials secure
- Use an IAM user with minimal permissions (ECR + App Runner only)
- Rotate keys regularly
- Never commit secrets to git

### 2. Create Limited IAM User (Recommended)

```bash
# Create user
aws iam create-user --user-name github-actions-apex

# Attach ECR policy
aws iam attach-user-policy \
  --user-name github-actions-apex \
  --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPowerUser

# Attach App Runner policy
aws iam put-user-policy \
  --user-name github-actions-apex \
  --policy-name AppRunnerDeployPolicy \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": [
          "apprunner:StartDeployment",
          "apprunner:DescribeService",
          "apprunner:ListServices"
        ],
        "Resource": "arn:aws:apprunner:*:ACCOUNT_ID:service/apex-backend/*"
      }
    ]
  }'

# Create access key
aws iam create-access-key --user-name github-actions-apex
```

### 3. Test the Workflow

1. Make a small change to `backend/` files
2. Commit and push to `main` or `master`
3. Go to **Actions** tab in GitHub to watch the deployment
4. Check the logs - green checkmark = success ✓

### 4. Manual Workflow Trigger

You can also manually trigger deployment without code changes:

```bash
# Via GitHub CLI
gh workflow run deploy.yml

# Via GitHub UI
1. Go to Actions tab
2. Click "Deploy Backend to App Runner" workflow
3. Click "Run workflow"
```

## Workflow Details

**What happens on each push:**

1. ✓ Code is checked out
2. ✓ AWS credentials are configured
3. ✓ Docker image is built
4. ✓ Image is pushed to ECR with:
   - Git commit SHA as tag (`abc123def456...`)
   - `latest` tag
5. ✓ App Runner deployment is triggered
6. ✓ Workflow waits for deployment to complete (up to 10 minutes)
7. ✓ Health check is performed (`/health` endpoint)
8. ✓ Success/failure notification

**Files that trigger deployment:**
- Changes to `backend/`
- Changes to `Dockerfile`
- Changes to `.github/workflows/deploy.yml`

You can modify the `paths` section in `.github/workflows/deploy.yml` to trigger on different files.

## Troubleshooting

### Workflow fails with "AWS credentials not found"
- ✓ Verify secrets are added to repository
- ✓ Check secret names match exactly (case-sensitive)
- ✓ Ensure AWS credentials are still valid

### Workflow fails with "Service not found"
- ✓ Verify service name is `apex-backend`
- ✓ Check IAM user has `apprunner:DescribeService` permission
- ✓ Ensure service exists in AWS Console

### Deployment times out
- ✓ Check App Runner service logs in AWS Console
- ✓ May need to increase timeout in workflow (currently 10 minutes)
- ✓ Verify Docker image size isn't too large (should be < 500MB)

### Health check fails
- ✓ Verify your `/health` endpoint returns 200 OK
- ✓ Wait a bit longer - container may still be starting
- ✓ Check service logs for startup errors

## Environment Variables

The workflow doesn't set environment variables automatically. You need to:

1. Go to AWS Console
2. Open App Runner → your service
3. Configuration → Environment variables
4. Add all required variables:
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
   - `SUPABASE_ADMIN_KEY`
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `S3_BUCKET_NAME`
   - `S3_REGION`
   - `CORS_ORIGINS`

## Customization

**Run on different branch:**
```yaml
on:
  push:
    branches: [ develop, staging, production ]
```

**Add notifications (Slack example):**
```yaml
    - name: Send Slack notification
      uses: slackapi/slack-github-action@v1
      if: always()
      with:
        payload: |
          {
            "text": "Deployment ${{ job.status }}",
            "deployment_url": "${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
          }
```

**Full workflow documentation:**
See `.github/workflows/deploy.yml` for complete configuration details.
