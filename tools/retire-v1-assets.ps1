$ErrorActionPreference = 'Stop'
$gameRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$rootPrefix = $gameRoot.TrimEnd('\') + '\'
$v2Ids = @('rosenberg2', 'jaemillz', 'mook', 'cassidy', 'ttop', 'msfit', 'lucastro', 'trufoe', 'kshine', 'nitty', 'dizaster', 'ave')
$oldPages = @{
  jaemillz = @('anim_low.jpg', 'anim_round.jpg', 'anim_upper.jpg', 'style_low.jpg', 'style_round.jpg', 'style_upper.jpg', 'story_grab.jpg', 'story_run.jpg', 'story_pick.jpg')
  mook = @('anim_low.jpg', 'anim_round.jpg', 'anim_upper.jpg')
  cassidy = @('sheet_3.jpg', 'sheet_6.jpg', 'sheet_7.jpg', 'anim_kick_a.jpg', 'anim_kick_b.jpg', 'anim_low.jpg', 'anim_round.jpg', 'anim_upper.jpg', 'style_kick_a.jpg', 'style_kick_b.jpg', 'style_low.jpg', 'style_round.jpg')
  msfit = @('anim_low.jpg', 'anim_round.jpg', 'anim_upper.jpg', 'style_low.jpg', 'style_round.jpg', 'style_upper.jpg')
  lucastro = @('anim_low.jpg', 'anim_round.jpg', 'anim_upper.jpg', 'style_low.jpg', 'style_round.jpg', 'style_upper.jpg')
  trufoe = @('sheet_5.jpg', 'sheet_6.jpg', 'sheet_7.jpg', 'cine_super.jpg')
  ave = @('cine_super.jpg')
}
$targets = [System.Collections.Generic.List[string]]::new()
foreach ($id in $v2Ids) {
  $hdDir = Join-Path $gameRoot "sprites-hd\$id"
  if (Test-Path -LiteralPath $hdDir) {
    foreach ($file in Get-ChildItem -LiteralPath $hdDir -File -Filter 'sheet_*.jpg') { $targets.Add($file.FullName) }
  }
  $spriteDir = Join-Path $gameRoot "sprites\$id"
  foreach ($name in @('grab16.webp', 'held16.webp', 'grabx.webp') + @($oldPages[$id])) {
    if ($name) { $targets.Add((Join-Path $spriteDir $name)) }
  }
  if (Test-Path -LiteralPath $spriteDir) {
    foreach ($file in Get-ChildItem -LiteralPath $spriteDir -File) {
      if ($file.BaseName -like 'style8*' -or $file.BaseName -like 'anim8*' -or $file.BaseName -like 'p_*') { $targets.Add($file.FullName) }
    }
  }
}
$removed = 0
foreach ($target in ($targets | Select-Object -Unique)) {
  $full = [System.IO.Path]::GetFullPath($target)
  if (-not $full.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) { throw "Refusing to delete outside game root: $full" }
  if (Test-Path -LiteralPath $full -PathType Leaf) { Remove-Item -LiteralPath $full -Force; $removed++ }
}
Write-Output "Retired $removed stale V1 sprite files from $gameRoot"
