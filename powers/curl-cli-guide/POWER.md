---
name: 'curl-cli-guide'
displayName: 'cURL CLI Guide'
description: 'Complete guide for using cURL command-line tool for HTTP requests, file transfers, and API testing.'
keywords: ['curl', 'http', 'api', 'cli', 'requests']
author: 'Kiro Assistant'
---

# cURL CLI Guide

## Overview

cURL is a powerful command-line tool for transferring data with URLs. It supports numerous protocols including HTTP, HTTPS, FTP, and more. This guide covers the most common use cases for web development and API testing.

Whether you're testing APIs, downloading files, or debugging HTTP requests, cURL provides a flexible and reliable solution that works across all platforms.

## Onboarding

### Installation

#### macOS (via Homebrew)

```bash
brew install curl
```

#### Ubuntu/Debian

```bash
sudo apt-get update
sudo apt-get install curl
```

#### Windows

cURL comes pre-installed on Windows 10+ or download from: https://curl.se/download.html

### Prerequisites

- No special requirements - cURL works out of the box
- For HTTPS requests, ensure your system has updated certificates

### Verification

```bash
# Verify installation
curl --version

# Expected output:
curl 7.x.x (platform) libcurl/7.x.x ...
```

## Common Workflows

### Workflow: Basic HTTP GET Request

**Goal:** Retrieve data from a web API or webpage

**Commands:**

```bash
# Simple GET request
curl https://api.example.com/users

# GET with headers
curl -H "Accept: application/json" https://api.example.com/users

# Save response to file
curl -o response.json https://api.example.com/users
```

**Complete Example:**

```bash
# Test a public API
curl -H "Accept: application/json" https://jsonplaceholder.typicode.com/posts/1

# Expected response:
{
  "userId": 1,
  "id": 1,
  "title": "sunt aut facere repellat provident occaecati excepturi optio reprehenderit",
  "body": "quia et suscipit..."
}
```

### Workflow: POST Request with Data

**Goal:** Send data to an API endpoint

**Commands:**

```bash
# POST with JSON data
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"title":"New Post","body":"Content here"}' \
  https://api.example.com/posts

# POST with form data
curl -X POST \
  -d "name=John&email=john@example.com" \
  https://api.example.com/users
```

**Complete Example:**

```bash
# Create a new post via API
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Post","body":"This is a test","userId":1}' \
  https://jsonplaceholder.typicode.com/posts
```

### Workflow: File Download

**Goal:** Download files from the internet

**Commands:**

```bash
# Download file with original name
curl -O https://example.com/file.zip

# Download with custom name
curl -o myfile.zip https://example.com/file.zip

# Resume interrupted download
curl -C - -O https://example.com/largefile.zip
```

## Command Reference

### Basic Options

| Flag | Description               | Example                                        |
| ---- | ------------------------- | ---------------------------------------------- |
| `-X` | HTTP method               | `curl -X POST url`                             |
| `-H` | Add header                | `curl -H "Content-Type: application/json" url` |
| `-d` | Send data                 | `curl -d "key=value" url`                      |
| `-o` | Output to file            | `curl -o file.txt url`                         |
| `-O` | Save with remote name     | `curl -O url/file.txt`                         |
| `-v` | Verbose output            | `curl -v url`                                  |
| `-s` | Silent mode               | `curl -s url`                                  |
| `-i` | Include headers in output | `curl -i url`                                  |

### Authentication Options

| Flag | Description       | Example                                     |
| ---- | ----------------- | ------------------------------------------- |
| `-u` | Basic auth        | `curl -u username:password url`             |
| `-H` | Bearer token      | `curl -H "Authorization: Bearer token" url` |
| `-k` | Ignore SSL errors | `curl -k https://url`                       |

## Troubleshooting

### Error: "curl: command not found"

**Cause:** cURL not installed or not in PATH
**Solution:**

1. Install cURL using your package manager
2. Verify installation: `which curl`
3. Restart terminal

### Error: "SSL certificate problem"

**Cause:** Invalid or expired SSL certificate
**Solution:**

1. Update system certificates: `brew update && brew upgrade curl` (macOS)
2. Use `-k` flag to ignore SSL (not recommended for production)
3. Verify the website's SSL certificate is valid

### Error: "Connection refused"

**Cause:** Server not responding or wrong URL
**Solution:**

1. Verify the URL is correct
2. Check if server is running: `ping hostname`
3. Try with verbose flag: `curl -v url`

### Slow Downloads

**Cause:** Network issues or server limitations
**Solution:**

1. Use resume flag for large files: `curl -C - -O url`
2. Limit bandwidth: `curl --limit-rate 200k url`
3. Try different time: `curl --connect-timeout 30 url`

## Best Practices

- Always use HTTPS when possible for secure data transfer
- Include appropriate headers (Content-Type, Accept) for API requests
- Use `-v` flag for debugging connection issues
- Save responses to files for large data sets
- Use authentication headers instead of URL parameters for sensitive data
- Test with public APIs before using with production endpoints

## Additional Resources

- Official Documentation: https://curl.se/docs/
- Manual Page: `man curl`
- HTTP Status Codes: https://httpstatuses.com/
- JSON Testing API: https://jsonplaceholder.typicode.com/

---

**CLI Tool:** `curl`
**Installation:** Available on most systems or via package managers
