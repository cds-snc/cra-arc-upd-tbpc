resource "aws_security_group" "cra_upd_docdb_sg" {
  name        = "cra-upd-docdb-sg"
  description = "Ingress to DocumentDB Security Group"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Allow ingress to DocumentDB"
    from_port       = 27017
    to_port         = 27017
    protocol        = "tcp"
    security_groups = [aws_security_group.cra_upd_docdb_egress_sg.id]
  }
}

resource "aws_security_group" "cra_upd_docdb_egress_sg" {
  name        = "cra-upd-docdb-egress-sg"
  description = "Allow egress to DocumentDB"
  vpc_id      = var.vpc_id
}
