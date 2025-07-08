resource "aws_security_group" "cra_upd_loadbalancer_sg" {
  name        = "cra-upd-loadbalancer-sg"
  description = "LoadBalancer Security Group for CRA UPD"
  vpc_id      = var.vpc_id
}

resource "aws_security_group_rule" "cra_upd_sg_rule_ingress_vpc_to_lb" {
  type              = "ingress"
  description       = "Allow ingress from VPC on port 80"
  from_port         = 80
  to_port           = 80
  protocol          = "tcp"
  cidr_blocks       = [var.vpc_cidr_block]
  security_group_id = aws_security_group.cra_upd_loadbalancer_sg.id
}

resource "aws_security_group_rule" "cra_upd_sg_rule_ingress_sg_to_lb" {
  type                     = "ingress"
  description              = "Allow ingress from security group to load balancer on port 9000"
  from_port                = 9000
  to_port                  = 9000
  protocol                 = "tcp"
  security_group_id        = aws_security_group.cra_upd_loadbalancer_sg.id
  source_security_group_id = aws_security_group.cra_upd_loadbalancer_egress_sg.id
}

resource "aws_security_group_rule" "cra_upd_sg_rule_egress_lb_to_sg" {
  type                     = "egress"
  description              = "Allow egress from load balancer to security group on port 9000"
  from_port                = 9000
  to_port                  = 9000
  protocol                 = "tcp"
  security_group_id        = aws_security_group.cra_upd_loadbalancer_sg.id
  source_security_group_id = aws_security_group.cra_upd_loadbalancer_egress_sg.id
}


resource "aws_security_group" "cra_upd_loadbalancer_egress_sg" {
  name        = "cra-upd-loadbalancer-egress-sg"
  description = "Allow egress to the application load balancer"
  vpc_id      = var.vpc_id
}
