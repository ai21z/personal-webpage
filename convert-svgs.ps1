# SVG to PNG Converter Script
# Converts massive SVG files to optimized PNGs

Write-Output "🎨 SVG to PNG Converter"
Write-Output "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Output ""

$svgFiles = Get-ChildItem "artifacts/projects/*.svg"
$outputSize = 400 # 400x400 for 2x retina display (displays at 200x200)

foreach ($svg in $svgFiles) {
    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($svg.Name)
    $pngPath = "artifacts/projects/$baseName.png"
    
    Write-Output "📄 Processing: $($svg.Name)"
    Write-Output "   Size: $([math]::Round($svg.Length/1MB, 2)) MB"
    Write-Output ""
    
    # Method 1: Using Chrome/Edge (manual)
    Write-Output "   ⚠️  MANUAL CONVERSION NEEDED:"
    Write-Output "   1. Open: $($svg.FullName)"
    Write-Output "   2. Take screenshot/export at ${outputSize}x${outputSize}px"
    Write-Output "   3. Save as: $pngPath"
    Write-Output ""
}

Write-Output ""
Write-Output "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Output "🎯 ALTERNATIVE: Online Conversion"
Write-Output "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Output ""
Write-Output "1. Go to: https://cloudconvert.com/svg-to-png"
Write-Output "2. Upload all 3 SVG files"
Write-Output "3. Set width: 400px (maintain aspect ratio)"
Write-Output "4. Download PNG files"
Write-Output "5. Place in: artifacts/projects/"
Write-Output ""
Write-Output "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Output "📊 After Conversion, Run This:"
Write-Output "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Output ""
Write-Output '   Get-ChildItem "artifacts/projects/*.png" | Select-Object Name, @{N="KB";E={[math]::Round($_.Length/1KB,2)}}'
Write-Output ""
Write-Output "Expected: 50-80KB per file (vs 2000-3000KB)"
Write-Output ""
