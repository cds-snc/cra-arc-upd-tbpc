resource "aws_security_group" "cra_upd_ecs_sg" {
  description = "ECS Security Group for CRA UPD"
  vpc_id      = var.vpc_id
  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group_rule" "cra_upd_sg_rule_ingress_lb_to_ecs" {
  type                     = "ingress"
  description              = "Allow ingress from load balancer to ECS on port 9000"
  from_port                = 9000
  to_port                  = 9000
  protocol                 = "tcp"
  security_group_id        = aws_security_group.cra_upd_ecs_sg.id
  source_security_group_id = aws_security_group.cra_upd_loadbalancer_sg.id
}

resource "aws_security_group" "cra_upd_loadbalancer_sg" {
  description = "LoadBalancer Security Group for CRA UPD"
  name        = "cra-upd-loadbalancer-sg"
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

resource "aws_security_group_rule" "cra_upd_sg_rule_ingress_ecs_to_lb" {
  type                     = "ingress"
  description              = "Allow ingress from ECS to load balancer on port 9000"
  from_port                = 9000
  to_port                  = 9000
  protocol                 = "tcp"
  security_group_id        = aws_security_group.cra_upd_loadbalancer_sg.id
  source_security_group_id = aws_security_group.cra_upd_ecs_sg.id
}

resource "aws_security_group_rule" "cra_upd_sg_rule_egress_lb_to_ecs" {
  type                     = "egress"
  description              = "Allow egress from load balancer to ECS on port 9000"
  from_port                = 9000
  to_port                  = 9000
  protocol                 = "tcp"
  security_group_id        = aws_security_group.cra_upd_loadbalancer_sg.id
  source_security_group_id = aws_security_group.cra_upd_ecs_sg.id
}