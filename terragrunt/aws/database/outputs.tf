output "docdb_cluster_id" {
  description = "The document db cluster id"
  value       = module.cra_upd_documentdb.docdb_cluster_id
}

output "docdb_cluster_arn" {
  description = "The document db cluster arn"
  value       = module.cra_upd_documentdb.docdb_cluster_arn
}

output "docdb_endpoint" {
  description = "The document db cluster endpoint"
  value       = module.cra_upd_documentdb.docdb_endpoint
  sensitive   = true
}

output "docdb_sg_id" {
  description = "The security group id of the document db database"
  value       = aws_security_group.cra_upd_docdb_sg.id
}

output "docdb_egress_sg_id" {
  description = "ID of the security group to allow egress to DocumentDB"
  value       = aws_security_group.cra_upd_docdb_egress_sg.id
}