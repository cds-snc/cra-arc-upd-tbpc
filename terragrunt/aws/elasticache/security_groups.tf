resource "aws_security_group" "cra_upd_elasticache_sg" {
  description = "ElastiCache Security Group"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Allow ingress from ECS to ElastiCache"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.cra_upd_elasticache_egress_sg.id]
  }
}
resource "aws_security_group" "cra_upd_elasticache_egress_sg" {
  description = "Allow egress to ElastiCache"
  vpc_id      = var.vpc_id
}