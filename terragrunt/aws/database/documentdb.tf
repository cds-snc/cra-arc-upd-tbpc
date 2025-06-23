#
# Terraform code to create an Amazon DocumentDB cluster 
#

data "aws_ssm_parameter" "docdb_username" {
  name = "DOCDB_USERNAME"
}

data "aws_ssm_parameter" "docdb_password" {
  name = "DOCDB_PASSWORD"
}

module "cra_upd_documentdb" {
  source = "github.com/cds-snc/terraform-modules//DocumentDB?ref=v10.4.4"

  database_name          = "upd"
  billing_code           = var.billing_code
  master_username        = data.aws_ssm_parameter.docdb_username.value
  master_password        = data.aws_ssm_parameter.docdb_password.value
  subnet_ids             = var.vpc_private_subnet_ids
  vpc_security_group_ids = [aws_security_group.cra_upd_docdb_sg.id]
  storage_encrypted      = true
  instance_class         = var.docdb_instance_class
  cluster_family         = "docdb5.0"
  cluster_size           = var.docdb_instance_count
  deletion_protection    = true
  backup_window          = var.docdb_backup_window
  storage_type           = var.docdb_storage_type

  parameters = [
    {
      apply_method = "pending-reboot"
      name         = "tls"
      value        = "enabled"
    },
    {
      name  = "default_collection_compression"
      value = "enabled"
    },
    {
      name  = "profiler"
      value = "disabled" # most queries will be considered "slow operations", so we'll disable this
    },
    {
      name  = "ttl_monitor"
      value = "disabled" # we won't be using TTL indexes, so we'll disable this to save on compute
    }
  ]
}