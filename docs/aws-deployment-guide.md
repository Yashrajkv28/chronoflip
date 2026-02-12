# AWS Deployment Guide — ChronoFlip

A detailed guide for deploying ChronoFlip (a static Vite/React SPA) on AWS using S3 + CloudFront, with a custom domain (`villdesign.com`).

---

## Architecture Overview

```
User types villdesign.com
        ↓
Browser asks DNS: "where is villdesign.com?"
        ↓
Route 53 answers: "it's at CloudFront distribution d1a2b3..."
        ↓
Browser connects to nearest CloudFront edge server
        ↓
CloudFront presents SSL certificate (from ACM) → secure HTTPS connection
        ↓
CloudFront serves files from S3 bucket (your dist/ folder)
        ↓
User sees ChronoFlip
```

### Services involved

| Service | Purpose | Cost |
|---------|---------|------|
| **S3** | Stores your static files (`dist/` folder) | ~$0.02/month |
| **CloudFront** | CDN — serves files globally over HTTPS | Free tier = 1TB transfer/month |
| **Route 53** | DNS — maps `villdesign.com` to CloudFront | $0.50/month per hosted zone |
| **ACM** | Free SSL certificates for HTTPS | Free |
| **Total** | | **~$0.50–$1/month** |

---

## Prerequisites

- **AWS Account**: Use the company/boss's account (they own billing). Ask for an **IAM user** with permissions for S3, CloudFront, Route 53, and ACM — this gives you access without exposing billing or root credentials.
- **AWS CLI** installed and configured (`aws configure` with your IAM access keys)
- **Node.js** and project dependencies installed

---

## Step 0: Build the App

```bash
npm run build    # produces dist/ folder with static HTML/CSS/JS
```

This is the folder that gets uploaded to S3. Vite bundles everything into optimized static files.

---

## Step 1: Create an S3 Bucket & Upload Files

### What is S3?

**S3 (Simple Storage Service)** is AWS's file storage. Think of it as a hard drive in the cloud. You create a "bucket" (like a folder) and put files in it. It's designed for durability — AWS guarantees 99.999999999% (eleven 9s) that your files won't be lost.

### How to set it up

1. Go to the **S3 console** → Click **Create bucket**
2. Bucket name: `chronoflip-app` (must be globally unique across all AWS users)
3. Region: Pick one close to you (e.g., `ap-south-1` for Mumbai, `us-east-1` for Virginia)
4. **Block all public access**: Leave this ON — CloudFront will access the bucket privately via Origin Access Control. The bucket does NOT need to be public.
5. Click **Create bucket**

### Upload your files

Using the AWS CLI:

```bash
aws s3 sync dist/ s3://chronoflip-app --delete
```

- `sync` uploads only changed files (efficient for updates)
- `--delete` removes files from S3 that no longer exist in `dist/` (keeps it clean)

Or use the S3 console: open the bucket → click **Upload** → drag in everything from `dist/`.

---

## Step 2: Create a CloudFront Distribution

### What is CloudFront?

**CloudFront is AWS's CDN (Content Delivery Network).** It takes your website files from S3 and copies them to **edge servers in 600+ locations around the world**. When a user in Tokyo visits your site, they get files from a server in Tokyo, not from your S3 bucket in Virginia. This makes the site **fast everywhere**.

CloudFront also:
- Handles **HTTPS** (where you attach your SSL certificate)
- **Caches** files so S3 doesn't get hit on every request
- Provides **DDoS protection** via AWS Shield (included free)

### How to set it up

1. Go to the **CloudFront console** → Click **Create distribution**

2. **Origin settings:**
   - Origin domain: Select your S3 bucket (`chronoflip-app.s3.amazonaws.com`)
   - Origin access: Choose **Origin Access Control (OAC)**
     - Click **Create new OAC** → use defaults → Create
   - This means only CloudFront can read your S3 bucket — no one can bypass the CDN

3. **Default cache behavior:**
   - Viewer protocol policy: **Redirect HTTP to HTTPS** (forces secure connections)
   - Allowed HTTP methods: **GET, HEAD** (static site only needs reads)
   - Cache policy: **CachingOptimized** (recommended)

4. **Settings:**
   - Default root object: `index.html`
   - Price class: Choose based on need (Use All Edge Locations for best performance, or Use Only North America and Europe to save cost)

5. Click **Create distribution**

6. **Important:** CloudFront will show you a **bucket policy** to copy. Go to your S3 bucket → **Permissions** → **Bucket policy** → paste it in. This grants CloudFront read access to the bucket.

### Handle SPA routing (critical for React apps)

Since ChronoFlip is a Single Page Application, all routes should serve `index.html`. CloudFront needs to know this:

