output "elasticache_endpoint" {
  description = "ElastiCache Endpoint for CRA UPD"
  value       = aws_elasticache_replication_group.cra_upd_elasticache_replication_group.primary_endpoint_address
  sensitive   = true
}

output "elasticache_egress_sg_id" {
  description = "ID of the security group to allow egress to ElastiCache"
  value       = aws_security_group.cra_upd_elasticache_egress_sg.id
}
