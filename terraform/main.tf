# =============================================================================
# terraform/main.tf
#
# Core AWS infrastructure:
#   - Default VPC + subnet lookup
#   - Security Group (SSH, HTTP, HTTPS, app port)
#   - IAM Role + Instance Profile (ECR pull permissions)
#   - EC2 instance (Amazon Linux 2023, Docker pre-installed via user_data)
#   - Elastic IP (stable public address for DNS + Ansible inventory)
# =============================================================================

# ---------------------------------------------------------------------------
# Data Sources — use the default VPC to avoid VPC creation costs
# ---------------------------------------------------------------------------

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# Latest Amazon Linux 2023 AMI (x86_64)
data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# ---------------------------------------------------------------------------
# Security Group
# ---------------------------------------------------------------------------

resource "aws_security_group" "app" {
  name        = "${var.project_name}-${var.environment}-sg"
  description = "Security group for ${var.project_name} (${var.environment})"
  vpc_id      = data.aws_vpc.default.id

  # SSH — restrict to your IP via var.allowed_ssh_cidr in production
  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.allowed_ssh_cidr]
  }

  # HTTP — for future Nginx/reverse proxy
  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTPS
  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Application port (direct access, e.g. during setup)
  ingress {
    description = "Application"
    from_port   = var.app_port
    to_port     = var.app_port
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Allow all outbound (required for: ECR pulls, apt/dnf updates, MongoDB Atlas)
  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-sg"
  }
}

# ---------------------------------------------------------------------------
# IAM — grants the EC2 instance permission to pull from ECR
#        without embedding AWS credentials on the server
# ---------------------------------------------------------------------------

resource "aws_iam_role" "ec2" {
  name = "${var.project_name}-${var.environment}-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
}

# Read-only ECR access — sufficient for `docker pull` and `ecr get-login-password`
resource "aws_iam_role_policy_attachment" "ecr_readonly" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

resource "aws_iam_instance_profile" "ec2" {
  name = "${var.project_name}-${var.environment}-ec2-profile"
  role = aws_iam_role.ec2.name
}

# ---------------------------------------------------------------------------
# EC2 Instance
# ---------------------------------------------------------------------------

resource "aws_instance" "app" {
  ami                    = data.aws_ami.amazon_linux_2023.id
  instance_type          = var.ec2_instance_type
  key_name               = var.ec2_key_pair_name
  subnet_id              = data.aws_subnets.default.ids[0]
  vpc_security_group_ids = [aws_security_group.app.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2.name

  # User data script — runs ONCE on first boot
  # Installs Docker + Compose plugin so Ansible finds them ready
  user_data = base64encode(<<-SCRIPT
    #!/bin/bash
    set -e

    # System update
    dnf update -y

    # Install Docker
    dnf install -y docker
    systemctl enable docker
    systemctl start docker
    usermod -aG docker ec2-user

    # Install Docker Compose plugin (v2)
    DOCKER_CONFIG=/usr/local/lib/docker/cli-plugins
    mkdir -p "$DOCKER_CONFIG"
    COMPOSE_URL="https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64"
    curl -fsSL "$COMPOSE_URL" -o "$DOCKER_CONFIG/docker-compose"
    chmod +x "$DOCKER_CONFIG/docker-compose"

    # Install AWS CLI v2 (for ECR login inside the instance)
    dnf install -y awscli

    # Create application directory
    mkdir -p /opt/campus-marketplace
    chown ec2-user:ec2-user /opt/campus-marketplace

    echo "Bootstrap complete" > /var/log/user-data.log
  SCRIPT
  )

  root_block_device {
    volume_size           = var.ec2_root_volume_size_gb
    volume_type           = "gp3"
    encrypted             = true
    delete_on_termination = true

    tags = {
      Name = "${var.project_name}-${var.environment}-root-volume"
    }
  }

  # Disable accidental termination in production
  disable_api_termination = var.environment == "prod" ? true : false

  tags = {
    Name = "${var.project_name}-${var.environment}-server"
  }

  lifecycle {
    # Prevent instance replacement when a newer AMI is published
    ignore_changes = [ami, user_data]
  }
}

# ---------------------------------------------------------------------------
# Elastic IP — stable public address, survives instance stop/start
# ---------------------------------------------------------------------------

resource "aws_eip" "app" {
  instance = aws_instance.app.id
  domain   = "vpc"

  tags = {
    Name = "${var.project_name}-${var.environment}-eip"
  }

  depends_on = [aws_instance.app]
}
