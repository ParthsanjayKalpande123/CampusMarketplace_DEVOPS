# =============================================================================
# terraform/variables.tf
#
# All configurable input variables for the Campus Marketplace infrastructure.
# Provide values via terraform.tfvars (never commit secrets) or -var flags.
# =============================================================================

variable "aws_region" {
  description = "AWS region to deploy all resources."
  type        = string
  default     = "ap-south-1"   # Asia Pacific (Mumbai)
}

variable "project_name" {
  description = "Short name used as a prefix for all AWS resource names."
  type        = string
  default     = "campus-marketplace"
}

variable "environment" {
  description = "Deployment environment label (dev | staging | prod)."
  type        = string
  default     = "prod"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be one of: dev, staging, prod."
  }
}

# ---------------------------------------------------------------------------
# Compute
# ---------------------------------------------------------------------------

variable "ec2_instance_type" {
  description = "EC2 instance type for the application server."
  type        = string
  default     = "t3.micro"    # 2 vCPU, 1 GB RAM — free-tier eligible (t2.micro)
}

variable "ec2_key_pair_name" {
  description = "Name of the existing EC2 Key Pair to attach for SSH access."
  type        = string
  # No default — must be provided in terraform.tfvars or via -var
}

variable "ec2_root_volume_size_gb" {
  description = "Size of the EC2 root EBS volume in GB."
  type        = number
  default     = 20
}

# ---------------------------------------------------------------------------
# Networking
# ---------------------------------------------------------------------------

variable "allowed_ssh_cidr" {
  description = "CIDR block allowed to connect on port 22 (SSH). Restrict to your IP in production."
  type        = string
  default     = "0.0.0.0/0"   # IMPORTANT: lock down before deploying to prod
}

variable "app_port" {
  description = "Port that the application container listens on."
  type        = number
  default     = 3000
}

variable "admin_port" {
  description = "Port that the admin dashboard listens on."
  type        = number
  default     = 3001
}

# ---------------------------------------------------------------------------
# ECR
# ---------------------------------------------------------------------------

variable "ecr_image_retention_count" {
  description = "Number of Docker images to retain in ECR. Older images are expired."
  type        = number
  default     = 5
}
