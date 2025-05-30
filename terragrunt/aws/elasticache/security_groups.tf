resource "aws_security_group" "cra_upd_elasticache_sg" {
  name        = "cra-upd-elasticache-sg"
  description = "ElastiCache Security Group"
  vpc_id      = var.vpc_id

  ingress {
    description = "Allow ingress from the VPC to ElastiCache"
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr_block]
  }
}
resource "aws_security_group" "cra_upd_elasticache_egress_sg" {
  name        = "cra-upd-elasticache-egress-sg"
  description = "Allow egress to ElastiCache"
  vpc_id      = var.vpc_id

  egress {
    description     = "Allow egress to ElastiCache"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.cra_upd_elasticache_sg.id]
  }
}
