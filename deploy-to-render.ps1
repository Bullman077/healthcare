# UHS Healthcare - Deploy Backend to Render (Terminal Only)
# Usage: .\deploy-to-render.ps1 -ApiKey "YOUR_RENDER_API_KEY"

param(
    [Parameter(Mandatory=$true)]
    [string]$ApiKey
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Deploying UHS Backend to Render" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. Get DATABASE_URL
$dbUrl = Read-Host -Prompt "Enter your Aiven PostgreSQL DATABASE_URL"
$adminEmail = Read-Host -Prompt "Enter admin email"
$adminPw = Read-Host -Prompt "Enter admin password (min 8 chars)" -AsSecureString
$adminPwPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($adminPw))

# 2. Generate secure secrets
$jwtSecret = -join ((48..57) + (97..102) | Get-Random -Count 64 | % {[char]$_})
$cookieSecret = -join ((48..57) + (97..102) | Get-Random -Count 64 | % {[char]$_})
Write-Host "[OK] Generated JWT_SECRET and COOKIE_SECRET" -ForegroundColor Green

# 3. Build JSON payload using PowerShell objects (no string interpolation issues)
$payload = @{
    type = "web_service"
    name = "uhs-backend"
    runtime = "node"
    region = "oregon"
    plan = "free"
    ownerId = "tea-d9hnrpt7vvec73eppv30"
    repo = "https://github.com/Bullman077/healthcare"
    branch = "master"
    rootDir = "backend"
    buildCommand = "npm install"
    startCommand = "node server.js"
    healthCheckPath = "/api/health"
    envVars = @(
        @{ key = "NODE_ENV"; value = "production" }
        @{ key = "PORT"; value = "5000" }
        @{ key = "TRUST_PROXY"; value = "1" }
        @{ key = "FRONTEND_URL"; value = "https://uhs-healthcare-ea3b4.web.app" }
        @{ key = "DATABASE_URL"; value = $dbUrl }
        @{ key = "JWT_SECRET"; value = $jwtSecret }
        @{ key = "COOKIE_SECRET"; value = $cookieSecret }
        @{ key = "ADMIN_EMAIL"; value = $adminEmail }
        @{ key = "ADMIN_PASSWORD"; value = $adminPwPlain }
    )
}

# 4. Convert to JSON and write to file
$jsonString = $payload | ConvertTo-Json -Depth 10 -Compress

# Debug: show the JSON
Write-Host "[DEBUG] Payload JSON:" -ForegroundColor Gray
Write-Host $jsonString.Substring(0, [Math]::Min(300, $jsonString.Length)) -ForegroundColor Gray

$tempFile = Join-Path $env:TEMP "render_deploy.json"
$jsonString | Out-File -FilePath $tempFile -Encoding UTF8 -Force

Write-Host "[..] Sending request to Render API..." -ForegroundColor Yellow

# 5. Call Render API - use Invoke-RestMethod for better JSON handling
try {
    $headers = @{
        "Accept" = "application/json"
        "Authorization" = "Bearer $ApiKey"
    }
    
    $response = Invoke-RestMethod -Uri "https://api.render.com/v1/services" `
        -Method Post `
        -Headers $headers `
        -ContentType "application/json" `
        -Body $jsonString `
        -ErrorAction Stop

    Write-Host "[OK] Service created successfully!" -ForegroundColor Green
    Write-Host "Service ID: $($response.id)" -ForegroundColor Cyan
    
    Write-Host "[INFO] Your backend will be available at:" -ForegroundColor Yellow
    Write-Host "   https://uhs-backend.onrender.com" -ForegroundColor White
    Write-Host "   https://uhs-backend.onrender.com/api/health" -ForegroundColor White
    Write-Host ""
    Write-Host "[!!] IMPORTANT: Save these secrets now (they won't be shown again!):" -ForegroundColor Red
    Write-Host "   JWT_SECRET:    $jwtSecret" -ForegroundColor Yellow
    Write-Host "   COOKIE_SECRET: $cookieSecret" -ForegroundColor Yellow
}
catch {
    Write-Host "[XX] Error!" -ForegroundColor Red
    
    # Try to get more details from the error
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $errorBody = $reader.ReadToEnd() | ConvertFrom-Json
        Write-Host "Error message: $($errorBody.message)" -ForegroundColor Red
        if ($errorBody.details) {
            Write-Host "Details: $($errorBody.details)" -ForegroundColor Yellow
        }
    }
    else {
        Write-Host "$($_.Exception.Message)" -ForegroundColor Red
    }
}
finally {
    if (Test-Path $tempFile) {
        Remove-Item $tempFile -Force
    }
}
