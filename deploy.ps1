# Apex Backend Deployment Script (Windows PowerShell) - v2
# Simplified and reliable version for AWS ECR and App Runner deployment

param([string]$AccountId = "")

if ([string]::IsNullOrWhiteSpace($AccountId)) {
    $AccountId = Read-Host "Enter AWS Account ID"
}

$AWS_REGION = "us-east-1"
$ECR_REPO = "apex-backend"
$ECR_URI = "$AccountId.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO"
$SERVICE_NAME = "apex-backend"

Write-Host "▶ Starting Apex Backend Deployment" -ForegroundColor Green
Write-Host "  Account: $AccountId"
Write-Host "  Region: $AWS_REGION"
Write-Host "  ECR URI: $ECR_URI"
Write-Host ""

try {
    # Step 1: Build Docker image
    Write-Host "▶ Building Docker image..." -ForegroundColor Green
    docker build -t $ECR_REPO`:latest .
    if ($LASTEXITCODE -ne 0) {
        throw "Docker build failed"
    }
    Write-Host "  ✓ Build successful" -ForegroundColor Gray
    
    # Step 2: ECR Login
    Write-Host "▶ Authenticating with ECR..." -ForegroundColor Green
    $ecr_pass = aws ecr get-login-password --region $AWS_REGION 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to get ECR password"
    }
    $ecr_pass | docker login --username AWS --password-stdin $ECR_URI 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "Docker ECR login failed"
    }
    Write-Host "  ✓ Authenticated" -ForegroundColor Gray
    
    # Step 3: Tag Image
    Write-Host "▶ Tagging Docker image..." -ForegroundColor Green
    $tag = Get-Date -Format "yyyyMMdd-HHmmss"
    docker tag $ECR_REPO`:latest $ECR_URI`:latest
    docker tag $ECR_REPO`:latest $ECR_URI`:$tag
    Write-Host "  ✓ Tagged as latest and $tag" -ForegroundColor Gray
    
    # Step 4: Push to ECR
    Write-Host "▶ Pushing image to ECR..." -ForegroundColor Green
    docker push $ECR_URI`:latest 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "Docker push failed"
    }
    Write-Host "  ✓ Pushed $ECR_URI`:latest" -ForegroundColor Gray
    
    # Step 5: Update/Create App Runner Service
    Write-Host "▶ Checking App Runner service..." -ForegroundColor Green
    
    $svc = aws apprunner list-services --region $AWS_REGION --query "ServiceSummaryList[?ServiceName=='$SERVICE_NAME'].ServiceArn" --output text 2>$null
    
    if ([string]::IsNullOrWhiteSpace($svc)) {
        Write-Host "  Creating new service (may take 2-5 minutes)..." -ForegroundColor Yellow
        $json = aws apprunner create-service `
            --service-name $SERVICE_NAME `
            --source-configuration "{`"ImageRepository`":{`"RepositoryType`":`"ECR`",`"ImageIdentifier`":`"$ECR_URI`:latest`",`"ImageConfiguration`":{`"Port`":`"8000`"}}}" `
            --instance-configuration "{`"InstanceRoleArn`":`"arn:aws:iam::$AccountId`:role/AppRunnerApexBackendRole`"}" `
            --region $AWS_REGION 2>$null
        
        if ($LASTEXITCODE -eq 0) {
            Start-Sleep -Seconds 2
            $svc = aws apprunner list-services --region $AWS_REGION --query "ServiceSummaryList[?ServiceName=='$SERVICE_NAME'].ServiceArn" --output text
        } else {
            throw "Service creation failed"
        }
    } else {
        Write-Host "  Updating existing service..." -ForegroundColor Yellow
        aws apprunner update-service `
            --service-arn $svc `
            --source-configuration "{`"ImageRepository`":{`"RepositoryType`":`"ECR`",`"ImageIdentifier`":`"$ECR_URI`:latest`"}}" `
            --region $AWS_REGION 2>$null | Out-Null
    }
    
    Write-Host "  ✓ Service ready: $svc" -ForegroundColor Gray
    
    # Step 6: Get Service URL
    Write-Host "▶ Fetching service details..." -ForegroundColor Green
    $details = aws apprunner describe-service --service-arn $svc --region $AWS_REGION --output json 2>$null | ConvertFrom-Json
    $url = $details.Service.ServiceUrl
    $status = $details.Service.Status
    
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║          DEPLOYMENT SUCCESSFUL             ║" -ForegroundColor Cyan
    Write-Host "╚════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host "Service URL:      $url"
    Write-Host "Status:           $status"
    Write-Host "Region:           $AWS_REGION"
    Write-Host "ECR Image:        $ECR_URI`:latest"
    Write-Host ""
    Write-Host "NEXT STEPS:" -ForegroundColor Yellow
    Write-Host "  1. Go to: https://console.aws.amazon.com/apprunner"
    Write-Host "  2. Find service: $SERVICE_NAME"
    Write-Host "  3. Configuration → Add Environment Variables:"
    Write-Host "     - SUPABASE_URL"
    Write-Host "     - SUPABASE_KEY"
    Write-Host "     - SUPABASE_ADMIN_KEY"
    Write-Host "     - AWS_ACCESS_KEY_ID"
    Write-Host "     - AWS_SECRET_ACCESS_KEY"
    Write-Host "     - S3_BUCKET_NAME"
    Write-Host "     - S3_REGION"
    Write-Host "     - CORS_ORIGINS"
    Write-Host "  4. Test health: Invoke-WebRequest '$url/health'"
    Write-Host "  5. Update frontend .env with API_URL: $url/api"

} catch {
    Write-Host "✗ Error: $_" -ForegroundColor Red
    exit 1
}
