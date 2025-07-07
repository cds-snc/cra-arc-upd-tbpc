resource "aws_security_group" "cra_upd_ecs_sg" {
  name        = "cra-upd-ecs-sg"
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
  source_security_group_id = var.loadbalancer_sg_id
}