1. Go to your CloudFront distribution → **Error pages** tab
2. Create custom error responses:

| HTTP Error Code | Response Page Path | HTTP Response Code |
|-----------------|--------------------|--------------------|
| 403 | `/index.html` | 200 |
| 404 | `/index.html` | 200 |

This ensures that if someone navigates directly to a route (or refreshes), they get `index.html` instead of a 404 error.

### Your CloudFront URL

After creation (takes ~5 minutes to deploy), you'll get a URL like:

```
https://d1a2b3c4d5e6f7.cloudfront.net
```

Your site is already live at this URL. The next steps are about connecting `villdesign.com` to it.

---

## Step 3: Move DNS to Route 53

### What is DNS?

When someone types `villdesign.com` in their browser, the browser doesn't know where that website lives. It asks a **DNS server**: "Hey, what's the IP address for villdesign.com?" The DNS server replies with something like `143.204.55.12`, and the browser connects to that IP.

**DNS = the phonebook of the internet.** Domain name in, IP address out.

### Where is DNS managed right now?

When your boss bought `villdesign.com`, he bought it from a **domain registrar** — GoDaddy, Namecheap, Google Domains, etc. That registrar is currently managing the DNS records for the domain. Your boss can log into that registrar and see settings like "DNS Management" or "Nameservers."

### What is Route 53?

**Route 53 is AWS's DNS service.** It does the same thing the registrar's DNS does, but it integrates seamlessly with other AWS services (CloudFront, S3, load balancers, etc.).

The name "Route 53" comes from **port 53**, which is the network port used for DNS traffic.

### Why move to Route 53?

You don't *have* to, but it makes everything easier:
- You can point `villdesign.com` directly to CloudFront with one click (Alias records)
- SSL certificate validation is one click
- Everything is in one place (AWS console)

### How to set it up

1. Go to the **Route 53 console** → **Hosted zones** → **Create hosted zone**
2. Domain name: `villdesign.com`
3. Type: **Public hosted zone**
4. Click **Create hosted zone**

Route 53 gives you **4 nameservers**, like:

```
ns-384.awsdns-48.com
ns-1033.awsdns-01.org
ns-572.awsdns-07.net
ns-1891.awsdns-44.co.uk
```

5. Go to the **registrar** where the domain was bought (e.g., GoDaddy)
6. Find the **Nameservers** setting (usually under DNS Management or Domain Settings)
7. Replace the default nameservers with the 4 AWS nameservers from above
8. Save

**What this does:** You're telling the world "for questions about villdesign.com, ask AWS (Route 53) instead of GoDaddy."

The domain is still *owned* at the registrar. You're just changing who answers DNS questions. This change can take **up to 48 hours** to propagate globally, but usually takes 15 minutes to a few hours.

---

## Step 4: Get a Free SSL Certificate from ACM

### What is SSL/TLS?

When you visit `https://` (note the **s**), the connection between your browser and the server is **encrypted**. Nobody in between (your ISP, a hacker on public WiFi) can read the traffic.

This encryption requires an **SSL certificate** — a digital document that proves "yes, this server really is villdesign.com." Without it, browsers show a scary "Not Secure" warning.

### What is AWS Certificate Manager (ACM)?

**ACM is AWS's free SSL certificate service.** It gives you SSL certificates at no cost and auto-renews them so they never expire.

Compare this to buying certificates elsewhere, which can cost $10–$100/year.

### How to set it up

1. **Important:** Switch to the **`us-east-1` (N. Virginia)** region in the AWS console. CloudFront only accepts certificates from this region, regardless of where your S3 bucket is.

2. Go to **ACM (Certificate Manager)** → **Request a certificate**

3. Certificate type: **Request a public certificate**

4. Domain names — add both:
   - `villdesign.com`
   - `*.villdesign.com` (wildcard — covers `www.villdesign.com`, `app.villdesign.com`, any subdomain)

5. Validation method: **DNS validation**

6. Click **Request**

### What is DNS validation?

ACM needs to confirm you actually own `villdesign.com`. It gives you a special CNAME record to add to your DNS. By adding a record that only the domain owner can add, you prove ownership.

It's like ACM saying: "Add this secret code to your DNS, and I'll believe you own this domain."

**If you're using Route 53:** There's literally a button that says **"Create records in Route 53"** — one click and it's done.

**If DNS is elsewhere:** Manually add the CNAME record ACM gives you at your registrar's DNS settings.

7. Wait a few minutes. ACM verifies the DNS record exists and changes the certificate status to **Issued**.

---

## Step 5: Attach Domain to CloudFront

### What does "attach" mean?

By default, your CloudFront distribution serves content at:

