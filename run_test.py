import subprocess, sys, os

os.chdir(r"C:\Users\admin\Desktop\Stroke detection project")
sys.path.insert(0, ".")
sys.path.insert(0, "./backend")

result = subprocess.run(
    [sys.executable, "tests/test_server_e2e.py"],
    capture_output=True,
    text=True,
    cwd=r"C:\Users\admin\Desktop\Stroke detection project",
)

with open("backend/test_output.txt", "w") as f:
    f.write("=== STDOUT ===\n")
    f.write(result.stdout)
    f.write("\n=== STDERR ===\n")
    f.write(result.stderr)
    f.write(f"\n=== EXIT CODE: {result.returncode} ===\n")
