@echo off
cd /d "C:\Users\admin\Desktop\Stroke detection project"
python tests\test_server_e2e.py > backend\test_output.txt 2> backend\test_error.txt
echo Exit code: %ERRORLEVEL% >> backend\test_output.txt