```
https://d1a2b3c4d5e6f7.cloudfront.net
```

That works, but you want people to visit `villdesign.com`. So you tell CloudFront: "When requests come in for villdesign.com, that's me, I should handle them."

### How to set it up

1. Go to your **CloudFront distribution** → **General** tab → **Edit settings**

2. **Alternate domain names (CNAMEs):** Add:
   - `villdesign.com`
   - `www.villdesign.com` (optional, if you want both to work)

3. **Custom SSL certificate:** Select the ACM certificate you created in Step 4. It should appear in the dropdown (make sure it's in `us-east-1` and status is "Issued").

4. Click **Save changes**

---

## Step 6: Point Domain to CloudFront via DNS

### What's happening here?

At this point:
- Route 53 manages your domain's DNS (Step 3)
- You have an SSL certificate (Step 4)
- CloudFront knows it should respond to `villdesign.com` (Step 5)

But there's a missing link: **when someone types `villdesign.com`, DNS still doesn't know to send them to CloudFront.** You need to connect the two.

### How to set it up

1. Go to **Route 53** → **Hosted zones** → **villdesign.com**

2. Click **Create record**

3. Create an **A record** for the root domain:

| Setting | Value |
|---------|-------|
| Record name | *(leave blank for root domain)* |
| Record type | **A** |
| Alias | **Yes** |
| Route traffic to | **Alias to CloudFront distribution** |
| Distribution | Select your CloudFront distribution |

4. Create another record for `www`:

| Setting | Value |
|---------|-------|
| Record name | `www` |
| Record type | **A** |
| Alias | **Yes** |
| Route traffic to | **Alias to CloudFront distribution** |
| Distribution | Select your CloudFront distribution |

### What is an A record?

An **A record** maps a domain name to an IP address. The **Alias** option is AWS-specific — instead of hardcoding an IP, it dynamically points to your CloudFront distribution (which has many IPs across the globe). AWS handles resolving to the nearest edge server automatically.

### DNS propagation

After creating these records, it may take **a few minutes to a few hours** for the changes to propagate globally. After that, `villdesign.com` will serve your ChronoFlip app over HTTPS.

---

## Deploying Updates

After the one-time setup above, deploying new versions is just two commands:

```bash
# 1. Build the app
npm run build

# 2. Upload to S3
aws s3 sync dist/ s3://chronoflip-app --delete

# 3. Invalidate CloudFront cache (so users see the new version immediately)
aws cloudfront create-invalidation --distribution-id YOUR_DISTRIBUTION_ID --paths "/*"
```

Find your distribution ID in the CloudFront console (it looks like `E1A2B3C4D5E6F7`).

### Why invalidate?

CloudFront caches your files at edge servers worldwide. Without invalidation, users might see the old version for up to 24 hours (default cache TTL). Invalidation tells all edge servers: "throw away your cached copies and fetch fresh files from S3."

The first 1,000 invalidation paths per month are free.

---

## Optional: Automate with GitHub Actions

Create `.github/workflows/deploy.yml` to auto-deploy on every push to `main`:

```yaml
name: Deploy to AWS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci
      - run: npm run build

      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - run: aws s3 sync dist/ s3://chronoflip-app --delete
      - run: aws cloudfront create-invalidation --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} --paths "/*"
```

Add `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `CLOUDFRONT_DISTRIBUTION_ID` as secrets in your GitHub repo settings.

---

## Quick Reference

### One-time setup checklist

- [ ] Create S3 bucket
- [ ] Upload `dist/` to S3
- [ ] Create CloudFront distribution with OAC → S3
- [ ] Add custom error responses (403/404 → `/index.html`)
- [ ] Create Route 53 hosted zone for `villdesign.com`
- [ ] Update nameservers at domain registrar
- [ ] Request SSL certificate in ACM (us-east-1)
- [ ] Validate certificate via DNS
- [ ] Add alternate domain + SSL cert to CloudFront
- [ ] Create A record (Alias) in Route 53 → CloudFront

### Deploy commands

```bash
npm run build
aws s3 sync dist/ s3://chronoflip-app --delete
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

### Useful AWS CLI commands

```bash
# List S3 bucket contents
aws s3 ls s3://chronoflip-app

# Check CloudFront distribution status
aws cloudfront get-distribution --id YOUR_DIST_ID --query "Distribution.Status"

# List all CloudFront distributions
aws cloudfront list-distributions --query "DistributionList.Items[*].{Id:Id,Domain:DomainName,Aliases:Aliases.Items}" --output table

# Check invalidation status
aws cloudfront get-invalidation --distribution-id YOUR_DIST_ID --id INVALIDATION_ID
```
