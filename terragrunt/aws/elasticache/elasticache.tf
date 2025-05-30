resource "aws_elasticache_replication_group" "cra_upd_elasticache_replication_group" {
  engine                     = "valkey"
  engine_version             = "7.2"
  port                       = 6379
  replication_group_id       = "cra-upd-elasticache-rep-group"
  description                = "UPD Elasticache Replication Group"
  parameter_group_name       = aws_elasticache_parameter_group.cra_upd_elasticache_param_group.name
  node_type                  = var.elasticache_node_type
  num_cache_clusters         = 1
  cluster_mode               = "disabled"
  at_rest_encryption_enabled = false
  transit_encryption_enabled = false
  subnet_group_name          = aws_elasticache_subnet_group.cra_upd_elasticache_subnet_group.name
  security_group_ids         = [aws_security_group.cra_upd_elasticache_sg.id]
  apply_immediately          = true

  lifecycle {
    ignore_changes = [num_cache_clusters]
  }
}

resource "aws_elasticache_subnet_group" "cra_upd_elasticache_subnet_group" {
  name       = "cra-upd-elasticache-subnet-group"
  subnet_ids = var.vpc_private_subnet_ids
}

resource "aws_elasticache_parameter_group" "cra_upd_elasticache_param_group" {
  name   = "cra-upd-elasticache-param-group"
  family = "valkey7"

  parameter {
    name  = "maxmemory-policy"
    value = "noeviction"
  }
}
