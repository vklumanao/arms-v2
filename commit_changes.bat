@echo off
setlocal enabledelayedexpansion
for /f "tokens=*" %%f in ('git status --porcelain') do (
    set "line=%%f"
    set "status=!line:~0,2!"
    set "file=!line:~3!"
    set "file=!file:"=!"
    if "!status!"=="??" (
        echo Adding !file!
        git add "!file!"
        git commit -m "feat: add !file!"
    ) else if "!status!"==" M" (
        echo Updating !file!
        git add "!file!"
        git commit -m "feat: update !file!"
    ) else if "!status!"=="MM" (
        echo Updating !file!
        git add "!file!"
        git commit -m "feat: update !file!"
    ) else if "!status!"=="AM" (
        echo Updating !file!
        git add "!file!"
        git commit -m "feat: update !file!"
    ) else if "!status!"==" D" (
        echo Removing !file!
        git rm "!file!"
        git commit -m "feat: remove !file!"
    ) else if "!status!"=="AD" (
        echo Removing !file!
        git rm "!file!"
        git commit -m "feat: remove !file!"
    ) else if "!status!"=="MD" (
        echo Removing !file!
        git rm "!file!"
        git commit -m "feat: remove !file!"
    )
)
endlocal