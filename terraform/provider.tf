# =============================================================================
# terraform/provider.tf
#
# AWS provider configuration and Terraform version constraints.
#
# Remote state (optional, recommended for teams):
#   Uncomment the backend block and replace the bucket/key with your values.
#   Run `terraform init` again after enabling the backend.
# =============================================================================

terraform {
  required_version = ">= 1.7.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50"
    }
  }

  # ---------------------------------------------------------------------------
  # Optional: S3 remote backend for shared state + locking
  # ---------------------------------------------------------------------------
  # backend "s3" {
  #   bucket         = "your-terraform-state-bucket-name"
  #   key            = "campus-marketplace/prod/terraform.tfstate"
  #   region         = "ap-south-1"
  #   dynamodb_table = "terraform-state-lock"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}
