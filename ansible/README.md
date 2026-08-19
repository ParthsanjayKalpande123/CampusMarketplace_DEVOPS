# Ansible — EC2 Configuration and Deployment

Implemented in **Phase 9**.

## Ansible Responsibilities

Ansible configures EC2 and deploys containers ONLY.
It does NOT provision AWS infrastructure (Terraform owns that).

## Planned Playbook Tasks

```
1.  Update system packages
2.  Install Docker CE
3.  Start and enable Docker service
4.  Install AWS CLI
5.  Authenticate Docker with Amazon ECR
6.  Pull campus-marketplace image from ECR
7.  Create /opt/campus-marketplace/ directory
8.  Copy .env file (from Ansible vault)
9.  Create Docker network: campus-marketplace-net
10. Start MongoDB container (with persistent volume)
11. Start campus-marketplace container
12. Verify: GET http://localhost:3000/api/v1/health
13. Verify: GET http://localhost:3000/api/v1/ready
```

## Idempotency

All tasks use idempotent Ansible modules.
Running the playbook multiple times does not restart healthy containers
or cause data loss in the MongoDB volume.

## Planned File Structure

```
ansible/
├── playbook.yml
├── inventory/
│   └── hosts.ini
├── roles/
│   ├── docker/
│   ├── ecr/
│   └── campus-marketplace/
└── vars/
    └── vault.yml   (encrypted — never committed in plaintext)
```
