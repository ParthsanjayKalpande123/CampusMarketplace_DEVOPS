# Terraform — AWS Infrastructure

Implemented in **Phase 8**.

## Terraform Responsibilities

Terraform provisions AWS infrastructure ONLY.
It does NOT install software, deploy application code, or configure containers.

## Resources to be Provisioned

```
AWS Account
  └── VPC (10.0.0.0/16)
        └── Public Subnet (10.0.1.0/24)
              ├── Internet Gateway
              ├── Route Table (0.0.0.0/0 → IGW)
              ├── Security Group
              │     ├── Inbound: TCP 22  (SSH — restricted)
              │     ├── Inbound: TCP 80  (HTTP)
              │     └── Outbound: All
              └── EC2 Instance
                    └── IAM Instance Profile (ECR ReadOnly)

ECR Repository: campus-marketplace
```

## Planned Module Structure

```
terraform/
├── main.tf
├── variables.tf
├── outputs.tf
├── versions.tf
└── modules/
    ├── vpc/
    ├── security/
    ├── ec2/
    ├── iam/
    └── ecr/
```

## Outputs Used by Ansible
- EC2 public IP (for Ansible inventory)
- ECR repository URL (for Docker push/pull)
