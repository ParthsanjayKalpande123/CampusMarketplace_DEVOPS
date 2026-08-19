# =============================================================================
# terraform/ecr.tf
#
# Amazon ECR repository for the Campus Marketplace Docker image.
# Includes a lifecycle policy to prevent unbounded image accumulation.
# =============================================================================

resource "aws_ecr_repository" "app" {
  name                 = var.project_name
  image_tag_mutability = "MUTABLE"    # Allows re-tagging :latest

  # Scan every pushed image for known CVEs (free with ECR)
  image_scanning_configuration {
    scan_on_push = true
  }

  # Encrypt images at rest using the AWS-managed KMS key
  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = {
    Name = var.project_name
  }
}

# ---------------------------------------------------------------------------
# Lifecycle policy — keep only the N most recent images
# Prevents storage costs from accumulating across many deploys
# ---------------------------------------------------------------------------

resource "aws_ecr_lifecycle_policy" "app" {
  repository = aws_ecr_repository.app.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Expire untagged images older than 1 day"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 1
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "Keep only the ${var.ecr_image_retention_count} most recent tagged images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = var.ecr_image_retention_count
        }
        action = { type = "expire" }
      }
    ]
  })
}
