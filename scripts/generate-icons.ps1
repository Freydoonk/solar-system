Add-Type -AssemblyName System.Drawing
$iconDirectory = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\public\icons'))
[System.IO.Directory]::CreateDirectory($iconDirectory) | Out-Null
foreach ($dimension in @(192, 512, 180)) {
  $bitmap = New-Object System.Drawing.Bitmap($dimension, $dimension)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#07111f'))
  $pen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml('#46657d'), ($dimension * 0.025))
  $sun = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#ffc458'))
  $planet = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#83e5bc'))
  $graphics.DrawEllipse($pen, ($dimension * 0.2), ($dimension * 0.2), ($dimension * 0.6), ($dimension * 0.6))
  $graphics.FillEllipse($sun, ($dimension * 0.39), ($dimension * 0.39), ($dimension * 0.22), ($dimension * 0.22))
  $graphics.FillEllipse($planet, ($dimension * 0.65), ($dimension * 0.24), ($dimension * 0.14), ($dimension * 0.14))
  $fileName = if ($dimension -eq 180) { 'apple-touch-icon.png' } else { 'icon-' + $dimension + '.png' }
  $bitmap.Save((Join-Path $iconDirectory $fileName), [System.Drawing.Imaging.ImageFormat]::Png)
  $pen.Dispose(); $sun.Dispose(); $planet.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}
