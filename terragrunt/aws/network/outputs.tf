output "vpc_id" {
  description = "The CRA UPD VPC id"
  value       = module.cra_upd_vpc.vpc_id
}

output "vpc_private_subnet_ids" {
  description = "List of the CRA UPD app VPC private subnet ids"
  value       = module.cra_upd_vpc.private_subnet_ids
}

output "vpc_public_subnet_ids" {
  description = "List of the CRA UPD app VPC public subnet ids"
  value       = module.cra_upd_vpc.public_subnet_ids
}

output "vpc_cidr_block" {
  description = "List of cidr block ips for the CRA UPD VPC"
  value       = module.cra_upd_vpc.cidr_block
}