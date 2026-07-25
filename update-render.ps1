# PowerShell script to update Render service configuration
param(
    [Parameter(Mandatory=$true)]
    [string]$ApiKey,
    [Parameter(Mandatory=$true)]
    [string]$ServiceId,
    [Parameter(Mandatory=$true)]
    [string]$DatabaseUrl,
    [Parameter(Mandatory=$true)]
    [string]$JwtSecret,
    [Parameter(Mandatory=$true)]
    [string]$CookieSecret
)

$headers = @{
    "Accept" = "application/json"
    "Authorization" = "Bearer $ApiKey"
    "Content-Type" = "application/json"
}

Write-Host "=== Step 1: Update Environment Variables ===" -ForegroundColor Cyan

$envVars = @(
    @{ key = "DATABASE_URL"; value = $DatabaseUrl }
    @{ key = "JWT_SECRET"; value = $JwtSecret }
    @{ key = "COOKIE_SECRET"; value = $CookieSecret }
    @{ key = "PORT"; value = "5000" }
) | ConvertTo-Json

Write-Host "Sending env vars payload..."
$envResult = Invoke-RestMethod -Uri "https://api.render.com/v1/services/$ServiceId/env-vars" -Method Put -Headers $headers -Body $envVars
Write-Host "Env vars updated successfully!" -ForegroundColor Green

Write-Host "`n=== Step 2: Verify Environment Variables ===" -ForegroundColor Cyan
$envCheck = Invoke-RestMethod -Uri "https://api.render.com/v1/services/$ServiceId/env-vars" -Method Get -Headers $headers
$envCheck | ConvertTo-Json -Depth 3
Write-Host "`n"

Write-Host "=== Step 3: Update Service Configuration (Build/Start Command) ===" -ForegroundColor Cyan

# First get the current service to get required fields
Write-Host "Fetching current service details..."
$service = Invoke-RestMethod -Uri "https://api.render.com/v1/services/$ServiceId" -Method Get -Headers $headers
Write-Host "Current buildCommand: $($service.serviceDetails.envSpecificDetails.buildCommand)"
Write-Host "Current startCommand: $($service.serviceDetails.envSpecificDetails.startCommand)"
Write-Host "Current healthCheckPath: '$($service.serviceDetails.healthCheckPath)'"

# Create update payload based on what Render API expects
$updatePayload = @{
    serviceDetails = @{
        envSpecificDetails = @{
            buildCommand = "npm install"
            startCommand = "node server.js"
        }
        healthCheckPath = "/api/health"
    }
} | ConvertTo-Json -Depth 10

Write-Host "`nSending service update payload..."
try {
    $updateResult = Invoke-RestMethod -Uri "https://api.render.com/v1/services/$ServiceId" -Method Patch -Headers $headers -Body $updatePayload
    Write-Host "Service updated successfully!" -ForegroundColor Green
} catch {
    Write-Host "PATCH failed with: $($_.Exception.Message)" -ForegroundColor Yellow
    
    # Try PUT instead
    Write-Host "Trying PUT method..." -ForegroundColor Yellow
    try {
        $updateResult = Invoke-RestMethod -Uri "https://api.render.com/v1/services/$ServiceId" -Method Put -Headers $headers -Body $updatePayload
        Write-Host "Service updated via PUT!" -ForegroundColor Green
    } catch {
        Write-Host "PUT also failed: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "Will need to update settings manually in Dashboard." -ForegroundColor Yellow
    }
}

Write-Host "`n=== Step 4: Trigger Deploy ===" -ForegroundColor Cyan
try {
    $deployResult = Invoke-RestMethod -Uri "https://api.render.com/v1/services/$ServiceId/deploys" -Method Post -Headers $headers
    Write-Host "Deploy triggered! Deploy ID: $($deployResult.deploy.id)" -ForegroundColor Green
} catch {
    Write-Host "Failed to trigger deploy: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nDone!" -ForegroundColor Green
