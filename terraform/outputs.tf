# =============================================================================
# terraform/outputs.tf
#
# Values exposed after `terraform apply` for use by:
#   - Ansible (EC2 public IP → inventory)
#   - GitHub Actions (ECR URL → docker push)
#   - Documentation / README
# =============================================================================

output "ec2_public_ip" {
  description = "Elastic IP (public IPv4) of the application server. Use this in your Ansible inventory and DNS records."
  value       = aws_eip.app.public_ip
}

output "ec2_instance_id" {
  description = "EC2 instance ID."
  value       = aws_instance.app.id
}

output "ecr_repository_url" {
  description = "Full ECR repository URL (registry/repository). Use in docker build -t and docker push."
  value       = aws_ecr_repository.app.repository_url
}

output "ecr_registry" {
  description = "ECR registry hostname only (without repository name). Use as ECR_REGISTRY in GitHub Actions."
  value       = split("/", aws_ecr_repository.app.repository_url)[0]
}

output "ecr_repository_name" {
  description = "ECR repository name. Use as ECR_REPOSITORY in GitHub Actions."
  value       = aws_ecr_repository.app.name
}

output "aws_region" {
  description = "AWS region where resources were deployed."
  value       = var.aws_region
}

output "security_group_id" {
  description = "Application security group ID."
  value       = aws_security_group.app.id
}

output "iam_role_arn" {
  description = "IAM role ARN attached to the EC2 instance."
  value       = aws_iam_role.ec2.arn
}

# ---------------------------------------------------------------------------
# Convenience output — copy this block to GitHub Secrets
# ---------------------------------------------------------------------------

output "github_secrets_summary" {
  description = "Values to set as GitHub Actions secrets. Treat as sensitive."
  sensitive   = true
  value = {
    EC2_HOST        = aws_eip.app.public_ip
    ECR_REGISTRY    = split("/", aws_ecr_repository.app.repository_url)[0]
    ECR_REPOSITORY  = aws_ecr_repository.app.name
    AWS_REGION      = var.aws_region
  }
}
