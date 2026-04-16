# run-all.ps1
Write-Host "Starting all microservices..." -ForegroundColor Green

# Start services in separate background jobs or windows
Start-Process "npm" -ArgumentList "run dev:gateway" -WindowStyle Normal -NoNewWindow
Start-Process "npm" -ArgumentList "run dev:users" -WindowStyle Normal -NoNewWindow
Start-Process "npm" -ArgumentList "run dev:orders" -WindowStyle Normal -NoNewWindow
Start-Process "npm" -ArgumentList "run dev:payments" -WindowStyle Normal -NoNewWindow
Start-Process "npm" -ArgumentList "run dev:inventory" -WindowStyle Normal -NoNewWindow
Start-Process "npm" -ArgumentList "run dev:notifications" -WindowStyle Normal -NoNewWindow

Write-Host "All services started in the background. Use Ctrl+C to stop the terminal session." -ForegroundColor Yellow
