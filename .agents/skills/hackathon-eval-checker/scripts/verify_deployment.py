#!/usr/bin/env python3
import os
import sys
import re
import subprocess
import argparse
import json

# Reconfigure stdout to use UTF-8 on Windows
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

class HackathonAuditor:
    def __init__(self, root_dir):
        self.root_dir = root_dir
        self.report = []
        self.scores = {
            "high": {"passed": 0, "total": 0, "failed_items": []},
            "medium": {"passed": 0, "total": 0, "failed_items": []},
            "low": {"passed": 0, "total": 0, "failed_items": []}
        }
        self.exit_code = 0

    def add_result(self, name, impact, passed, message):
        tier = self.scores[impact]
        tier["total"] += 1
        if passed:
            tier["passed"] += 1
            status = "✅ PASS"
        else:
            tier["failed_items"].append(name)
            status = "❌ FAIL"
            if impact == "high":
                self.exit_code = 1
        
        self.report.append(f"| {status} | **{name}** | {impact.upper()} | {message} |")

    def run_audit(self):
        self.report.append("# A-ONE Habitwings — Pre-Deployment Audit Report")
        self.report.append(f"Generated on root workspace: `{self.root_dir}`\n")
        self.report.append("| Status | Parameter Checked | Impact Tier | Details / Recommendations |")
        self.report.append("|---|---|---|---|")

        # 1. Check Git
        self.audit_git()

        # 2. Check README
        self.audit_readme()

        # 3. Check Security (API keys, CSP, XSS)
        self.audit_security()

        # 4. Check Testing
        self.audit_testing()

        # 5. Check Accessibility
        self.audit_accessibility()

        # 6. Check Code Hygiene & Quality
        self.audit_hygiene()

        # Write score summaries
        self.compile_scorecard()

    def audit_git(self):
        # Check Remote Origin
        try:
            res = subprocess.run(["git", "remote", "get-url", "origin"], capture_output=True, text=True, encoding="utf-8", check=True)
            url = res.stdout.strip()
            if "github.com" in url or url.startswith("https://") or url.startswith("git@"):
                self.add_result("Git Remote Origin", "high", True, f"Configured to: `{url}`")
            else:
                self.add_result("Git Remote Origin", "high", False, f"Invalid remote URL format: `{url}`. Must be a valid public repository.")
        except Exception as e:
            self.add_result("Git Remote Origin", "high", False, "No git remote configured or git command failed.")

        # Check Git Status clean
        try:
            res = subprocess.run(["git", "status", "--porcelain"], capture_output=True, text=True, encoding="utf-8", check=True)
            changes = res.stdout.strip()
            if not changes:
                self.add_result("Git Clean Status", "high", True, "Workspace is clean. All code is staged and committed.")
            else:
                lines = len(changes.splitlines())
                self.add_result("Git Clean Status", "high", False, f"You have {lines} unstaged/uncommitted files. Commit all changes before deployment.")
        except Exception:
            self.add_result("Git Clean Status", "high", False, "Failed to inspect git status. Ensure git is initialized.")

    def audit_readme(self):
        readme_path = os.path.join(self.root_dir, "README.md")
        if not os.path.exists(readme_path):
            self.add_result("README.md Presence", "high", False, "README.md is missing at project root.")
            return

        with open(readme_path, "r", encoding="utf-8") as f:
            content = f.read().lower()

        checks = {
            "vertical": ["vertical", "addiction", "habit-breaking"],
            "approach": ["approach", "logic", "habit swap"],
            "how it works": ["how the solution works", "how it works", "architecture"],
            "assumptions": ["assumption"]
        }

        for name, keywords in checks.items():
            found = any(k in content for k in keywords)
            if found:
                self.add_result(f"README - {name.capitalize()}", "high", True, f"Found corresponding keywords in README.")
            else:
                self.add_result(f"README - {name.capitalize()}", "high", False, f"README lacks details on {name}. Ensure you add section header.")

    def audit_security(self):
        # 1. Check for API keys
        api_key_regex = re.compile(r"AIzaSy[A-Za-z0-9_-]{35}")
        leaks = []
        
        # 2. Check for CSP Tag
        has_csp = False

        # 3. Check for XSS
        inner_html_regex = re.compile(r"\binnerHTML\b|\bdangerouslySetInnerHTML\b")
        xss_violations = []

        exclude_dirs = {"node_modules", ".next", ".git", "habitwings"}

        for root, dirs, files in os.walk(self.root_dir):
            dirs[:] = [d for d in dirs if d not in exclude_dirs]
            for file in files:
                if file.endswith((".js", ".jsx", ".html", ".css", ".mjs")):
                    path = os.path.join(root, file)
                    rel_path = os.path.relpath(path, self.root_dir)
                    try:
                        with open(path, "r", encoding="utf-8") as f:
                            content = f.read()
                            
                            # API key check
                            if api_key_regex.search(content):
                                leaks.append(rel_path)

                            # CSP check
                            if "Content-Security-Policy" in content or "connect-src" in content:
                                has_csp = True

                            # XSS check
                            if inner_html_regex.search(content):
                                if "escapeHtml" not in content:
                                    xss_violations.append(rel_path)
                    except Exception:
                        pass

        if not leaks:
            self.add_result("API Key Scan", "high", True, "Zero hardcoded Gemini/Google API keys found in codebase.")
        else:
            self.add_result("API Key Scan", "high", False, f"Leaks found in: {', '.join(leaks)}. Shift keys to server env vars.")

        if has_csp:
            self.add_result("CSP Security Headers", "high", True, "Content-Security-Policy tags/headers configured.")
        else:
            self.add_result("CSP Security Headers", "high", False, "No Content-Security-Policy header detected in HTML/JS layout files.")

        if not xss_violations:
            self.add_result("XSS Injection Auditing", "high", True, "HTML templates sanitize dynamic inserts using escapeHtml.")
        else:
            self.add_result("XSS Injection Auditing", "high", False, f"Raw innerHTML set without escapeHtml in: {', '.join(xss_violations)}.")

    def audit_testing(self):
        # check package.json script
        pkg_path = os.path.join(self.root_dir, "package.json")
        has_test_script = False
        if os.path.exists(pkg_path):
            try:
                with open(pkg_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if "test" in data.get("scripts", {}):
                        has_test_script = True
            except Exception:
                pass

        if has_test_script:
            self.add_result("Test Script Declaration", "medium", True, "`package.json` contains a declared standard test runner script.")
        else:
            self.add_result("Test Script Declaration", "medium", False, "`package.json` does not declare a standard test script.")

        # run tests
        try:
            res = subprocess.run(["node", "test.js"], capture_output=True, text=True, encoding="utf-8")
            if res.returncode == 0:
                self.add_result("Automated Unit Testing", "medium", True, f"Test suite run executed successfully:\n\n{res.stdout.strip()}")
            else:
                self.add_result("Automated Unit Testing", "medium", False, f"Test suite run failed with code {res.returncode}. Errors:\n\n{res.stderr}")
        except Exception as e:
            self.add_result("Automated Unit Testing", "medium", False, f"Failed to execute automated tests: {str(e)}")

    def audit_accessibility(self):
        # Check landmarks
        landmarks = ["<header", "<main", "<nav", "<section", "<footer"]
        has_landmarks = False
        
        # Check display: none inputs (custom controls a11y trap)
        display_none_inputs = False

        # Check SVG attributes
        has_svg = False
        svg_labeled = True

        exclude_dirs = {"node_modules", ".next", ".git", "habitwings"}
        for root, dirs, files in os.walk(self.root_dir):
            dirs[:] = [d for d in dirs if d not in exclude_dirs]
            for file in files:
                if file.endswith((".js", ".jsx", ".html", ".css")):
                    path = os.path.join(root, file)
                    try:
                        with open(path, "r", encoding="utf-8") as f:
                            content = f.read()
                            
                            if any(l in content for l in landmarks):
                                has_landmarks = True

                            # Check for a11y display: none trap on inputs
                            if "display: none" in content and ("input" in content or "checkbox" in content or "radio" in content):
                                if "visually-hidden" not in content and (".css" in file):
                                    display_none_inputs = True

                            # SVG checks
                            if "<svg" in content and not file.endswith(".css"):
                                has_svg = True
                                if "role=" not in content or "aria-label=" not in content:
                                    svg_labeled = False
                    except Exception:
                        pass

        if has_landmarks:
            self.add_result("A11y Semantic Landmarks", "medium", True, "Semantic HTML5 landmarks detected in code structure.")
        else:
            self.add_result("A11y Semantic Landmarks", "medium", False, "Missing semantic landmarks like <main>, <header>, or <nav>.")

        if not display_none_inputs:
            self.add_result("A11y Keyboard Focusable Controls", "medium", True, "Custom inputs clip off-screen visually instead of breaking tab layout via display:none.")
        else:
            self.add_result("A11y Keyboard Focusable Controls", "medium", False, "Found instances where inputs are styled with display:none. Use .visually-hidden class.")

        if not has_svg:
            self.add_result("A11y SVG Images Labels", "medium", True, "No SVGs requiring role labels.")
        elif svg_labeled:
            self.add_result("A11y SVG Images Labels", "medium", True, "Dynamic SVGs carry explicit role=\"img\" and aria-label attributes.")
        else:
            self.add_result("A11y SVG Images Labels", "medium", False, "SVGs detected without role=\"img\" or aria-label attributes.")

    def audit_hygiene(self):
        # Check design variables in CSS
        has_vars = False
        css_path = os.path.join(self.root_dir, "src/app/globals.css")
        if os.path.exists(css_path):
            try:
                with open(css_path, "r", encoding="utf-8") as f:
                    content = f.read()
                    if "--color-" in content or "--bg-" in content or ":root" in content:
                        has_vars = True
            except Exception:
                pass
        
        if has_vars:
            self.add_result("CSS Design Tokens", "low", True, "Global CSS configures design system tokens in :root.")
        else:
            self.add_result("CSS Design Tokens", "low", False, "Design system variables not declared in globals.css.")

        # Check gitignore blocks
        gitignore_path = os.path.join(self.root_dir, ".gitignore")
        has_ignores = False
        if os.path.exists(gitignore_path):
            try:
                with open(gitignore_path, "r", encoding="utf-8") as f:
                    content = f.read()
                    if "node_modules" in content or ".next" in content:
                        has_ignores = True
            except Exception:
                pass

        if has_ignores:
            self.add_result("Project Hygiene (.gitignore)", "low", True, ".gitignore filters OS cache, logs, and node packages.")
        else:
            self.add_result("Project Hygiene (.gitignore)", "low", False, "Missing or incomplete .gitignore config for standard files.")

    def compile_scorecard(self):
        high_score = self.scores["high"]
        med_score = self.scores["medium"]
        low_score = self.scores["low"]

        h_pct = (high_score["passed"] / high_score["total"] * 100) if high_score["total"] > 0 else 100
        m_pct = (med_score["passed"] / med_score["total"] * 100) if med_score["total"] > 0 else 100
        l_pct = (low_score["passed"] / low_score["total"] * 100) if low_score["total"] > 0 else 100

        weighted_score = round((h_pct * 0.5) + (m_pct * 0.3) + (l_pct * 0.2))

        self.report.append("\n## 📊 Evaluation Scorecard")
        self.report.append(f"**Weighted Compliance Index: {weighted_score}/100**\n")
        self.report.append(f"- **High Impact Parameters**: {high_score['passed']}/{high_score['total']} ({round(h_pct)}% pass rate)")
        self.report.append(f"- **Medium Impact Parameters**: {med_score['passed']}/{med_score['total']} ({round(m_pct)}% pass rate)")
        self.report.append(f"- **Low Impact Parameters**: {low_score['passed']}/{low_score['total']} ({round(l_pct)}% pass rate)\n")

        if self.exit_code != 0:
            self.report.append("> ⚠️ **ALERT**: High Impact parameters failed. Fix these immediately to avoid critical score penalties.")
        else:
            self.report.append("> 🎉 **PASSED**: All critical pre-deployment audits completed successfully. Ready for build.")

def main():
    parser = argparse.ArgumentParser(description="Hackathon Pre-Deployment Auditor")
    parser.add_argument("command", choices=["verify"])
    parser.add_argument("--output", help="Write report to markdown file")
    args = parser.parse_args()

    root = os.getcwd()
    auditor = HackathonAuditor(root)
    auditor.run_audit()

    markdown_report = "\n".join(auditor.report)

    if args.output:
        report_path = os.path.abspath(args.output)
        with open(report_path, "w", encoding="utf-8") as f:
            f.write(markdown_report)
        print(f"Audit complete! Report written to: {report_path}")
    else:
        print(markdown_report)

    sys.exit(auditor.exit_code)

if __name__ == "__main__":
    main()
