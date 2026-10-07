# Ansible — EC2 Configuration and Deployment

Implemented in **Phase 9**.

## Ansible Responsibilities

Ansible configures EC2 and deploys containers ONLY.
It does NOT provision AWS infrastructure (Terraform owns that).

## Deployment Flow

```
1.  Configure Docker, Docker Compose, and AWS CLI on EC2.
2.  Copy production Compose and monitoring configuration.
3.  Write the protected production .env file and authenticate to ECR.
4.  Start/update shared database and monitoring services.
5.  Deploy GREEN on 127.0.0.1:3002 while BLUE continues serving on :3000.
6.  Verify GREEN locally, then deploy the same image to BLUE on :3000.
7.  Verify BLUE before stopping GREEN; on GREEN failure, leave BLUE running.
```

The GREEN host port is bound to loopback and is not exposed in the EC2
security group. The stable production endpoint remains port 3000; promotion
updates the BLUE service after GREEN passes its health check.

## Idempotency

The playbook can be rerun safely. MongoDB data is stored in a named volume and
is shared by both application slots. Deploying GREEN does not recreate BLUE;
the old GREEN container is stopped only after BLUE passes its post-promotion
health check.

## File Structure

```
ansible/
├── playbook.yml
├── inventory/
│   └── hosts.ini  (generated during CI/CD; ignored by Git)
├── roles/
│   ├── common/
│   └── deploy/
```
