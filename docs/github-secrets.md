# =============================================================================
# docs/github-secrets.md
#
# GitHub Actions Secrets Setup Guide
#
# Required before cd.yml can deploy to AWS.
# Go to: GitHub repo → Settings → Secrets and variables → Actions → New secret
# =============================================================================

# GitHub Actions Secrets — Setup Guide

All secrets below must be added to your GitHub repository before the CD
pipeline can run successfully.

**Path:** `Settings → Secrets and variables → Actions → New repository secret`

## AWS Credentials

| Secret Name              | How to get it | Example |
|--------------------------|---------------|---------|
| `AWS_ACCESS_KEY_ID`      | IAM → Users → your-ci-user → Security credentials | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY`  | IAM (same page, create access key) | `wJalrXUtnFEMI/K7MDENG/...` |
| `AWS_REGION`             | The region you chose in Terraform | `ap-south-1` |

> **Least-privilege IAM policy for the CI user:**
> Attach an inline policy that allows:
> - `ecr:GetAuthorizationToken`
> - `ecr:BatchCheckLayerAvailability`
> - `ecr:GetDownloadUrlForLayer`
> - `ecr:PutImage`
> - `ecr:InitiateLayerUpload`
> - `ecr:UploadLayerPart`
> - `ecr:CompleteLayerUpload`

## EC2 Access

| Secret Name  | How to get it |
|--------------|---------------|
| `EC2_HOST`   | `terraform output ec2_public_ip` |
| `EC2_SSH_KEY`| Contents of the `.pem` file for `var.ec2_key_pair_name`. Copy the full file including `-----BEGIN RSA PRIVATE KEY-----` |

## ECR

| Secret Name      | How to get it |
|------------------|---------------|
| `ECR_REPOSITORY` | `terraform output ecr_repository_name` |

> `ECR_REGISTRY` is derived automatically inside the CD workflow from the
> ECR login step output — **no secret needed**.

## Application

| Secret Name          | Description |
|----------------------|-------------|
| `JWT_SECRET`         | Random 64+ character string. Generate: `openssl rand -hex 32` |
| `MONGODB_URI`        | `mongodb://mongodb:27017/campus_marketplace` (internal Docker network) |
| `CORS_ORIGIN`        | Your domain, e.g. `https://campus.example.com` or the EC2 IP |
| `MONGO_ROOT_PASSWORD`| Strong password for MongoDB root user. Generate: `openssl rand -hex 24` |

## Quick Setup Commands

```bash
# 1. Apply Terraform
cd terraform
terraform init
terraform apply

# 2. Capture outputs
EC2_IP=$(terraform output -raw ec2_public_ip)
ECR_REPO=$(terraform output -raw ecr_repository_name)

echo "EC2_HOST:       $EC2_IP"
echo "ECR_REPOSITORY: $ECR_REPO"

# 3. Generate secrets
echo "JWT_SECRET: $(openssl rand -hex 32)"
echo "MONGO_ROOT_PASSWORD: $(openssl rand -hex 24)"

# 4. Add all secrets to GitHub via CLI
gh secret set AWS_ACCESS_KEY_ID
gh secret set AWS_SECRET_ACCESS_KEY
gh secret set AWS_REGION         --body "ap-south-1"
gh secret set EC2_HOST           --body "$EC2_IP"
gh secret set EC2_SSH_KEY        < ~/.ssh/your-key.pem
gh secret set ECR_REPOSITORY     --body "$ECR_REPO"
gh secret set JWT_SECRET
gh secret set MONGODB_URI        --body "mongodb://mongodb:27017/campus_marketplace"
gh secret set CORS_ORIGIN
gh secret set MONGO_ROOT_PASSWORD
```

## Verifying the Pipeline

After pushing to `main`:

1. Go to **Actions** tab in GitHub.
2. The **CI** workflow should pass first (green check on the test job).
3. The **CD** workflow runs: `test → build-push → deploy`.
4. After deployment, the `deploy` job curl-checks:
   `http://<EC2_HOST>:3000/api/v1/health` — must return `200 OK`.
